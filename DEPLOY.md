# Dr. Gupet — Deployment Guide

Step-by-step runbook to deploy and operate Dr. Gupet on a fresh server.
Scripts in [`scripts/`](scripts/) are English. Setup is a one-time interactive wizard; updates require an approved full Git SHA and a clean checkout.

**TL;DR on a fresh Ubuntu/Debian server:**

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/MohammadAky/Dr.Gupet.git /opt/drgupet
cd /opt/drgupet
sudo ./scripts/setup.sh
```

The setup script **asks for everything step-by-step** (domain, admin domain, email,
admin phone, SMS provider, payment provider) and writes the whole `backend/.env` for
you. Use flags (`--domain`, `--phone`, …) or `--non-interactive` for automation.

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
sudo ./scripts/setup.sh
```

**The script asks everything step-by-step** (just press Enter for defaults):

1. Store domain (`shop.example.com`) — empty skips SSL
2. Admin panel domain (`admin.shop.example.com`)
3. Email for Let's Encrypt expiry notices
4. Admin login phone — OTP codes for the admin panel are sent here
5. **SMS provider** — `console` (test: codes in backend logs) or `sms.ir`
   (real SMS: API key + template id; line number is only for bulk notifications)
6. **Payment provider** — `disabled` (default), `zarinpal`, or local-only `mock`
   (real: merchant id + sandbox yes/no)
7. Summary → confirm → everything is written into `backend/.env` for you

Flags pre-fill the answers (nothing is asked twice):

| Flag | Meaning |
|---|---|
| `--domain` | Public store domain (fills `PUBLIC_BASE_URL`, CORS, payment URLs) |
| `--admin-domain` | Admin panel subdomain (separate nginx site + certificate) |
| `--email` | Let's Encrypt expiry notifications |
| `--phone` | `ADMIN_SEED_PHONE` — the admin login number (OTP codes go here) |
| `--with-front` | Build `frontend/dist` + `admin/dist` on this server (needs Node 20+) |
| `--skip-ssl` | Skip the SSL step |
| `--non-interactive` | Never prompt. Public-domain setup fails if real SMS credentials are not supplied; it never publishes development auth |

> **Production note:** the backend **refuses to boot** with `NODE_ENV=production`
> unless real SMS credentials and `OTP_HASH_SECRET` are set, with payments either
> `disabled` or a licensed `zarinpal` gateway. Public setup rejects mock payments,
> console SMS and Zarinpal sandbox; it clears fixed development OTPs.

What the 10 steps do:

1. Check arguments
2. Configuration wizard (above)
3. Enable swap on small VMs (< 2 GB RAM)
4. Install Docker, Docker Compose, nginx, certbot
5. Generate a new private `backend/.env`; an existing file stops setup
6. Build the backend image and start MySQL + Redis + backend
7. Wait for `GET /api/v1/health` — **on failure it prints container status and the
   last backend log lines automatically** and stops early if the backend is
   crash-looping
8. Local-only demo seed; provision approved data and the first admin separately in production
9. Optional: build the frontends
10. Optional: SSL — skips with instructions when DNS is not ready

**Set `--phone` to a real number you control** — with `SMS_DRIVER=smsir` the OTP login
code for the admin panel is sent by real SMS to that number.

An existing `backend/.env` stops setup before changes. Preserve it, diagnose the
failed step, and use the update workflow for an existing deployment. Do not run
the demo seed on production or assume `ADMIN_SEED_PHONE` alone creates an admin.

## 4. After every code change — `scripts/update.sh`

```bash
cd /opt/drgupet
sudo ./scripts/update.sh --revision FULL_APPROVED_GIT_SHA --with-front
```

1. Require clean `main`, fetch `origin/main`, verify the approved SHA is published,
   and advance only by fast-forward. There is no dirty-tree bypass.
2. Preserve a private MySQL dump, rollback image, previous SHA and existing dist
   builds. Build both SPAs with `/api/v1` before replacing the backend image.
3. `docker compose up -d` — only changed containers are replaced; **DB migrations run
   automatically on boot**; downtime is a few seconds
4. Health check
5. Demo seed is prohibited with production configuration; reviewed migrations only.
6. `--with-front` is required when frontend/admin sources changed. Check the actual
   Nginx root: an externally staged release must be promoted separately; rebuilding
   checkout dist does not update that directory. Verify deployed assets and API,
   customer/admin OTP, current roles and refresh/logout after release.

The mandatory workflow for both apps and API is local tests, owner approval,
commit/push to `main`, then deploy that exact SHA. Do not copy uncommitted source
onto VPS. Credentials stay private per environment, never in Git. Preserve the
previous release and confirm schema compatibility before any rollback.

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
| Backend crash-loop with OpenSSL/Prisma engine errors | OpenSSL is now installed in both Docker stages. Preserve server changes, publish the approved correction to main, and rebuild using `update.sh --revision FULL_APPROVED_GIT_SHA` |
| Setup waits for backend health | Inspect private settings, production sms.ir credentials, disabled/licensed payments, database auth and migration errors. Preserve the existing `.env`; do not rerun initial setup. Check `docker compose -f backend/docker-compose.yml logs --tail=40 backend` |
| Setup "stuck" at the SSL step | DNS not pointing at the server yet — the script skips and tells you; run `scripts/ssl.sh` after DNS propagates |
| Setup "stuck" at frontend builds | On 1 GB VMs `npm ci` + Vite can take 5–10 min per app — it is working; swap is enabled by setup.sh to prevent OOM |
| First `docker compose build` is slow | Normal on 1 vCPU (10–20 min). Later runs use the Docker cache (seconds) |
| `docker compose pull` fails with **403 Forbidden** (cloudfront) | See [Docker Hub blocked (403)](#docker-hub-blocked-403--image-pull-failures) below |
| Site returns 502 | Backend container is down → `docker compose -f backend/docker-compose.yml logs backend` |
| Backend keeps restarting | Missing required env in `backend/.env` (see the `env.validation` message in the logs) |
| OTP SMS not arriving | Check `GET /admin/sms/logs`, `SMS_API_KEY` / `SMS_IR_TEMPLATE_ID`, and the `SmsLog` table |
| Certificate problems | `certbot renew --dry-run`, `journalctl -u certbot.timer`, `certbot certificates` |
| Out of disk | `docker system prune`, old backups in `/backups`, `docker image prune -f` |

More detail (env vars, API contracts, business rules): the root [`README.md`](README.md).

## 10. Docker Hub blocked (403) / image pull failures

Symptom while pulling `mysql:8.4` / `redis:7-alpine`:

```text
unknown: failed to copy: httpReadSeeker: failed open: unexpected status from GET
request to https://production.cloudfront.docker.com/... : 403 Forbidden
```

This is a **network/registry restriction** (Docker Hub rate limit or regional blocking),
not a bug in the scripts. The backend image builds fine — only the prebuilt images fail.
Pick ONE fix, preserve the existing deployment, then resume the failed image pull/build step; do not rerun initial setup over an existing `.env`:

**A. Registry mirror (fastest):** add a pull-through mirror to the Docker daemon:

```bash
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
EOF
sudo systemctl restart docker
cd /root/Dr.Gupet && docker compose -f backend/docker-compose.yml pull
```

> Mirrors are third parties: they can serve tampered images. Prefer trusted mirrors,
> or use option B below for full control. Availability of public mirrors changes over
> time — if one is down, try another.

**B. `docker save` / `docker load` (most reliable):** on ANY machine that can reach
Docker Hub (laptop, another VPS):

```bash
docker pull mysql:8.4 redis:7-alpine
docker save mysql:8.4 redis:7-alpine | gzip > pet-images.tar.gz
```

Copy the file to the server (`scp`), then:

```bash
gunzip -c pet-images.tar.gz | docker load
```

**C. Proxy for the Docker daemon** (if you already run a VPN/proxy on the server):

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/proxy.conf <<'EOF'
[Service]
Environment="HTTPS_PROXY=http://127.0.0.1:PORT"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
```

**D. Just retry:** `failed open` errors are sometimes transient CDN hiccups:

```bash
for i in 1 2 3; do docker compose -f backend/docker-compose.yml pull && break; sleep 10; done
```

`setup.sh` already retries the pull 3 times and prints these hints automatically.
