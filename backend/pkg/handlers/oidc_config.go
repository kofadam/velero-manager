package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"velero-manager/pkg/config"
	"velero-manager/pkg/k8s"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/net/context"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	oidcConfigMapName = "velero-manager-oidc-config"
	oidcSecretName    = "velero-manager-oidc-secret"
	namespace         = "velero-manager"
)

// OIDCConfigHandler handles OIDC configuration management
type OIDCConfigHandler struct {
	k8sClient *k8s.Client
}

// NewOIDCConfigHandler creates a new OIDC configuration handler
func NewOIDCConfigHandler(k8sClient *k8s.Client) *OIDCConfigHandler {
	return &OIDCConfigHandler{
		k8sClient: k8sClient,
	}
}

// OIDCConfigRequest represents the OIDC configuration request
type OIDCConfigRequest struct {
	Enabled       bool     `json:"enabled"`
	IssuerURL     string   `json:"issuerURL"`
	ClientID      string   `json:"clientID"`
	ClientSecret  string   `json:"clientSecret"`
	RedirectURL   string   `json:"redirectURL"`
	UsernameClaim string   `json:"usernameClaim"`
	EmailClaim    string   `json:"emailClaim"`
	FullNameClaim string   `json:"fullNameClaim"`
	RolesClaim    string   `json:"rolesClaim"`
	GroupsClaim   string   `json:"groupsClaim"`
	AdminRoles    []string `json:"adminRoles"`
	AdminGroups   []string `json:"adminGroups"`
	DefaultRole   string   `json:"defaultRole"`
}

// GetOIDCConfig retrieves the current OIDC configuration
func (h *OIDCConfigHandler) GetOIDCConfig(c *gin.Context) {
	ctx := context.Background()

	// Get ConfigMap
	configMap, err := h.k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, oidcConfigMapName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Return default configuration
			c.JSON(http.StatusOK, OIDCConfigRequest{
				Enabled:       false,
				UsernameClaim: "preferred_username",
				EmailClaim:    "email",
				FullNameClaim: "name",
				RolesClaim:    "realm_access.roles",
				GroupsClaim:   "groups",
				DefaultRole:   "user",
				AdminRoles:    []string{},
				AdminGroups:   []string{},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve OIDC configuration"})
		return
	}

	// Get Secret for client secret
	secret, err := h.k8sClient.Clientset.CoreV1().Secrets(namespace).Get(ctx, oidcSecretName, metav1.GetOptions{})
	if err != nil && !errors.IsNotFound(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve OIDC secret"})
		return
	}

	// Parse configuration
	config := OIDCConfigRequest{
		Enabled:       configMap.Data["enabled"] == "true",
		IssuerURL:     configMap.Data["issuerURL"],
		ClientID:      configMap.Data["clientID"],
		RedirectURL:   configMap.Data["redirectURL"],
		UsernameClaim: configMap.Data["usernameClaim"],
		EmailClaim:    configMap.Data["emailClaim"],
		FullNameClaim: configMap.Data["fullNameClaim"],
		RolesClaim:    configMap.Data["rolesClaim"],
		GroupsClaim:   configMap.Data["groupsClaim"],
		DefaultRole:   configMap.Data["defaultRole"],
	}

	// Parse JSON arrays
	if adminRolesStr := configMap.Data["adminRoles"]; adminRolesStr != "" {
		json.Unmarshal([]byte(adminRolesStr), &config.AdminRoles)
	}
	if adminGroupsStr := configMap.Data["adminGroups"]; adminGroupsStr != "" {
		json.Unmarshal([]byte(adminGroupsStr), &config.AdminGroups)
	}

	// Get client secret from Secret
	if secret != nil && secret.Data != nil {
		config.ClientSecret = string(secret.Data["clientSecret"])
	}

	c.JSON(http.StatusOK, config)
}

// UpdateOIDCConfig updates the OIDC configuration
func (h *OIDCConfigHandler) UpdateOIDCConfig(c *gin.Context) {
	var req OIDCConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	ctx := context.Background()

	// Prepare ConfigMap data
	adminRolesJSON, _ := json.Marshal(req.AdminRoles)
	adminGroupsJSON, _ := json.Marshal(req.AdminGroups)

	configMapData := map[string]string{
		"enabled":       fmt.Sprintf("%t", req.Enabled),
		"issuerURL":     req.IssuerURL,
		"clientID":      req.ClientID,
		"redirectURL":   req.RedirectURL,
		"usernameClaim": req.UsernameClaim,
		"emailClaim":    req.EmailClaim,
		"fullNameClaim": req.FullNameClaim,
		"rolesClaim":    req.RolesClaim,
		"groupsClaim":   req.GroupsClaim,
		"adminRoles":    string(adminRolesJSON),
		"adminGroups":   string(adminGroupsJSON),
		"defaultRole":   req.DefaultRole,
	}

	// Create or update ConfigMap
	configMap, err := h.k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, oidcConfigMapName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Create new ConfigMap
			configMap = &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      oidcConfigMapName,
					Namespace: namespace,
					Labels: map[string]string{
						"app": "velero-manager",
					},
				},
				Data: configMapData,
			}
			_, err = h.k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, configMap, metav1.CreateOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create ConfigMap: %v", err)})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get ConfigMap: %v", err)})
			return
		}
	} else {
		// Update existing ConfigMap
		configMap.Data = configMapData
		_, err = h.k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, configMap, metav1.UpdateOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update ConfigMap: %v", err)})
			return
		}
	}

	// Create or update Secret for client secret
	if req.ClientSecret != "" {
		secretData := map[string][]byte{
			"clientSecret": []byte(req.ClientSecret),
		}

		secret, err := h.k8sClient.Clientset.CoreV1().Secrets(namespace).Get(ctx, oidcSecretName, metav1.GetOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				// Create new Secret
				secret = &corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{
						Name:      oidcSecretName,
						Namespace: namespace,
						Labels: map[string]string{
							"app": "velero-manager",
						},
					},
					Type: corev1.SecretTypeOpaque,
					Data: secretData,
				}
				_, err = h.k8sClient.Clientset.CoreV1().Secrets(namespace).Create(ctx, secret, metav1.CreateOptions{})
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create Secret: %v", err)})
					return
				}
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get Secret: %v", err)})
				return
			}
		} else {
			// Update existing Secret
			secret.Data = secretData
			_, err = h.k8sClient.Clientset.CoreV1().Secrets(namespace).Update(ctx, secret, metav1.UpdateOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update Secret: %v", err)})
				return
			}
		}
	}

	// Trigger configuration reload by updating environment
	// Note: In production, you might want to trigger a pod restart or use a webhook
	config.ReloadOIDCConfig()

	c.JSON(http.StatusOK, gin.H{"message": "OIDC configuration updated successfully"})
}

// TestOIDCConnection tests the OIDC provider connection
func (h *OIDCConfigHandler) TestOIDCConnection(c *gin.Context) {
	var req struct {
		IssuerURL    string `json:"issuerURL" binding:"required"`
		ClientID     string `json:"clientID" binding:"required"`
		ClientSecret string `json:"clientSecret" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate required fields
	if strings.TrimSpace(req.IssuerURL) == "" || strings.TrimSpace(req.ClientID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IssuerURL and ClientID are required"})
		return
	}

	ctx := context.Background()

	// Try to create OIDC provider to test connection
	provider, err := oidc.NewProvider(ctx, req.IssuerURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to connect to OIDC provider: %v", err)})
		return
	}

	// Get provider endpoints to verify connectivity
	var claims struct {
		Issuer   string `json:"issuer"`
		AuthURL  string `json:"authorization_endpoint"`
		TokenURL string `json:"token_endpoint"`
		JWKSURL  string `json:"jwks_uri"`
	}

	if err := provider.Claims(&claims); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get provider information: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully connected to OIDC provider",
		"issuer":  claims.Issuer,
		"endpoints": gin.H{
			"authorization": claims.AuthURL,
			"token":         claims.TokenURL,
			"jwks":          claims.JWKSURL,
		},
	})
}

// LoadOIDCConfigFromK8s loads OIDC configuration from Kubernetes ConfigMap and Secret
func LoadOIDCConfigFromK8s(k8sClient *k8s.Client) (*config.OIDCConfig, error) {
	ctx := context.Background()

	// Get ConfigMap
	configMap, err := k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, oidcConfigMapName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// No OIDC configuration exists
			return &config.OIDCConfig{Enabled: false}, nil
		}
		return nil, fmt.Errorf("failed to get OIDC ConfigMap: %v", err)
	}

	// Get Secret
	secret, err := k8sClient.Clientset.CoreV1().Secrets(namespace).Get(ctx, oidcSecretName, metav1.GetOptions{})
	if err != nil && !errors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to get OIDC Secret: %v", err)
	}

	// Parse configuration
	oidcConfig := &config.OIDCConfig{
		Enabled:       configMap.Data["enabled"] == "true",
		IssuerURL:     configMap.Data["issuerURL"],
		ClientID:      configMap.Data["clientID"],
		RedirectURL:   configMap.Data["redirectURL"],
		UsernameClaim: configMap.Data["usernameClaim"],
		EmailClaim:    configMap.Data["emailClaim"],
		FullNameClaim: configMap.Data["fullNameClaim"],
		RolesClaim:    configMap.Data["rolesClaim"],
		GroupsClaim:   configMap.Data["groupsClaim"],
		DefaultRole:   configMap.Data["defaultRole"],
	}

	// Set defaults if not specified
	if oidcConfig.UsernameClaim == "" {
		oidcConfig.UsernameClaim = "preferred_username"
	}
	if oidcConfig.EmailClaim == "" {
		oidcConfig.EmailClaim = "email"
	}
	if oidcConfig.FullNameClaim == "" {
		oidcConfig.FullNameClaim = "name"
	}
	if oidcConfig.RolesClaim == "" {
		oidcConfig.RolesClaim = "realm_access.roles"
	}
	if oidcConfig.GroupsClaim == "" {
		oidcConfig.GroupsClaim = "groups"
	}
	if oidcConfig.DefaultRole == "" {
		oidcConfig.DefaultRole = "user"
	}

	// Parse JSON arrays
	if adminRolesStr := configMap.Data["adminRoles"]; adminRolesStr != "" {
		json.Unmarshal([]byte(adminRolesStr), &oidcConfig.AdminRoles)
	}
	if adminGroupsStr := configMap.Data["adminGroups"]; adminGroupsStr != "" {
		json.Unmarshal([]byte(adminGroupsStr), &oidcConfig.AdminGroups)
	}

	// Get client secret from Secret
	if secret != nil && secret.Data != nil {
		oidcConfig.ClientSecret = string(secret.Data["clientSecret"])
	}

	return oidcConfig, nil
}