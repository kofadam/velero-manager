package k8s

import (
	"context"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

type Client struct {
	Clientset     kubernetes.Interface
	DynamicClient dynamic.Interface
	Config        *rest.Config
	Context       context.Context
}

func NewClient() (*Client, error) {
	config, err := getKubeConfig()
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	return &Client{
		Clientset:     clientset,
		DynamicClient: dynamicClient,
		Config:        config,
		Context:       context.Background(),
	}, nil
}

func getKubeConfig() (*rest.Config, error) {
	// Try in-cluster config first (for running in K8s)
	if config, err := rest.InClusterConfig(); err == nil {
		return config, nil
	}

	// Try kubeconfig file
	var kubeconfig string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	if envKubeconfig := os.Getenv("KUBECONFIG"); envKubeconfig != "" {
		kubeconfig = envKubeconfig
	}

	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}

// Velero resource definitions
var (
	BackupGVR = schema.GroupVersionResource{
		Group:    "velero.io",
		Version:  "v1",
		Resource: "backups",
	}

	ScheduleGVR = schema.GroupVersionResource{
		Group:    "velero.io",
		Version:  "v1",
		Resource: "schedules",
	}

	RestoreGVR = schema.GroupVersionResource{
		Group:    "velero.io",
		Version:  "v1",
		Resource: "restores",
	}

	BackupStorageLocationGVR = schema.GroupVersionResource{
		Group:    "velero.io",
		Version:  "v1",
		Resource: "backupstoragelocations",
	}

	CronJobGVR = schema.GroupVersionResource{
		Group:    "batch",
		Version:  "v1",
		Resource: "cronjobs",
	}

	JobGVR = schema.GroupVersionResource{
		Group:    "batch",
		Version:  "v1",
		Resource: "jobs",
	}
	SecretGVR = schema.GroupVersionResource{
		Group:    "",
		Version:  "v1",
		Resource: "secrets",
	}

	DownloadRequestGVR = schema.GroupVersionResource{
		Group:    "velero.io",
		Version:  "v1",
		Resource: "downloadrequests",
	}
)
