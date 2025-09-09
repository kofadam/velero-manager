FROM node:18-alpine AS frontend-builder
ARG REACT_APP_VERSION=v0.9.0-beta.6
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN REACT_APP_VERSION=${REACT_APP_VERSION} npm run build

# Go backend builder
FROM golang:latest AS backend-builder

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o velero-manager .

# Final air-gap image
FROM alpine:3.20

# Install ca-certificates for TLS (required for Kubernetes API)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /app/velero-manager .

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create non-root user for security
RUN addgroup -g 1001 -S velero && \
    adduser -S velero -u 1001 -G velero

USER velero

EXPOSE 8080

CMD ["./velero-manager"]
