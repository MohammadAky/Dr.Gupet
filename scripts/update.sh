#!/usr/bin/env bash
# =====================================================================
# update.sh — refresh the deployment after a code change
#
#   sudo ./scripts/update.sh --revision <approved-full-git-sha> [--seed] [--with-front]
#
# What it does (6 steps):
#   1) Advance main to an approved published SHA; stop on local divergence
#   2) Rebuild the backend image (Docker layer cache keeps this fast)
#   3) docker compose up -d — only changed containers are replaced
#      (database migrations run automatically on boot)
#   4) Health check
#   5) Optional local seed; production demo seed is prohibited
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

DO_SEED=0 WITH_FRONT=0 APPROVED_REVISION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)       DO_SEED=1; shift ;;
    --with-front) WITH_FRONT=1; shift ;;
    --revision)   APPROVED_REVISION="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1 (see --help)" ;;
  esac
done
[[ $EUID -eq 0 ]] || die "This script must run as root: sudo ./scripts/update.sh"
[[ "$APPROVED_REVISION" =~ ^[0-9a-fA-F]{40}$ ]] || die "Pass the full owner-approved Git SHA with --revision."
if [[ $WITH_FRONT -eq 1 ]]; then
  command -v npm >/dev/null || die "npm is required for --with-front; deployment stopped before changes."
  for site in frontend admin; do
    [[ ! -L "$ROOT_DIR/$site/dist" ]] || die "External dist symlink detected; promote its release manually."
    [[ ! -e "$ROOT_DIR/$site/dist.next" && ! -L "$ROOT_DIR/$site/dist.next" && ! -e "$ROOT_DIR/$site/dist.previous" && ! -L "$ROOT_DIR/$site/dist.previous" ]] || die "Previous frontend promotion files exist; preserve and reconcile them before retrying."
  done
fi
PREVIOUS_REVISION="$(git -C "$ROOT_DIR" rev-parse HEAD)"

compose() { docker compose -p backend --env-file "$ROOT_DIR/backend/.env" -f "$COMPOSE_FILE" "$@"; }

# ---------- 1) pull latest code ----------
step "Fetching the latest code from git"
if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  die "Uncommitted local changes found — preserve and reconcile them with main before deployment."
fi

[[ "$(git -C "$ROOT_DIR" branch --show-current)" == "main" ]] || die "Deployment checkout must be on main."
git -C "$ROOT_DIR" fetch origin main --quiet
APPROVED_REVISION="$(git -C "$ROOT_DIR" rev-parse --verify "$APPROVED_REVISION^{commit}")"
git -C "$ROOT_DIR" merge-base --is-ancestor "$APPROVED_REVISION" origin/main || die "Approved revision is not published on origin/main."
git -C "$ROOT_DIR" merge-base --is-ancestor HEAD "$APPROVED_REVISION" || die "Server has diverged from the approved revision; reconcile without overwriting it."
if ! git -C "$ROOT_DIR" diff --quiet HEAD "$APPROVED_REVISION" -- frontend admin; then
  [[ $WITH_FRONT -eq 1 ]] || die "This release changes the frontends; pass --with-front."
fi
if [[ $DO_SEED -eq 1 ]] && grep -Eq "^[[:space:]]*(export[[:space:]]+)?NODE_ENV[[:space:]]*=[[:space:]]*['\"]?production(['\"])?[[:space:]]*(#.*)?$" "$ROOT_DIR/backend/.env"; then
  die "Production demo seed is prohibited; use a reviewed data migration instead."
fi
git -C "$ROOT_DIR" merge --ff-only "$APPROVED_REVISION"
info "Deploying approved revision: $APPROVED_REVISION"

# Preserve the database and the running image before migration/container changes.
umask 077
BACKUP_DIR="/var/backups/drgupet/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers --no-tablespaces "$MYSQL_DATABASE"' > "$BACKUP_DIR/database.sql"
[[ -s "$BACKUP_DIR/database.sql" ]] || die "Database backup is empty; deployment stopped."
CURRENT_IMAGE="$(docker inspect pet_backend --format '{{.Image}}')"
docker tag "$CURRENT_IMAGE" "drgupet-backend:rollback-$(basename "$BACKUP_DIR")"
printf '%s\n' "$APPROVED_REVISION" > "$BACKUP_DIR/target-revision"
printf '%s\n' "$PREVIOUS_REVISION" > "$BACKUP_DIR/previous-revision"
for site in frontend admin; do
  [[ ! -d "$ROOT_DIR/$site/dist" ]] || cp -a "$ROOT_DIR/$site/dist" "$BACKUP_DIR/$site-dist"
done
info "Private database backup and rollback image preserved in $BACKUP_DIR"

# Compile both apps before replacing the backend; a failed build aborts release.
if [[ $WITH_FRONT -eq 1 ]]; then
  export NODE_OPTIONS=--max-old-space-size=768
  (umask 022; cd "$ROOT_DIR/frontend" && npm ci --no-audit --no-fund && VITE_API_BASE_URL=/api/v1 npm run build -- --outDir "$BACKUP_DIR/new-builds/frontend")
  (umask 022; cd "$ROOT_DIR/admin" && npm ci --no-audit --no-fund && VITE_API_BASE_URL=/api/v1 npm run build -- --outDir "$BACKUP_DIR/new-builds/admin")
  [[ -f "$BACKUP_DIR/new-builds/frontend/index.html" && -f "$BACKUP_DIR/new-builds/admin/index.html" ]] || die "Frontend build output missing; deployment stopped."
fi
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || die "Source changed during build; deployment stopped."
if [[ $WITH_FRONT -eq 1 ]]; then
  for site in frontend admin; do
    cp -a "$BACKUP_DIR/new-builds/$site" "$ROOT_DIR/$site/dist.next"
  done
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
  STATE="$(docker inspect -f '{{.State.Status}}' pet_backend 2>/dev/null || echo missing)"
  RESTARTS="$(docker inspect -f '{{.RestartCount}}' pet_backend 2>/dev/null || echo 0)"
  if [[ "$STATE" == "restarting" && "${RESTARTS:-0}" -ge 2 ]]; then
    warn "Backend is crash-looping (restart #${RESTARTS}) — logs below"
    compose ps || true
    compose logs --tail=40 backend || true
    die "Backend keeps restarting after the update — fix backend/.env / migration issues and re-run"
  fi
  if [[ $i -eq 60 ]]; then
    compose ps || true
    compose logs --tail=40 backend || true
    die "Backend did not become healthy — see the logs above"
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
  step "Both frontend builds completed before backend replacement"
  for site in frontend admin; do
    HAD_PREVIOUS=0
    if [[ -d "$ROOT_DIR/$site/dist" ]]; then
      mv "$ROOT_DIR/$site/dist" "$ROOT_DIR/$site/dist.previous"
      HAD_PREVIOUS=1
    fi
    if ! mv "$ROOT_DIR/$site/dist.next" "$ROOT_DIR/$site/dist"; then
      if [[ $HAD_PREVIOUS -eq 1 ]]; then
        mv "$ROOT_DIR/$site/dist.previous" "$ROOT_DIR/$site/dist" || die "Frontend promotion and restoration failed; restore the preserved release manually."
      fi
      die "Frontend promotion failed; previous served files were preserved."
    fi
    [[ $HAD_PREVIOUS -eq 0 ]] || mv "$ROOT_DIR/$site/dist.previous" "$BACKUP_DIR/$site-before-promotion"
  done
  warn "Verify nginx serves these dist directories; external release paths must be promoted separately."
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
