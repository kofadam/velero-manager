package metrics

import (
	"context"
	"log"
	"time"
)

// MetricsCollector handles periodic collection of Velero metrics
type MetricsCollector struct {
	metrics         *VeleroMetrics
	collectInterval time.Duration
	ctx             context.Context
	cancel          context.CancelFunc
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(metrics *VeleroMetrics, collectInterval time.Duration) *MetricsCollector {
	ctx, cancel := context.WithCancel(context.Background())

	return &MetricsCollector{
		metrics:         metrics,
		collectInterval: collectInterval,
		ctx:             ctx,
		cancel:          cancel,
	}
}

// Start begins the metrics collection loop
func (mc *MetricsCollector) Start() {
	log.Println("📊 Starting Velero metrics collector...")

	// Collect metrics immediately on start
	if err := mc.metrics.UpdateVeleroMetrics(); err != nil {
		log.Printf("⚠️  Failed to collect initial metrics: %v", err)
	} else {
		log.Println("✅ Initial metrics collection completed")
	}

	// Start periodic collection
	ticker := time.NewTicker(mc.collectInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := mc.metrics.UpdateVeleroMetrics(); err != nil {
				log.Printf("⚠️  Failed to collect Velero metrics: %v", err)
			} else {
				log.Printf("📈 Velero metrics updated at %s", time.Now().Format("15:04:05"))
			}
		case <-mc.ctx.Done():
			log.Println("🛑 Metrics collector stopped")
			return
		}
	}
}

// Stop stops the metrics collection
func (mc *MetricsCollector) Stop() {
	log.Println("🛑 Stopping metrics collector...")
	mc.cancel()
}
