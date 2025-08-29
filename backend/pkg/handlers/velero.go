package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"
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
		backupName := backup.GetName()
		clusterName := extractClusterFromBackupName(backupName)
		
		backupData := map[string]interface{}{
			"name":              backupName,
			"cluster":           clusterName,
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

// DeleteRestore deletes a restore
func (h *VeleroHandler) DeleteRestore(c *gin.Context) {
        name := c.Param("name")
        
        err := h.k8sClient.DynamicClient.
                Resource(k8s.RestoreGVR).
                Namespace("velero").
                Delete(h.k8sClient.Context, name, metav1.DeleteOptions{})
        
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{
                        "error":   "Failed to delete restore",
                        "details": err.Error(),
                        "restore": name,
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "message": "Restore deleted successfully",
                "restore": name,
        })
}

// GetRestoreLogs returns logs for a restore
func (h *VeleroHandler) GetRestoreLogs(c *gin.Context) {
        name := c.Param("name")
        
        // For now, return a placeholder response
        // In a full implementation, this would fetch actual Velero restore logs
        c.JSON(http.StatusOK, gin.H{
                "logs": fmt.Sprintf("Restore logs for '%s' would be retrieved from Velero here.\\n\\nThis is a placeholder implementation. In production, this would:\\n1. Connect to the Velero pod\\n2. Fetch restore logs using 'velero restore logs %s'\\n3. Return the actual log content", name, name),
                "restore": name,
        })
}

// DescribeRestore returns detailed information about a restore
func (h *VeleroHandler) DescribeRestore(c *gin.Context) {
        name := c.Param("name")
        
        restore, err := h.k8sClient.DynamicClient.
                Resource(k8s.RestoreGVR).
                Namespace("velero").
                Get(h.k8sClient.Context, name, metav1.GetOptions{})
        
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{
                        "error":   "Restore not found",
                        "details": err.Error(),
                        "restore": name,
                })
                return
        }

        c.JSON(http.StatusOK, gin.H{
                "name":      restore.GetName(),
                "namespace": restore.GetNamespace(),
                "metadata":  restore.Object["metadata"],
                "spec":      restore.Object["spec"],
                "status":    restore.Object["status"],
        })
}
func (h *VeleroHandler) CreateRestore(c *gin.Context) {
	var request struct {
		Name                    string            `json:"name" binding:"required"`
		BackupName              string            `json:"backupName" binding:"required"`
		TargetCluster           string            `json:"targetCluster,omitempty"`
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
	labels := make(map[string]interface{})
	if request.TargetCluster != "" {
		labels["velero.io/target-cluster"] = request.TargetCluster
	}
	
	metadata := map[string]interface{}{
		"name":      request.Name,
		"namespace": "velero",
	}
	if len(labels) > 0 {
		metadata["labels"] = labels
	}
	
	restore := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Restore",
		"metadata":   metadata,
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
func (h *VeleroHandler) ListRestores(c *gin.Context) {
	// Check if Velero CRDs exist first
	_, err := h.k8sClient.Clientset.Discovery().ServerResourcesForGroupVersion("velero.io/v1")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Velero not installed or CRDs not found",
			"details": err.Error(),
		})
		return
	}

	// Get restores from Velero namespace
	restoreList, err := h.k8sClient.DynamicClient.
		Resource(k8s.RestoreGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to list restores",
			"details":   err.Error(),
			"namespace": "velero",
		})
		return
	}

	// Convert to simpler format
	var restores []map[string]interface{}
	for _, restore := range restoreList.Items {
		restoreName := restore.GetName()
		clusterName := extractClusterFromRestoreName(restoreName, restore.Object)
		
		restoreData := map[string]interface{}{
			"name":              restoreName,
			"cluster":           clusterName,
			"namespace":         restore.GetNamespace(),
			"creationTimestamp": restore.GetCreationTimestamp(),
			"labels":            restore.GetLabels(),
		}

		// Extract status if available
		if status, found := restore.Object["status"]; found {
			restoreData["status"] = status
		}

		// Extract spec if available
		if spec, found := restore.Object["spec"]; found {
			restoreData["spec"] = spec
		}

		restores = append(restores, restoreData)
	}

	c.JSON(http.StatusOK, gin.H{
		"restores": restores,
		"count":    len(restores),
	})
}

func (h *VeleroHandler) ListSchedules(c *gin.Context) {
	// Check if Velero CRDs exist first
	_, err := h.k8sClient.Clientset.Discovery().ServerResourcesForGroupVersion("velero.io/v1")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Velero not installed or CRDs not found",
			"details": err.Error(),
		})
		return
	}

	// Get schedules from Velero namespace
	scheduleList, err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to list schedules",
			"details":   err.Error(),
			"namespace": "velero",
		})
		return
	}

	// Convert to simpler format
	var schedules []map[string]interface{}
	for _, schedule := range scheduleList.Items {
		scheduleData := map[string]interface{}{
			"name":              schedule.GetName(),
			"namespace":         schedule.GetNamespace(),
			"creationTimestamp": schedule.GetCreationTimestamp(),
			"labels":            schedule.GetLabels(),
		}

		// Extract status if available
		if status, found := schedule.Object["status"]; found {
			scheduleData["status"] = status
		}

		// Extract spec if available
		if spec, found := schedule.Object["spec"]; found {
			scheduleData["spec"] = spec
		}

		schedules = append(schedules, scheduleData)
	}

	c.JSON(http.StatusOK, gin.H{
		"schedules": schedules,
		"count":     len(schedules),
	})
}
func (h *VeleroHandler) CreateSchedule(c *gin.Context) {
	var request struct {
		Name               string   `json:"name" binding:"required"`
		Schedule           string   `json:"schedule" binding:"required"`
		IncludedNamespaces []string `json:"includedNamespaces,omitempty"`
		ExcludedNamespaces []string `json:"excludedNamespaces,omitempty"`
		StorageLocation    string   `json:"storageLocation,omitempty"`
		TTL                string   `json:"ttl,omitempty"`
		Paused             *bool    `json:"paused,omitempty"`
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

	// Create schedule object
	schedule := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Schedule",
		"metadata": map[string]interface{}{
			"name":      request.Name,
			"namespace": "velero",
		},
		"spec": map[string]interface{}{
			"schedule": request.Schedule,
			"template": map[string]interface{}{
				"storageLocation": request.StorageLocation,
				"ttl":             request.TTL,
			},
		},
	}

	template := schedule["spec"].(map[string]interface{})["template"].(map[string]interface{})

	// Add namespaces if specified
	if len(request.IncludedNamespaces) > 0 {
		template["includedNamespaces"] = request.IncludedNamespaces
	}
	if len(request.ExcludedNamespaces) > 0 {
		template["excludedNamespaces"] = request.ExcludedNamespaces
	}

	// Add paused status
	if request.Paused != nil && *request.Paused {
		schedule["spec"].(map[string]interface{})["paused"] = true
	}

	// Create the schedule in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: schedule}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Failed to create schedule",
			"details":  err.Error(),
			"schedule": request.Name,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Schedule created successfully",
		"schedule": result.GetName(),
		"status":   "created",
	})
}

func (h *VeleroHandler) DeleteSchedule(c *gin.Context) {
	scheduleName := c.Param("name")
	if scheduleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "schedule name is required",
		})
		return
	}

	// Delete the schedule from Velero namespace
	err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		Delete(h.k8sClient.Context, scheduleName, metav1.DeleteOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Failed to delete schedule",
			"details":  err.Error(),
			"schedule": scheduleName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Schedule deleted successfully",
		"schedule": scheduleName,
	})
}

func (h *VeleroHandler) UpdateSchedule(c *gin.Context) {
	scheduleName := c.Param("name")
	if scheduleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "schedule name is required",
		})
		return
	}

	var request struct {
		Paused *bool `json:"paused,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Get the existing schedule
	existing, err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		Get(h.k8sClient.Context, scheduleName, metav1.GetOptions{})

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":    "Schedule not found",
			"details":  err.Error(),
			"schedule": scheduleName,
		})
		return
	}

	// Update the paused status
	if request.Paused != nil {
		if *request.Paused {
			existing.Object["spec"].(map[string]interface{})["paused"] = true
		} else {
			delete(existing.Object["spec"].(map[string]interface{}), "paused")
		}
	}

	// Update the schedule
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		Update(h.k8sClient.Context, existing, metav1.UpdateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Failed to update schedule",
			"details":  err.Error(),
			"schedule": scheduleName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Schedule updated successfully",
		"schedule": result.GetName(),
	})
}
func (h *VeleroHandler) CreateBackupFromSchedule(c *gin.Context) {
	scheduleName := c.Param("name")
	if scheduleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "schedule name is required",
		})
		return
	}

	// Get the schedule to use its template
	schedule, err := h.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		Get(h.k8sClient.Context, scheduleName, metav1.GetOptions{})

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":    "Schedule not found",
			"details":  err.Error(),
			"schedule": scheduleName,
		})
		return
	}

	// Extract template from schedule spec
	scheduleSpec, found := schedule.Object["spec"].(map[string]interface{})
	if !found {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Invalid schedule specification",
			"schedule": scheduleName,
		})
		return
	}

	template, found := scheduleSpec["template"].(map[string]interface{})
	if !found {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Schedule template not found",
			"schedule": scheduleName,
		})
		return
	}

	// Generate backup name with timestamp
	timestamp := time.Now().Format("20060102-150405")
	backupName := fmt.Sprintf("%s-manual-%s", scheduleName, timestamp)

	// Create backup object using schedule template
	backup := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Backup",
		"metadata": map[string]interface{}{
			"name":      backupName,
			"namespace": "velero",
			"labels": map[string]interface{}{
				"velero.io/schedule-name": scheduleName,
				"velero.io/backup-type":   "manual",
			},
		},
		"spec": template,
	}

	// Create the backup in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: backup}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Failed to create backup from schedule",
			"details":  err.Error(),
			"schedule": scheduleName,
			"backup":   backupName,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Manual backup created successfully from schedule",
		"backup":     result.GetName(),
		"schedule":   scheduleName,
		"status":     "created",
		"backupType": "manual",
	})
}

func (h *VeleroHandler) ListCronJobs(c *gin.Context) {
	// Get cronjobs from Velero namespace
	cronJobList, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to list cronjobs",
			"details":   err.Error(),
			"namespace": "velero",
		})
		return
	}

	// Convert to simpler format
	var cronJobs []map[string]interface{}
	for _, cronJob := range cronJobList.Items {
		cronJobName := cronJob.GetName()
		clusterName := extractClusterFromCronJobName(cronJobName)
		
		cronJobData := map[string]interface{}{
			"name":              cronJobName,
			"cluster":           clusterName,
			"namespace":         cronJob.GetNamespace(),
			"creationTimestamp": cronJob.GetCreationTimestamp(),
			"labels":            cronJob.GetLabels(),
		}

		// Extract spec if available
		if spec, found := cronJob.Object["spec"]; found {
			cronJobData["spec"] = spec
		}

		// Extract status if available
		if status, found := cronJob.Object["status"]; found {
			cronJobData["status"] = status
		}

		cronJobs = append(cronJobs, cronJobData)
	}

	c.JSON(http.StatusOK, gin.H{
		"cronjobs": cronJobs,
		"count":    len(cronJobs),
	})
}

// extractClusterFromCronJobName parses cluster name from cronjob naming convention
// Example: "backup-core-cl1-daily" -> "core-cl1"
func extractClusterFromCronJobName(cronJobName string) string {
	if strings.HasPrefix(cronJobName, "backup-") && strings.HasSuffix(cronJobName, "-daily") {
		// Remove "backup-" prefix and "-daily" suffix
		clusterPart := strings.TrimPrefix(cronJobName, "backup-")
		clusterPart = strings.TrimSuffix(clusterPart, "-daily")
		return clusterPart
	}
	
	return "unknown"
}

// extractClusterFromBackupName parses cluster name from backup naming convention
// Example: "core-cl1-daily-backup-20250821020001" -> "core-cl1"
func extractClusterFromBackupName(backupName string) string {
	parts := strings.Split(backupName, "-daily-backup-")
	if len(parts) >= 2 {
		return parts[0]
	}
	
	// Fallback for other naming patterns
	if strings.Contains(backupName, "-centralized-") {
		parts = strings.Split(backupName, "-centralized-")
		if len(parts) >= 2 {
			return parts[0]
		}
	}
	
	return "unknown"
}

// extractClusterFromRestoreName parses cluster name from restore name or backup reference
func extractClusterFromRestoreName(restoreName string, restoreObj map[string]interface{}) string {
	// Try parsing from restore name first
	if cluster := extractClusterFromBackupName(restoreName); cluster != "management" && cluster != "unknown" {
		return cluster
	}
	
	// Try extracting from backup name in spec
	if spec, found := restoreObj["spec"].(map[string]interface{}); found {
		if backupName, found := spec["backupName"].(string); found {
			return extractClusterFromBackupName(backupName)
		}
	}
	
	return "management"
}

func (h *VeleroHandler) ListClusters(c *gin.Context) {
	// Get all backups to extract cluster list
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list backups for cluster detection",
			"details": err.Error(),
		})
		return
	}

	// Extract unique clusters from backup names
	clusterMap := make(map[string]map[string]interface{})
	
	for _, backup := range backupList.Items {
		clusterName := extractClusterFromBackupName(backup.GetName())
		if clusterName == "unknown" {
			continue
		}

		if _, exists := clusterMap[clusterName]; !exists {
			clusterMap[clusterName] = map[string]interface{}{
				"name":        clusterName,
				"backupCount": 0,
				"lastBackup":  nil,
			}
		}

		// Count backups per cluster
		clusterMap[clusterName]["backupCount"] = clusterMap[clusterName]["backupCount"].(int) + 1

		// Track most recent backup
		if clusterMap[clusterName]["lastBackup"] == nil {
			clusterMap[clusterName]["lastBackup"] = backup.GetCreationTimestamp()
		}
	}

	// Convert map to slice
	var clusters []map[string]interface{}
	for _, cluster := range clusterMap {
		clusters = append(clusters, cluster)
	}

	c.JSON(http.StatusOK, gin.H{
		"clusters": clusters,
		"count":    len(clusters),
	})
}

func (h *VeleroHandler) ListBackupsByCluster(c *gin.Context) {
	clusterName := c.Param("cluster")
	if clusterName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "cluster name is required",
		})
		return
	}

	// Get all backups
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list backups",
			"details": err.Error(),
		})
		return
	}

	// Filter by cluster
	var backups []map[string]interface{}
	for _, backup := range backupList.Items {
		if extractClusterFromBackupName(backup.GetName()) == clusterName {
			backupData := map[string]interface{}{
				"name":              backup.GetName(),
				"cluster":           clusterName,
				"namespace":         backup.GetNamespace(),
				"creationTimestamp": backup.GetCreationTimestamp(),
				"labels":            backup.GetLabels(),
			}

			if status, found := backup.Object["status"]; found {
				backupData["status"] = status
			}
			if spec, found := backup.Object["spec"]; found {
				backupData["spec"] = spec
			}

			backups = append(backups, backupData)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster": clusterName,
		"backups": backups,
		"count":   len(backups),
	})
}

func (h *VeleroHandler) GetClusterHealth(c *gin.Context) {
	clusterName := c.Param("cluster")
	if clusterName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "cluster name is required",
		})
		return
	}

	// Check if cluster has recent backups (indicates connectivity)
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to check cluster health",
			"details": err.Error(),
		})
		return
	}

	var lastBackup interface{}
	var backupCount int
	
	for _, backup := range backupList.Items {
		if extractClusterFromBackupName(backup.GetName()) == clusterName {
			backupCount++
			if lastBackup == nil {
				lastBackup = backup.GetCreationTimestamp()
			}
		}
	}

	status := "healthy"
	if backupCount == 0 {
		status = "no-backups"
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster":     clusterName,
		"status":      status,
		"backupCount": backupCount,
		"lastBackup":  lastBackup,
	})
}