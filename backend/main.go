package main

import (
	"log"
	"net/http"
	"strings"
	"time"
	"velero-manager/pkg/handlers"
	"velero-manager/pkg/k8s"
	"velero-manager/pkg/metrics"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	// Initialize metrics
	veleroMetrics := metrics.NewVeleroMetrics(k8sClient)
	
	// Start metrics collector (collect every 30 seconds)
	metricsCollector := metrics.NewMetricsCollector(veleroMetrics, 30*time.Second)
	go metricsCollector.Start()

	// Initialize Gin router
	router := gin.Default()

	// CORS configuration for development
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	router.Use(cors.New(config))

	// Add Prometheus metrics middleware
	router.Use(veleroMetrics.PrometheusMiddleware())

	// Initialize handlers
	veleroHandler := handlers.NewVeleroHandler(k8sClient)

	// API routes
	api := router.Group("/api/v1")
	{
		api.GET("/backups", veleroHandler.ListBackups)
		api.POST("/backups", veleroHandler.CreateBackup)
		api.DELETE("/backups/:name", veleroHandler.DeleteBackup)
		api.GET("/restores", veleroHandler.ListRestores)
		api.POST("/restores", veleroHandler.CreateRestore)
		api.DELETE("/restores/:name", veleroHandler.DeleteRestore)
		api.GET("/restores/:name/logs", veleroHandler.GetRestoreLogs)
		api.GET("/restores/:name/describe", veleroHandler.DescribeRestore)
		api.GET("/schedules", veleroHandler.ListSchedules)
		api.POST("/schedules", veleroHandler.CreateSchedule)
		api.DELETE("/schedules/:name", veleroHandler.DeleteSchedule)
		api.PUT("/schedules/:name", veleroHandler.UpdateSchedule)
		api.POST("/schedules/:name/backup", veleroHandler.CreateBackupFromSchedule)
		api.GET("/cronjobs", veleroHandler.ListCronJobs)
		api.POST("/cronjobs", veleroHandler.CreateCronJob)
		api.DELETE("/cronjobs/:name", veleroHandler.DeleteCronJob)
		api.PUT("/cronjobs/:name", veleroHandler.UpdateCronJob)
		api.POST("/cronjobs/:name/trigger", veleroHandler.TriggerCronJob)
		api.GET("/clusters", veleroHandler.ListClusters)
		api.GET("/clusters/:cluster/backups", veleroHandler.ListBackupsByCluster)
		api.GET("/clusters/:cluster/health", veleroHandler.GetClusterHealth)
		api.GET("/clusters/:cluster/details", veleroHandler.GetClusterDetails)
		api.GET("/storage-locations", veleroHandler.ListStorageLocations)
		api.POST("/storage-locations", veleroHandler.CreateStorageLocation)
		api.DELETE("/storage-locations/:name", veleroHandler.DeleteStorageLocation)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})
	}

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Serve static files from frontend build
	router.Static("/static", "./frontend/build/static")
	router.StaticFile("/favicon.ico", "./frontend/build/favicon.ico")
	router.StaticFile("/manifest.json", "./frontend/build/manifest.json")

	// Serve React app for all non-API routes
	router.NoRoute(func(c *gin.Context) {
		// Don't serve index.html for API routes
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}
		c.File("./frontend/build/index.html")
	})

	log.Println("🚀 Velero Manager starting on :8080")
	log.Println("📁 Serving frontend from ./frontend/build/")
	log.Fatal(router.Run(":8080"))
}
