#!/bin/bash

echo "=== Lint Output ==="
npm run lint 2>&1 || true

echo ""
echo "=== Typecheck Output (next build --dry-run if available) ==="
npx tsc --noEmit 2>&1 || true

echo ""
echo "=== Build Output ==="
npm run build 2>&1 || true

echo ""
echo "=== Test Output ==="
npm run test -- --passWithNoTests 2>&1 || true

echo ""
echo "=== Validation Complete ==="
