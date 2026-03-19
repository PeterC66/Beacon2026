#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Merge latest main to pick up docs/design files uploaded directly
git fetch origin main 2>/dev/null || true
git merge origin/main --no-edit 2>/dev/null || true

# Install backend dependencies
cd "$CLAUDE_PROJECT_DIR/backend"
npm install

# Install frontend dependencies
cd "$CLAUDE_PROJECT_DIR/frontend"
npm install
