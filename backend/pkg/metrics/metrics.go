package metrics

import (
	"context"
	"strconv"
	"time"

	"velero-manager/pkg/k8s"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type VeleroMetrics struct {
	k8sClient *k8s.Client

	// Backup metrics
	BackupTotal         prometheus.CounterVec
	BackupSuccessTotal  prometheus.CounterVec
	BackupFailureTotal  prometheus.CounterVec
	BackupDuration      prometheus.HistogramVec
	BackupSizeBytes     prometheus.GaugeVec
	BackupItemsTotal    prometheus.GaugeVec
	BackupItemsBackedUp prometheus.GaugeVec
	BackupErrors        prometheus.GaugeVec
	BackupWarnings      prometheus.GaugeVec

	// Restore metrics
	RestoreTotal         prometheus.CounterVec
	RestoreSuccessTotal  prometheus.CounterVec
	RestoreFailureTotal  prometheus.CounterVec
	RestoreDuration      prometheus.HistogramVec
	RestoreItemsTotal    prometheus.GaugeVec
	RestoreItemsRestored prometheus.GaugeVec
	RestoreErrors        prometheus.GaugeVec
	RestoreWarnings      prometheus.GaugeVec

	// Schedule metrics
	ScheduleTotal            prometheus.GaugeVec
	SchedulePaused           prometheus.GaugeVec
	ScheduleLastBackup       prometheus.GaugeVec
	ScheduleValidationErrors prometheus.GaugeVec

	// General metrics
	VeleroAvailable    prometheus.Gauge
	APIRequestsTotal   prometheus.CounterVec
	APIRequestDuration prometheus.HistogramVec
}

func NewVeleroMetrics(k8sClient *k8s.Client) *VeleroMetrics {
	return &VeleroMetrics{
		k8sClient: k8sClient,

		// Backup metrics
		BackupTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_backup_total",
			Help: "Total number of Velero backups created",
		}, []string{"namespace", "schedule", "storage_location"}),

		BackupSuccessTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_backup_success_total",
			Help: "Total number of successful Velero backups",
		}, []string{"namespace", "schedule", "storage_location"}),

		BackupFailureTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_backup_failure_total",
			Help: "Total number of failed Velero backups",
		}, []string{"namespace", "schedule", "storage_location"}),

		BackupDuration: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "velero_backup_duration_seconds",
			Help:    "Duration of Velero backups in seconds",
			Buckets: prometheus.ExponentialBuckets(30, 2, 10), // 30s to ~8.5 hours
		}, []string{"namespace", "schedule", "phase"}),

		BackupSizeBytes: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_backup_size_bytes",
			Help: "Size of Velero backup in bytes",
		}, []string{"namespace", "backup_name", "phase"}),

		BackupItemsTotal: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_backup_items_total",
			Help: "Total number of items in Velero backup",
		}, []string{"namespace", "backup_name", "phase"}),

		BackupItemsBackedUp: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_backup_items_backed_up",
			Help: "Number of items successfully backed up in Velero backup",
		}, []string{"namespace", "backup_name", "phase"}),

		BackupErrors: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_backup_errors",
			Help: "Number of errors in Velero backup",
		}, []string{"namespace", "backup_name", "phase"}),

		BackupWarnings: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_backup_warnings",
			Help: "Number of warnings in Velero backup",
		}, []string{"namespace", "backup_name", "phase"}),

		// Restore metrics
		RestoreTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_restore_total",
			Help: "Total number of Velero restores created",
		}, []string{"namespace", "backup_name"}),

		RestoreSuccessTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_restore_success_total",
			Help: "Total number of successful Velero restores",
		}, []string{"namespace", "backup_name"}),

		RestoreFailureTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_restore_failure_total",
			Help: "Total number of failed Velero restores",
		}, []string{"namespace", "backup_name"}),

		RestoreDuration: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "velero_restore_duration_seconds",
			Help:    "Duration of Velero restores in seconds",
			Buckets: prometheus.ExponentialBuckets(30, 2, 10), // 30s to ~8.5 hours
		}, []string{"namespace", "backup_name", "phase"}),

		RestoreItemsTotal: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_restore_items_total",
			Help: "Total number of items in Velero restore",
		}, []string{"namespace", "restore_name", "phase"}),

		RestoreItemsRestored: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_restore_items_restored",
			Help: "Number of items successfully restored in Velero restore",
		}, []string{"namespace", "restore_name", "phase"}),

		RestoreErrors: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_restore_errors",
			Help: "Number of errors in Velero restore",
		}, []string{"namespace", "restore_name", "phase"}),

		RestoreWarnings: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_restore_warnings",
			Help: "Number of warnings in Velero restore",
		}, []string{"namespace", "restore_name", "phase"}),

		// Schedule metrics
		ScheduleTotal: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_schedule_total",
			Help: "Total number of Velero schedules",
		}, []string{"namespace", "phase"}),

		SchedulePaused: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_schedule_paused",
			Help: "Number of paused Velero schedules",
		}, []string{"namespace"}),

		ScheduleLastBackup: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_schedule_last_backup_timestamp",
			Help: "Timestamp of last backup created by schedule",
		}, []string{"namespace", "schedule_name"}),

		ScheduleValidationErrors: *promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "velero_schedule_validation_errors",
			Help: "Number of validation errors in Velero schedule",
		}, []string{"namespace", "schedule_name"}),

		// General metrics
		VeleroAvailable: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "velero_available",
			Help: "Whether Velero CRDs are available (1) or not (0)",
		}),

		APIRequestsTotal: *promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "velero_manager_api_requests_total",
			Help: "Total number of API requests to Velero Manager",
		}, []string{"method", "endpoint", "status_code"}),

		APIRequestDuration: *promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "velero_manager_api_request_duration_seconds",
			Help:    "Duration of API requests to Velero Manager",
			Buckets: prometheus.DefBuckets,
		}, []string{"method", "endpoint"}),
	}
}

// UpdateVeleroMetrics collects and updates all Velero metrics
func (vm *VeleroMetrics) UpdateVeleroMetrics() error {
	// Check if Velero is available
	_, err := vm.k8sClient.Clientset.Discovery().ServerResourcesForGroupVersion("velero.io/v1")
	if err != nil {
		vm.VeleroAvailable.Set(0)
		return err
	}
	vm.VeleroAvailable.Set(1)

	// Update backup metrics
	if err := vm.updateBackupMetrics(); err != nil {
		return err
	}

	// Update restore metrics
	if err := vm.updateRestoreMetrics(); err != nil {
		return err
	}

	// Update schedule metrics
	if err := vm.updateScheduleMetrics(); err != nil {
		return err
	}

	return nil
}

func (vm *VeleroMetrics) updateBackupMetrics() error {
	backupList, err := vm.k8sClient.DynamicClient.
		Resource(k8s.BackupGVR).
		Namespace("velero").
		List(context.Background(), metav1.ListOptions{})

	if err != nil {
		return err
	}

	// Reset gauges to avoid stale metrics
	vm.BackupSizeBytes.Reset()
	vm.BackupItemsTotal.Reset()
	vm.BackupItemsBackedUp.Reset()
	vm.BackupErrors.Reset()
	vm.BackupWarnings.Reset()

	for _, backup := range backupList.Items {
		name := backup.GetName()
		namespace := backup.GetNamespace()

		// Get labels for schedule and storage location
		labels := backup.GetLabels()
		schedule := "manual"
		if sched, ok := labels["velero.io/schedule-name"]; ok {
			schedule = sched
		}

		// Get storage location from spec
		_ = "default" // Remove unused variable

		// Process status
		if status, found := backup.Object["status"]; found {
			if statusMap, ok := status.(map[string]interface{}); ok {
				phase := "Unknown"
				if p, ok := statusMap["phase"].(string); ok {
					phase = p
				}

				// Count totals instead of incrementing counters repeatedly
				// (counters will be set to actual counts after the loop)

				// Update duration if available
				if startTime, ok := statusMap["startTimestamp"]; ok && startTime != nil {
					if endTime, ok := statusMap["completionTimestamp"]; ok && endTime != nil {
						if startStr, ok := startTime.(string); ok {
							if endStr, ok := endTime.(string); ok {
								if start, err := time.Parse(time.RFC3339, startStr); err == nil {
									if end, err := time.Parse(time.RFC3339, endStr); err == nil {
										duration := end.Sub(start).Seconds()
										vm.BackupDuration.WithLabelValues(namespace, schedule, phase).Observe(duration)
									}
								}
							}
						}
					}
				}

				// Update item counts
				if totalItems, ok := statusMap["totalItems"]; ok {
					if count, ok := totalItems.(float64); ok {
						vm.BackupItemsTotal.WithLabelValues(namespace, name, phase).Set(count)
					}
				}

				if itemsBackedUp, ok := statusMap["itemsBackedUp"]; ok {
					if count, ok := itemsBackedUp.(float64); ok {
						vm.BackupItemsBackedUp.WithLabelValues(namespace, name, phase).Set(count)
					}
				}

				if errors, ok := statusMap["errors"]; ok {
					if count, ok := errors.(float64); ok {
						vm.BackupErrors.WithLabelValues(namespace, name, phase).Set(count)
					}
				}

				if warnings, ok := statusMap["warnings"]; ok {
					if count, ok := warnings.(float64); ok {
						vm.BackupWarnings.WithLabelValues(namespace, name, phase).Set(count)
					}
				}
			}
		}
	}

	// Set actual counts after processing all backups
	totalCompleted := 0
	totalFailed := 0
	for _, backup := range backupList.Items {
		if status, found := backup.Object["status"]; found {
			if statusMap, ok := status.(map[string]interface{}); ok {
				if phase, ok := statusMap["phase"].(string); ok {
					switch phase {
					case "Completed":
						totalCompleted++
					case "Failed", "PartiallyFailed":
						totalFailed++
					}
				}
			}
		}
	}

	// Reset and set correct values using gauges instead of counters for current state
	vm.BackupSuccessTotal.Reset()
	vm.BackupFailureTotal.Reset()
	if totalCompleted > 0 {
		vm.BackupSuccessTotal.WithLabelValues("velero", "manual", "default").Add(float64(totalCompleted))
	}
	if totalFailed > 0 {
		vm.BackupFailureTotal.WithLabelValues("velero", "manual", "default").Add(float64(totalFailed))
	}

	return nil
}

func (vm *VeleroMetrics) updateRestoreMetrics() error {
	restoreList, err := vm.k8sClient.DynamicClient.
		Resource(k8s.RestoreGVR).
		Namespace("velero").
		List(context.Background(), metav1.ListOptions{})

	if err != nil {
		return err
	}

	// Reset gauges to avoid stale metrics
	vm.RestoreItemsTotal.Reset()
	vm.RestoreItemsRestored.Reset()
	vm.RestoreErrors.Reset()
	vm.RestoreWarnings.Reset()

	for _, restore := range restoreList.Items {
		name := restore.GetName()
		namespace := restore.GetNamespace()

		// Get backup name from spec
		backupName := "unknown"
		if spec, found := restore.Object["spec"]; found {
			if specMap, ok := spec.(map[string]interface{}); ok {
				if bn, ok := specMap["backupName"].(string); ok {
					backupName = bn
				}
			}
		}

		// Process status
		if status, found := restore.Object["status"]; found {
			if statusMap, ok := status.(map[string]interface{}); ok {
				phase := "Unknown"
				if p, ok := statusMap["phase"].(string); ok {
					phase = p
				}

				// Update restore counters based on phase
				vm.RestoreTotal.WithLabelValues(namespace, backupName).Inc()

				switch phase {
				case "Completed":
					vm.RestoreSuccessTotal.WithLabelValues(namespace, backupName).Inc()
				case "Failed", "PartiallyFailed":
					vm.RestoreFailureTotal.WithLabelValues(namespace, backupName).Inc()
				}

				// Update duration if available
				if startTime, ok := statusMap["startTimestamp"]; ok && startTime != nil {
					if endTime, ok := statusMap["completionTimestamp"]; ok && endTime != nil {
						if startStr, ok := startTime.(string); ok {
							if endStr, ok := endTime.(string); ok {
								if start, err := time.Parse(time.RFC3339, startStr); err == nil {
									if end, err := time.Parse(time.RFC3339, endStr); err == nil {
										duration := end.Sub(start).Seconds()
										vm.RestoreDuration.WithLabelValues(namespace, backupName, phase).Observe(duration)
									}
								}
							}
						}
					}
				}

				// Update item counts
				if itemsRestored, ok := statusMap["itemsRestored"]; ok {
					if count, ok := itemsRestored.(float64); ok {
						vm.RestoreItemsRestored.WithLabelValues(namespace, name, phase).Set(count)
					}
				}

				if errors, ok := statusMap["errors"]; ok {
					if count, ok := errors.(float64); ok {
						vm.RestoreErrors.WithLabelValues(namespace, name, phase).Set(count)
					}
				}

				if warnings, ok := statusMap["warnings"]; ok {
					if count, ok := warnings.(float64); ok {
						vm.RestoreWarnings.WithLabelValues(namespace, name, phase).Set(count)
					}
				}
			}
		}
	}

	return nil
}

func (vm *VeleroMetrics) updateScheduleMetrics() error {
	scheduleList, err := vm.k8sClient.DynamicClient.
		Resource(k8s.ScheduleGVR).
		Namespace("velero").
		List(context.Background(), metav1.ListOptions{})

	if err != nil {
		return err
	}

	// Reset gauges to avoid stale metrics
	vm.ScheduleTotal.Reset()
	vm.SchedulePaused.Reset()
	vm.ScheduleLastBackup.Reset()
	vm.ScheduleValidationErrors.Reset()

	totalSchedules := 0
	pausedSchedules := 0

	for _, schedule := range scheduleList.Items {
		name := schedule.GetName()
		namespace := schedule.GetNamespace()

		totalSchedules++

		// Check if schedule is paused
		if spec, found := schedule.Object["spec"]; found {
			if specMap, ok := spec.(map[string]interface{}); ok {
				if paused, ok := specMap["paused"].(bool); ok && paused {
					pausedSchedules++
				}
			}
		}

		// Process status
		if status, found := schedule.Object["status"]; found {
			if statusMap, ok := status.(map[string]interface{}); ok {
				phase := "Unknown"
				if p, ok := statusMap["phase"].(string); ok {
					phase = p
				}

				// Update last backup timestamp
				if lastBackup, ok := statusMap["lastBackup"]; ok && lastBackup != nil {
					if lastBackupStr, ok := lastBackup.(string); ok {
						if lastBackupTime, err := time.Parse(time.RFC3339, lastBackupStr); err == nil {
							vm.ScheduleLastBackup.WithLabelValues(namespace, name).Set(float64(lastBackupTime.Unix()))
						}
					}
				}

				// Update validation errors
				if validationErrors, ok := statusMap["validationErrors"]; ok {
					if errors, ok := validationErrors.([]interface{}); ok {
						vm.ScheduleValidationErrors.WithLabelValues(namespace, name).Set(float64(len(errors)))
					}
				}

				vm.ScheduleTotal.WithLabelValues(namespace, phase).Inc()
			}
		}
	}

	vm.SchedulePaused.WithLabelValues("velero").Set(float64(pausedSchedules))

	return nil
}

// RecordAPIRequest records API request metrics
func (vm *VeleroMetrics) RecordAPIRequest(method, endpoint string, statusCode int, duration time.Duration) {
	vm.APIRequestsTotal.WithLabelValues(method, endpoint, strconv.Itoa(statusCode)).Inc()
	vm.APIRequestDuration.WithLabelValues(method, endpoint).Observe(duration.Seconds())
}
