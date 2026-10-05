#!/usr/bin/env bash
# =====================================================================
# ssl.sh — activate HTTPS with Let's Encrypt (certbot) + nginx config
#
#   sudo ./scripts/ssl.sh --domain shop.example.com \
#        [--admin-domain admin.example.com] \
#        [--email you@example.com] \
#        [--root /opt/drgupet]
#
# What it does (5 steps):
#   1) Install nginx and certbot if missing
#   2) Render scripts/nginx/site.conf.template for the store domain
#      (and the admin domain when --admin-domain is given)
#   3) Check DNS, then issue a free Let's Encrypt certificate
#      with automatic HTTP->HTTPS redirect
#   4) Verify automatic renewal (systemd timer installed with certbot)
#   5) Print a summary
#
# Notes:
#   * Fully non-interactive: never waits for keyboard input.
#   * If DNS does not point to this server yet, it SKIPS issuance with
#     clear instructions instead of hanging on the ACME challenge.
# =====================================================================
set -euo pipefail

# ---------- logging helpers ----------
if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
TOTAL_STEPS=5; STEP_NO=0
info()  { echo "${G}[✓]${N} $*"; }
step()  { STEP_NO=$((STEP_NO+1)); echo; echo "${B}[${STEP_NO}/${TOTAL_STEPS}]${N} $*"; }
warn()  { echo "${Y}[!]${N} $*"; }
die()   { echo "${R}[✗]${N} $*" >&2; exit 1; }
usage() { awk 'NR==1 {next} /^#/ {sub(/^# ?/,""); print; next} {exit}' "$0"; }

# ---------- arguments ----------
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi
step "Checking arguments"
DOMAIN="" ADMIN_DOMAIN="" EMAIL="" ROOT_DIR="/opt/drgupet"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)       DOMAIN="${2:?}"; shift 2 ;;
    --admin-domain) ADMIN_DOMAIN="${2:?}"; shift 2 ;;
    --email)        EMAIL="${2:?}"; shift 2 ;;
    --root)         ROOT_DIR="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1 (see --help)" ;;
  esac
done
[[ $EUID -eq 0 ]] || die "This script must run as root: sudo ./scripts/ssl.sh"
[[ -n "$DOMAIN" ]] || die "Missing required flag: --domain shop.example.com"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || die "Invalid domain name: $DOMAIN"
[[ -z "$ADMIN_DOMAIN" || "$ADMIN_DOMAIN" =~ ^[a-z0-9.-]+$ ]] || die "Invalid domain name: $ADMIN_DOMAIN"

TEMPLATE="$(cd "$(dirname "$0")" && pwd)/nginx/site.conf.template"
[[ -f "$TEMPLATE" ]] || die "nginx template not found: $TEMPLATE"

# ---------- 1) install nginx + certbot ----------
step "Installing nginx and certbot"
export DEBIAN_FRONTEND=noninteractive
if ! command -v nginx >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq nginx
fi
if ! command -v certbot >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi
info "nginx and certbot ready"

# ---------- 2) render nginx site config ----------
render_site() {  # $1=server_name  $2=dist_dir  $3=label  $4=site_file
  sed -e "s|__SERVER_NAME__|$1|g" \
      -e "s|__DIST_DIR__|$2|g" \
      -e "s|__SITE__|$3|g" \
      "$TEMPLATE" > "/etc/nginx/sites-available/$4"
  ln -sf "/etc/nginx/sites-available/$4" "/etc/nginx/sites-enabled/$4"
  info "$3 config written: /etc/nginx/sites-available/$4"
}

step "Writing nginx config for $DOMAIN"
render_site "$DOMAIN" "$ROOT_DIR/frontend/dist" "Store" "drgupet"

if [[ -n "$ADMIN_DOMAIN" ]]; then
  info "Writing nginx config for admin panel $ADMIN_DOMAIN"
  render_site "$ADMIN_DOMAIN" "$ROOT_DIR/admin/dist" "Admin panel" "drgupet-admin"
fi

# Drop the default site so the server answers with our app on the IP too
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "nginx config is invalid"
systemctl reload nginx
info "nginx reloaded"

# ---------- 3) DNS check + certificate ----------
resolve_v4() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}'; }

SERVER_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
DNS_OK=1
if [[ -n "$SERVER_IP" ]]; then
  for d in $DOMAIN ${ADMIN_DOMAIN:-}; do
    ip="$(resolve_v4 "$d")"
    if [[ -z "$ip" ]]; then
      DNS_OK=0
      warn "$d has no DNS record yet"
    elif [[ "$ip" != "$SERVER_IP" ]]; then
      DNS_OK=0
      warn "$d resolves to $ip but this server is $SERVER_IP"
    else
      info "$d -> $ip ✓"
    fi
  done
else
  warn "Could not determine this server's public IP — skipping the DNS check"
fi

if [[ $DNS_OK -eq 0 ]]; then
  step "Skipping certificate issuance (DNS not ready — NOT an error)"
  warn "Point the A record(s) to this server's public IP, wait for DNS to propagate,"
  warn "then run:  sudo ./scripts/ssl.sh --domain $DOMAIN${ADMIN_DOMAIN:+ --admin-domain $ADMIN_DOMAIN}"
  warn "The site works over HTTP in the meantime."
  exit 0
fi

CERT_ARGS=(-d "$DOMAIN")
[[ -n "$ADMIN_DOMAIN" ]] && CERT_ARGS+=(-d "$ADMIN_DOMAIN")
EMAIL_ARGS=(--register-unsafely-without-email)
[[ -n "$EMAIL" ]] && EMAIL_ARGS=(-m "$EMAIL")

step "Issuing Let's Encrypt certificate for: ${CERT_ARGS[*]}"
timeout 600 certbot --nginx "${CERT_ARGS[@]}" \
  --non-interactive --agree-tos --redirect \
  "${EMAIL_ARGS[@]}" \
  || die "certbot failed — check port 80 is reachable from the internet, then re-run this script"

# ---------- 4) renewal check ----------
step "Verifying automatic renewal (systemd timer checks twice a day)"
timeout 300 certbot renew --dry-run >/dev/null 2>&1 \
  && info "Auto-renewal is healthy" \
  || warn "Renewal dry-run failed — check later with: certbot renew --dry-run"

# ---------- 5) summary ----------
echo
info "SSL is active ✅"
echo "  ${B}https://$DOMAIN${N}"
[[ -n "$ADMIN_DOMAIN" ]] && echo "  ${B}https://$ADMIN_DOMAIN${N}  (admin panel)"
echo
echo "Notes:"
echo "  * A records of both domains must point to this server."
echo "  * If you need CORS later (calling the API from another origin):"
echo "      CORS_ORIGINS=https://$DOMAIN$([[ -n "$ADMIN_DOMAIN" ]] && echo ",https://$ADMIN_DOMAIN")"
echo "      in backend/.env, then run ./scripts/update.sh"
