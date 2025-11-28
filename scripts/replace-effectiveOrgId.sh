#!/bin/bash
# Script to replace effectiveOrgId with orgId across the codebase
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/effectiveOrgId/orgId/g' {} +
