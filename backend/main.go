package main

import (
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"velero-manager/pkg/handlers"
	"velero-manager/pkg/k8s"
)

func main() {
	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	// Initialize Gin router
	router := gin.Default()

	// CORS configuration for development
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	router.Use(cors.New(config))

	// Initialize handlers
	veleroHandler := handlers.NewVeleroHandler(k8sClient)

	// API routes
	api := router.Group("/api/v1")
	{
		api.GET("/backups", veleroHandler.ListBackups)
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})
	}

	// Static files will be added later when frontend is ready

	log.Println("🚀 Velero Manager starting on :8080")
	log.Fatal(router.Run(":8080"))
}
