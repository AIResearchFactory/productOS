#!/bin/bash

# Pre-commit hook to run tests and verification
# This script is used by developers and the AI agent to ensure code quality before committing.

echo "🔍 Running pre-commit checks..."

# 1. Backend & Unit Tests (Node.js)
echo "🧪 Running Node.js tests..."
if ! npm test; then
    echo "❌ Backend tests failed!"
    exit 1
fi

# 2. Frontend Build Verification
echo "⚛️ Verifying frontend build..."
if ! npm run build; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✅ All checks passed!"
exit 0
