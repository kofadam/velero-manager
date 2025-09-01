package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"velero-manager/pkg/config"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// OIDCProvider holds the OIDC provider and OAuth2 configuration
type OIDCProvider struct {
	Provider      *oidc.Provider
	OAuth2Config  *oauth2.Config
	Verifier      *oidc.IDTokenVerifier
	Config        *config.OIDCConfig
	configVersion string
	configMutex   sync.RWMutex
}

// Global config version for tracking changes
var (
	globalConfigVersion string
	configVersionMutex  sync.RWMutex
)

// NewOIDCProvider creates a new OIDC provider instance
func NewOIDCProvider(oidcConfig *config.OIDCConfig) (*OIDCProvider, error) {
	if !oidcConfig.IsValid() {
		return nil, fmt.Errorf("invalid OIDC configuration")
	}

	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, oidcConfig.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %v", err)
	}

	// Configure the OAuth2 config with additional scopes for roles/groups
	oauth2Config := &oauth2.Config{
		ClientID:     oidcConfig.ClientID,
		ClientSecret: oidcConfig.ClientSecret,
		RedirectURL:  oidcConfig.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups", "roles"},
	}

	// Configure the ID token verifier
	verifier := provider.Verifier(&oidc.Config{ClientID: oidcConfig.ClientID})

	oidcProvider := &OIDCProvider{
		Provider:      provider,
		OAuth2Config:  oauth2Config,
		Verifier:      verifier,
		Config:        oidcConfig,
		configVersion: generateConfigVersion(oidcConfig),
	}

	// Update global config version
	configVersionMutex.Lock()
	globalConfigVersion = oidcProvider.configVersion
	configVersionMutex.Unlock()

	// Start config watcher
	go oidcProvider.watchConfigChanges()

	log.Printf("OIDC Provider initialized with config version: %s", oidcProvider.configVersion)
	log.Printf("Admin roles: %v, Admin groups: %v", oidcConfig.AdminRoles, oidcConfig.AdminGroups)

	return oidcProvider, nil
}

// UserInfo represents user information extracted from OIDC token
type UserInfo struct {
	Username   string   `json:"username"`
	Email      string   `json:"email"`
	FullName   string   `json:"full_name"`
	Roles      []string `json:"roles"`
	Groups     []string `json:"groups"`
	MappedRole string   `json:"mapped_role"` // Role mapped for velero-manager
}

// ExtractUserInfo extracts user information from ID token with enhanced Keycloak support
func (p *OIDCProvider) ExtractUserInfo(idToken *oidc.IDToken) (*UserInfo, error) {
	var claims map[string]interface{}
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to get claims: %v", err)
	}

	// Debug logging for OIDC claims
	if debugMode := os.Getenv("DEBUG_OIDC"); debugMode == "true" {
		claimsJSON, _ := json.MarshalIndent(claims, "", "  ")
		log.Printf("OIDC Claims received:\n%s", claimsJSON)
	}

	userInfo := &UserInfo{}

	// Extract username with multiple fallbacks
	if username, ok := claims[p.Config.UsernameClaim].(string); ok {
		userInfo.Username = username
	} else if preferred, ok := claims["preferred_username"].(string); ok {
		userInfo.Username = preferred // Keycloak preferred username
	} else if email, ok := claims["email"].(string); ok {
		userInfo.Username = email // Fallback to email
	} else if sub, ok := claims["sub"].(string); ok {
		userInfo.Username = sub // Final fallback to subject
	}

	// Extract email
	if email, ok := claims[p.Config.EmailClaim].(string); ok {
		userInfo.Email = email
	} else if email, ok := claims["email"].(string); ok {
		userInfo.Email = email // Direct email claim
	}

	// Extract full name
	if name, ok := claims[p.Config.FullNameClaim].(string); ok {
		userInfo.FullName = name
	} else if name, ok := claims["name"].(string); ok {
		userInfo.FullName = name // Direct name claim
	}

	// Extract ALL roles from multiple sources
	var allRoles []string

	// 1. Extract realm roles (realm_access.roles)
	realmRoles := p.extractNestedStringArray(claims, "realm_access.roles")
	allRoles = append(allRoles, realmRoles...)

	// 2. Extract client roles (resource_access.CLIENT_ID.roles)
	clientRoles := p.extractClientRoles(claims)
	allRoles = append(allRoles, clientRoles...)

	// 3. Extract from configured claim path if different
	if p.Config.RolesClaim != "" &&
		p.Config.RolesClaim != "realm_access.roles" &&
		!strings.HasPrefix(p.Config.RolesClaim, "resource_access.") {
		configuredRoles := p.extractNestedStringArray(claims, p.Config.RolesClaim)
		allRoles = append(allRoles, configuredRoles...)
	}

	// 4. Check for direct roles claim (some OIDC providers)
	if directRoles, ok := claims["roles"].([]interface{}); ok {
		for _, role := range directRoles {
			if roleStr, ok := role.(string); ok {
				allRoles = append(allRoles, roleStr)
			}
		}
	}

	userInfo.Roles = removeDuplicates(allRoles)

	// Extract groups from multiple sources
	var allGroups []string

	// Try configured groups claim
	if p.Config.GroupsClaim != "" {
		allGroups = p.extractNestedStringArray(claims, p.Config.GroupsClaim)
	}

	// Also try direct groups claim
	if len(allGroups) == 0 {
		if groups, ok := claims["groups"].([]interface{}); ok {
			for _, group := range groups {
				if groupStr, ok := group.(string); ok {
					allGroups = append(allGroups, groupStr)
				}
			}
		}
	}

	userInfo.Groups = removeDuplicates(allGroups)

	// Map to velero-manager role
	userInfo.MappedRole = p.mapToVeleroRole(userInfo.Roles, userInfo.Groups)

	// Log the mapping result
	log.Printf("OIDC User authenticated: %s, Roles: %v, Groups: %v, Mapped Role: %s",
		userInfo.Username, userInfo.Roles, userInfo.Groups, userInfo.MappedRole)

	return userInfo, nil
}

// extractNestedStringArray extracts string array from nested JSON path
func (p *OIDCProvider) extractNestedStringArray(claims map[string]interface{}, claimPath string) []string {
	if claimPath == "" {
		return []string{}
	}

	// Special handling for Keycloak resource_access.CLIENT_ID.roles
	if strings.HasPrefix(claimPath, "resource_access.") && strings.HasSuffix(claimPath, ".roles") {
		return p.extractClientRoles(claims)
	}

	parts := strings.Split(claimPath, ".")
	current := claims

	// Navigate through nested structure
	for _, part := range parts[:len(parts)-1] {
		if next, ok := current[part].(map[string]interface{}); ok {
			current = next
		} else {
			return []string{} // Path not found
		}
	}

	// Get the final array
	finalKey := parts[len(parts)-1]
	if arr, ok := current[finalKey].([]interface{}); ok {
		result := []string{}
		for _, item := range arr {
			if str, ok := item.(string); ok {
				result = append(result, str)
			}
		}
		return result
	}

	return []string{}
}

// extractClientRoles extracts client-specific roles from Keycloak token
func (p *OIDCProvider) extractClientRoles(claims map[string]interface{}) []string {
	var allRoles []string

	// Check resource_access for client-specific roles
	if resourceAccess, ok := claims["resource_access"].(map[string]interface{}); ok {
		// Check for our specific client
		if clientAccess, ok := resourceAccess[p.Config.ClientID].(map[string]interface{}); ok {
			if roles, ok := clientAccess["roles"].([]interface{}); ok {
				for _, role := range roles {
					if roleStr, ok := role.(string); ok {
						allRoles = append(allRoles, roleStr)
					}
				}
			}
		}

		// Also check for "account" client (common in Keycloak)
		if accountAccess, ok := resourceAccess["account"].(map[string]interface{}); ok {
			if roles, ok := accountAccess["roles"].([]interface{}); ok {
				for _, role := range roles {
					if roleStr, ok := role.(string); ok {
						// Prefix with account: to distinguish
						allRoles = append(allRoles, fmt.Sprintf("account:%s", roleStr))
					}
				}
			}
		}
	}

	return allRoles
}

// mapToVeleroRole maps Keycloak roles/groups to velero-manager roles
func (p *OIDCProvider) mapToVeleroRole(roles, groups []string) string {
	// Check admin roles
	for _, adminRole := range p.Config.AdminRoles {
		for _, userRole := range roles {
			if strings.EqualFold(userRole, adminRole) {
				return "admin"
			}
		}
	}

	// Check admin groups
	for _, adminGroup := range p.Config.AdminGroups {
		for _, userGroup := range groups {
			if strings.EqualFold(userGroup, adminGroup) {
				return "admin"
			}
		}
	}

	// Check if user has basic user role (e.g., velero-user)
	userRoles := []string{"velero-user", "velero-viewer"} // Define allowed user roles
	for _, allowedRole := range userRoles {
		for _, userRole := range roles {
			if strings.EqualFold(userRole, allowedRole) {
				return "user"
			}
		}
	}

	// No matching role - deny access
	return "no-access"
}

// ValidateOIDCToken validates an OIDC ID token and returns user info
func (p *OIDCProvider) ValidateOIDCToken(tokenString string) (*UserInfo, error) {
	idToken, err := p.Verifier.Verify(context.Background(), tokenString)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ID token: %v", err)
	}

	return p.ExtractUserInfo(idToken)
}

// RequireOIDCAuth middleware that supports both OIDC and legacy auth
func RequireOIDCAuth(oidcProvider *OIDCProvider) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If OIDC is not configured, fall back to legacy auth
		if oidcProvider == nil || !oidcProvider.Config.Enabled {
			RequireAuth()(c)
			return
		}

		// Clean expired sessions periodically
		go CleanExpiredSessions()

		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.GetHeader("X-Auth-Token")
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No authentication token provided"})
			c.Abort()
			return
		}

		// Remove "Bearer " prefix if present
		if strings.HasPrefix(token, "Bearer ") {
			token = strings.TrimPrefix(token, "Bearer ")
		}

		// Try OIDC token first if OIDC is enabled
		if oidcProvider != nil && oidcProvider.Config.Enabled {
			if userInfo, err := oidcProvider.ValidateOIDCToken(token); err == nil {
				c.Set("username", userInfo.Username)
				c.Set("role", userInfo.MappedRole)
				c.Set("email", userInfo.Email)
				c.Set("full_name", userInfo.FullName)
				c.Set("oidc_roles", userInfo.Roles)
				c.Set("oidc_groups", userInfo.Groups)
				c.Set("auth_method", "oidc")
				c.Next()
				return
			}
		}

		// Try JWT token (legacy)
		if claims, err := ValidateJWTToken(token); err == nil {
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)
			c.Set("auth_method", "jwt")
			c.Next()
			return
		}

		// Fallback to session tokens (legacy)
		sessionMutex.RLock()
		session, exists := userSessions[token]
		sessionMutex.RUnlock()

		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Check if session is expired
		if time.Now().After(session.Expiry) {
			sessionMutex.Lock()
			delete(userSessions, token)
			sessionMutex.Unlock()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired"})
			c.Abort()
			return
		}

		c.Set("username", session.Username)
		c.Set("role", session.Role)
		c.Set("auth_method", "session")
		c.Next()
	}
}

// GetAuthInfo returns authentication info for the current request
func GetAuthInfo(c *gin.Context) gin.H {
	username := c.GetString("username")
	role := c.GetString("role")
	email := c.GetString("email")
	fullName := c.GetString("full_name")
	authMethod := c.GetString("auth_method")

	info := gin.H{
		"username":    username,
		"role":        role,
		"auth_method": authMethod,
	}

	if email != "" {
		info["email"] = email
	}
	if fullName != "" {
		info["full_name"] = fullName
	}

	// Add OIDC-specific info if available
	if oidcRoles, exists := c.Get("oidc_roles"); exists {
		info["oidc_roles"] = oidcRoles
	}
	if oidcGroups, exists := c.Get("oidc_groups"); exists {
		info["oidc_groups"] = oidcGroups
	}

	return info
}

// Config version management functions

// generateConfigVersion generates a hash of the current configuration
func generateConfigVersion(config *config.OIDCConfig) string {
	// Create a version string from critical config elements
	configStr := fmt.Sprintf("%s:%s:%s:%s",
		strings.Join(config.AdminRoles, ","),
		strings.Join(config.AdminGroups, ","),
		config.RolesClaim,
		config.GroupsClaim)

	// Simple hash - in production use crypto/sha256
	return fmt.Sprintf("%d", hashString(configStr))
}

// Simple string hash function
func hashString(s string) uint32 {
	var hash uint32
	for _, c := range s {
		hash = hash*31 + uint32(c)
	}
	return hash
}

// GetConfigVersion returns the current configuration version
func (p *OIDCProvider) GetConfigVersion() string {
	p.configMutex.RLock()
	defer p.configMutex.RUnlock()
	return p.configVersion
}

// watchConfigChanges monitors for configuration changes
func (p *OIDCProvider) watchConfigChanges() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Re-read config from environment
		currentAdminRoles := strings.Split(os.Getenv("OIDC_ADMIN_ROLES"), ",")
		currentAdminGroups := strings.Split(os.Getenv("OIDC_ADMIN_GROUPS"), ",")

		// Clean up whitespace
		for i := range currentAdminRoles {
			currentAdminRoles[i] = strings.TrimSpace(currentAdminRoles[i])
		}
		for i := range currentAdminGroups {
			currentAdminGroups[i] = strings.TrimSpace(currentAdminGroups[i])
		}

		// Check if config changed
		configChanged := false
		if !stringSlicesEqual(p.Config.AdminRoles, currentAdminRoles) {
			p.Config.AdminRoles = currentAdminRoles
			configChanged = true
		}
		if !stringSlicesEqual(p.Config.AdminGroups, currentAdminGroups) {
			p.Config.AdminGroups = currentAdminGroups
			configChanged = true
		}

		if configChanged {
			p.configMutex.Lock()
			p.configVersion = generateConfigVersion(p.Config)
			p.configMutex.Unlock()

			configVersionMutex.Lock()
			globalConfigVersion = p.configVersion
			configVersionMutex.Unlock()

			log.Printf("OIDC configuration changed. New version: %s", p.configVersion)
			log.Printf("Admin roles: %v, Admin groups: %v", p.Config.AdminRoles, p.Config.AdminGroups)
		}
	}
}

// Helper functions

// stringSlicesEqual compares two string slices
func stringSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// removeDuplicates removes duplicate strings from a slice
func removeDuplicates(strings []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, str := range strings {
		if !seen[str] {
			seen[str] = true
			result = append(result, str)
		}
	}
	return result
}
