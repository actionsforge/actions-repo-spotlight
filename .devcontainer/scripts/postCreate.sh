#!/bin/bash
set -e

if [ -f "package.json" ]; then
  echo "📦 Installing dependencies..."
  npm ci

  echo "🧪 Running tests..."
  npm test

  echo "📊 Generating test coverage..."
  npm test -- --coverage

  echo "🔒 Running security audit..."
  npm audit || true  # don't fail the build if advisories are found

  echo "📦 Checking for outdated dependencies..."
  npm outdated || true
fi
