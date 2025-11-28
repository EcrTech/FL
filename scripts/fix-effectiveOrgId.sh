#!/bin/bash

# Script to replace all effectiveOrgId with orgId across the entire codebase
# This is a one-time migration script for single-tenant conversion

echo "Starting effectiveOrgId → orgId replacement..."

# Find all TypeScript/TSX files and replace effectiveOrgId with orgId
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/effectiveOrgId/orgId/g' {} +

echo "Replacement complete! Fixed all occurrences in src/"
echo "Please review the changes and run npm run typecheck to verify"
