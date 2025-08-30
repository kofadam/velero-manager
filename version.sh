#!/bin/bash

# Get version from git tag, commit, or default
TAG=$(git describe --tags --exact-match 2>/dev/null)

if [ -n "$TAG" ]; then
    # We're on a tagged commit
    VERSION="$TAG"
else
    # Use latest tag + commit hash
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v2.3.0")
    COMMIT_HASH=$(git rev-parse --short HEAD)
    VERSION="${LATEST_TAG}-${COMMIT_HASH}"
fi

printf "%s" "${VERSION}"