package k8s

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ClusterClient represents a connection to a remote cluster
type ClusterClient struct {
	Name          string
	Clientset     kubernetes.Interface
	DynamicClient dynamic.Interface
	Config        *rest.Config
	LastSeen      time.Time
	Status        string // "healthy", "unhealthy", "unreachable"
	mutex         sync.RWMutex
}

// MultiClusterClient manages connections to multiple clusters
type MultiClusterClient struct {
	managementClient *Client
	clusters         map[string]*ClusterClient
	cache            *BackupCache
	mutex            sync.RWMutex
	ctx              context.Context
}

// ClusterConnection represents cluster connection information
type ClusterConnection struct {
	Name            string
	DisplayName     string
	APIEndpoint     string
	TokenSecretName string
	Status          string
	LastSeen        time.Time
}

// NewMultiClusterClient creates a new multi-cluster client
func NewMultiClusterClient(managementClient *Client) *MultiClusterClient {
	return &MultiClusterClient{
		managementClient: managementClient,
		clusters:         make(map[string]*ClusterClient),
		cache:            NewBackupCache(5 * time.Minute), // Cache for 5 minutes
		ctx:              context.Background(),
	}
}

// DiscoverClusters finds cluster connections from existing secrets and cronjobs
func (mc *MultiClusterClient) DiscoverClusters() ([]ClusterConnection, error) {
	// Get all cronjobs to identify clusters
	cronJobList, err := mc.managementClient.DynamicClient.
		Resource(CronJobGVR).
		Namespace("velero").
		List(mc.ctx, metav1.ListOptions{})

	if err != nil {
		return nil, fmt.Errorf("failed to list cronjobs: %w", err)
	}

	clusterMap := make(map[string]ClusterConnection)

	// Extract cluster names from cronjobs
	for _, cronJob := range cronJobList.Items {
		clusterName := extractClusterFromCronJobName(cronJob.GetName())
		if clusterName != "unknown" && clusterName != "" {
			clusterMap[clusterName] = ClusterConnection{
				Name:        clusterName,
				DisplayName: clusterName,
				Status:      "unknown",
			}
		}
	}

	// Look for corresponding secrets with API endpoints
	secretList, err := mc.managementClient.DynamicClient.
		Resource(SecretGVR).
		Namespace("velero").
		List(mc.ctx, metav1.ListOptions{})

	if err != nil {
		log.Printf("Warning: failed to list secrets for cluster discovery: %v", err)
	} else {
		for _, secret := range secretList.Items {
			secretName := secret.GetName()

			// Check if this is a cluster token secret (pattern: {cluster}-sa-token or {cluster}-credentials)
			for clusterName := range clusterMap {
				expectedTokenSecret := fmt.Sprintf("%s-sa-token", clusterName)
				expectedCredsSecret := fmt.Sprintf("%s-credentials", clusterName)

				if secretName == expectedTokenSecret || secretName == expectedCredsSecret {
					cluster := clusterMap[clusterName]
					cluster.TokenSecretName = secretName

					// Try to extract API endpoint from secret data
					if data, found, _ := unstructured.NestedMap(secret.Object, "data"); found {
						if serverB64, exists := data["server"]; exists {
							if serverBytes, err := base64.StdEncoding.DecodeString(serverB64.(string)); err == nil {
								cluster.APIEndpoint = string(serverBytes)
							}
						}
					}

					clusterMap[clusterName] = cluster
					break
				}
			}
		}
	}

	// Convert map to slice
	connections := make([]ClusterConnection, 0, len(clusterMap))
	for _, cluster := range clusterMap {
		connections = append(connections, cluster)
	}

	return connections, nil
}

// ConnectToCluster establishes a connection to a remote cluster using stored credentials
func (mc *MultiClusterClient) ConnectToCluster(clusterName string) error {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()

	// Check if already connected
	if existing, exists := mc.clusters[clusterName]; exists {
		if existing.Status == "healthy" && time.Since(existing.LastSeen) < 5*time.Minute {
			return nil // Already connected and healthy
		}
	}

	// Find the secret for this cluster
	secretName := fmt.Sprintf("%s-sa-token", clusterName)

	// Try alternative secret naming patterns
	secretNames := []string{
		secretName,
		fmt.Sprintf("%s-credentials", clusterName),
		fmt.Sprintf("cluster-%s-token", clusterName),
	}

	var secret *unstructured.Unstructured
	var err error

	for _, sName := range secretNames {
		secret, err = mc.managementClient.DynamicClient.
			Resource(SecretGVR).
			Namespace("velero").
			Get(mc.ctx, sName, metav1.GetOptions{})

		if err == nil {
			secretName = sName
			break
		}
	}

	if err != nil {
		return fmt.Errorf("failed to find secret for cluster %s: %w", clusterName, err)
	}

	// Extract connection details from secret
	data, found, err := unstructured.NestedMap(secret.Object, "data")
	if err != nil || !found {
		return fmt.Errorf("secret %s has no data section", secretName)
	}

	// Decode token
	tokenB64, exists := data["token"]
	if !exists {
		return fmt.Errorf("secret %s missing token", secretName)
	}
	token, err := base64.StdEncoding.DecodeString(tokenB64.(string))
	if err != nil {
		return fmt.Errorf("failed to decode token: %w", err)
	}

	// Decode server URL
	serverB64, exists := data["server"]
	if !exists {
		return fmt.Errorf("secret %s missing server", secretName)
	}
	server, err := base64.StdEncoding.DecodeString(serverB64.(string))
	if err != nil {
		return fmt.Errorf("failed to decode server URL: %w", err)
	}

	// Decode CA certificate
	caCertB64, exists := data["ca.crt"]
	if !exists {
		return fmt.Errorf("secret %s missing ca.crt", secretName)
	}
	caCert, err := base64.StdEncoding.DecodeString(caCertB64.(string))
	if err != nil {
		return fmt.Errorf("failed to decode CA certificate: %w", err)
	}

	// Create rest config for remote cluster
	config := &rest.Config{
		Host:        string(server),
		BearerToken: string(token),
		TLSClientConfig: rest.TLSClientConfig{
			CAData: caCert,
		},
		Timeout: 30 * time.Second,
	}

	// Create clientset and dynamic client
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset for cluster %s: %w", clusterName, err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client for cluster %s: %w", clusterName, err)
	}

	// Test the connection
	_, err = clientset.Discovery().ServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to cluster %s: %w", clusterName, err)
	}

	// Store the connection
	clusterClient := &ClusterClient{
		Name:          clusterName,
		Clientset:     clientset,
		DynamicClient: dynamicClient,
		Config:        config,
		LastSeen:      time.Now(),
		Status:        "healthy",
	}

	mc.clusters[clusterName] = clusterClient
	log.Printf("Successfully connected to cluster: %s", clusterName)

	return nil
}

// GetClusterBackups retrieves backups from a specific cluster
func (mc *MultiClusterClient) GetClusterBackups(clusterName string) ([]map[string]interface{}, error) {
	mc.mutex.RLock()
	clusterClient, exists := mc.clusters[clusterName]
	mc.mutex.RUnlock()

	if !exists {
		// Try to connect first
		if err := mc.ConnectToCluster(clusterName); err != nil {
			return nil, fmt.Errorf("cluster %s not connected: %w", clusterName, err)
		}

		mc.mutex.RLock()
		clusterClient = mc.clusters[clusterName]
		mc.mutex.RUnlock()
	}

	// Check if Velero CRDs exist in the remote cluster
	ctx, cancel := context.WithTimeout(mc.ctx, 30*time.Second)
	defer cancel()

	_, err := clusterClient.Clientset.Discovery().ServerResourcesForGroupVersion("velero.io/v1")
	if err != nil {
		clusterClient.mutex.Lock()
		clusterClient.Status = "unhealthy"
		clusterClient.mutex.Unlock()
		return nil, fmt.Errorf("velero not found in cluster %s: %w", clusterName, err)
	}

	// Get backups from the remote cluster's velero namespace
	backupList, err := clusterClient.DynamicClient.
		Resource(BackupGVR).
		Namespace("velero").
		List(ctx, metav1.ListOptions{})

	if err != nil {
		clusterClient.mutex.Lock()
		clusterClient.Status = "unhealthy"
		clusterClient.mutex.Unlock()
		return nil, fmt.Errorf("failed to list backups from cluster %s: %w", clusterName, err)
	}

	// Update last seen
	clusterClient.mutex.Lock()
	clusterClient.LastSeen = time.Now()
	clusterClient.Status = "healthy"
	clusterClient.mutex.Unlock()

	// Convert to standard format
	var backups []map[string]interface{}
	for _, backup := range backupList.Items {
		backupData := map[string]interface{}{
			"name":              backup.GetName(),
			"cluster":           clusterName, // Ensure cluster is set correctly
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

	log.Printf("Retrieved %d backups from cluster %s", len(backups), clusterName)
	return backups, nil
}

// GetAllBackups aggregates backups from all connected clusters with caching
func (mc *MultiClusterClient) GetAllBackups() ([]map[string]interface{}, error) {
	connections, err := mc.DiscoverClusters()
	if err != nil {
		return nil, fmt.Errorf("failed to discover clusters: %w", err)
	}

	// First, try to return cached data if available
	cachedBackups := mc.cache.GetAllBackups()
	if len(cachedBackups) > 0 {
		log.Printf("Returning %d cached backups", len(cachedBackups))
		return cachedBackups, nil
	}

	// No cache or expired, fetch fresh data
	var allBackups []map[string]interface{}
	var wg sync.WaitGroup
	var mutex sync.Mutex

	// Channel to collect errors
	errors := make(chan error, len(connections))

	for _, connection := range connections {
		wg.Add(1)
		go func(clusterName string) {
			defer wg.Done()

			backups, err := mc.GetClusterBackups(clusterName)
			if err != nil {
				log.Printf("Warning: failed to get backups from cluster %s: %v", clusterName, err)
				errors <- err
				return
			}

			// Cache each backup
			for _, backup := range backups {
				if name, ok := backup["name"].(string); ok {
					mc.cache.Set(clusterName, name, backup)
				}
			}

			mutex.Lock()
			allBackups = append(allBackups, backups...)
			mutex.Unlock()
		}(connection.Name)
	}

	wg.Wait()
	close(errors)

	// Log any errors but don't fail completely
	errorCount := 0
	for err := range errors {
		errorCount++
		if errorCount <= 3 { // Log first few errors
			log.Printf("Cluster connection error: %v", err)
		}
	}

	if errorCount > 0 {
		log.Printf("Warning: %d clusters failed to respond, showing partial results", errorCount)
	}

	log.Printf("Aggregated %d backups from %d clusters (%d errors)", len(allBackups), len(connections), errorCount)
	return allBackups, nil
}

// GetConnectedClusters returns status of all cluster connections
func (mc *MultiClusterClient) GetConnectedClusters() []map[string]interface{} {
	mc.mutex.RLock()
	defer mc.mutex.RUnlock()

	clusters := make([]map[string]interface{}, 0, len(mc.clusters))
	for name, client := range mc.clusters {
		client.mutex.RLock()
		clusterInfo := map[string]interface{}{
			"name":     name,
			"status":   client.Status,
			"lastSeen": client.LastSeen,
		}
		client.mutex.RUnlock()
		clusters = append(clusters, clusterInfo)
	}

	return clusters
}

// GetCacheStats returns cache statistics
func (mc *MultiClusterClient) GetCacheStats() map[string]interface{} {
	return mc.cache.GetStats()
}

// Helper function to extract cluster name from cronjob name
// This should match the logic in velero.go
func extractClusterFromCronJobName(cronJobName string) string {
	// Implementation matches the existing function in velero.go
	if len(cronJobName) > 7 && cronJobName[:7] == "backup-" && len(cronJobName) > 13 && cronJobName[len(cronJobName)-6:] == "-daily" {
		// Remove "backup-" prefix and "-daily" suffix
		clusterPart := cronJobName[7 : len(cronJobName)-6]
		return clusterPart
	}
	return "unknown"
}
