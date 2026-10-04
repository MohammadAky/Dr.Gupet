#!/usr/bin/env bash
# =====================================================================
# ssl.sh — فعال‌سازی HTTPS با Let's Encrypt (certbot) + پیکربندی nginx
#
#   sudo ./scripts/ssl.sh --domain shop.example.com \
#        [--email you@example.com] \
#        [--admin-domain admin.example.com] \
#        [--root /opt/drgupet]
#
# کارهایی که می‌کند:
#   ۱) نصب nginx و certbot اگر نباشند
#   ۲) رندر قالب scripts/nginx/site.conf.template برای دامنهٔ فروشگاه
#      (و در صورت وجود --admin-domain برای دامنهٔ پنل ادمین)
#   ۳) صدور گواهی رایگان Let's Encrypt و روشن‌کردن redirect خودکار HTTP→HTTPS
#   ۴) بررسی تمدید خودکار (تایمر systemd که همراه certbot نصب می‌شود)
# =====================================================================
set -euo pipefail

# ---------- کمک‌های رنگ و لاگ ----------
if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
info()  { echo "${G}[✓]${N} $*"; }
step()  { echo "${B}▸ $*${N}"; }
warn()  { echo "${Y}[!]${N} $*"; }
die()   { echo "${R}[✗]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "این اسکریپت باید با root اجرا شود: sudo ./scripts/ssl.sh"

# ---------- آرگومان‌ها ----------
DOMAIN="" ADMIN_DOMAIN="" EMAIL="" ROOT_DIR="/opt/drgupet"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)       DOMAIN="${2:?}"; shift 2 ;;
    --admin-domain) ADMIN_DOMAIN="${2:?}"; shift 2 ;;
    --email)        EMAIL="${2:?}"; shift 2 ;;
    --root)         ROOT_DIR="${2:?}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -20; exit 0 ;;
    *) die "آرگومان ناشناخته: $1 (راهنما: --help)" ;;
  esac
done
[[ -n "$DOMAIN" ]] || die "دامنه لازم است: --domain shop.example.com"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || die "نام دامنه نامعتبر است: $DOMAIN"

TEMPLATE="$(cd "$(dirname "$0")" && pwd)/nginx/site.conf.template"
[[ -f "$TEMPLATE" ]] || die "قالب nginx پیدا نشد: $TEMPLATE"

# ---------- ۱) نصب nginx و certbot ----------
step "بررسی/نصب nginx و certbot"
export DEBIAN_FRONTEND=noninteractive
if ! command -v nginx >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq nginx
fi
if ! command -v certbot >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi
info "nginx و certbot آماده‌اند"

# ---------- ۲) رندر پیکربندی سایت ----------
render_site() {  # $1=server_name  $2=dist_dir  $3=label  $4=site_file
  sed -e "s|__SERVER_NAME__|$1|g" \
      -e "s|__DIST_DIR__|$2|g" \
      -e "s|__SITE__|$3|g" \
      "$TEMPLATE" > "/etc/nginx/sites-available/$4"
  ln -sf "/etc/nginx/sites-available/$4" "/etc/nginx/sites-enabled/$4"
  info "پیکربندی $3 آماده شد: /etc/nginx/sites-available/$4"
}

step "پیکربندی nginx برای $DOMAIN"
render_site "$DOMAIN" "$ROOT_DIR/frontend/dist" "فروشگاه" "drgupet"

if [[ -n "$ADMIN_DOMAIN" ]]; then
  step "پیکربندی nginx برای پنل ادمین $ADMIN_DOMAIN"
  render_site "$ADMIN_DOMAIN" "$ROOT_DIR/admin/dist" "پنل ادمین" "drgupet-admin"
fi

# پیکربندی پیش‌فرض nginx را کنار بگذار تا روی IP هم سایت خودمان جواب دهد
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "پیکربندی nginx نامعتبر است"
systemctl reload nginx
info "nginx بارگذاری شد"

# ---------- ۳) صدور گواهی SSL ----------
if [[ -z "$EMAIL" ]]; then
  if [[ -t 0 ]]; then
    read -rp "ایمیل برای اطلاع‌رسانی Let's Encrypt: " EMAIL
  fi
  [[ -n "$EMAIL" ]] || die "ایمیل لازم است: --email you@example.com"
fi

CERT_ARGS=(-d "$DOMAIN")
[[ -n "$ADMIN_DOMAIN" ]] && CERT_ARGS+=(-d "$ADMIN_DOMAIN")

step "صدور گواهی Let's Encrypt برای ${CERT_ARGS[*]}"
certbot --nginx "${CERT_ARGS[@]}" \
  --non-interactive --agree-tos --redirect \
  -m "$EMAIL"

# ---------- ۴) بررسی تمدید خودکار ----------
step "بررسی تمدید خودکار گواهی"
certbot renew --dry-run >/dev/null 2>&1 \
  && info "تمدید خودکار سالم است (تایمر systemd هر ۱۲ ساعت بررسی می‌کند)" \
  || warn "تست تمدید خودکار موفق نبود — بعداً 'certbot renew --dry-run' را بررسی کنید"

echo
info "SSL فعال شد ✅"
echo "  ${B}https://$DOMAIN${N}"
[[ -n "$ADMIN_DOMAIN" ]] && echo "  ${B}https://$ADMIN_DOMAIN${N}  (پنل ادمین)"
echo
echo "نکته‌ها:"
echo "  • رکورد A دامنه‌ها باید به IP این سرور اشاره کند."
echo "  • اگر CORS لازم شد (فراخوانی API از دامنهٔ دیگر):"
echo "      CORS_ORIGINS=https://$DOMAIN$([[ -n "$ADMIN_DOMAIN" ]] && echo ",https://$ADMIN_DOMAIN")"
echo "      را در backend/.env بگذارید و ./scripts/update.sh را اجرا کنید."
