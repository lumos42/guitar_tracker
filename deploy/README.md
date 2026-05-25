# Guitar Tracker – Deployment

Production stack: **Traefik** (reverse proxy) → **gunicorn + uvicorn** (backend) + **serve** (frontend SPA).

```
Browser :80
   │
   └─ Traefik (/api/*) ──► gunicorn/uvicorn  :9000  (FastAPI)
              (/*)     ──► serve             :3000  (React SPA)
```

## Prerequisites

| Tool | Min version |
|------|-------------|
| Python | 3.12 |
| Node.js | 18 |
| npm | 9 |
| curl + tar | any |
| systemd | 240+ |

## First-time install

```bash
# 1. Clone / pull the repo
cd /home/shubham/projects/guitar_tracker

# 2. Edit production env (DB creds, JWT secret, OAuth keys, etc.)
cp backend/.env.example backend/.env
$EDITOR backend/.env

# 3. Run the setup script (installs Traefik binary, venv, serve, copies configs, enables + starts services)
sudo ./deploy/setup.sh
```

The script will:
1. Create `backend/.venv` and install all Python deps (including gunicorn)
2. Run `npm ci && npm run build` in `frontend/`
3. Install `serve` globally via npm
4. Download and install the Traefik binary to `/usr/local/bin/traefik`
5. Create the `traefik` system user
6. Write configs to `/etc/traefik/`
7. Copy the three `.service` files to `/etc/systemd/system/`
8. Enable and start all services

## Re-deploy after code changes

```bash
# Re-build frontend + reinstall Python deps + restart services
sudo ./deploy/setup.sh --update
```

## Service management

```bash
# Status
systemctl status guitar-tracker-backend
systemctl status guitar-tracker-frontend
systemctl status traefik

# Live logs
journalctl -u guitar-tracker-backend -f
journalctl -u guitar-tracker-frontend -f
journalctl -u traefik -f

# Restart individual service
sudo systemctl restart guitar-tracker-backend

# Graceful backend reload (zero-downtime worker recycle)
sudo systemctl reload guitar-tracker-backend
```

## Log files

| Service | Location |
|---------|----------|
| Backend access | `/var/log/guitar-tracker/backend-access.log` |
| Backend errors | `/var/log/guitar-tracker/backend-error.log` |
| Traefik access | `/var/log/traefik/access.log` |
| Traefik main   | `/var/log/traefik/traefik.log` |

## Traefik dashboard

Available at `http://<host>:8080/dashboard/` by default (insecure, for local use).  
To disable it, remove or comment out the `api` block in `traefik/traefik.yml`.

## Adding HTTPS (Let's Encrypt)

1. Point a public domain at your server's IP.
2. In `traefik/traefik.yml`, uncomment the `websecure` entryPoint and the `certificatesResolvers` block (fill in your email).
3. In `traefik/dynamic/guitar-tracker.yml`, uncomment the `tls` blocks on both routers and uncomment the HTTP→HTTPS redirect in `traefik.yml`.
4. Re-copy the config and reload:
   ```bash
   sudo cp deploy/traefik/traefik.yml /etc/traefik/traefik.yml
   sudo cp deploy/traefik/dynamic/guitar-tracker.yml /etc/traefik/dynamic/
   sudo systemctl reload traefik
   ```

## File layout

```
deploy/
├── README.md
├── setup.sh                              # install / update script
├── systemd/
│   ├── guitar-tracker-backend.service   # gunicorn + uvicorn workers
│   ├── guitar-tracker-frontend.service  # serve (React SPA static files)
│   └── traefik.service                  # Traefik reverse proxy
└── traefik/
    ├── traefik.yml                       # static config (entrypoints, providers)
    └── dynamic/
        └── guitar-tracker.yml           # routers, services, middlewares
```

## Tuning gunicorn worker count

The default is `--workers 4`. A common rule of thumb is `2 × CPU_cores + 1`.  
Edit the `ExecStart` line in `deploy/systemd/guitar-tracker-backend.service` and run `--update`.

## Google OAuth and multiple workers

Each gunicorn worker has its own process memory. **Do not store OAuth `state` in an in-memory dict** — `/google/login` and `/google/callback` can land on different workers, which produces `{"detail":"Invalid OAuth state"}` intermittently (often mistaken for an account-specific issue).

The backend stores pending OAuth state in a **signed httpOnly cookie** (`oauth_state`, path `/api/v1/auth`, `SameSite=Lax`) so any worker can validate the callback. Requirements:

- `COOKIE_SECURE=true` when the site is served over HTTPS (otherwise the cookie is not set).
- Users must allow cookies for the app domain; blocked cookies break login.
- State expires after 10 minutes on the Google consent screen.

If you scale to **multiple backend hosts** behind a load balancer, cookies still work; only add Redis (or similar) if you need server-side session storage beyond that.
