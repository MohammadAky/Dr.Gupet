#!/usr/bin/env bash
# =====================================================================
# setup.sh — راه‌اندازی اولیهٔ سرور (فقط یک‌بار؛ اجرای مجدد بی‌خطر است)
#
#   sudo ./scripts/setup.sh --domain shop.example.com \
#        [--admin-domain admin.example.com] \
#        [--email you@example.com] \
#        [--phone 09120000000] \
#        [--with-front] [--skip-ssl]
#
# کارهایی که می‌کند:
#   ۱) نصب Docker (+ Compose) و nginx و certbot در صورت نبود
#   ۲) ساخت backend/.env با secretهای قوی (JWT، OTP، رمز MySQL) و تنظیم دامنه‌ها
#   ۳) ساخت و بالا آوردن پشته (MySQL + Redis + بک‌اند) با docker compose
#   ۴) صبر تا سلامت بک‌اند + اجرای seed (داده‌های مرجع و ادمین)
#   ۵) (اختیاری --with-front) ساخت خروجی فرانت‌اند و پنل ادمین
#   ۶) (اختیاری) فراخوانی scripts/ssl.sh برای HTTPS
# =====================================================================
set -euo pipefail

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
info()  { echo "${G}[✓]${N} $*"; }
step()  { echo "${B}▸ $*${N}"; }
warn()  { echo "${Y}[!]${N} $*"; }
die()   { echo "${R}[✗]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "این اسکریپت باید با root اجرا شود: sudo ./scripts/setup.sh"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml"
ENV_FILE="$ROOT_DIR/backend/.env"
ENV_EXAMPLE="$ROOT_DIR/backend/.env.example"

# ---------- آرگومان‌ها ----------
DOMAIN="" ADMIN_DOMAIN="" EMAIL="" PHONE="09120000000" WITH_FRONT=0 SKIP_SSL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)       DOMAIN="${2:?}"; shift 2 ;;
    --admin-domain) ADMIN_DOMAIN="${2:?}"; shift 2 ;;
    --email)        EMAIL="${2:?}"; shift 2 ;;
    --phone)        PHONE="${2:?}"; shift 2 ;;
    --with-front)   WITH_FRONT=1; shift ;;
    --skip-ssl)     SKIP_SSL=1; shift ;;
    -h|--help)      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -20; exit 0 ;;
    *) die "آرگومان ناشناخته: $1 (راهنما: --help)" ;;
  esac
done

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ---------- ۱) نصب Docker و nginx ----------
step "بررسی/نصب Docker، Compose، nginx و certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg openssl nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null; then
  step "نصب Docker (اسکریپت رسمی)"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 \
  || apt-get install -y -qq docker-compose-plugin
info "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') + Compose آماده است"

# ---------- ۲) ساخت فایل .env ----------
step "آماده‌سازی backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn "backend/.env از قبل وجود دارد — دست نمی‌خورد (در صورت نیاز دستی ویرایش کنید)"
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  # secretهای قوی
  JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
  OTP_HASH_SECRET="$(openssl rand -hex 32)"
  MYSQL_PASSWORD="$(openssl rand -hex 16)"
  MYSQL_ROOT_PASSWORD="$(openssl rand -hex 16)"

  sed -i \
    -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET|" \
    -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" \
    -e "s|^OTP_HASH_SECRET=.*|OTP_HASH_SECRET=$OTP_HASH_SECRET|" \
    -e "s|^ADMIN_SEED_PHONE=.*|ADMIN_SEED_PHONE=$PHONE|" \
    "$ENV_FILE"

  # رمزهای MySQL برای interpolation در docker-compose
  cat >> "$ENV_FILE" <<EOF

# --- ساخته‌شده توسط scripts/setup.sh ---
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
EOF

  if [[ -n "$DOMAIN" ]]; then
    ORIGINS="https://$DOMAIN"
    [[ -n "$ADMIN_DOMAIN" ]] && ORIGINS="$ORIGINS,https://$ADMIN_DOMAIN"
    sed -i \
      -e "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMAIN|" \
      -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$ORIGINS|" \
      -e "s|^PAYMENT_CALLBACK_URL=.*|PAYMENT_CALLBACK_URL=https://$DOMAIN/api/v1/payments/callback|" \
      -e "s|^FRONTEND_PAYMENT_RESULT_URL=.*|FRONTEND_PAYMENT_RESULT_URL=https://$DOMAIN/payment/result|" \
      "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
  info "backend/.env ساخته شد (secretها تولید شدند؛ فقط مالک فایل می‌خواند)"
fi

mkdir -p "$ROOT_DIR/backend/uploads"

# ---------- ۳) ساخت و اجرای پشته ----------
step "ساخت ایمیج بک‌اند و بالا آوردن پشته (MySQL + Redis + بک‌اند)"
compose build
compose up -d
info "کانتینرها در حال بالا آمدن هستند"

# ---------- ۴) انتظار برای سلامت + seed ----------
step "انتظار برای سلامت بک‌اند (GET /api/v1/health)"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    info "بک‌اند سالم است"
    break
  fi
  [[ $i -eq 60 ]] && die "بک‌اند سالم نشد — لاگ: docker compose -f backend/docker-compose.yml logs backend"
  sleep 3
done

step "اجرای seed (داده‌های مرجع + کاربر ادمین از ADMIN_SEED_PHONE)"
compose exec -T backend npm run prisma:seed || warn "seed ناموفق بود — بعداً دستی اجرا کنید"

# ---------- ۵) فرانت‌اند و پنل (اختیاری) ----------
if [[ $WITH_FRONT -eq 1 ]]; then
  step "ساخت خروجی فرانت‌اند و پنل ادمین (نیازمند Node 20+)"
  if command -v npm >/dev/null; then
    (cd "$ROOT_DIR/frontend" && npm ci && npm run build)
    (cd "$ROOT_DIR/admin" && npm ci && npm run build)
    info "frontend/dist و admin/dist ساخته شدند"
  else
    warn "npm پیدا نشد — فرانت‌ها را بعداً روی همین سرور یا CI بسازید"
  fi
fi

# ---------- ۶) SSL ----------
if [[ $SKIP_SSL -eq 0 && -n "$DOMAIN" ]]; then
  step "فعال‌سازی SSL"
  SSL_ARGS=(--domain "$DOMAIN")
  [[ -n "$ADMIN_DOMAIN" ]] && SSL_ARGS+=(--admin-domain "$ADMIN_DOMAIN")
  [[ -n "$EMAIL" ]] && SSL_ARGS+=(--email "$EMAIL")
  "$ROOT_DIR/scripts/ssl.sh" "${SSL_ARGS[@]}"
elif [[ $SKIP_SSL -eq 1 ]]; then
  warn "SSL به‌درخواست شما رد شد — بعداً: sudo ./scripts/ssl.sh --domain $DOMAIN"
fi

echo
info "راه‌اندازی کامل شد ✅"
echo "  ${B}وضعیت:${N}      cd $ROOT_DIR && docker compose -f backend/docker-compose.yml ps"
echo "  ${B}لاگ‌ها:${N}      docker compose -f backend/docker-compose.yml logs -f backend"
echo "  ${B}به‌روزرسانی:${N} sudo $ROOT_DIR/scripts/update.sh"
