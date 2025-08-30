package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
	"velero-manager/pkg/config"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// OIDCProvider holds the OIDC provider and OAuth2 configuration
type OIDCProvider struct {
	Provider     *oidc.Provider
	OAuth2Config *oauth2.Config
	Verifier     *oidc.IDTokenVerifier
	Config       *config.OIDCConfig
}

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

	// Configure the OAuth2 config
	oauth2Config := &oauth2.Config{
		ClientID:     oidcConfig.ClientID,
		ClientSecret: oidcConfig.ClientSecret,
		RedirectURL:  oidcConfig.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups"},
	}

	// Configure the ID token verifier
	verifier := provider.Verifier(&oidc.Config{ClientID: oidcConfig.ClientID})

	return &OIDCProvider{
		Provider:     provider,
		OAuth2Config: oauth2Config,
		Verifier:     verifier,
		Config:       oidcConfig,
	}, nil
}

// UserInfo represents user information extracted from OIDC token
type UserInfo struct {
	Username    string   `json:"username"`
	Email       string   `json:"email"`
	FullName    string   `json:"full_name"`
	Roles       []string `json:"roles"`
	Groups      []string `json:"groups"`
	MappedRole  string   `json:"mapped_role"`  // Role mapped for velero-manager
}

// ExtractUserInfo extracts user information from ID token
func (p *OIDCProvider) ExtractUserInfo(idToken *oidc.IDToken) (*UserInfo, error) {
	var claims map[string]interface{}
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to get claims: %v", err)
	}

	userInfo := &UserInfo{}

	// Extract username
	if username, ok := claims[p.Config.UsernameClaim].(string); ok {
		userInfo.Username = username
	} else if sub, ok := claims["sub"].(string); ok {
		userInfo.Username = sub // Fallback to subject
	}

	// Extract email
	if email, ok := claims[p.Config.EmailClaim].(string); ok {
		userInfo.Email = email
	}

	// Extract full name
	if name, ok := claims[p.Config.FullNameClaim].(string); ok {
		userInfo.FullName = name
	}

	// Extract roles from nested claims (e.g., realm_access.roles)
	userInfo.Roles = p.extractNestedStringArray(claims, p.Config.RolesClaim)

	// Extract groups
	userInfo.Groups = p.extractNestedStringArray(claims, p.Config.GroupsClaim)

	// Map to velero-manager role
	userInfo.MappedRole = p.mapToVeleroRole(userInfo.Roles, userInfo.Groups)

	return userInfo, nil
}

// extractNestedStringArray extracts string array from nested JSON path
func (p *OIDCProvider) extractNestedStringArray(claims map[string]interface{}, claimPath string) []string {
	if claimPath == "" {
		return []string{}
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

	// Return default role for authenticated users
	return p.Config.DefaultRole
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