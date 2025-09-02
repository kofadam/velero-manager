package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"
	"velero-manager/pkg/k8s"
	"velero-manager/pkg/metrics"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type VeleroHandler struct {
	k8sClient *k8s.Client
	metrics   *metrics.VeleroMetrics
}

func NewVeleroHandler(k8sClient *k8s.Client, veleroMetrics *metrics.VeleroMetrics) *VeleroHandler {
	return &VeleroHandler{
		k8sClient: k8sClient,
		metrics:   veleroMetrics,
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

func (h *VeleroHandler) CreateCronJob(c *gin.Context) {
	var request struct {
		Name               string   `json:"name" binding:"required"`
		Cluster            string   `json:"cluster" binding:"required"`
		Schedule           string   `json:"schedule" binding:"required"`
		IncludedNamespaces []string `json:"includedNamespaces,omitempty"`
		ExcludedNamespaces []string `json:"excludedNamespaces,omitempty"`
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
	if request.TTL == "" {
		request.TTL = "720h"
	}

	// Generate CronJob name following the pattern
	cronJobName := fmt.Sprintf("backup-%s-daily", request.Cluster)
	if request.Name != "" {
		cronJobName = request.Name
	}

	// Build namespace selector
	namespaceArg := "--all-namespaces"
	if len(request.IncludedNamespaces) > 0 {
		namespaceArg = fmt.Sprintf("--include-namespaces=%s", strings.Join(request.IncludedNamespaces, ","))
	}

	// Create CronJob manifest
	cronJob := map[string]interface{}{
		"apiVersion": "batch/v1",
		"kind":       "CronJob",
		"metadata": map[string]interface{}{
			"name":      cronJobName,
			"namespace": "velero",
			"labels": map[string]interface{}{
				"velero.io/cluster": request.Cluster,
				"app":               "velero-backup",
			},
		},
		"spec": map[string]interface{}{
			"schedule": request.Schedule,
			"jobTemplate": map[string]interface{}{
				"spec": map[string]interface{}{
					"template": map[string]interface{}{
						"spec": map[string]interface{}{
							"containers": []map[string]interface{}{
								{
									"name":  "velero-backup",
									"image": "velero/velero:v1.12.0",
									"command": []string{
										"/bin/sh",
										"-c",
										fmt.Sprintf(`velero backup create %s-$(date +%%Y%%m%%d%%H%%M%%S) %s --ttl %s --wait`,
											request.Cluster, namespaceArg, request.TTL),
									},
									"volumeMounts": []map[string]interface{}{
										{
											"name":      "cluster-credentials",
											"mountPath": "/credentials",
											"readOnly":  true,
										},
									},
								},
							},
							"restartPolicy": "OnFailure",
							"volumes": []map[string]interface{}{
								{
									"name": "cluster-credentials",
									"secret": map[string]interface{}{
										"secretName": fmt.Sprintf("%s-credentials", request.Cluster),
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create the CronJob in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: cronJob}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create CronJob",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "CronJob created successfully",
		"cronJob": result.GetName(),
		"cluster": request.Cluster,
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

func (h *VeleroHandler) DeleteCronJob(c *gin.Context) {
	cronJobName := c.Param("name")
	if cronJobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CronJob name is required",
		})
		return
	}

	err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Delete(h.k8sClient.Context, cronJobName, metav1.DeleteOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete CronJob",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "CronJob deleted successfully",
		"cronJob": cronJobName,
	})
}

func (h *VeleroHandler) UpdateCronJob(c *gin.Context) {
	cronJobName := c.Param("name")
	if cronJobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CronJob name is required",
		})
		return
	}

	var request struct {
		Suspend *bool `json:"suspend,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Get existing CronJob
	existing, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Get(h.k8sClient.Context, cronJobName, metav1.GetOptions{})

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "CronJob not found",
			"details": err.Error(),
		})
		return
	}

	// Update suspend field
	if request.Suspend != nil {
		if spec, ok := existing.Object["spec"].(map[string]interface{}); ok {
			spec["suspend"] = *request.Suspend
		}
	}

	// Update the CronJob
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Update(h.k8sClient.Context, existing, metav1.UpdateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update CronJob",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "CronJob updated successfully",
		"cronJob": result.GetName(),
	})
}

func (h *VeleroHandler) TriggerCronJob(c *gin.Context) {
	cronJobName := c.Param("name")
	if cronJobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CronJob name is required",
		})
		return
	}

	// Get the CronJob to extract its spec
	cronJob, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Get(h.k8sClient.Context, cronJobName, metav1.GetOptions{})

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "CronJob not found",
			"details": err.Error(),
		})
		return
	}

	// Extract cluster name for the backup
	clusterName := extractClusterFromCronJobName(cronJobName)
	
	// Create a Job from the CronJob template
	jobName := fmt.Sprintf("%s-manual-%d", cronJobName, time.Now().Unix())
	
	// Get job template from CronJob spec
	spec, _ := cronJob.Object["spec"].(map[string]interface{})
	jobTemplate, _ := spec["jobTemplate"].(map[string]interface{})
	jobSpec, _ := jobTemplate["spec"].(map[string]interface{})

	// Create Job manifest
	job := map[string]interface{}{
		"apiVersion": "batch/v1",
		"kind":       "Job",
		"metadata": map[string]interface{}{
			"name":      jobName,
			"namespace": "velero",
			"labels": map[string]interface{}{
				"velero.io/cluster":   clusterName,
				"velero.io/triggered": "manual",
				"cronjob-name":        cronJobName,
			},
		},
		"spec": jobSpec,
	}

	// Create the Job
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.JobGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: job}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to trigger CronJob",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Backup triggered successfully",
		"job":     result.GetName(),
		"cronJob": cronJobName,
		"cluster": clusterName,
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

func (h *VeleroHandler) GetClusterDetails(c *gin.Context) {
	clusterName := c.Param("cluster")
	
	// Get CronJob for this cluster to extract configuration
	cronJobList, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get cluster details",
			"details": err.Error(),
		})
		return
	}
	
	// Find the CronJob for this cluster
	var clusterCronJob map[string]interface{}
	for _, cronJob := range cronJobList.Items {
		if extractClusterFromCronJobName(cronJob.GetName()) == clusterName {
			clusterCronJob = cronJob.Object
			break
		}
	}
	
	// Extract secret name from CronJob spec if available
	secretName := fmt.Sprintf("%s-credentials", clusterName) // Default pattern
	if clusterCronJob != nil {
		if spec, ok := clusterCronJob["spec"].(map[string]interface{}); ok {
			if jobTemplate, ok := spec["jobTemplate"].(map[string]interface{}); ok {
				if jobSpec, ok := jobTemplate["spec"].(map[string]interface{}); ok {
					if template, ok := jobSpec["template"].(map[string]interface{}); ok {
						if podSpec, ok := template["spec"].(map[string]interface{}); ok {
							if volumes, ok := podSpec["volumes"].([]interface{}); ok && len(volumes) > 0 {
								if volume, ok := volumes[0].(map[string]interface{}); ok {
									if secret, ok := volume["secret"].(map[string]interface{}); ok {
										if name, ok := secret["secretName"].(string); ok {
											secretName = name
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	
	// Get recent backups for this cluster
	backupList, _ := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})
	
	var lastBackup interface{}
	backupCount := 0
	
	for _, backup := range backupList.Items {
		if extractClusterFromBackupName(backup.GetName()) == clusterName {
			backupCount++
			if lastBackup == nil {
				lastBackup = backup.GetCreationTimestamp()
			}
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"cluster": clusterName,
		"secretName": secretName,
		"backupCount": backupCount,
		"lastBackup": lastBackup,
		"cronJob": clusterCronJob != nil,
	})
}

func (h *VeleroHandler) ListClusters(c *gin.Context) {
	// Get all CronJobs to identify clusters
	cronJobList, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list cronjobs",
			"details": err.Error(),
		})
		return
	}
	
	// Build cluster map from CronJobs first
	clusterMap := make(map[string]map[string]interface{})
	
	for _, cronJob := range cronJobList.Items {
		clusterName := extractClusterFromCronJobName(cronJob.GetName())
		if clusterName != "unknown" && clusterName != "" {
			clusterMap[clusterName] = map[string]interface{}{
				"name": clusterName,
				"backupCount": 0,
				"lastBackup": nil,
			}
		}
	}
	
	// Try to get backups (but don't fail if they don't exist)
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})
	
	if err == nil {
	
	// Add backup counts and last backup times
		for _, backup := range backupList.Items {
			clusterName := extractClusterFromBackupName(backup.GetName())
			if cluster, exists := clusterMap[clusterName]; exists {
				cluster["backupCount"] = cluster["backupCount"].(int) + 1
				
				backupTime := backup.GetCreationTimestamp()
				if cluster["lastBackup"] == nil || backupTime.After(cluster["lastBackup"].(metav1.Time).Time) {
					cluster["lastBackup"] = backupTime
				}
			}
		}
	}
	
	// Convert map to slice
	clusters := make([]map[string]interface{}, 0, len(clusterMap))
	for _, cluster := range clusterMap {
		clusters = append(clusters, cluster)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"clusters": clusters,
		"count": len(clusters),
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

func (h *VeleroHandler) ListStorageLocations(c *gin.Context) {
	// Get storage locations from Velero namespace
	storageList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupStorageLocationGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list storage locations",
			"details": err.Error(),
		})
		return
	}

	var locations []map[string]interface{}
	for _, location := range storageList.Items {
		locationData := map[string]interface{}{
			"name":      location.GetName(),
			"namespace": location.GetNamespace(),
			"spec":      location.Object["spec"],
			"status":    location.Object["status"],
		}
		locations = append(locations, locationData)
	}

	c.JSON(http.StatusOK, gin.H{
		"locations": locations,
		"count":     len(locations),
	})
}

func (h *VeleroHandler) CreateStorageLocation(c *gin.Context) {
	var request struct {
		Name       string `json:"name" binding:"required"`
		Provider   string `json:"provider" binding:"required"`
		Bucket     string `json:"bucket" binding:"required"`
		Region     string `json:"region,omitempty"`
		Prefix     string `json:"prefix,omitempty"`
		Config     map[string]string `json:"config,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Create BackupStorageLocation object
	storageLocation := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "BackupStorageLocation",
		"metadata": map[string]interface{}{
			"name":      request.Name,
			"namespace": "velero",
		},
		"spec": map[string]interface{}{
			"provider": request.Provider,
			"objectStorage": map[string]interface{}{
				"bucket": request.Bucket,
				"prefix": request.Prefix,
			},
		},
	}

	// Add config if provided
	if len(request.Config) > 0 {
		storageLocation["spec"].(map[string]interface{})["config"] = request.Config
	}

	// Create the storage location in Kubernetes
	result, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupStorageLocationGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: storageLocation}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create storage location",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Storage location created successfully",
		"location": result.GetName(),
	})
}

func (h *VeleroHandler) DeleteStorageLocation(c *gin.Context) {
	locationName := c.Param("name")
	if locationName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Storage location name is required",
		})
		return
	}

	// Prevent deletion of default location
	if locationName == "default" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Cannot delete default storage location",
		})
		return
	}

	err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupStorageLocationGVR).
		Namespace("velero").
		Delete(h.k8sClient.Context, locationName, metav1.DeleteOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete storage location",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Storage location deleted successfully",
		"location": locationName,
	})
}

func (h *VeleroHandler) AddCluster(c *gin.Context) {
	var request struct {
		Name            string `json:"name" binding:"required"`
		APIEndpoint     string `json:"apiEndpoint" binding:"required"`
		Schedule        string `json:"schedule" binding:"required"`
		StorageLocation string `json:"storageLocation"`
		TTL             string `json:"ttl"`
		Token           string `json:"token" binding:"required"`
		CACert          string `json:"caCert" binding:"required"`
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
		request.TTL = "720h"
	}

	// Create Secret for cluster credentials
	secretName := fmt.Sprintf("%s-sa-token", request.Name)
	
	// Token comes as plain text, needs base64 encoding
	tokenData := base64.StdEncoding.EncodeToString([]byte(request.Token))
	
	// CA cert should already be base64 encoded from kubectl output
	// Validate it's proper base64
	if _, err := base64.StdEncoding.DecodeString(request.CACert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid CA certificate",
			"details": "CA certificate must be base64 encoded",
		})
		return
	}
	
	// Encode server URL to base64
	serverData := base64.StdEncoding.EncodeToString([]byte(request.APIEndpoint))
	
	secret := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Secret",
		"metadata": map[string]interface{}{
			"name":      secretName,
			"namespace": "velero",
			"labels": map[string]interface{}{
				"velero.io/cluster": request.Name,
				"app":               "velero-manager",
			},
		},
		"type": "Opaque",
		"data": map[string]interface{}{
			"token":  tokenData,
			"ca.crt": request.CACert,
			"server": serverData,
		},
	}

	// Create the Secret
	_, err := h.k8sClient.DynamicClient.
		Resource(k8s.SecretGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: secret}, metav1.CreateOptions{})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create secret",
			"details": err.Error(),
		})
		return
	}

	// Create CronJob for scheduled backups
	cronJobName := fmt.Sprintf("backup-%s-daily", request.Name)
	cronJob := map[string]interface{}{
		"apiVersion": "batch/v1",
		"kind":       "CronJob",
		"metadata": map[string]interface{}{
			"name":      cronJobName,
			"namespace": "velero",
			"labels": map[string]interface{}{
				"velero.io/cluster": request.Name,
				"app":               "velero-backup",
			},
		},
		"spec": map[string]interface{}{
			"schedule": request.Schedule,
			"jobTemplate": map[string]interface{}{
				"spec": map[string]interface{}{
					"template": map[string]interface{}{
						"spec": map[string]interface{}{
							"serviceAccountName": "velero-manager",
							"containers": []map[string]interface{}{
								{
									"name":  "trigger-backup",
									"image": "bitnami/kubectl:latest",
									"command": []string{
										"/bin/sh",
										"-c",
										fmt.Sprintf(`kubectl --server=$SERVER --token=$TOKEN --certificate-authority=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
create -f - <<EOF
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: %s-$(date +%%Y%%m%%d%%H%%M%%S)
  namespace: velero
spec:
  ttl: %s
  storageLocation: %s
  includedNamespaces:
  - "*"
EOF`, request.Name, request.TTL, request.StorageLocation),
									},
									"env": []map[string]interface{}{
										{
											"name": "SERVER",
											"valueFrom": map[string]interface{}{
												"secretKeyRef": map[string]interface{}{
													"name": secretName,
													"key":  "server",
												},
											},
										},
										{
											"name": "TOKEN",
											"valueFrom": map[string]interface{}{
												"secretKeyRef": map[string]interface{}{
													"name": secretName,
													"key":  "token",
												},
											},
										},
									},
									"volumeMounts": []map[string]interface{}{
										{
											"name":      "ca-cert",
											"mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
											"readOnly":  true,
										},
									},
								},
							},
							"restartPolicy": "OnFailure",
							"volumes": []map[string]interface{}{
								{
									"name": "ca-cert",
									"secret": map[string]interface{}{
										"secretName": secretName,
										"items": []map[string]interface{}{
											{
												"key":  "ca.crt",
												"path": "ca.crt",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create the CronJob
	_, err = h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		Create(h.k8sClient.Context, &unstructured.Unstructured{Object: cronJob}, metav1.CreateOptions{})

	if err != nil {
		// Try to clean up the secret if CronJob creation failed
		h.k8sClient.DynamicClient.
			Resource(k8s.SecretGVR).
			Namespace("velero").
			Delete(h.k8sClient.Context, secretName, metav1.DeleteOptions{})

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create CronJob",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Cluster added successfully",
		"cluster":  request.Name,
		"secret":   secretName,
		"cronJob":  cronJobName,
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

	// Get detailed cluster health metrics
	health, err := h.calculateClusterHealth(clusterName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to check cluster health",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, health)
}

func (h *VeleroHandler) calculateClusterHealth(clusterName string) (map[string]interface{}, error) {
	// Get all backups for this cluster
	backupList, err := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	if err != nil {
		return nil, fmt.Errorf("failed to list backups: %w", err)
	}

	var (
		totalBackups     int
		successfulBackups int
		failedBackups    int
		lastSuccessful   interface{}
		lastFailed       interface{}
		recentBackups    []map[string]interface{}
		lastBackup       interface{}
	)

	now := time.Now()
	lastWeek := now.Add(-7 * 24 * time.Hour)

	for _, backup := range backupList.Items {
		if extractClusterFromBackupName(backup.GetName()) != clusterName {
			continue
		}

		totalBackups++
		
		// Get backup status
		status, found, _ := unstructured.NestedString(backup.Object, "status", "phase")
		if !found {
			status = "Unknown"
		}

		creationTime := backup.GetCreationTimestamp()
		if lastBackup == nil || creationTime.After(lastBackup.(metav1.Time).Time) {
			lastBackup = creationTime
		}

		// Count success/failure rates
		switch status {
		case "Completed":
			successfulBackups++
			if lastSuccessful == nil || creationTime.After(lastSuccessful.(metav1.Time).Time) {
				lastSuccessful = creationTime
			}
		case "Failed", "FailedValidation":
			failedBackups++
			if lastFailed == nil || creationTime.After(lastFailed.(metav1.Time).Time) {
				lastFailed = creationTime
			}
		}

		// Collect recent backups (last week)
		if creationTime.After(lastWeek) {
			recentBackups = append(recentBackups, map[string]interface{}{
				"name":   backup.GetName(),
				"status": status,
				"time":   creationTime,
			})
		}
	}

	// Get restore information for this cluster
	restoreList, err := h.k8sClient.DynamicClient.
		Resource(k8s.RestoreGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	totalRestores := 0
	successfulRestores := 0
	failedRestores := 0

	if err == nil {
		for _, restore := range restoreList.Items {
			// Check if restore is from a backup of this cluster
			backupName, found, _ := unstructured.NestedString(restore.Object, "spec", "backupName")
			if !found || extractClusterFromBackupName(backupName) != clusterName {
				continue
			}

			totalRestores++
			status, found, _ := unstructured.NestedString(restore.Object, "status", "phase")
			if found {
				switch status {
				case "Completed":
					successfulRestores++
				case "Failed":
					failedRestores++
				}
			}
		}
	}

	// Calculate health status
	status := "healthy"
	if totalBackups == 0 {
		status = "no-backups"
	} else if failedBackups > 0 && successfulBackups == 0 {
		status = "critical"
	} else if float64(failedBackups)/float64(totalBackups) > 0.3 {
		status = "warning"
	}

	// Calculate success rates
	backupSuccessRate := float64(0)
	if totalBackups > 0 {
		backupSuccessRate = float64(successfulBackups) / float64(totalBackups) * 100
	}

	restoreSuccessRate := float64(0)
	if totalRestores > 0 {
		restoreSuccessRate = float64(successfulRestores) / float64(totalRestores) * 100
	}

	return map[string]interface{}{
		"cluster": clusterName,
		"status":  status,
		"backups": map[string]interface{}{
			"total":          totalBackups,
			"successful":     successfulBackups,
			"failed":         failedBackups,
			"successRate":    backupSuccessRate,
			"lastSuccessful": lastSuccessful,
			"lastFailed":     lastFailed,
			"last":           lastBackup,
		},
		"restores": map[string]interface{}{
			"total":       totalRestores,
			"successful":  successfulRestores,
			"failed":      failedRestores,
			"successRate": restoreSuccessRate,
		},
		"recentActivity": recentBackups,
		"updatedAt":      now,
	}, nil
}

// getClusterList returns list of clusters based on CronJobs and backups
func (h *VeleroHandler) getClusterList() ([]map[string]interface{}, error) {
	// Get all CronJobs to identify clusters
	cronJobList, err := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})
	
	if err != nil {
		return nil, fmt.Errorf("failed to list cronjobs: %w", err)
	}
	
	// Build cluster map from CronJobs first
	clusterMap := make(map[string]map[string]interface{})
	
	for _, cronJob := range cronJobList.Items {
		clusterName := extractClusterFromCronJobName(cronJob.GetName())
		if clusterName != "unknown" && clusterName != "" {
			clusterMap[clusterName] = map[string]interface{}{
				"Name": clusterName,
				"name": clusterName,
				"backupCount": 0,
				"lastBackup": nil,
			}
		}
	}
	
	// Convert map to slice
	clusters := make([]map[string]interface{}, 0, len(clusterMap))
	for _, cluster := range clusterMap {
		clusters = append(clusters, cluster)
	}
	
	return clusters, nil
}

// GetDashboardMetrics provides comprehensive dashboard statistics
func (h *VeleroHandler) GetDashboardMetrics(c *gin.Context) {
	// Get all clusters 
	clusters, err := h.getClusterList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch clusters",
			"details": err.Error(),
		})
		return
	}

	// Get health for all clusters
	clusterHealthMap := make(map[string]interface{})
	var totalClusters, healthyClusters, criticalClusters int
	
	for _, cluster := range clusters {
		clusterName := cluster["name"].(string)
		health, err := h.calculateClusterHealth(clusterName)
		if err != nil {
			continue
		}
		clusterHealthMap[clusterName] = health
		totalClusters++
		
		switch health["status"] {
		case "healthy":
			healthyClusters++
		case "critical":
			criticalClusters++
		}
	}

	// Get overall backup/restore statistics
	backupList, _ := h.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	restoreList, _ := h.k8sClient.DynamicClient.
		Resource(k8s.RestoreGVR).
		Namespace("velero").
		List(h.k8sClient.Context, metav1.ListOptions{})

	cronJobList, _ := h.k8sClient.DynamicClient.
		Resource(k8s.CronJobGVR).
		Namespace("velero-manager").
		List(h.k8sClient.Context, metav1.ListOptions{})

	// Calculate overall metrics
	now := time.Now()
	lastWeek := now.Add(-7 * 24 * time.Hour)
	
	var (
		totalBackups, successfulBackups, failedBackups     int
		totalRestores, successfulRestores, failedRestores int
		recentBackups, recentRestores                     []map[string]interface{}
	)

	// Process backups
	if backupList != nil {
		for _, backup := range backupList.Items {
			totalBackups++
			
			status, _, _ := unstructured.NestedString(backup.Object, "status", "phase")
			creationTime := backup.GetCreationTimestamp()
			
			switch status {
			case "Completed":
				successfulBackups++
			case "Failed", "FailedValidation":
				failedBackups++
			}
			
			if creationTime.After(lastWeek) {
				recentBackups = append(recentBackups, map[string]interface{}{
					"name":    backup.GetName(),
					"status":  status,
					"time":    creationTime,
					"cluster": extractClusterFromBackupName(backup.GetName()),
				})
			}
		}
	}

	// Process restores
	if restoreList != nil {
		for _, restore := range restoreList.Items {
			totalRestores++
			
			status, _, _ := unstructured.NestedString(restore.Object, "status", "phase")
			creationTime := restore.GetCreationTimestamp()
			
			switch status {
			case "Completed":
				successfulRestores++
			case "Failed":
				failedRestores++
			}
			
			if creationTime.After(lastWeek) {
				backupName, _, _ := unstructured.NestedString(restore.Object, "spec", "backupName")
				recentRestores = append(recentRestores, map[string]interface{}{
					"name":       restore.GetName(),
					"status":     status,
					"time":       creationTime,
					"backupName": backupName,
					"cluster":    extractClusterFromBackupName(backupName),
				})
			}
		}
	}

	// Calculate success rates
	backupSuccessRate := float64(0)
	if totalBackups > 0 {
		backupSuccessRate = float64(successfulBackups) / float64(totalBackups) * 100
	}

	restoreSuccessRate := float64(0)
	if totalRestores > 0 {
		restoreSuccessRate = float64(successfulRestores) / float64(totalRestores) * 100
	}

	response := map[string]interface{}{
		"clusters": map[string]interface{}{
			"total":     totalClusters,
			"healthy":   healthyClusters,
			"critical":  criticalClusters,
			"details":   clusterHealthMap,
		},
		"backups": map[string]interface{}{
			"total":       totalBackups,
			"successful":  successfulBackups,
			"failed":      failedBackups,
			"successRate": backupSuccessRate,
		},
		"restores": map[string]interface{}{
			"total":       totalRestores,
			"successful":  successfulRestores,
			"failed":      failedRestores,
			"successRate": restoreSuccessRate,
		},
		"schedules": map[string]interface{}{
			"total": len(cronJobList.Items),
		},
		"recentActivity": map[string]interface{}{
			"backups":  recentBackups,
			"restores": recentRestores,
		},
		"updatedAt": now,
	}

	c.JSON(http.StatusOK, response)
}

// GenerateTestData populates metrics with mock data for testing
func (h *VeleroHandler) GenerateTestData(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Metrics not initialized",
		})
		return
	}

	// Generate mock data
	h.metrics.GenerateMockData()

	c.JSON(http.StatusOK, gin.H{
		"message": "Mock data generated successfully",
		"note":    "Check /metrics endpoint and Grafana dashboards to see the test data",
		"clusters": []string{"core-cl1", "staging-cl2", "dev-cl3"},
		"data_types": []string{
			"cluster_health_status",
			"backup_success_rates", 
			"restore_operations",
			"backup_schedules",
			"api_request_metrics",
		},
	})
}