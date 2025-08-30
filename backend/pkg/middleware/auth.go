package middleware

import (
	"net/http"
	"velero-manager/pkg/handlers"

	"github.com/gin-gonic/gin"
)

// For now, we'll use a simple session approach
// In production, you'd want JWT tokens or similar
var userSessions = make(map[string]string) // token -> username

func StoreSession(username, token string) {
	userSessions[token] = username
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.GetHeader("X-Auth-Token")
		}
		
		username, exists := userSessions[token]
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		
		c.Set("username", username)
		c.Next()
	}
}

func RequireAdmin(userHandler *handlers.UserHandler) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		if username == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		
		// Check if user is admin
		users, _ := userHandler.GetUsers()
		user, exists := users[username]
		if !exists || user.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		
		c.Next()
	}
}