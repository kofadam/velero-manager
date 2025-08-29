#!/bin/bash
VERSION=$(./version.sh | tr -d '\n\r')
kubectl set image deployment/velero-manager velero-manager=localhost:32000/velero-manager:$VERSION -n velero-manager
echo "Deployed version: $VERSION"
