#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# server-setup.sh
#
# One-time bootstrap script for a fresh Ubuntu 22.04 server.
# Run as root (or with sudo).
#
# What it does:
#   1. System update
#   2. Install Docker + Docker Compose plugin
#   3. Create a deploy user with Docker access
#   4. Configure UFW firewall
#   5. Create the application directory and .env template
#   6. Print next steps
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configurable variables ────────────────────────────────────────────────────
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="/home/${DEPLOY_USER}/app"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# ── 0. Sanity check ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Please run this script as root or with sudo." >&2
  exit 1
fi

# ── 1. System update ──────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q \
  curl \
  ca-certificates \
  gnupg \
  ufw \
  fail2ban

# ── 2. Install Docker ─────────────────────────────────────────────────────────
info "Installing Docker Engine..."

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -q
apt-get install -y -q \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Enable Docker to start on boot
systemctl enable --now docker
info "Docker $(docker --version) installed."

# ── 3. Create deploy user ─────────────────────────────────────────────────────
if id "${DEPLOY_USER}" &>/dev/null; then
  warn "User '${DEPLOY_USER}' already exists – skipping creation."
else
  info "Creating deploy user '${DEPLOY_USER}'..."
  useradd -m -s /bin/bash "${DEPLOY_USER}"
  # Let the deploy user run Docker without sudo
  usermod -aG docker "${DEPLOY_USER}"
  info "User '${DEPLOY_USER}' created and added to docker group."
fi

# ── 4. Configure UFW firewall ─────────────────────────────────────────────────
info "Configuring UFW firewall..."

# Reset to a known-good default (safe – does not block current SSH session yet)
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (keep this first to avoid locking yourself out)
ufw allow ssh        # port 22

# Allow HTTP and HTTPS for the web application
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS

# Enable the firewall
ufw --force enable
ufw status verbose

# ── 5. Harden SSH ─────────────────────────────────────────────────────────────
info "Hardening SSH configuration..."
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/'               /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/'    /etc/ssh/sshd_config
systemctl restart sshd
warn "SSH root login and password auth have been disabled."
warn "Make sure you have added your SSH public key to ~/.ssh/authorized_keys before logging out!"

# ── 6. Configure fail2ban ─────────────────────────────────────────────────────
info "Enabling fail2ban..."
systemctl enable --now fail2ban

# ── 7. Create application directory and .env template ─────────────────────────
info "Creating application directory at ${APP_DIR}..."
mkdir -p "${APP_DIR}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<'EOF'
# ── Application secrets ───────────────────────────────────────────────
# Fill in real values before running docker compose up.
# This file must NEVER be committed to git.

# MongoDB credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Connection string used by the backend
MONGODB_URI=mongodb://admin:CHANGE_ME_STRONG_PASSWORD@mongo:27017/app?authSource=admin

# JWT signing secret (use: openssl rand -hex 32)
JWT_SECRET=CHANGE_ME_JWT_SECRET

# Docker image references (updated automatically by CI/CD)
FRONTEND_IMAGE=ghcr.io/refaeltz/server/frontend:latest
BACKEND_IMAGE=ghcr.io/refaeltz/server/backend:latest
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  info ".env template created at ${ENV_FILE}"
else
  warn ".env already exists – skipping template creation."
fi

# ── 8. Add deploy user's SSH authorized_keys directory ───────────────────────
SSH_DIR="/home/${DEPLOY_USER}/.ssh"
mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"
touch "${SSH_DIR}/authorized_keys"
chmod 600 "${SSH_DIR}/authorized_keys"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${SSH_DIR}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "═══════════════════════════════════════════════════════════════════"
info " Server setup complete. Next steps:"
info "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Add your CI/CD SSH public key:"
echo "     echo '<your-public-key>' >> /home/${DEPLOY_USER}/.ssh/authorized_keys"
echo ""
echo "  2. Edit the .env file with real secrets:"
echo "     nano ${APP_DIR}/.env"
echo ""
echo "  3. Add GitHub Actions secrets in your repository settings:"
echo "     SERVER_HOST   – your server IP or domain"
echo "     SERVER_USER   – ${DEPLOY_USER}"
echo "     SERVER_SSH_KEY – private key matching the public key added above"
echo "     SERVER_PORT   – 22 (or your custom port)"
echo ""
echo "  4. (Optional) Set up HTTPS with Let's Encrypt:"
echo "     See the README for Certbot instructions."
echo ""
