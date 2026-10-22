#!/usr/bin/env bash
# ==============================================================================
# check-quality-gate.sh
# ------------------------------------------------------------------------------
# Deterministic Quality Gate for Spec Kit powered by Vite+ (vp).
# Validates:
#   1. Code formatting (Oxfmt Airbnb style)
#   2. Linter (Oxlint with Airbnb rules and @shadcn/lint)
#   3. Strict type checking (TypeScript typeCheck)
#   4. Cyclomatic complexity limits (max 10) and function line limits (max 50)
#   5. Clean Architecture layer boundaries (import/no-restricted-paths)
# ==============================================================================

set -eo pipefail

show_help() {
  cat << 'EOF'
Usage: check-quality-gate.sh [options]

Deterministic Quality Gate for Spec Kit with Vite+ (vp).
Verifies formatting, types, Airbnb style rules, complexity limits, and architectural boundaries.

Options:
  --help        Show this help message
  --dry-run     Verify tooling availability without running full check
  --fix         Automatically fix formatting and auto-fixable lint issues

Exit Codes:
  0             All checks passed successfully
  1             Linting, type, complexity, or architectural boundary violations
  2             Missing dependencies or runtime tools
EOF
}

DRY_RUN=false
AUTO_FIX=false

for arg in "$@"; do
  case "$arg" in
    --help)
      show_help
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --fix)
      AUTO_FIX=true
      ;;
    *)
      ;;
  esac
done

echo "======================================================================"
echo "[QUALITY GATE] Starting deterministic quality check with Vite+"
echo "======================================================================"

# 1. Resolve Vite+ (vp) binary
VP_CMD=""
if command -v vp >/dev/null 2>&1; then
  VP_CMD="vp"
elif [ -x "./node_modules/.bin/vp" ]; then
  VP_CMD="./node_modules/.bin/vp"
elif command -v npx >/dev/null 2>&1; then
  VP_CMD="npx vite-plus vp"
fi

if [ -z "$VP_CMD" ]; then
  echo "⚠️ [QUALITY GATE ERROR]: Neither Vite+ 'vp' command nor 'npx' was found."
  echo "To install Vite+, run: curl -fsSL https://vite.plus | bash"
  exit 2
fi

echo "✓ Engine detected: $VP_CMD"

if [ "$DRY_RUN" = true ]; then
  echo "✓ [QUALITY GATE]: Dry run completed successfully. Tools are available."
  exit 0
fi

# 2. Run unified quality check
echo "Executing vp check (Airbnb Linter + Oxlint + TypeScript Types + Complexity)..."

VP_DIR_ARG=""
if [ -d "apps/web-dashboard" ]; then
  VP_DIR_ARG="-C apps/web-dashboard"
fi

CHECK_STATUS=0
if [ "$AUTO_FIX" = true ]; then
  $VP_CMD $VP_DIR_ARG check --fix || CHECK_STATUS=$?
else
  $VP_CMD $VP_DIR_ARG check || CHECK_STATUS=$?
fi

if [ $CHECK_STATUS -ne 0 ]; then
  echo ""
  echo "❌ [QUALITY GATE FAILED]: Violations detected in code (exit code: $CHECK_STATUS)."
  echo "Please fix the issues flagged by Vite+ before proceeding to the next phase."
  exit 1
fi

echo ""
echo "✅ [QUALITY GATE PASSED]: All deterministic quality checks passed."
exit 0
