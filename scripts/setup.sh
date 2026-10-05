#!/usr/bin/env bash
# =====================================================================
# setup.sh — interactive one-time server setup for Dr. Gupet
#
#   sudo ./scripts/setup.sh [options]
#
# Options (anything omitted is asked step-by-step in the terminal):
#   --domain shop.example.com      store domain
#   --admin-domain admin.x.com     admin panel domain
#   --email you@example.com        Let's Encrypt notifications
#   --phone 0912xxxxxxxx           admin login phone (OTP goes here)
#   --with-front                   build frontend/ and admin/ here (Node 20+)
#   --skip-ssl                     skip the SSL step
#   --non-interactive              never prompt (for automation); missing values
#                                  fall back to safe test defaults
#
# What it does (10 steps):
#   1) Check arguments
#   2) Configuration wizard — domain, admin domain, email, admin phone,
#      SMS provider (console / sms.ir + keys), payment (mock / zarinpal + keys)
#   3) Enable swap on small VMs (< 2 GB RAM) so builds never stall
#   4) Install Docker, Docker Compose, nginx and certbot
#   5) Generate backend/.env (strong secrets + all wizard answers)
#   6) Build the backend image and start the stack (MySQL + Redis + backend)
#   7) Wait for backend health — dumps container logs automatically on failure
#   8) Seed reference data + the admin user (ADMIN_SEED_PHONE)
#   9) Optional (--with-front): build frontend/ and admin/
#  10) Optional: activate SSL — skips cleanly when DNS is not ready
#
# Notes:
#   * Idempotent: secrets in an existing backend/.env are never overwritten;
#     wizard answers update their specific keys so re-runs can fix settings.
#   * The first backend image build can take 5-20 minutes on a 1 vCPU VM.
# =====================================================================
set -euo pipefail

# ---------- logging helpers ----------
if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
TOTAL_STEPS=10; STEP_NO=0
info()  { echo "${G}[✓]${N} $*"; }
step()  { STEP_NO=$((STEP_NO+1)); echo; echo "${B}[${STEP_NO}/${TOTAL_STEPS}]${N} $*"; }
warn()  { echo "${Y}[!]${N} $*"; }
die()   { echo "${R}[✗]${N} $*" >&2; exit 1; }
usage() { awk 'NR==1 {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

# ---------- 1) arguments ----------
step "Checking arguments"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml"
ENV_FILE="$ROOT_DIR/backend/.env"
ENV_EXAMPLE="$ROOT_DIR/backend/.env.example"

DOMAIN="" ADMIN_DOMAIN="" EMAIL="" PHONE="" WITH_FRONT=0 SKIP_SSL=0 NON_INTERACTIVE=0
SMS_DRIVER="" SMS_API_KEY="" SMS_IR_TEMPLATE_ID="" SMS_IR_LINE_NUMBER=""
PAYMENT_DRIVER="" ZARINPAL_MERCHANT_ID="" ZARINPAL_SANDBOX=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)          DOMAIN="${2:?}"; shift 2 ;;
    --admin-domain)    ADMIN_DOMAIN="${2:?}"; shift 2 ;;
    --email)           EMAIL="${2:?}"; shift 2 ;;
    --phone)           PHONE="${2:?}"; shift 2 ;;
    --with-front)      WITH_FRONT=1; shift ;;
    --skip-ssl)        SKIP_SSL=1; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    -h|--help)         usage; exit 0 ;;
    *) die "Unknown argument: $1 (see --help)" ;;
  esac
done
[[ $EUID -eq 0 ]] || die "This script must run as root: sudo ./scripts/setup.sh"

INTERACTIVE=0
[[ $NON_INTERACTIVE -eq 0 && -t 0 ]] && INTERACTIVE=1

# ---------- 2) configuration wizard ----------
step "Configuration wizard (press Enter to accept [defaults])"

ask() {  # $1=var  $2=prompt  $3=default
  local _v
  [[ -n "${!1:-}" ]] && return 0
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rp "$2${3:+ [$3]}: " _v || die "Cancelled"
    printf -v "$1" '%s' "${_v:-$3}"
  else
    printf -v "$1" '%s' "$3"
  fi
}
ask_secret() {  # $1=var  $2=prompt
  local _v
  [[ -n "${!1:-}" ]] && return 0
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rsp "$2: " _v || die "Cancelled"; echo
    printf -v "$1" '%s' "$_v"
  else
    printf -v "$1" '%s' ""
  fi
}
choose2() {  # $1=var  $2=question  $3=default(1|2)  $4=label1  $5=label2
  local _v
  [[ -n "${!1:-}" ]] && return 0
  echo "$2"
  echo "  1) $4"
  echo "  2) $5"
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rp "Choice [$3]: " _v || die "Cancelled"
    printf -v "$1" '%s' "${_v:-$3}"
  else
    printf -v "$1" '%s' "$3"
  fi
}

ask DOMAIN       "Store domain (e.g. shop.example.com, empty to skip SSL)" ""
ask ADMIN_DOMAIN "Admin panel domain" "admin.${DOMAIN:-example.com}"
ask EMAIL        "Email for Let's Encrypt notices" "admin@${DOMAIN:-localhost}"
ask PHONE        "Admin login phone (OTP codes are sent here)" "09120000000"

choose2 SMS_CHOICE "SMS provider (OTP codes):" 1 \
  "console — TEST mode: codes printed in backend logs (no real SMS)" \
  "sms.ir — real SMS (needs API key + template)"
if [[ "$SMS_CHOICE" == "2" ]]; then
  SMS_DRIVER="smsir"
  ask_secret SMS_API_KEY        "sms.ir API key"
  ask SMS_IR_TEMPLATE_ID        "sms.ir template id (OTP template)" ""
  ask SMS_IR_LINE_NUMBER        "sms.ir line number" ""
  [[ -n "$SMS_API_KEY" && -n "$SMS_IR_TEMPLATE_ID" ]] || die "sms.ir needs both API key and template id"
else
  SMS_DRIVER="console"
fi

choose2 PAY_CHOICE "Payment provider:" 1 \
  "mock — TEST mode: fake payment page (no real money)" \
  "zarinpal — real gateway (needs merchant id)"
if [[ "$PAY_CHOICE" == "2" ]]; then
  PAYMENT_DRIVER="zarinpal"
  ask_secret ZARINPAL_MERCHANT_ID "Zarinpal merchant id"
  [[ -n "$ZARINPAL_MERCHANT_ID" ]] || die "zarinpal needs a merchant id"
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rp "Enable Zarinpal SANDBOX (test) mode? [Y/n]: " _sb || die "Cancelled"
    ZARINPAL_SANDBOX="true"; [[ "$_sb" =~ ^[Nn] ]] && ZARINPAL_SANDBOX="false"
  else
    ZARINPAL_SANDBOX="true"
  fi
else
  PAYMENT_DRIVER="mock"
  ZARINPAL_SANDBOX="true"
fi

# NODE_ENV=production is only valid with real providers (backend enforces this)
NODE_ENV_VALUE="development"
if [[ "$SMS_DRIVER" == "smsir" && "$PAYMENT_DRIVER" == "zarinpal" ]]; then
  NODE_ENV_VALUE="production"
else
  warn "Test drivers selected (SMS=$SMS_DRIVER, payment=$PAYMENT_DRIVER) -> NODE_ENV=development"
  warn "The backend REFUSES to boot in production without smsir + zarinpal credentials."
  warn "You can upgrade later by editing backend/.env and running ./scripts/update.sh"
fi

if [[ $INTERACTIVE -eq 1 ]]; then
  echo
  echo "${B}Summary:${N}"
  echo "  Store domain:     ${DOMAIN:-'(none - SSL skipped)'}"
  echo "  Admin domain:     ${ADMIN_DOMAIN:-'(none)'}"
  echo "  Email:            ${EMAIL:-'(none)'}"
  echo "  Admin phone:      $PHONE"
  echo "  SMS:              $SMS_DRIVER"
  echo "  Payment:          $PAYMENT_DRIVER (sandbox=$ZARINPAL_SANDBOX)"
  echo "  NODE_ENV:         $NODE_ENV_VALUE"
  echo
  read -rp "Proceed with these values? [Y/n]: " _ok || die "Cancelled"
  [[ "$_ok" =~ ^[Nn] ]] && die "Aborted by user"
fi

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ---------- 3) swap for small VMs ----------
step "Checking RAM / swap (1 GB VMs need swap for Docker + npm builds)"
MEM_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
if [[ "$MEM_KB" -lt 2000000 ]] && ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "1 GB swap enabled (RAM: $((MEM_KB/1024)) MB)"
else
  info "No swap change needed (RAM: $((MEM_KB/1024)) MB)"
fi

# ---------- 4) install Docker + nginx + certbot ----------
step "Installing Docker, Docker Compose, nginx and certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg openssl nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null; then
  info "Installing Docker (official get.docker.com script)"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 \
  || apt-get install -y -qq docker-compose-plugin
info "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') + Compose ready"

# ---------- 5) generate backend/.env ----------
step "Writing backend/.env (secrets + wizard answers)"
FRESH=0
if [[ -f "$ENV_FILE" ]]; then
  warn "backend/.env exists — secrets are kept, wizard answers update their keys"
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  FRESH=1
  sed -i \
    -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^OTP_HASH_SECRET=.*|OTP_HASH_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^PAYMENT_CALLBACK_SECRET=.*|PAYMENT_CALLBACK_SECRET=$(openssl rand -hex 32)|" \
    "$ENV_FILE"
  cat >> "$ENV_FILE" <<EOF

# --- generated by scripts/setup.sh ---
MYSQL_PASSWORD=$(openssl rand -hex 16)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
EOF
  chmod 600 "$ENV_FILE"
  info "backend/.env created (strong secrets generated)"
fi

# Always apply the wizard/flag answers to their specific keys
set_env() {  # $1=key  $2=value
  local _k="$1" _v="$2"
  _v="${_v//\\/\\\\}"; _v="${_v//&/\\&}"; _v="${_v//|/\\|}"
  if grep -q "^$_k=" "$ENV_FILE"; then
    sed -i "s|^$_k=.*|$_k=$_v|" "$ENV_FILE"
  else
    echo "$_k=$2" >> "$ENV_FILE"
  fi
}
set_env NODE_ENV "$NODE_ENV_VALUE"
set_env SMS_DRIVER "$SMS_DRIVER"
set_env PAYMENT_DRIVER "$PAYMENT_DRIVER"
set_env ZARINPAL_SANDBOX "$ZARINPAL_SANDBOX"
set_env ADMIN_SEED_PHONE "$PHONE"
set_env TRUST_PROXY "1"
[[ -n "$SMS_API_KEY" ]]        && set_env SMS_API_KEY "$SMS_API_KEY"
[[ -n "$SMS_IR_TEMPLATE_ID" ]] && set_env SMS_IR_TEMPLATE_ID "$SMS_IR_TEMPLATE_ID"
[[ -n "$SMS_IR_LINE_NUMBER" ]] && set_env SMS_IR_LINE_NUMBER "$SMS_IR_LINE_NUMBER"
[[ -n "$ZARINPAL_MERCHANT_ID" ]] && set_env ZARINPAL_MERCHANT_ID "$ZARINPAL_MERCHANT_ID"

if [[ -n "$DOMAIN" ]]; then
  ORIGINS="https://$DOMAIN"
  [[ -n "$ADMIN_DOMAIN" ]] && ORIGINS="$ORIGINS,https://$ADMIN_DOMAIN"
  set_env PUBLIC_BASE_URL "https://$DOMAIN"
  set_env CORS_ORIGINS "$ORIGINS"
  set_env PAYMENT_CALLBACK_URL "https://$DOMAIN/api/v1/payments/callback"
  set_env FRONTEND_PAYMENT_RESULT_URL "https://$DOMAIN/payment/result"
fi
info "backend/.env is up to date"

mkdir -p "$ROOT_DIR/backend/uploads"

# ---------- 6) build image + start stack ----------
step "Building the backend image and starting MySQL + Redis + backend"
info "First build takes a while on small VMs — progress below is normal, it is NOT stuck"

info "Pulling base images (mysql:8.4, redis:7-alpine) with retries..."
PULLED=0
for attempt in 1 2 3; do
  if compose pull mysql redis; then PULLED=1; break; fi
  warn "Image pull failed (attempt $attempt/3) — retrying in 10s..."
  sleep 10
done
if [[ $PULLED -eq 0 ]]; then
  warn "Could not pull images from Docker Hub (403/timeouts are usually network restrictions)."
  warn "Fixes (pick one, then re-run this script):"
  warn "  1) Configure a registry mirror in /etc/docker/daemon.json and 'systemctl restart docker'"
  warn "     (see DEPLOY.md, section 'Docker Hub blocked (403)')"
  warn "  2) Load the images from a machine that can reach Docker Hub: docker save | docker load"
  die "docker compose pull failed for mysql/redis"
fi

compose build backend
compose up -d
info "Stack is up"

# ---------- 7) wait for backend health ----------
step "Waiting for backend health (GET /api/v1/health)"
dump_backend_diagnostics() {
  warn "---- container status ----"
  compose ps || true
  warn "---- last backend logs ----"
  compose logs --tail=40 backend || true
  warn "---------------------------"
}
for i in $(seq 1 90); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    info "Backend is healthy"
    break
  fi
  STATE="$(docker inspect -f '{{.State.Status}}' pet_backend 2>/dev/null || echo missing)"
  RESTARTS="$(docker inspect -f '{{.RestartCount}}' pet_backend 2>/dev/null || echo 0)"
  if [[ "$STATE" == "restarting" && "${RESTARTS:-0}" -ge 2 ]]; then
    warn "Backend is crash-looping (restart #${RESTARTS}) — logs below"
    dump_backend_diagnostics
    die "Backend keeps restarting. Typical causes: env validation (production needs smsir + zarinpal creds in backend/.env), wrong DATABASE_URL/MYSQL_PASSWORD, or a failed migration. Fix backend/.env and re-run this script."
  fi
  if [[ $i -eq 90 ]]; then
    dump_backend_diagnostics
    die "Backend did not become healthy in 270s — see the logs above."
  fi
  [[ $((i % 10)) -eq 0 ]] && warn "Still waiting... ($((i*3))s) — first boot runs migrations"
  sleep 3
done

# ---------- 8) seed ----------
step "Seeding reference data + admin user (ADMIN_SEED_PHONE)"
compose exec -T backend npm run prisma:seed || warn "Seed failed — run it later: docker compose -f backend/docker-compose.yml exec backend npm run prisma:seed"

# ---------- 9) optional frontend builds ----------
if [[ $WITH_FRONT -eq 1 ]]; then
  step "Building frontend/dist and admin/dist (Node 20+)"
  if command -v npm >/dev/null; then
    export NODE_OPTIONS=--max-old-space-size=768
    info "Building frontend..."
    (cd "$ROOT_DIR/frontend" && npm ci --no-audit --no-fund && npm run build)
    info "Building admin panel..."
    (cd "$ROOT_DIR/admin" && npm ci --no-audit --no-fund && npm run build)
    info "frontend/dist and admin/dist are ready"
  else
    warn "npm not found — build the frontends later (or in CI) and re-run scripts/ssl.sh"
  fi
else
  step "Skipping frontend builds (use --with-front to build them here)"
fi

# ---------- 10) optional SSL ----------
if [[ $SKIP_SSL -eq 1 || -z "$DOMAIN" ]]; then
  step "Skipping SSL"
  [[ $SKIP_SSL -eq 1 ]] && warn "SSL skipped by request — later: sudo ./scripts/ssl.sh --domain $DOMAIN"
else
  step "Activating SSL (skips cleanly if DNS is not ready yet)"
  SSL_ARGS=(--domain "$DOMAIN" --root "$ROOT_DIR")
  [[ -n "$ADMIN_DOMAIN" ]] && SSL_ARGS+=(--admin-domain "$ADMIN_DOMAIN")
  [[ -n "$EMAIL" ]] && SSL_ARGS+=(--email "$EMAIL")
  "$ROOT_DIR/scripts/ssl.sh" "${SSL_ARGS[@]}" \
    || warn "SSL activation failed — fix the issue and re-run: sudo ./scripts/ssl.sh --domain $DOMAIN --root $ROOT_DIR"
fi

echo
info "Setup finished ✅"
echo "  ${B}Status:${N}   cd $ROOT_DIR && docker compose -f backend/docker-compose.yml ps"
echo "  ${B}Logs:${N}     docker compose -f backend/docker-compose.yml logs -f backend"
echo "  ${B}Update:${N}   sudo $ROOT_DIR/scripts/update.sh"
echo "  ${B}Guide:${N}    $ROOT_DIR/DEPLOY.md"
