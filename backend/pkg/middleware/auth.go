package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWT secret key - in production, this should be from environment variable
var jwtSecret = []byte("velero-manager-secret-key-change-in-production")

// Session store with expiration
type Session struct {
	Username string
	Role     string
	Expiry   time.Time
}

var (
	userSessions = make(map[string]Session)
	sessionMutex = sync.RWMutex{}
)

// RevokedTokens stores revoked session IDs
var (
	revokedSessions = make(map[string]time.Time)
	revokeMutex     = sync.RWMutex{}
)

// Generate secure random token
func generateSecureToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// JWT Claims structure with enhanced tracking
type Claims struct {
	Username      string `json:"username"`
	Role          string `json:"role"`
	ConfigVersion string `json:"config_version,omitempty"` // Track config version
	SessionID     string `json:"session_id,omitempty"`     // Track session for revocation
	AuthMethod    string `json:"auth_method,omitempty"`    // oidc or legacy
	jwt.RegisteredClaims
}

// Create JWT token (legacy compatibility)
func CreateJWTToken(username, role string) (string, error) {
	return CreateJWTTokenWithConfig(username, role, "", "legacy")
}

// CreateJWTTokenWithConfig creates JWT with additional options
func CreateJWTTokenWithConfig(username, role, configVersion, authMethod string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour) // 24 hour expiry
	sessionID := generateSecureToken()[:16] // Shorter session ID
	
	claims := &Claims{
		Username:      username,
		Role:          role,
		ConfigVersion: configVersion,
		SessionID:     sessionID,
		AuthMethod:    authMethod,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	
	if err == nil && authMethod == "oidc" {
		log.Printf("Created JWT for OIDC user %s with role %s, session %s, config %s", 
			username, role, sessionID, configVersion)
	}
	
	return tokenString, err
}

// Validate JWT token with enhanced validation
func ValidateJWTToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	
	// Check if session was revoked
	if claims.SessionID != "" && IsSessionRevoked(claims.SessionID) {
		return nil, fmt.Errorf("session has been revoked")
	}
	
	// For OIDC tokens, validate config version if available
	if claims.AuthMethod == "oidc" && claims.ConfigVersion != "" {
		// Check against global config version
		if !CheckConfigVersion(claims.ConfigVersion) {
			return nil, fmt.Errorf("configuration changed, please re-authenticate")
		}
	}

	return claims, nil
}

// RevokeSession adds a session to the revocation list
func RevokeSession(sessionID string) {
	revokeMutex.Lock()
	defer revokeMutex.Unlock()
	revokedSessions[sessionID] = time.Now().Add(25 * time.Hour) // Keep longer than token expiry
	log.Printf("Session %s has been revoked", sessionID)
}

// IsSessionRevoked checks if a session has been revoked
func IsSessionRevoked(sessionID string) bool {
	revokeMutex.RLock()
	defer revokeMutex.RUnlock()
	
	expiry, exists := revokedSessions[sessionID]
	if !exists {
		return false
	}
	
	// Clean up if expired
	if time.Now().After(expiry) {
		delete(revokedSessions, sessionID)
		return false
	}
	
	return true
}

// Store session (fallback for non-JWT clients)
func StoreSession(username, role, token string) {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()
	userSessions[token] = Session{
		Username: username,
		Role:     role,
		Expiry:   time.Now().Add(24 * time.Hour),
	}
}

// Clean expired sessions
func CleanExpiredSessions() {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()
	now := time.Now()
	for token, session := range userSessions {
		if now.After(session.Expiry) {
			delete(userSessions, token)
		}
	}
	
	// Also clean expired revocations
	revokeMutex.Lock()
	defer revokeMutex.Unlock()
	for sessionID, expiry := range revokedSessions {
		if now.After(expiry) {
			delete(revokedSessions, sessionID)
		}
	}
}

// ClearSession removes a specific session
func ClearSession(token string) {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()
	delete(userSessions, token)
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
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
		
		// Try JWT token first
		if claims, err := ValidateJWTToken(token); err == nil {
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)
			c.Set("auth_method", claims.AuthMethod)
			c.Set("session_id", claims.SessionID)
			c.Set("config_version", claims.ConfigVersion)
			c.Next()
			return
		} else if err != nil {
			// Log specific validation errors for debugging
			if strings.Contains(err.Error(), "configuration changed") {
				log.Printf("Token validation failed for config change: %v", err)
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "Configuration changed, please re-authenticate",
					"needs_refresh": true,
				})
				c.Abort()
				return
			} else if strings.Contains(err.Error(), "revoked") {
				log.Printf("Token validation failed - session revoked: %v", err)
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "Session has been revoked",
					"needs_refresh": true,
				})
				c.Abort()
				return
			}
		}
		
		// Fallback to session tokens
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

// UserValidator interface to avoid circular dependency
type UserValidator interface {
	GetUsers() (map[string]interface{}, error)
}

var globalUserValidator UserValidator

func SetUserValidator(validator UserValidator) {
	globalUserValidator = validator
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		role := c.GetString("role")
		
		if username == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		
		// First check role from token/session
		if role == "admin" {
			c.Next()
			return
		}
		
		// If we have a validator, use it as fallback
		if globalUserValidator != nil {
			users, err := globalUserValidator.GetUsers()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
				c.Abort()
				return
			}
			
			if user, exists := users[username]; exists {
				if userMap, ok := user.(map[string]interface{}); ok {
					if userRole, ok := userMap["role"].(string); ok && userRole == "admin" {
						c.Next()
						return
					}
				}
			}
		}
		
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		c.Abort()
	}
}

// Global OIDC provider reference for config validation
var globalOIDCProvider interface {
	GetConfigVersion() string
}

// SetOIDCProvider sets the global OIDC provider for config validation
func SetOIDCProvider(provider interface{ GetConfigVersion() string }) {
	globalOIDCProvider = provider
}

// CheckConfigVersion validates config version against current
func CheckConfigVersion(version string) bool {
	if globalOIDCProvider == nil {
		return true // If no OIDC provider, always valid
	}
	currentVersion := globalOIDCProvider.GetConfigVersion()
	return version == currentVersion
}