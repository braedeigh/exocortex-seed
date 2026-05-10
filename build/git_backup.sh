#!/bin/bash
# Daily git backup — commits everything and pushes to GitHub
# Runs as bradie via cron

cd /opt/exocortex

# Add everything
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
    echo "$(date): Nothing to commit"
    exit 0
fi

# Commit with date
git commit -m "Auto-backup $(date +%Y-%m-%d)"

# Push
git push origin main

echo "$(date): Backup pushed"
