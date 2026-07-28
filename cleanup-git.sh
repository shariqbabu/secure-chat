#!/bin/bash

# Git history cleanup script
# WARNING: This rewrites git history - coordinate with team before running

echo "Git History Cleanup for secure-chat"
echo "===================================="
echo ""
echo "This will remove from git history:"
echo "  - node_modules/ directories"
echo "  - dist/ build output"
echo "  - .vite/ cache"
echo ""
echo "Current repo size: $(du -sh .git | cut -f1)"
echo "Total tracked files: $(git ls-files | wc -l)"
echo ""

read -p "Continue? This will rewrite history. (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Creating backup branch..."
git branch backup-before-cleanup

echo "Step 2: Removing files from git history (this may take a few minutes)..."

# Use git filter-repo (recommended) or filter-branch
if command -v git-filter-repo &> /dev/null; then
    echo "Using git-filter-repo (faster)..."
    git filter-repo --path node_modules --path-match node_modules --invert-paths --force
    git filter-repo --path dist --path-match dist --invert-paths --force
    git filter-repo --path .vite --path-match .vite --invert-paths --force
else
    echo "Using git filter-branch (slower)..."
    git filter-branch --force --index-filter \
        'git rm -rf --cached --ignore-unmatch node_modules dist frontend/node_modules frontend/dist worker/node_modules .vite' \
        --prune-empty --tag-name-filter cat -- --all
fi

echo ""
echo "Step 3: Cleaning up refs and garbage collection..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "Step 4: Checking new size..."
echo "New repo size: $(du -sh .git | cut -f1)"
echo "Tracked files: $(git ls-files | wc -l)"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify everything works: npm install && npm run build"
echo "  2. Force push to remote: git push --force --all"
echo "  3. Notify team to re-clone the repo"
echo ""
echo "To restore backup: git reset --hard backup-before-cleanup"
