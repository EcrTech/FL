#!/bin/bash

# Script to replace all effectiveOrgId with orgId across the entire codebase
# This is a one-time migration script for single-tenant conversion

echo "Starting effectiveOrgId → orgId replacement..."

# For macOS (BSD sed)
if [[ "$OSTYPE" == "darwin"* ]]; then
  find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/effectiveOrgId/orgId/g' {} +
# For Linux (GNU sed)
else
  find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/effectiveOrgId/orgId/g' {} +
fi

echo "Replacement complete! Fixed all occurrences in src/"
echo "Please review the changes and run npm run typecheck to verify"
