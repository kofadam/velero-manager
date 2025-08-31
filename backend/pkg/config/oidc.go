package config

import (
	"os"
	"strings"
	"sync"
)

// OIDCConfig holds OIDC configuration for Keycloak integration
type OIDCConfig struct {
	Enabled      bool   `json:"enabled"`
	IssuerURL    string `json:"issuer_url"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	RedirectURL  string `json:"redirect_url"`
	
	// Role mapping configuration
	RolesClaim       string            `json:"roles_claim"`        // JWT claim containing roles
	GroupsClaim      string            `json:"groups_claim"`       // JWT claim containing groups
	AdminRoles       []string          `json:"admin_roles"`        // Keycloak roles that map to admin
	AdminGroups      []string          `json:"admin_groups"`       // Keycloak groups that map to admin
	DefaultRole      string            `json:"default_role"`       // Default role for authenticated users
	
	// Optional claims mapping
	UsernameClaim    string            `json:"username_claim"`     // Claim for username (default: preferred_username)
	EmailClaim       string            `json:"email_claim"`        // Claim for email (default: email)
	FullNameClaim    string            `json:"full_name_claim"`    // Claim for full name (default: name)
}

var (
	currentConfig *OIDCConfig
	configMutex   sync.RWMutex
)

// GetOIDCConfig loads OIDC configuration from environment variables or returns cached config
func GetOIDCConfig() *OIDCConfig {
	configMutex.RLock()
	if currentConfig != nil {
		defer configMutex.RUnlock()
		return currentConfig
	}
	configMutex.RUnlock()

	configMutex.Lock()
	defer configMutex.Unlock()
	
	// Double-check after acquiring write lock
	if currentConfig != nil {
		return currentConfig
	}
	config := &OIDCConfig{
		Enabled:          getEnvBool("OIDC_ENABLED", false),
		IssuerURL:        getEnv("OIDC_ISSUER_URL", ""),
		ClientID:         getEnv("OIDC_CLIENT_ID", ""),
		ClientSecret:     getEnv("OIDC_CLIENT_SECRET", ""),
		RedirectURL:      getEnv("OIDC_REDIRECT_URL", "http://localhost:3000/auth/callback"),
		
		RolesClaim:       getEnv("OIDC_ROLES_CLAIM", "realm_access.roles"),
		GroupsClaim:      getEnv("OIDC_GROUPS_CLAIM", "groups"),
		AdminRoles:       getEnvSlice("OIDC_ADMIN_ROLES", []string{"velero-admin", "admin"}),
		AdminGroups:      getEnvSlice("OIDC_ADMIN_GROUPS", []string{"velero-administrators", "administrators"}),
		DefaultRole:      getEnv("OIDC_DEFAULT_ROLE", "user"),
		
		UsernameClaim:    getEnv("OIDC_USERNAME_CLAIM", "preferred_username"),
		EmailClaim:       getEnv("OIDC_EMAIL_CLAIM", "email"),
		FullNameClaim:    getEnv("OIDC_FULL_NAME_CLAIM", "name"),
	}
	
	currentConfig = config
	return config
}

// SetOIDCConfig sets the current OIDC configuration (used when loading from ConfigMap)
func SetOIDCConfig(config *OIDCConfig) {
	configMutex.Lock()
	defer configMutex.Unlock()
	currentConfig = config
}

// ReloadOIDCConfig clears the cached configuration to force reload
func ReloadOIDCConfig() {
	configMutex.Lock()
	defer configMutex.Unlock()
	currentConfig = nil
}

// IsValidOIDCConfig checks if OIDC configuration is complete and valid
func (c *OIDCConfig) IsValid() bool {
	if !c.Enabled {
		return false
	}
	
	return c.IssuerURL != "" && 
		   c.ClientID != "" && 
		   c.ClientSecret != "" && 
		   c.RedirectURL != ""
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1"
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		// Simple comma-separated parsing
		result := []string{}
		for _, item := range splitAndTrim(value, ",") {
			if item != "" {
				result = append(result, item)
			}
		}
		return result
	}
	return defaultValue
}

func splitAndTrim(s, sep string) []string {
	result := []string{}
	for _, item := range strings.Split(s, sep) {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}