#!/bin/bash

# Get version from git tag, commit, or default
if git describe --tags --exact-match 2>/dev/null; then
    # We're on a tagged commit
    VERSION=$(git describe --tags --exact-match)
else
    # Use latest tag + commit hash
    LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.2.0")
    COMMIT_HASH=$(git rev-parse --short HEAD)
    VERSION="${LATEST_TAG}-${COMMIT_HASH}"
fi

echo "${VERSION}"
