package models

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Backup represents a Velero backup
type Backup struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              BackupSpec   `json:"spec,omitempty"`
	Status            BackupStatus `json:"status,omitempty"`
}

type BackupSpec struct {
	IncludedNamespaces      []string              `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces      []string              `json:"excludedNamespaces,omitempty"`
	IncludedResources       []string              `json:"includedResources,omitempty"`
	ExcludedResources       []string              `json:"excludedResources,omitempty"`
	LabelSelector           *metav1.LabelSelector `json:"labelSelector,omitempty"`
	StorageLocation         string                `json:"storageLocation,omitempty"`
	TTL                     metav1.Duration       `json:"ttl,omitempty"`
	IncludeClusterResources *bool                 `json:"includeClusterResources,omitempty"`
}

type BackupStatus struct {
	Phase               string       `json:"phase,omitempty"`
	StartTimestamp      *metav1.Time `json:"startTimestamp,omitempty"`
	CompletionTimestamp *metav1.Time `json:"completionTimestamp,omitempty"`
	Expiration          *metav1.Time `json:"expiration,omitempty"`
	TotalItems          int          `json:"totalItems,omitempty"`
	ItemsBackedUp       int          `json:"itemsBackedUp,omitempty"`
	Errors              int          `json:"errors,omitempty"`
	Warnings            int          `json:"warnings,omitempty"`
}

// Schedule represents a Velero schedule
type Schedule struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              ScheduleSpec   `json:"spec,omitempty"`
	Status            ScheduleStatus `json:"status,omitempty"`
}

type ScheduleSpec struct {
	Schedule string     `json:"schedule,omitempty"`
	Template BackupSpec `json:"template,omitempty"`
}

type ScheduleStatus struct {
	Phase            string       `json:"phase,omitempty"`
	LastBackup       *metav1.Time `json:"lastBackup,omitempty"`
	ValidationErrors []string     `json:"validationErrors,omitempty"`
}

// Restore represents a Velero restore
type Restore struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              RestoreSpec   `json:"spec,omitempty"`
	Status            RestoreStatus `json:"status,omitempty"`
}

type RestoreSpec struct {
	BackupName              string                `json:"backupName,omitempty"`
	IncludedNamespaces      []string              `json:"includedNamespaces,omitempty"`
	ExcludedNamespaces      []string              `json:"excludedNamespaces,omitempty"`
	IncludedResources       []string              `json:"includedResources,omitempty"`
	ExcludedResources       []string              `json:"excludedResources,omitempty"`
	NamespaceMapping        map[string]string     `json:"namespaceMapping,omitempty"`
	LabelSelector           *metav1.LabelSelector `json:"labelSelector,omitempty"`
	RestorePVs              *bool                 `json:"restorePVs,omitempty"`
	IncludeClusterResources *bool                 `json:"includeClusterResources,omitempty"`
}

type RestoreStatus struct {
	Phase               string       `json:"phase,omitempty"`
	StartTimestamp      *metav1.Time `json:"startTimestamp,omitempty"`
	CompletionTimestamp *metav1.Time `json:"completionTimestamp,omitempty"`
	Errors              int          `json:"errors,omitempty"`
	Warnings            int          `json:"warnings,omitempty"`
	ItemsRestored       int          `json:"itemsRestored,omitempty"`
}
