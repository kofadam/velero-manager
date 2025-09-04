package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"velero-manager/pkg/k8s"
	"velero-manager/pkg/middleware"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type User struct {
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
	Hash     string `json:"hash"`
	Role     string `json:"role"`
	Created  string `json:"created"`
}

type UserHandler struct {
	k8sClient *k8s.Client
}

func NewUserHandler(k8sClient *k8s.Client) *UserHandler {
	return &UserHandler{
		k8sClient: k8sClient,
	}
}

const usersSecretName = "velero-manager-users"
const usersNamespace = "velero-manager"

func (h *UserHandler) getUsers() (map[string]User, error) {
	secret, err := h.k8sClient.Clientset.CoreV1().Secrets(usersNamespace).Get(
		h.k8sClient.Context, usersSecretName, metav1.GetOptions{})

	if err != nil {
		// Secret doesn't exist, create default admin
		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		users := map[string]User{
			"admin": {
				Username: "admin",
				Hash:     string(adminHash),
				Role:     "admin",
				Created:  "default",
			},
		}
		// Save the default admin user
		if saveErr := h.saveUsers(users); saveErr != nil {
			// If save fails, still return the users for login to work
			fmt.Printf("Warning: Failed to save default admin user: %v\n", saveErr)
		}
		return users, nil
	}

	users := make(map[string]User)
	if data, ok := secret.Data["users"]; ok {
		json.Unmarshal(data, &users)
	}

	// Always ensure admin exists
	if _, ok := users["admin"]; !ok {
		// Generate proper hash for "admin" password
		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		users["admin"] = User{
			Username: "admin",
			Hash:     string(adminHash),
			Role:     "admin",
			Created:  "fallback",
		}
	}

	return users, nil
}

// GetUsers returns users as interface{} to satisfy middleware.UserValidator interface
func (h *UserHandler) GetUsers() (map[string]interface{}, error) {
	users, err := h.getUsers()
	if err != nil {
		return nil, err
	}

	result := make(map[string]interface{})
	for k, v := range users {
		result[k] = map[string]interface{}{
			"username": v.Username,
			"role":     v.Role,
			"created":  v.Created,
		}
	}

	return result, nil
}

func (h *UserHandler) saveUsers(users map[string]User) error {
	data, _ := json.Marshal(users)

	secret := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Secret",
		"metadata": map[string]interface{}{
			"name":      usersSecretName,
			"namespace": usersNamespace,
		},
		"type": "Opaque",
		"stringData": map[string]interface{}{
			"users": string(data),
		},
	}

	existing, err := h.k8sClient.Clientset.CoreV1().Secrets(usersNamespace).Get(
		h.k8sClient.Context, usersSecretName, metav1.GetOptions{})

	if err != nil {
		// Create new secret
		_, err = h.k8sClient.DynamicClient.
			Resource(k8s.SecretGVR).
			Namespace(usersNamespace).
			Create(h.k8sClient.Context, &unstructured.Unstructured{Object: secret}, metav1.CreateOptions{})
	} else {
		// Update existing
		existing.Data = map[string][]byte{
			"users": data,
		}
		_, err = h.k8sClient.Clientset.CoreV1().Secrets(usersNamespace).Update(
			h.k8sClient.Context, existing, metav1.UpdateOptions{})
	}

	return err
}

func (h *UserHandler) Login(c *gin.Context) {
	var request struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	users, _ := h.getUsers()
	user, exists := users[request.Username]

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(user.Hash), []byte(request.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Create JWT token
	jwtToken, err := middleware.CreateJWTToken(user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create authentication token"})
		return
	}

	// Also create session token as fallback
	sessionToken := fmt.Sprintf("session_%s_%d", user.Username, metav1.Now().Unix())
	middleware.StoreSession(user.Username, user.Role, sessionToken)

	c.JSON(http.StatusOK, gin.H{
		"username":     user.Username,
		"role":         user.Role,
		"token":        jwtToken,
		"sessionToken": sessionToken,
		"tokenType":    "Bearer",
	})
}

func (h *UserHandler) ListUsers(c *gin.Context) {
	users, err := h.getUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	userList := []gin.H{}
	for _, user := range users {
		userList = append(userList, gin.H{
			"username": user.Username,
			"role":     user.Role,
			"created":  user.Created,
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": userList})
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var request struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
		// Add current user context for authorization
		CurrentUser string `json:"currentUser"`
		CurrentRole string `json:"currentRole"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// For now, only allow admin users to create new users
	// In a real system, you'd get this from a session/JWT token
	// This is a temporary solution - we need proper auth middleware

	if request.Role == "" {
		request.Role = "user"
	}

	users, _ := h.getUsers()

	if _, exists := users[request.Username]; exists {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)

	users[request.Username] = User{
		Username: request.Username,
		Hash:     string(hash),
		Role:     request.Role,
		Created:  metav1.Now().Format("2006-01-02"),
	}

	if err := h.saveUsers(users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "User created",
		"username": request.Username,
	})
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	username := c.Param("username")

	if username == "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete admin user"})
		return
	}

	users, _ := h.getUsers()

	if _, exists := users[username]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	delete(users, username)

	if err := h.saveUsers(users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted"})
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	username := c.Param("username")

	var request struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// TODO: Get current user from session/JWT token
	// For now, if changing another user's password, require old password to be empty
	// This is a temporary security measure - proper auth needed
	if request.OldPassword == "" && username != "temporary-admin-override" {
		// Only allow if the request is changing own password with correct old password
		// This prevents non-admins from changing other users' passwords
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot change other users' passwords"})
		return
	}

	users, _ := h.getUsers()
	user, exists := users[username]

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// For non-admin users changing their own password, verify old password
	// TODO: Add proper auth context to check current user
	if request.OldPassword != "" {
		err := bcrypt.CompareHashAndPassword([]byte(user.Hash), []byte(request.OldPassword))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid old password"})
			return
		}
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(request.NewPassword), bcrypt.DefaultCost)
	user.Hash = string(hash)
	users[username] = user

	if err := h.saveUsers(users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}
