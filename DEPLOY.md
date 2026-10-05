# Dr. Gupet — Deployment Guide

Step-by-step runbook to deploy and operate Dr. Gupet on a fresh server.
All scripts in [`scripts/`](scripts/) are English, non-interactive, and safe to re-run.

**TL;DR on a fresh Ubuntu/Debian server:**

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/MohammadAky/Dr.Gupet.git /opt/drgupet
cd /opt/drgupet
sudo ./scripts/setup.sh \
  --domain shop.example.com \
  --admin-domain admin.example.com \
  --email you@example.com \
  --phone 0912xxxxxxxx \
  --with-front
```

---

## 1. Server requirements

| Item | Minimum | Recommended |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | **1 GB** (setup.sh adds 1 GB swap automatically) | 2 GB+ |
| Disk | 10 GB | 20 GB+ |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Access | `sudo` (root) over SSH | — |
| Network | Ports **80** and **443** open to the internet | — |

> On a 1 GB / 1 vCPU box everything works, but the first `docker compose build` can take
> **10–20 minutes** — this is normal, it is not stuck. `setup.sh` enables a 1 GB swap file
> first so Docker/npm builds never run out of memory.

## 2. DNS (before SSL)

Create **A records** pointing to the server's public IP:

| Record | Purpose |
|---|---|
| `shop.example.com` → `SERVER_IP` | Storefront + API |
| `admin.example.com` → `SERVER_IP` | Admin panel |

Both domains serve their own app and proxy `/api/` to the same backend (same-origin,
so no CORS setup is needed). `scripts/ssl.sh` checks DNS first and **skips certificate
issuance cleanly** if records are missing — you can finish SSL later.

## 3. One-time setup — `scripts/setup.sh`

```bash
sudo ./scripts/setup.sh --domain shop.example.com \
     [--admin-domain admin.example.com] \
     [--email you@example.com] \
     [--phone 0912xxxxxxxx] \
     [--with-front] [--skip-ssl]
```

| Flag | Meaning |
|---|---|
| `--domain` | Public store domain (fills `PUBLIC_BASE_URL`, CORS, payment URLs in `.env`) |
| `--admin-domain` | Admin panel subdomain (separate nginx site + certificate) |
| `--email` | Let's Encrypt expiry notifications (optional; no prompt if omitted) |
| `--phone` | `ADMIN_SEED_PHONE` — the admin login number (OTP codes go here) |
| `--with-front` | Build `frontend/dist` + `admin/dist` on this server (needs Node 20+) |
| `--skip-ssl` | Skip step 9 entirely |

What the 9 steps do:

1. Check arguments
2. Enable swap on small VMs (< 2 GB RAM)
3. Install Docker, Docker Compose, nginx, certbot
4. Generate `backend/.env` with strong random secrets (idempotent — never overwrites)
5. Build the backend image and start MySQL + Redis + backend
6. Wait for `GET /api/v1/health`
7. Seed reference data + the admin user (`ADMIN_SEED_PHONE`)
8. Optional: build the frontends
9. Optional: SSL — skips with instructions when DNS is not ready

**Set `--phone` to a real number you control** — with `SMS_DRIVER=smsir` the OTP login
code for the admin panel is sent by real SMS to that number.

If the script fails at some step, fix the cause and simply re-run it: every step is
idempotent. `backend/.env` is created only once, so re-runs keep your secrets.

## 4. After every code change — `scripts/update.sh`

```bash
cd /opt/drgupet
sudo ./scripts/update.sh [--seed] [--with-front] [--force]
```

1. `git pull` (fast-forward only; refuses dirty trees unless `--force`)
2. Rebuild the backend image (Docker cache keeps this fast)
3. `docker compose up -d` — only changed containers are replaced; **DB migrations run
   automatically on boot**; downtime is a few seconds
4. Health check
5. `--seed`: re-run the idempotent seed (e.g. after changing `ADMIN_SEED_PHONE`)
6. `--with-front`: rebuild the SPA bundles (after UI changes)

## 5. SSL — `scripts/ssl.sh`

```bash
sudo ./scripts/ssl.sh --domain shop.example.com \
     [--admin-domain admin.example.com] [--email you@example.com] \
     [--root /opt/drgupet]
```

- Issues a free Let's Encrypt certificate and enables HTTP→HTTPS redirect.
- **Non-interactive** — never waits for keyboard input.
- **DNS pre-check** — if records are not ready it exits with instructions instead of
  hanging on the ACME challenge.
- Auto-renewal is handled by the certbot systemd timer (checked twice a day);
  verify anytime with `certbot renew --dry-run`.
- Default `--root` is `/opt/drgupet`; pass `--root` if you cloned elsewhere.

## 6. Verify the deployment

```bash
curl https://shop.example.com/api/v1/health          # backend health
docker compose -f backend/docker-compose.yml ps      # all containers "running/healthy"
curl -I https://shop.example.com                     # 200 + redirect from http
```

Open `https://shop.example.com` (storefront) and `https://admin.example.com` (admin).
Admin login: your `--phone` number → OTP by SMS → ADMIN role check → dashboard.

## 7. Backups (do this from day one)

```bash
# nightly cron example
docker exec pet_mysql mysqldump -u pet -p"$MYSQL_PASSWORD" pet_db | gzip > /backups/db-$(date +%F).sql.gz
tar czf /backups/uploads-$(date +%F).tar.gz -C /opt/drgupet/backend uploads
```

Copy backups off the server (S3 or another host). Restore:

```bash
gunzip < db.sql.gz | docker exec -i pet_mysql mysql -u pet -p pet_db
```

## 8. Common commands

| Task | Command |
|---|---|
| Service status | `docker compose -f backend/docker-compose.yml ps` |
| Live backend logs | `docker compose -f backend/docker-compose.yml logs -f backend` |
| Restart backend only | `docker compose -f backend/docker-compose.yml restart backend` |
| Run seed manually | `docker compose -f backend/docker-compose.yml exec backend npm run prisma:seed` |
| Shell into backend | `docker compose -f backend/docker-compose.yml exec backend sh` |
| Stop everything | `docker compose -f backend/docker-compose.yml down` (data stays in volumes) |
| nginx config test | `nginx -t && systemctl reload nginx` |
| Certificate status | `certbot certificates` |

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Setup "stuck" at the SSL step | DNS not pointing at the server yet — the script now skips and tells you; run `scripts/ssl.sh` after DNS propagates |
| Setup "stuck" at frontend builds | On 1 GB VMs `npm ci` + Vite can take 5–10 min per app — it is working; swap is enabled by setup.sh to prevent OOM |
| First `docker compose build` is slow | Normal on 1 vCPU (10–20 min). Later runs use the Docker cache (seconds) |
| Site returns 502 | Backend container is down → `docker compose -f backend/docker-compose.yml logs backend` |
| Backend keeps restarting | Missing required env in `backend/.env` (see the `env.validation` message in the logs) |
| OTP SMS not arriving | Check `GET /admin/sms/logs`, `SMS_API_KEY` / `SMS_IR_TEMPLATE_ID`, and the `SmsLog` table |
| Certificate problems | `certbot renew --dry-run`, `journalctl -u certbot.timer`, `certbot certificates` |
| Out of disk | `docker system prune`, old backups in `/backups`, `docker image prune -f` |

More detail (env vars, API contracts, business rules): the root [`README.md`](README.md).
