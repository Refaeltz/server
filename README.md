# Production Server Setup

A Docker-based deployment for a React + NestJS + MongoDB web application, served behind NGINX. Designed to run on a single Ubuntu 22.04 server with an easy migration path to Kubernetes.

---

## Project Structure

```
project-root/
├── backend/
│   └── Dockerfile               # Multi-stage Node.js build
├── frontend/
│   ├── Dockerfile               # Multi-stage React build → NGINX
│   └── nginx-spa.conf           # SPA routing inside the frontend container
├── nginx/
│   └── nginx.conf               # Reverse proxy: routes / and /api, security headers
├── docker-compose.yml           # Full stack orchestration
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD: build → push → deploy
├── scripts/
│   └── server-setup.sh          # One-time Ubuntu bootstrap script
├── k8s/
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   └── secrets.example.yaml
└── README.md
```

---

## Quick Start

### 1. Provision the Server

Run the bootstrap script once on a fresh Ubuntu 22.04 machine:

```bash
curl -fsSL https://raw.githubusercontent.com/Refaeltz/server/main/scripts/server-setup.sh \
  | sudo bash
```

What it does:
- Updates packages
- Installs Docker Engine + Compose plugin
- Creates a `deploy` user with Docker access
- Configures UFW (allows SSH, 80, 443)
- Hardens SSH (disables root login and password auth)
- Enables fail2ban
- Creates `~/app/.env` template

### 2. Configure Secrets on the Server

```bash
nano ~/app/.env
```

Fill in:
| Variable | Description |
|---|---|
| `MONGO_ROOT_PASSWORD` | Strong password for MongoDB root user |
| `MONGODB_URI` | Connection string for the backend |
| `JWT_SECRET` | Random 32-byte hex string (`openssl rand -hex 32`) |
| `FRONTEND_IMAGE` | Updated automatically by CI/CD |
| `BACKEND_IMAGE` | Updated automatically by CI/CD |

### 3. Add GitHub Actions Secrets

In your repository → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `SERVER_HOST` | Your server IP or domain |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | Private SSH key for the deploy user |
| `SERVER_PORT` | `22` (or your custom port) |

The `GITHUB_TOKEN` secret is provided automatically by GitHub Actions.

### 4. Add the Deploy SSH Key to the Server

On your local machine, generate a dedicated key pair:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key
```

Copy the public key to the server:

```bash
ssh-copy-id -i ~/.ssh/deploy_key.pub deploy@YOUR_SERVER_IP
```

Add the **private key** (`~/.ssh/deploy_key`) as the `SERVER_SSH_KEY` GitHub secret.

### 5. Push to Deploy

Any push to `main` triggers the pipeline:

1. Builds Docker images (with layer caching)
2. Pushes to `ghcr.io/Refaeltz/server`
3. SSHs into the server and runs `docker compose pull && docker compose up -d`

---

## HTTPS with Let's Encrypt

### Step 1 — Point your domain to the server

Create an `A` record: `your-domain.com → YOUR_SERVER_IP`

### Step 2 — Obtain a certificate

```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com
```

### Step 3 — Enable HTTPS in nginx.conf

In `nginx/nginx.conf`:

1. Replace `server_name _;` with `server_name your-domain.com;`
2. Uncomment the `return 301 https://...` line in the HTTP block
3. Uncomment the entire HTTPS `server { ... }` block
4. Replace `your-domain.com` with your actual domain

### Step 4 — Restart NGINX

```bash
docker compose restart nginx
```

### Step 5 — Auto-renewal

The `certbot` service in `docker-compose.yml` runs a renewal loop. To enable it permanently:

```bash
docker compose up -d certbot
```

---

## Local Development

```bash
# Copy the env template
cp ~/app/.env .env   # or create your own

# Run with locally built images
FRONTEND_IMAGE=frontend BACKEND_IMAGE=backend docker compose up --build
```

---

## Resource Allocation (8 GB server)

| Container | CPU limit | Memory limit |
|---|---|---|
| nginx | 0.25 cores | 128 MB |
| frontend | 0.25 cores | 128 MB |
| backend | 1.0 core | 512 MB |
| mongo | 1.0 core | 1 GB |
| **Total reserved** | **~2.5 cores** | **~1.75 GB** |

The remaining ~6 GB is available for the OS, Docker overhead, and headroom for traffic spikes.

---

## Migrating to Kubernetes (GKE)

The `k8s/` directory contains production-ready manifests.

### Prerequisites

```bash
# Install tools
brew install kubectl google-cloud-sdk helm

# Authenticate with GCP
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT

# Create a GKE cluster (Autopilot recommended for simplicity)
gcloud container clusters create-auto app-cluster --region us-central1

# Get credentials
gcloud container clusters get-credentials app-cluster --region us-central1
```

### Deploy

```bash
# 1. Create image pull secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=Refaeltz \
  --docker-password=YOUR_GITHUB_PAT

# 2. Create application secrets
kubectl create secret generic app-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...' \
  --from-literal=JWT_SECRET='your-jwt-secret'

# 3. Install NGINX ingress controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 4. Install cert-manager for automatic TLS
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 5. Apply manifests
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/ingress.yaml
```

Update `k8s/ingress.yaml` with your real domain before applying.

---

## Firewall Summary (UFW)

| Port | Protocol | Allowed from | Purpose |
|---|---|---|---|
| 22 | TCP | Anywhere | SSH |
| 80 | TCP | Anywhere | HTTP |
| 443 | TCP | Anywhere | HTTPS |
| All others | — | Denied | — |

MongoDB (27017) is **not** exposed to the host; it only listens on the internal Docker network.

---

## Useful Commands

```bash
# View live logs for all services
docker compose logs -f

# View logs for a single service
docker compose logs -f backend

# Restart a single service without downtime
docker compose up -d --no-deps backend

# Open a shell inside the backend container
docker compose exec backend sh

# Check container resource usage
docker stats
```
