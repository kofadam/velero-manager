package main

import (
	"log"
	"net/http"
	"strings"
	"time"
	"velero-manager/pkg/config"
	"velero-manager/pkg/handlers"
	"velero-manager/pkg/k8s"
	"velero-manager/pkg/metrics"
	"velero-manager/pkg/middleware"

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

	// Try to load OIDC configuration from ConfigMap first
	oidcConfig, err := handlers.LoadOIDCConfigFromK8s(k8sClient)
	if err != nil {
		log.Printf("Failed to load OIDC config from ConfigMap, using environment: %v", err)
		oidcConfig = config.GetOIDCConfig()
	} else {
		// Set the loaded config as current
		config.SetOIDCConfig(oidcConfig)
	}

	if oidcConfig.Enabled {
		log.Printf("OIDC authentication enabled with issuer: %s", oidcConfig.IssuerURL)
	} else {
		log.Println("OIDC authentication disabled, using legacy authentication")
	}

	// Initialize metrics
	veleroMetrics := metrics.NewVeleroMetrics(k8sClient)

	// Start metrics collector (collect every 30 seconds)
	metricsCollector := metrics.NewMetricsCollector(veleroMetrics, 30*time.Second)
	go metricsCollector.Start()

	// Initialize Gin router
	router := gin.Default()

	// CORS configuration for development
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Auth-Token"}
	router.Use(cors.New(corsConfig))

	// Add Prometheus metrics middleware
	router.Use(veleroMetrics.PrometheusMiddleware())

	// Initialize handlers
	veleroHandler := handlers.NewVeleroHandler(k8sClient, veleroMetrics)
	userHandler := handlers.NewUserHandler(k8sClient)
	oidcConfigHandler := handlers.NewOIDCConfigHandler(k8sClient)

	// Initialize auth handler with OIDC support
	authHandler, err := handlers.NewAuthHandler(k8sClient, oidcConfig)
	if err != nil {
		log.Fatalf("Failed to create auth handler: %v", err)
	}

	// Set user validator for admin middleware
	middleware.SetUserValidator(userHandler)

	// API routes
	api := router.Group("/api/v1")
	{
		// Public endpoints (no auth required)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})

		// Test endpoint for generating mock metrics data
		api.POST("/test/generate-mock-data", veleroHandler.GenerateTestData)

		// Auth endpoints
		auth := api.Group("/auth")
		{
			auth.GET("/info", authHandler.GetAuthInfo)                 // Get auth config and user info
			auth.POST("/login", authHandler.LegacyLogin)               // Legacy username/password login
			auth.GET("/oidc/login", authHandler.InitiateOIDCLogin)     // Start OIDC flow
			auth.GET("/oidc/callback", authHandler.HandleOIDCCallback) // OIDC callback
			auth.POST("/logout", authHandler.Logout)                   // Logout (both OIDC and legacy)
		}

		// Protected endpoints (authentication required)
		protected := api.Group("/")
		protected.Use(middleware.RequireOIDCAuth(authHandler.GetOIDCProvider()))
		{
			// User management - admin only
			admin := protected.Group("/")
			admin.Use(middleware.RequireAdmin())
			{
				admin.GET("/users", userHandler.ListUsers)
				admin.POST("/users", userHandler.CreateUser)
				admin.DELETE("/users/:username", userHandler.DeleteUser)
				admin.POST("/clusters", veleroHandler.AddCluster)
				admin.POST("/storage-locations", veleroHandler.CreateStorageLocation)
				admin.DELETE("/storage-locations/:name", veleroHandler.DeleteStorageLocation)

				// OIDC configuration management - admin only for modify operations
				admin.PUT("/oidc/config", oidcConfigHandler.UpdateOIDCConfig)
				admin.POST("/oidc/test", oidcConfigHandler.TestOIDCConnection)
			}

			// User can change their own password
			protected.PUT("/users/:username/password", userHandler.ChangePassword)

			// OIDC configuration view - all authenticated users can view
			protected.GET("/oidc/config", oidcConfigHandler.GetOIDCConfig)

			// Backup operations (authenticated users)
			protected.GET("/backups", veleroHandler.ListBackups)
			protected.POST("/backups", veleroHandler.CreateBackup)
			protected.DELETE("/backups/:name", veleroHandler.DeleteBackup)

			// Restore operations (authenticated users)
			protected.GET("/restores", veleroHandler.ListRestores)
			protected.POST("/restores", veleroHandler.CreateRestore)
			protected.DELETE("/restores/:name", veleroHandler.DeleteRestore)
			protected.GET("/restores/:name/logs", veleroHandler.GetRestoreLogs)
			protected.GET("/restores/:name/describe", veleroHandler.DescribeRestore)

			// Schedule operations (authenticated users)
			protected.GET("/schedules", veleroHandler.ListSchedules)
			protected.POST("/schedules", veleroHandler.CreateSchedule)
			protected.DELETE("/schedules/:name", veleroHandler.DeleteSchedule)
			protected.PUT("/schedules/:name", veleroHandler.UpdateSchedule)
			protected.POST("/schedules/:name/backup", veleroHandler.CreateBackupFromSchedule)

			// CronJob operations (authenticated users)
			protected.GET("/cronjobs", veleroHandler.ListCronJobs)
			protected.POST("/cronjobs", veleroHandler.CreateCronJob)
			protected.DELETE("/cronjobs/:name", veleroHandler.DeleteCronJob)
			protected.PUT("/cronjobs/:name", veleroHandler.UpdateCronJob)
			protected.POST("/cronjobs/:name/trigger", veleroHandler.TriggerCronJob)

			// Cluster operations (read operations for all authenticated users)
			protected.GET("/clusters", veleroHandler.ListClusters)
			protected.GET("/clusters/:cluster/backups", veleroHandler.ListBackupsByCluster)
			protected.GET("/clusters/:cluster/health", veleroHandler.GetClusterHealth)
			protected.GET("/clusters/:cluster/details", veleroHandler.GetClusterDetails)

			// Storage locations (read operations for all authenticated users)
			protected.GET("/storage-locations", veleroHandler.ListStorageLocations)

			// Dashboard metrics
			protected.GET("/dashboard/metrics", veleroHandler.GetDashboardMetrics)
		}
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
