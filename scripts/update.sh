#!/usr/bin/env bash
# =====================================================================
# update.sh — refresh the deployment after a code change
#
#   sudo ./scripts/update.sh [--seed] [--with-front] [--force]
#
# What it does (6 steps):
#   1) git pull (fast-forward only; stops on uncommitted local changes)
#   2) Rebuild the backend image (Docker layer cache keeps this fast)
#   3) docker compose up -d — only changed containers are replaced
#      (database migrations run automatically on boot)
#   4) Health check
#   5) Optional (--seed): re-run the idempotent seed
#   6) Optional (--with-front): rebuild frontend/dist and admin/dist
#
# Notes:
#   * Downtime is a few seconds (backend container swap).
#   * Idempotent and safe to re-run.
# =====================================================================
set -euo pipefail

# ---------- logging helpers ----------
if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
TOTAL_STEPS=6; STEP_NO=0
info()  { echo "${G}[✓]${N} $*"; }
step()  { STEP_NO=$((STEP_NO+1)); echo; echo "${B}[${STEP_NO}/${TOTAL_STEPS}]${N} $*"; }
warn()  { echo "${Y}[!]${N} $*"; }
die()   { echo "${R}[✗]${N} $*" >&2; exit 1; }
usage() { awk 'NR==1 {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"; }

# ---------- arguments ----------
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi
step "Checking arguments"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml"

DO_SEED=0 WITH_FRONT=0 FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)       DO_SEED=1; shift ;;
    --with-front) WITH_FRONT=1; shift ;;
    --force)      FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1 (see --help)" ;;
  esac
done
[[ $EUID -eq 0 ]] || die "This script must run as root: sudo ./scripts/update.sh"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ---------- 1) pull latest code ----------
step "Fetching the latest code from git"
if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  [[ $FORCE -eq 1 ]] \
    && warn "You have uncommitted local changes (--force) — continuing with pull" \
    || die "Uncommitted local changes found — commit/stash them first, or use --force"
fi

git -C "$ROOT_DIR" fetch origin --quiet
BEHIND="$(git -C "$ROOT_DIR" rev-list --count HEAD..origin/HEAD 2>/dev/null || echo 0)"
if [[ "$BEHIND" == "0" ]]; then
  info "Already up to date ($(git -C "$ROOT_DIR" log -1 --format='%h %s'))"
else
  git -C "$ROOT_DIR" pull --ff-only origin "$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
  info "Pulled $BEHIND new commit(s): $(git -C "$ROOT_DIR" log -1 --format='%h %s')"
fi

# ---------- 2) rebuild backend image ----------
step "Rebuilding the backend image (Docker cache)"
compose build backend

# ---------- 3) apply the new version ----------
step "Recreating changed containers (DB migrations run automatically on boot)"
compose up -d
info "Services refreshed"

# ---------- 4) health check ----------
step "Checking backend health"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    info "Backend is healthy ✅"
    break
  fi
  if [[ $i -eq 60 ]]; then
    die "Backend did not become healthy — check: docker compose -f backend/docker-compose.yml logs --tail=50 backend"
  fi
  [[ $((i % 10)) -eq 0 ]] && warn "Still waiting... ($((i*3))s)"
  sleep 3
done

# ---------- 5) optional seed ----------
if [[ $DO_SEED -eq 1 ]]; then
  step "Running seed (idempotent)"
  compose exec -T backend npm run prisma:seed
else
  step "Skipping seed (use --seed to run it)"
fi

# ---------- 6) optional frontend rebuild ----------
if [[ $WITH_FRONT -eq 1 ]]; then
  step "Rebuilding frontend/dist and admin/dist"
  if command -v npm >/dev/null; then
    export NODE_OPTIONS=--max-old-space-size=768
    info "Building frontend..."
    (cd "$ROOT_DIR/frontend" && npm ci --no-audit --no-fund && npm run build)
    info "Building admin panel..."
    (cd "$ROOT_DIR/admin" && npm ci --no-audit --no-fund && npm run build)
    info "Frontend builds are fresh (no nginx reload needed)"
  else
    warn "npm not found on this server — build the frontends in CI or install Node 20+"
  fi
else
  step "Skipping frontend rebuilds (use --with-front after UI changes)"
fi

# ---------- cleanup ----------
docker image prune -f >/dev/null

echo
info "Update finished ✅"
compose ps
echo
echo "Live logs:  docker compose -f backend/docker-compose.yml logs -f backend"
