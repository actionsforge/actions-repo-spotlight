#!/bin/bash
set -e

echo "🧪 Testing GitHub Action"

# Check if we're in a devcontainer
if [ -n "$DEVCONTAINER" ]; then
    echo "📦 Running in devcontainer environment"
fi

# Build the action
echo "📦 Building action..."
npm run build

# CLI smoke (live API coverage belongs in consumer workflows with a real token)
echo "🔍 Testing CLI interface..."
node dist/index.cjs --help

echo "🔍 Testing basic functionality..."
node dist/index.cjs --token test-token --username test-user || {
    echo "⚠️ Basic functionality test failed (expected with test token)"
}

echo "✅ Local action smoke completed"
echo "Note: Unit tests run in CI (ci.yml). Live API runs in consumer workflows."
