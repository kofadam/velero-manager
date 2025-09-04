package metrics

import (
	"math/rand"
	"time"
)

// GenerateMockData populates metrics with realistic test data
func (vm *VeleroMetrics) GenerateMockData() {
	clusters := []string{"core-cl1", "staging-cl2", "dev-cl3"}
	namespaces := []string{"production", "staging", "development"}
	schedules := []string{"daily-backup", "weekly-backup", "hourly-snapshot"}
	storageLocations := []string{"aws-s3", "minio-local", "azure-blob"}

	// Generate cluster health data
	for _, cluster := range clusters {
		// Most clusters healthy (3), some warnings (2), rare critical (0-1)
		healthStatus := 3.0
		if rand.Float32() < 0.1 {
			healthStatus = 2.0 // Warning
		}
		if rand.Float32() < 0.02 {
			healthStatus = 0.0 // Critical
		}
		vm.ClusterHealthStatus.WithLabelValues(cluster).Set(healthStatus)

		// Backup success rate (85-99%)
		successRate := 85 + rand.Float64()*14
		vm.ClusterBackupSuccessRate.WithLabelValues(cluster).Set(successRate)

		// Restore success rate (90-100%)
		restoreRate := 90 + rand.Float64()*10
		vm.ClusterRestoreSuccessRate.WithLabelValues(cluster).Set(restoreRate)

		// Last backup timestamp (within last 24 hours)
		lastBackup := time.Now().Add(-time.Duration(rand.Intn(24)) * time.Hour).Unix()
		vm.ClusterLastBackupTime.WithLabelValues(cluster).Set(float64(lastBackup))

		// Total backups (50-500)
		totalBackups := float64(50 + rand.Intn(450))
		vm.ClusterBackupTotal.WithLabelValues(cluster, "total").Set(totalBackups)

		// Total restores (5-50)
		totalRestores := float64(5 + rand.Intn(45))
		vm.ClusterRestoreTotal.WithLabelValues(cluster, "total").Set(totalRestores)
	}

	// Generate backup/restore operation data
	for i := 0; i < 50; i++ {
		namespace := namespaces[rand.Intn(len(namespaces))]
		schedule := schedules[rand.Intn(len(schedules))]
		storage := storageLocations[rand.Intn(len(storageLocations))]

		// Backup counters - mostly successful
		vm.BackupTotal.WithLabelValues(namespace, schedule, storage).Add(1)
		if rand.Float32() < 0.9 { // 90% success rate
			vm.BackupSuccessTotal.WithLabelValues(namespace, schedule, storage).Add(1)
		} else {
			vm.BackupFailureTotal.WithLabelValues(namespace, schedule, storage).Add(1)
		}

		// Backup duration (30s to 3600s)
		duration := 30 + rand.Float64()*3570
		vm.BackupDuration.WithLabelValues(namespace, schedule, "Completed").Observe(duration)

		// Backup size (100MB to 50GB)
		sizeBytes := float64(100*1024*1024 + rand.Intn(50*1024*1024*1024))
		backupName := schedule + "-" + time.Now().Format("20060102-150405")
		vm.BackupSizeBytes.WithLabelValues(namespace, backupName, "Completed").Set(sizeBytes)

		// Backup items
		totalItems := float64(100 + rand.Intn(2000))
		backedUpItems := totalItems * (0.95 + rand.Float64()*0.05) // 95-100% backed up
		vm.BackupItemsTotal.WithLabelValues(namespace, backupName, "Completed").Set(totalItems)
		vm.BackupItemsBackedUp.WithLabelValues(namespace, backupName, "Completed").Set(backedUpItems)

		// Occasional errors/warnings
		if rand.Float32() < 0.1 {
			vm.BackupErrors.WithLabelValues(namespace, backupName, "Completed").Set(float64(rand.Intn(5)))
		}
		if rand.Float32() < 0.2 {
			vm.BackupWarnings.WithLabelValues(namespace, backupName, "Completed").Set(float64(rand.Intn(10)))
		}
	}

	// Generate restore data (less frequent)
	for i := 0; i < 15; i++ {
		namespace := namespaces[rand.Intn(len(namespaces))]

		vm.RestoreTotal.WithLabelValues(namespace, "manual").Add(1)
		if rand.Float32() < 0.85 { // 85% success rate
			vm.RestoreSuccessTotal.WithLabelValues(namespace, "manual").Add(1)
		} else {
			vm.RestoreFailureTotal.WithLabelValues(namespace, "manual").Add(1)
		}

		// Restore duration (60s to 7200s)
		duration := 60 + rand.Float64()*7140
		vm.RestoreDuration.WithLabelValues(namespace, "manual", "Completed").Observe(duration)

		restoreName := "restore-" + time.Now().Format("20060102-150405")
		totalItems := float64(100 + rand.Intn(1500))
		restoredItems := totalItems * (0.90 + rand.Float64()*0.10) // 90-100% restored
		vm.RestoreItemsTotal.WithLabelValues(namespace, restoreName, "Completed").Set(totalItems)
		vm.RestoreItemsRestored.WithLabelValues(namespace, restoreName, "Completed").Set(restoredItems)
	}

	// Generate schedule data
	for _, schedule := range schedules {
		for _, namespace := range namespaces {
			vm.ScheduleTotal.WithLabelValues(namespace, schedule).Set(1)
			vm.SchedulePaused.WithLabelValues(namespace, schedule).Set(0) // Not paused

			// Last backup for this schedule (within last 48 hours)
			lastScheduledBackup := time.Now().Add(-time.Duration(rand.Intn(48)) * time.Hour).Unix()
			vm.ScheduleLastBackup.WithLabelValues(namespace, schedule).Set(float64(lastScheduledBackup))
		}
	}

	// Set Velero availability
	vm.VeleroAvailable.Set(1) // Available

	// Generate some API request metrics
	apiEndpoints := []string{"/api/v1/backups", "/api/v1/restores", "/api/v1/schedules", "/api/v1/clusters"}
	methods := []string{"GET", "POST", "DELETE"}

	for i := 0; i < 200; i++ {
		endpoint := apiEndpoints[rand.Intn(len(apiEndpoints))]
		method := methods[rand.Intn(len(methods))]

		// Status distribution: mostly 2xx, some 4xx, rare 5xx
		var status string
		r := rand.Float32()
		if r < 0.8 {
			status = "200"
		} else if r < 0.9 {
			status = "201"
		} else if r < 0.95 {
			status = "404"
		} else if r < 0.98 {
			status = "400"
		} else {
			status = "500"
		}

		vm.APIRequestsTotal.WithLabelValues(method, endpoint, status).Add(1)

		// Request duration (1ms to 5000ms)
		duration := 0.001 + rand.Float64()*4.999
		vm.APIRequestDuration.WithLabelValues(method, endpoint).Observe(duration)
	}
}
