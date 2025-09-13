package k8s

import (
	"log"
	"sync"
	"time"
)

// BackupCacheEntry represents cached backup metadata
type BackupCacheEntry struct {
	BackupName          string                 `json:"backup_name"`
	ClusterName         string                 `json:"cluster_name"`
	Namespace           string                 `json:"namespace"`
	Phase               string                 `json:"phase"`
	CreationTimestamp   time.Time              `json:"creation_timestamp"`
	CompletionTimestamp *time.Time             `json:"completion_timestamp,omitempty"`
	ExpirationTimestamp *time.Time             `json:"expiration_timestamp,omitempty"`
	IncludedNamespaces  []string               `json:"included_namespaces,omitempty"`
	ExcludedNamespaces  []string               `json:"excluded_namespaces,omitempty"`
	StorageLocation     string                 `json:"storage_location,omitempty"`
	TTL                 string                 `json:"ttl,omitempty"`
	Errors              int                    `json:"errors"`
	Warnings            int                    `json:"warnings"`
	ItemsBackedUp       int                    `json:"items_backed_up"`
	TotalItems          int                    `json:"total_items"`
	LastUpdated         time.Time              `json:"last_updated"`
	RawBackupData       map[string]interface{} `json:"raw_backup_data"` // Store original backup object
}

// BackupCache provides in-memory caching for backup metadata
type BackupCache struct {
	entries map[string]*BackupCacheEntry // key: cluster_name:backup_name
	mutex   sync.RWMutex
	ttl     time.Duration
}

// NewBackupCache creates a new backup cache
func NewBackupCache(ttl time.Duration) *BackupCache {
	cache := &BackupCache{
		entries: make(map[string]*BackupCacheEntry),
		ttl:     ttl,
	}

	// Start cleanup goroutine
	go cache.cleanupExpiredEntries()

	return cache
}

// Set stores a backup entry in the cache
func (bc *BackupCache) Set(clusterName, backupName string, backupData map[string]interface{}) {
	bc.mutex.Lock()
	defer bc.mutex.Unlock()

	key := clusterName + ":" + backupName

	entry := &BackupCacheEntry{
		BackupName:    backupName,
		ClusterName:   clusterName,
		Namespace:     getString(backupData, "namespace", "velero"),
		LastUpdated:   time.Now(),
		RawBackupData: backupData,
	}

	// Extract creation timestamp
	if creationTS, ok := backupData["creationTimestamp"]; ok {
		if ts, ok := creationTS.(time.Time); ok {
			entry.CreationTimestamp = ts
		}
	}

	// Extract status information
	if status, ok := backupData["status"].(map[string]interface{}); ok {
		entry.Phase = getString(status, "phase", "Unknown")

		// Extract error and warning counts
		if errors, ok := status["errors"]; ok {
			if errorSlice, ok := errors.([]interface{}); ok {
				entry.Errors = len(errorSlice)
			}
		}
		if warnings, ok := status["warnings"]; ok {
			if warningSlice, ok := warnings.([]interface{}); ok {
				entry.Warnings = len(warningSlice)
			}
		}

		// Extract completion timestamp
		if completionTS, ok := status["completionTimestamp"]; ok {
			if ts, ok := completionTS.(time.Time); ok {
				entry.CompletionTimestamp = &ts
			}
		}

		// Extract expiration timestamp
		if expirationTS, ok := status["expiration"]; ok {
			if ts, ok := expirationTS.(time.Time); ok {
				entry.ExpirationTimestamp = &ts
			}
		}

		// Extract progress information
		if progress, ok := status["progress"].(map[string]interface{}); ok {
			if totalItems, ok := progress["totalItems"].(int64); ok {
				entry.TotalItems = int(totalItems)
			}
			if itemsBackedUp, ok := progress["itemsBackedUp"].(int64); ok {
				entry.ItemsBackedUp = int(itemsBackedUp)
			}
		}
	}

	// Extract spec information
	if spec, ok := backupData["spec"].(map[string]interface{}); ok {
		entry.StorageLocation = getString(spec, "storageLocation", "default")
		entry.TTL = getString(spec, "ttl", "720h0m0s")

		if includedNS, ok := spec["includedNamespaces"].([]interface{}); ok {
			entry.IncludedNamespaces = interfaceSliceToStringSlice(includedNS)
		}
		if excludedNS, ok := spec["excludedNamespaces"].([]interface{}); ok {
			entry.ExcludedNamespaces = interfaceSliceToStringSlice(excludedNS)
		}
	}

	bc.entries[key] = entry
}

// Get retrieves a backup entry from the cache
func (bc *BackupCache) Get(clusterName, backupName string) (*BackupCacheEntry, bool) {
	bc.mutex.RLock()
	defer bc.mutex.RUnlock()

	key := clusterName + ":" + backupName
	entry, exists := bc.entries[key]

	if !exists {
		return nil, false
	}

	// Check if entry is expired
	if time.Since(entry.LastUpdated) > bc.ttl {
		return nil, false
	}

	return entry, true
}

// GetAllBackups returns all cached backups across all clusters
func (bc *BackupCache) GetAllBackups() []map[string]interface{} {
	bc.mutex.RLock()
	defer bc.mutex.RUnlock()

	var backups []map[string]interface{}

	for _, entry := range bc.entries {
		// Check if entry is expired
		if time.Since(entry.LastUpdated) > bc.ttl {
			continue
		}

		// Convert cache entry back to backup format
		backup := make(map[string]interface{})
		for k, v := range entry.RawBackupData {
			backup[k] = v
		}

		// Ensure cluster is set correctly
		backup["cluster"] = entry.ClusterName

		backups = append(backups, backup)
	}

	return backups
}

// GetClusterBackups returns cached backups for a specific cluster
func (bc *BackupCache) GetClusterBackups(clusterName string) []map[string]interface{} {
	bc.mutex.RLock()
	defer bc.mutex.RUnlock()

	var backups []map[string]interface{}

	for _, entry := range bc.entries {
		if entry.ClusterName != clusterName {
			continue
		}

		// Check if entry is expired
		if time.Since(entry.LastUpdated) > bc.ttl {
			continue
		}

		// Convert cache entry back to backup format
		backup := make(map[string]interface{})
		for k, v := range entry.RawBackupData {
			backup[k] = v
		}

		backup["cluster"] = entry.ClusterName
		backups = append(backups, backup)
	}

	return backups
}

// Delete removes a backup entry from the cache
func (bc *BackupCache) Delete(clusterName, backupName string) {
	bc.mutex.Lock()
	defer bc.mutex.Unlock()

	key := clusterName + ":" + backupName
	delete(bc.entries, key)
}

// GetStats returns cache statistics
func (bc *BackupCache) GetStats() map[string]interface{} {
	bc.mutex.RLock()
	defer bc.mutex.RUnlock()

	clusterCounts := make(map[string]int)
	totalEntries := len(bc.entries)
	expiredEntries := 0

	for _, entry := range bc.entries {
		clusterCounts[entry.ClusterName]++

		if time.Since(entry.LastUpdated) > bc.ttl {
			expiredEntries++
		}
	}

	return map[string]interface{}{
		"total_entries":   totalEntries,
		"expired_entries": expiredEntries,
		"active_entries":  totalEntries - expiredEntries,
		"cluster_counts":  clusterCounts,
		"cache_ttl":       bc.ttl.String(),
	}
}

// cleanupExpiredEntries runs periodically to remove expired entries
func (bc *BackupCache) cleanupExpiredEntries() {
	ticker := time.NewTicker(5 * time.Minute) // Cleanup every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		bc.mutex.Lock()

		toDelete := []string{}
		for key, entry := range bc.entries {
			if time.Since(entry.LastUpdated) > bc.ttl {
				toDelete = append(toDelete, key)
			}
		}

		for _, key := range toDelete {
			delete(bc.entries, key)
		}

		if len(toDelete) > 0 {
			log.Printf("Cleaned up %d expired cache entries", len(toDelete))
		}

		bc.mutex.Unlock()
	}
}

// Helper functions
func getString(data map[string]interface{}, key, defaultValue string) string {
	if value, ok := data[key].(string); ok {
		return value
	}
	return defaultValue
}

func interfaceSliceToStringSlice(slice []interface{}) []string {
	result := make([]string, 0, len(slice))
	for _, item := range slice {
		if str, ok := item.(string); ok {
			result = append(result, str)
		}
	}
	return result
}
