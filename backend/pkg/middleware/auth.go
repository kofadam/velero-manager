package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
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

// Generate secure random token
func generateSecureToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// JWT Claims structure
type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Create JWT token
func CreateJWTToken(username, role string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour) // 24 hour expiry
	claims := &Claims{
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// Validate JWT token
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

	return claims, nil
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
			c.Next()
			return
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