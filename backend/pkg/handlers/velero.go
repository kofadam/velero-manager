package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"velero-manager/pkg/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
			"error": "Velero not installed or CRDs not found",
			"details": err.Error(),
			"help": "Install Velero: https://velero.io/docs/v1.12/basic-install/",
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
			"error": "Failed to list backups",
			"details": err.Error(),
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
			"labels":           backup.GetLabels(),
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