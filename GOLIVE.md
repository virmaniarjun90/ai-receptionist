# Go-Live Readiness — Hostinger VPS

> Target: Hostinger KVM VPS (Ubuntu 22.04). This covers everything from a blank server to a live, production-grade deployment.

---

## What you need before you start

| Item | Where to get it |
|---|---|
| Hostinger KVM VPS (min 2 GB RAM) | hostinger.com → VPS Hosting |
| Domain name | Any registrar; point DNS to VPS IP |
| Twilio account | twilio.com |
| WhatsApp Business API approval from Twilio | Takes 1–3 weeks — apply early |
| One Twilio phone number per property | ~$1/month each |
| Anthropic API key (Claude) | console.anthropic.com |
| A strong random string for `ADMIN_API_KEY` | `openssl rand -hex 32` |

---

## Step 1 — Server setup

SSH into your VPS as root, then run:

```bash
# System
apt update && apt upgrade -y
apt install -y curl git ufw nginx certbot python3-certbot-nginx

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL 15
apt install -y postgresql postgresql-contrib

# Redis
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# PM2 (process manager — keeps app alive after reboots)
npm install -g pm2
```

---

## Step 2 — PostgreSQL database

```bash
# Switch to postgres user and create the app database and user
sudo -u postgres psql <<EOF
CREATE DATABASE ai_receptionist;
CREATE USER ai_user WITH ENCRYPTED PASSWORD 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE ai_receptionist TO ai_user;
EOF
```

Your `DATABASE_URL` will be:
```
postgresql://ai_user:choose-a-strong-password@localhost:5432/ai_receptionist
```

---

## Step 3 — Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'   # HTTP + HTTPS
ufw enable
```

> Redis and PostgreSQL are localhost-only — do NOT open their ports to the internet.

---

## Step 4 — Deploy the app

```bash
# As root or a deploy user
cd /var/www
git clone <your-repo-url> ai-receptionist
cd ai-receptionist

# Install dependencies
npm install --workspaces

# Backend .env
cp backend/.env.example backend/.env
nano backend/.env    # fill in all values — see Environment Variables section below

# Admin .env
cp admin/.env.example admin/.env
nano admin/.env      # set VITE_API_URL and VITE_ADMIN_KEY

# Database migrations
cd backend
npx prisma migrate deploy
npx prisma generate
npx ts-node -r tsconfig-paths/register prisma/seed.ts
cd ..

# Build admin (static files)
cd admin && npm run build && cd ..
```

---

## Step 5 — Nginx configuration

```bash
nano /etc/nginx/sites-available/ai-receptionist
```

Paste this (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Admin UI — served as static files
    location / {
        root /var/www/ai-receptionist/admin/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxied to Node
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /webhook/ {
        proxy_pass http://localhost:3000/webhook/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://localhost:3000/admin/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /guest/ {
        proxy_pass http://localhost:3000/guest/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/ai-receptionist /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Step 6 — SSL certificate

```bash
certbot --nginx -d yourdomain.com
# Follow the prompts — certbot patches Nginx automatically
# Auto-renew is set up for you
```

---

## Step 7 — Start with PM2

```bash
cd /var/www/ai-receptionist/backend

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ai-receptionist-api',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
EOF

# Build and start
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # run the command it prints to survive reboots
```

---

## Step 8 — Twilio webhook

In the Twilio console → Phone Numbers → your number → Messaging:

```
Webhook URL:   https://yourdomain.com/webhook/whatsapp
Method:        POST
```

> SSL is required — Twilio will reject plain HTTP webhook URLs.

---

## Environment Variables

Set these in `backend/.env` before starting:

```env
# App
NODE_ENV=production
PORT=3000
APP_MODE=pilot          # demo | pilot | production
APP_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://ai_user:your-password@localhost:5432/ai_receptionist

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM — Claude recommended for production
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1XXXXXXXXXX
TWILIO_VALIDATE_WEBHOOK=true

# Channel manager
CHANNEL_MANAGER_PROVIDER=mock    # switch to cm1 once channel manager creds are ready

# Admin
ADMIN_API_KEY=<output of: openssl rand -hex 32>

# Privacy
PII_MASKING_ENABLED=true
```

Set these in `admin/.env` before building:

```env
VITE_API_URL=https://yourdomain.com
VITE_ADMIN_KEY=<same value as ADMIN_API_KEY above>
```

---

## Redeployment (after code changes)

```bash
cd /var/www/ai-receptionist
git pull

# Backend
cd backend
npm install
npx prisma migrate deploy
npm run build
pm2 restart ai-receptionist-api

# Admin (if UI changed)
cd ../admin
npm install
npm run build
# Nginx serves the new dist/ automatically — no restart needed
```

---

## Go-Live Checklist

### Server
- [ ] VPS provisioned, SSH key-based auth only (disable password login)
- [ ] Firewall: only ports 22, 80, 443 open
- [ ] SSL certificate installed and auto-renew verified (`certbot renew --dry-run`)
- [ ] PM2 running and set to start on reboot

### Application
- [ ] `NODE_ENV=production` set
- [ ] `TWILIO_VALIDATE_WEBHOOK=true` set
- [ ] `ADMIN_API_KEY` is a strong random secret (not empty)
- [ ] `APP_URL` matches your actual domain
- [ ] `LLM_PROVIDER=claude` with a valid `ANTHROPIC_API_KEY`
- [ ] `PII_MASKING_ENABLED=true`
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] Seed data in place (at least one property with a phone number)

### Twilio
- [ ] Sandbox tested — host and a test guest number have opted in
- [ ] WhatsApp Business API approval submitted (do this now if not done)
- [ ] Production number purchased and webhook URL set
- [ ] Test inbound message end-to-end: guest texts → AI replies
- [ ] Test host relay: guest asks unknown question → host gets ping → JOIN → relay works → DONE

### Admin UI
- [ ] Login works at `https://yourdomain.com`
- [ ] At least one property created with `phoneNumber` and `hostPhone` set
- [ ] Knowledge base entries added (WiFi, check-in instructions, house rules)
- [ ] One test reservation created with a real guest phone number

### Monitoring
- [ ] `GET https://yourdomain.com/health` returns `{ status: "ok" }`
- [ ] PM2 logs checked: `pm2 logs ai-receptionist-api`
- [ ] Set up a free uptime monitor (UptimeRobot or Better Uptime) on `/health`

---

## Twilio WhatsApp Business API — Timeline

This takes time. Start immediately.

| Step | Time |
|---|---|
| Create Facebook Business Manager account | Day 1 |
| Create WhatsApp Business Account (WABA) | Day 1–2 |
| Submit for Twilio WhatsApp approval | Day 2 |
| Approval granted | 1–3 weeks |
| Buy production number + configure webhook | After approval |

**In the meantime**: use the Twilio WhatsApp Sandbox for testing. The sandbox number works immediately — guests just need to send a join code once.

---

## Cost estimate (per month, one property)

| Item | Cost |
|---|---|
| Hostinger KVM VPS 2GB | ~$7 |
| Twilio phone number | ~$1 |
| Twilio WhatsApp messages | ~$0.005/message |
| Claude API (light usage) | ~$1–5 depending on volume |
| Domain | ~$1 amortised |
| **Total** | **~$10–15/month** |
