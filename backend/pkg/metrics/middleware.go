package metrics

import (
	"time"

	"github.com/gin-gonic/gin"
)

// PrometheusMiddleware returns a Gin middleware that records metrics for HTTP requests
func (vm *VeleroMetrics) PrometheusMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Record metrics after request completion
		duration := time.Since(start)
		method := c.Request.Method
		endpoint := c.FullPath()
		statusCode := c.Writer.Status()

		// Clean up endpoint path for metrics (remove parameter values)
		if endpoint == "" {
			endpoint = "unknown"
		}

		vm.RecordAPIRequest(method, endpoint, statusCode, duration)
	})
}