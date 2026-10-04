#!/usr/bin/env bash
# =====================================================================
# update.sh — تازه‌سازی سرویس بعد از تغییر کد
#
#   sudo ./scripts/update.sh [--seed] [--with-front] [--force]
#
# کارهایی که می‌کند:
#   ۱) git pull (فقط fast-forward؛ با تغییرات محلی commit‌نشده متوقف می‌شود)
#   ۲) ساخت دوبارهٔ ایمیج بک‌اند (با cache — اگر وابستگی‌ها عوض نشده باشند سریع است)
#   ۳) docker compose up -d → فقط کانتینرهای تغییرکرده بازساخته می‌شوند
#      (مهاجرت دیتابیس خودکار روی بوت اجرا می‌شود)
#   ۴) بررسی سلامت + نمایش وضعیت
#   ۵) (اختیاری --seed) اجرای مجدد seed بی‌خطر
#   ۶) (اختیاری --with-front) ساخت دوبارهٔ frontend/dist و admin/dist
#
# نکته: توقف سرویس فقط چند ثانیه است (بازساخت کانتینر بک‌اند).
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

[[ $EUID -eq 0 ]] || die "این اسکریپت باید با root اجرا شود: sudo ./scripts/update.sh"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml"

DO_SEED=0 WITH_FRONT=0 FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)       DO_SEED=1; shift ;;
    --with-front) WITH_FRONT=1; shift ;;
    --force)      FORCE=1; shift ;;
    -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -20; exit 0 ;;
    *) die "آرگومان ناشناخته: $1 (راهنما: --help)" ;;
  esac
done

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ---------- ۱) دریافت آخرین کد ----------
step "دریافت آخرین کد از git"
if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  [[ $FORCE -eq 1 ]] \
    && warn "تغییرات محلی commit‌نشده دارید (--force) — با pull ادامه می‌دهم" \
    || die "تغییرات محلی commit‌نشده دارید؛ اول commit/push کنید یا --force بزنید"
fi

git -C "$ROOT_DIR" fetch origin --quiet
BEHIND="$(git -C "$ROOT_DIR" rev-list --count HEAD..origin/HEAD 2>/dev/null || echo 0)"
if [[ "$BEHIND" == "0" ]]; then
  info "کد از قبل به‌روز است ($(git -C "$ROOT_DIR" log -1 --format='%h %s'))"
else
  git -C "$ROOT_DIR" pull --ff-only origin "$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
  info "$BEHIND کامیت جدید دریافت شد: $(git -C "$ROOT_DIR" log -1 --format='%h %s')"
fi

# ---------- ۲) ساخت ایمیج ----------
step "ساخت ایمیج بک‌اند (کش Docker)"
compose build backend

# ---------- ۳) اجرای نسخهٔ جدید ----------
step "تازه‌سازی کانتینرها (مهاجرت دیتابیس خودکار روی بوت)"
compose up -d
info "سرویس‌ها تازه شدند"

# ---------- ۴) بررسی سلامت ----------
step "بررسی سلامت بک‌اند"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    info "بک‌اند سالم است ✅"
    break
  fi
  [[ $i -eq 40 ]] && die "بک‌اند سالم نشد — لاگ: docker compose -f backend/docker-compose.yml logs --tail=50 backend"
  sleep 3
done

# ---------- ۵) seed (اختیاری؛ بی‌خطر/upsert) ----------
if [[ $DO_SEED -eq 1 ]]; then
  step "اجرای seed (idempotent)"
  compose exec -T backend npm run prisma:seed
fi

# ---------- ۶) فرانت‌ها (اختیاری) ----------
if [[ $WITH_FRONT -eq 1 ]]; then
  step "ساخت دوبارهٔ frontend/dist و admin/dist"
  if command -v npm >/dev/null; then
    (cd "$ROOT_DIR/frontend" && npm ci && npm run build)
    (cd "$ROOT_DIR/admin" && npm ci && npm run build)
    info "خروجی فرانت‌ها تازه شد (nginx نیازی به reload ندارد)"
  else
    warn "npm روی سرور نیست — فرانت‌ها را در CI بسازید یا Node 20+ نصب کنید"
  fi
fi

# ---------- پاک‌سازی ----------
docker image prune -f >/dev/null

echo
info "تازه‌سازی کامل شد ✅"
compose ps
echo
echo "لاگ زنده:  docker compose -f backend/docker-compose.yml logs -f backend"
