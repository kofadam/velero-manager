package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"velero-manager/pkg/config"
	"velero-manager/pkg/k8s"
	"velero-manager/pkg/middleware"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// AuthHandler handles authentication operations for both legacy and OIDC
type AuthHandler struct {
	k8sClient    *k8s.Client
	userHandler  *UserHandler
	oidcProvider *middleware.OIDCProvider
	oidcConfig   *config.OIDCConfig
}

// NewAuthHandler creates a new auth handler with optional OIDC support
func NewAuthHandler(k8sClient *k8s.Client, oidcConfig *config.OIDCConfig) (*AuthHandler, error) {
	handler := &AuthHandler{
		k8sClient:   k8sClient,
		userHandler: NewUserHandler(k8sClient),
		oidcConfig:  oidcConfig,
	}

	// Initialize OIDC provider if configured
	if oidcConfig != nil && oidcConfig.IsValid() {
		provider, err := middleware.NewOIDCProvider(oidcConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize OIDC provider: %v", err)
		}
		handler.oidcProvider = provider
	}

	return handler, nil
}

// GetAuthInfo returns current authentication configuration and user info
func (h *AuthHandler) GetAuthInfo(c *gin.Context) {
	info := gin.H{
		"oidcEnabled":       h.oidcConfig != nil && h.oidcConfig.Enabled,
		"legacyAuthEnabled": true, // Always available as fallback
	}

	// If user is authenticated, add user info
	if username := c.GetString("username"); username != "" {
		userInfo := middleware.GetAuthInfo(c)
		info["user"] = userInfo
		info["authenticated"] = true
	} else {
		info["authenticated"] = false
	}

	c.JSON(http.StatusOK, info)
}

// InitiateOIDCLogin starts the OIDC authentication flow
func (h *AuthHandler) InitiateOIDCLogin(c *gin.Context) {
	if h.oidcProvider == nil || !h.oidcConfig.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OIDC authentication not enabled"})
		return
	}

	// Generate state parameter for CSRF protection
	state, err := generateSecureState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state"})
		return
	}

	// Store state in session/memory for verification
	// In production, you might want to use Redis or database
	storeState(c, state)

	// Get authorization URL
	authURL := h.oidcProvider.OAuth2Config.AuthCodeURL(state, oauth2.AccessTypeOffline)

	c.JSON(http.StatusOK, gin.H{
		"authUrl": authURL,
		"state":   state,
	})
}

// HandleOIDCCallback handles the OIDC callback after successful authentication
func (h *AuthHandler) HandleOIDCCallback(c *gin.Context) {
	if h.oidcProvider == nil || !h.oidcConfig.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OIDC authentication not enabled"})
		return
	}

	// Get authorization code and state from query parameters
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}

	// Verify state parameter
	if !verifyState(c, state) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state parameter"})
		return
	}

	// Exchange code for tokens
	oauth2Token, err := h.oidcProvider.OAuth2Config.Exchange(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code for token"})
		return
	}

	// Extract ID token
	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ID token not found"})
		return
	}

	// Verify and extract user info
	userInfo, err := h.oidcProvider.ValidateOIDCToken(rawIDToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate ID token"})
		return
	}

	// SECURITY: Block users without proper roles
	if userInfo.MappedRole == "no-access" || userInfo.MappedRole == "" {
		log.Printf("Access denied for user %s - no valid role assigned (roles: %v, groups: %v)",
			userInfo.Username, userInfo.Roles, userInfo.Groups)

		// Redirect to login page with error message
		errorMsg := "Access denied. You need velero-user or velero-admin role in Keycloak."
		redirectURL := fmt.Sprintf("/login?error=%s", errorMsg)
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	// Log successful authentication
	log.Printf("User %s authenticated successfully with role: %s", userInfo.Username, userInfo.MappedRole)

	// Create JWT token for client
	jwtToken, err := middleware.CreateJWTToken(userInfo.Username, userInfo.MappedRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create JWT token"})
		return
	}

	// Store session as fallback
	sessionToken := fmt.Sprintf("oidc_session_%s_%d", userInfo.Username, time.Now().Unix())
	middleware.StoreSession(userInfo.Username, userInfo.MappedRole, sessionToken)

	// Redirect to frontend with token in URL fragment (secure for SPA)
	redirectURL := fmt.Sprintf("/?token=%s&auth=oidc&username=%s&role=%s",
		jwtToken, userInfo.Username, userInfo.MappedRole)

	c.Redirect(http.StatusFound, redirectURL)
}

// LegacyLogin provides the original username/password login
func (h *AuthHandler) LegacyLogin(c *gin.Context) {
	h.userHandler.Login(c)
}

// Logout handles logout for both OIDC and legacy sessions
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get token from request
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.GetHeader("X-Auth-Token")
	}

	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	// Clear session if it exists
	if token != "" {
		middleware.ClearSession(token)
	}

	// If OIDC is enabled, provide logout URL
	response := gin.H{"message": "Logged out successfully"}

	if h.oidcProvider != nil && h.oidcConfig.Enabled {
		// Construct Keycloak logout URL properly
		issuerURL := h.oidcConfig.IssuerURL
		// Remove trailing slash if present
		issuerURL = strings.TrimSuffix(issuerURL, "/")

		// Keycloak logout URL format
		logoutURL := fmt.Sprintf("%s/protocol/openid-connect/logout", issuerURL)
		response["oidc_logout_url"] = logoutURL
	}

	c.JSON(http.StatusOK, response)
}

// Helper functions for state management
func generateSecureState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// Simple in-memory state storage (use Redis/DB in production)
var stateStore = make(map[string]time.Time)

func storeState(c *gin.Context, state string) {
	// Store with expiration (10 minutes)
	stateStore[state] = time.Now().Add(10 * time.Minute)

	// Clean expired states
	go func() {
		now := time.Now()
		for s, expiry := range stateStore {
			if now.After(expiry) {
				delete(stateStore, s)
			}
		}
	}()
}

func verifyState(c *gin.Context, state string) bool {
	if state == "" {
		return false
	}

	expiry, exists := stateStore[state]
	if !exists {
		return false
	}

	if time.Now().After(expiry) {
		delete(stateStore, state)
		return false
	}

	// Remove state after verification (single use)
	delete(stateStore, state)
	return true
}

// GetOIDCProvider returns the OIDC provider (for use in main.go)
func (h *AuthHandler) GetOIDCProvider() *middleware.OIDCProvider {
	return h.oidcProvider
}
