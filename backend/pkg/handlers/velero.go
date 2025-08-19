package handlers

import (
	"net/http"
	"velero-manager/pkg/k8s"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type VeleroHandler struct {
	k8sClient *k8s.Client
}

func NewVeleroHandler(k8sClient *k8s.Client) *VeleroHandler {
	return &VeleroHandler{
		k8sClient: k8sClient,
	}
}

func (h *VeleroHandler) ListBackups(c *gin.Context) {
	// Check if Velero CRDs exist first
	_, err := h.k8sClient.Clientset.Discovery().ServerResourcesForGroupVersion("velero.io/v1")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Velero not installed or CRDs not found",
			"details": err.Error(),
			"help":    "Install Velero: https://velero.io/docs/v1.12/basic-install/",
		})
		return
	}

	// Get backups from Velero namespace
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to list backups",
			"details":   err.Error(),
			"namespace": "velero",
		})
		return
	}

	// Convert to simpler format
	var backups []map[string]interface{}
	for _, backup := range backupList.Items {
		backupData := map[string]interface{}{
			"name":              backup.GetName(),
			"namespace":         backup.GetNamespace(),
			"creationTimestamp": backup.GetCreationTimestamp(),
			"labels":            backup.GetLabels(),
		}

		// Extract status if available
		if status, found := backup.Object["status"]; found {
			backupData["status"] = status
		}

		// Extract spec if available
		if spec, found := backup.Object["spec"]; found {
			backupData["spec"] = spec
		}

		backups = append(backups, backupData)
	}

	c.JSON(http.StatusOK, gin.H{
		"backups": backups,
		"count":   len(backups),
	})
}

func (h *VeleroHandler) DeleteBackup(c *gin.Context) {
	backupName := c.Param("name")
	if backupName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "backup name is required",
		})
		return
	}

	// Delete the backup from Velero namespace
	err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		Delete(h.k8sClient.Context, backupName, metav1.DeleteOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete backup",
			"details": err.Error(),
			"backup":  backupName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Backup deleted successfully",
		"backup":  backupName,
	})
}

func (h *VeleroHandler) CreateBackup(c *gin.Context) {
	var request struct {
		Name               string   `json:"name" binding:"required"`
		IncludedNamespaces []string `json:"includedNamespaces,omitempty"`
		ExcludedNamespaces []string `json:"excludedNamespaces,omitempty"`
		StorageLocation    string   `json:"storageLocation,omitempty"`
		TTL                string   `json:"ttl,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Set defaults
	if request.StorageLocation == "" {
		request.StorageLocation = "default"
	}
	if request.TTL == "" {
		request.TTL = "720h0m0s"
	}

	// Create backup object
	backup := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Backup",
		"metadata": map[string]interface{}{
			"name":      request.Name,
			"namespace": "velero",
		},
		"spec": map[string]interface{}{
			"storageLocation": request.StorageLocation,
			"ttl":             request.TTL,
		},
	}

	// Add namespaces if specified
	if len(request.IncludedNamespaces) > 0 {
		backup["spec"].(map[string]interface{})["includedNamespaces"] = request.IncludedNamespaces
	}
	if len(request.ExcludedNamespaces) > 0 {
		backup["spec"].(map[string]interface{})["excludedNamespaces"] = request.ExcludedNamespaces
	}

	// Create the backup in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: backup}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create backup",
			"details": err.Error(),
			"backup":  request.Name,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Backup created successfully",
		"backup":  result.GetName(),
		"status":  "created",
	})
}
func (h *VeleroHandler) CreateRestore(c *gin.Context) {
	var request struct {
		Name                    string            `json:"name" binding:"required"`
		BackupName              string            `json:"backupName" binding:"required"`
		IncludedNamespaces      []string          `json:"includedNamespaces,omitempty"`
		ExcludedNamespaces      []string          `json:"excludedNamespaces,omitempty"`
		NamespaceMapping        map[string]string `json:"namespaceMapping,omitempty"`
		RestorePVs              *bool             `json:"restorePVs,omitempty"`
		IncludeClusterResources *bool             `json:"includeClusterResources,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Create restore object
	restore := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Restore",
		"metadata": map[string]interface{}{
			"name":      request.Name,
			"namespace": "velero",
		},
		"spec": map[string]interface{}{
			"backupName": request.BackupName,
		},
	}

	spec := restore["spec"].(map[string]interface{})

	// Add optional fields
	if len(request.IncludedNamespaces) > 0 {
		spec["includedNamespaces"] = request.IncludedNamespaces
	}
	if len(request.ExcludedNamespaces) > 0 {
		spec["excludedNamespaces"] = request.ExcludedNamespaces
	}
	if len(request.NamespaceMapping) > 0 {
		spec["namespaceMapping"] = request.NamespaceMapping
	}
	if request.RestorePVs != nil {
		spec["restorePVs"] = *request.RestorePVs
	}
	if request.IncludeClusterResources != nil {
		spec["includeClusterResources"] = *request.IncludeClusterResources
	}

	// Create the restore in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.RestoreGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: restore}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create restore",
			"details": err.Error(),
			"restore": request.Name,
			"backup":  request.BackupName,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Restore created successfully",
		"restore": result.GetName(),
		"backup":  request.BackupName,
		"status":  "created",
	})
}
