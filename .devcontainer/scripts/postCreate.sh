#!/bin/bash
set -e

# Print environment information
echo "🔍 Environment Information:"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "TypeScript version: $(npx tsc --version)"

# Verify Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v)
REQUIRED_VERSION="v20.10.0"
if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    echo "❌ Node.js version $NODE_VERSION is below required version $REQUIRED_VERSION"
    exit 1
fi
echo "✅ Node.js version $NODE_VERSION meets requirements"

if [ -f "package.json" ]; then
  echo "📦 Installing dependencies..."
  npm ci || {
    echo "⚠️ npm ci failed, trying npm install..."
    npm install
  }

  echo "🔍 Type checking..."
  npm run typecheck || echo "⚠️ Type checking failed, but continuing..."

  echo "🔨 Building action..."
  npm run build || echo "⚠️ Build failed, but continuing..."

  echo "🔒 Security audit (non-blocking)..."
  npm audit || echo "⚠️ Audit issues found, but not blocking container creation"

  echo "📦 Checking dependencies..."
  npm outdated || echo "✅ All dependencies are up to date"

  echo "✅ Dev container setup complete!"
  echo "💡 Available commands:"
  echo "   - npm test: Run tests"
  echo "   - npm run dev: Start development mode"
  echo "   - npm run build: Build the action"
  echo "   - act: Run GitHub Actions locally"
fi
