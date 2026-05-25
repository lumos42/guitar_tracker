#!/usr/bin/env bash
# Guitar Tracker – deployment setup
# Installs and configures: Python venv + gunicorn, Node serve, systemd services.
# Traefik is managed externally (Coolify) – place deploy/traefik/dynamic/guitar-tracker.yml
# into /data/coolify/proxy/dynamic/ manually.
#
# Usage:
#   sudo ./deploy/setup.sh          # full install
#   sudo ./deploy/setup.sh --update # re-deploy app changes (no system installs)
#
# Requirements: python3.12+, node 18+, npm, systemd

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DEPLOY_DIR="$PROJECT_DIR/deploy"
VENV_DIR="$BACKEND_DIR/.venv"
APP_USER="shubham"

LOG_DIR="/var/log/guitar-tracker"

UPDATE_ONLY=false
[[ "${1:-}" == "--update" ]] && UPDATE_ONLY=true

# ── Helpers ───────────────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
die()   { echo -e "\033[1;31m[ERR ]\033[0m  $*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || die "Run this script with sudo."
}

# ── Checks ────────────────────────────────────────────────────────────────────
require_root

command -v python3 >/dev/null || die "python3 not found."
command -v node    >/dev/null || die "node not found."
command -v npm     >/dev/null || die "npm not found."

PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python $PY_VER detected."

# ── 1. Python virtualenv + backend deps ──────────────────────────────────────
info "Setting up Python virtualenv at $VENV_DIR …"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
ok "Backend dependencies installed."

# ── 2. Build the frontend ─────────────────────────────────────────────────────
info "Installing frontend npm dependencies …"
npm --prefix "$FRONTEND_DIR" ci --silent

info "Building frontend …"
npm --prefix "$FRONTEND_DIR" run build

[[ -d "$FRONTEND_DIR/dist" ]] || die "Frontend build failed – dist/ not found."
ok "Frontend built at $FRONTEND_DIR/dist."

# ── 3. Install serve (global, for the static file service) ───────────────────
if ! command -v serve >/dev/null 2>&1; then
  info "Installing 'serve' globally …"
  npm install --global serve --silent
fi
SERVE_BIN=$(command -v serve)
ok "'serve' found at $SERVE_BIN."

# Update the frontend service file with the actual serve binary path
sed -i "s|/usr/local/bin/serve|$SERVE_BIN|g" \
    "$DEPLOY_DIR/systemd/guitar-tracker-frontend.service"

# ── 4. Log directory ──────────────────────────────────────────────────────────
info "Creating log directory …"
mkdir -p "$LOG_DIR"
chown "$APP_USER:$APP_USER" "$LOG_DIR"

# ── 5. Install + enable systemd services ─────────────────────────────────────
info "Installing systemd service units …"
SYSTEMD_DIR="/etc/systemd/system"
cp "$DEPLOY_DIR/systemd/guitar-tracker-backend.service"  "$SYSTEMD_DIR/"
cp "$DEPLOY_DIR/systemd/guitar-tracker-frontend.service" "$SYSTEMD_DIR/"

systemctl daemon-reload

for svc in guitar-tracker-backend guitar-tracker-frontend; do
  systemctl enable "$svc"
done
ok "Services enabled."

# ── 6. Set up production .env if missing ─────────────────────────────────────
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  warn "No .env found – copying from .env.example. Edit $BACKEND_DIR/.env before starting."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  sed -i 's/^APP_ENV=.*/APP_ENV=production/' "$BACKEND_DIR/.env"
fi

# ── 7. Start / restart services ──────────────────────────────────────────────
info "Starting services …"
for svc in guitar-tracker-backend guitar-tracker-frontend; do
  systemctl restart "$svc"
  sleep 1
  if systemctl is-active --quiet "$svc"; then
    ok "$svc is running."
  else
    warn "$svc failed to start. Check: journalctl -u $svc -n 50"
  fi
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Guitar Tracker – deployment complete               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Backend   →  http://127.0.0.1:9000  (internal)             ║"
echo "║  Frontend  →  http://127.0.0.1:3000  (internal)             ║"
echo "║  Public    →  https://guitar.lanomilano.com  (via Traefik)  ║"
echo "║  Logs      →  $LOG_DIR/                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Traefik dynamic config:                                     ║"
echo "║  cp deploy/traefik/dynamic/guitar-tracker.yml \\             ║"
echo "║     /data/coolify/proxy/dynamic/                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  View logs:                                                  ║"
echo "║    ./deploy/logs.sh backend          # error log            ║"
echo "║    ./deploy/logs.sh backend access   # access log           ║"
echo "║    ./deploy/logs.sh frontend         # journal              ║"
echo "║    ./deploy/logs.sh all -f           # live stream, both    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  To redeploy:  sudo ./deploy/setup.sh --update              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
warn "Edit $BACKEND_DIR/.env with your production secrets before going live."
