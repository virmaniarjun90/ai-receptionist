#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Receptionist — Local startup script
# Checks prerequisites, configures, seeds, and starts all services.
# ─────────────────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
ADMIN="$ROOT/admin"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  $1"; ERRORS=$((ERRORS+1)); }
info() { echo -e "  ${BLUE}→${RESET}  $1"; }

ERRORS=0

echo ""
echo -e "${BOLD}AI Receptionist — Setup & Start${RESET}"
echo "────────────────────────────────────────"

# ── 1. System prerequisites ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}1. Checking system prerequisites${RESET}"

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  ok "Node.js $NODE_VER"
else
  fail "Node.js not found — install from https://nodejs.org (v18+)"
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found"
fi

# PostgreSQL
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL is running"
elif command -v pg_isready &>/dev/null; then
  fail "PostgreSQL is not running — start it: sudo service postgresql start"
else
  warn "PostgreSQL client not found — skipping check (ensure DB is accessible)"
fi

# Redis
if redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "Redis is running"
else
  fail "Redis is not running — start it: redis-server --daemonize yes"
fi

# ── 2. Check .env files ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}2. Checking configuration${RESET}"

# Backend .env
if [ ! -f "$BACKEND/.env" ]; then
  warn "backend/.env not found — creating from example"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  warn "Edit backend/.env with your credentials before first use"
else
  ok "backend/.env exists"
fi

# Check required backend vars
source "$BACKEND/.env" 2>/dev/null || true

check_var() {
  local var="$1"; local desc="$2"; local val="${!var}"
  if [ -z "$val" ]; then
    warn "$var not set — $desc"
  else
    ok "$var is set"
  fi
}

check_var "DATABASE_URL"            "required — set PostgreSQL connection string"
check_var "TWILIO_ACCOUNT_SID"      "required for WhatsApp — get from console.twilio.com"
check_var "TWILIO_AUTH_TOKEN"       "required for WhatsApp"
check_var "TWILIO_WHATSAPP_NUMBER"  "required — format: whatsapp:+14155238886"
check_var "HOST_WHATSAPP_NUMBER"    "host's personal WhatsApp (receives handoff alerts) — format: whatsapp:+91XXXXXXXXXX"

# LLM provider
LLM="${LLM_PROVIDER:-mock}"
if [ "$LLM" = "mock" ]; then
  ok "LLM_PROVIDER=mock (demo mode — no API key needed)"
elif [ "$LLM" = "claude" ]; then
  check_var "ANTHROPIC_API_KEY" "required when LLM_PROVIDER=claude"
elif [ "$LLM" = "openai" ]; then
  check_var "OPENAI_API_KEY" "required when LLM_PROVIDER=openai"
fi

# APP_URL (affects welcome kit links in WhatsApp messages)
APP_URL="${APP_URL:-http://localhost:3000}"
if [ "$APP_URL" = "http://localhost:3000" ]; then
  warn "APP_URL=http://localhost:3000 — welcome kit links will only work locally"
  info "For real guests, set APP_URL to your public server URL (e.g. ngrok)"
else
  ok "APP_URL=$APP_URL"
fi

# Twilio daily limit warning
echo ""
echo -e "  ${YELLOW}⚠${RESET}  ${YELLOW}Twilio Sandbox has a 50 messages/day limit.${RESET}"
echo -e "     If messages stop sending, the limit is likely hit. It resets at midnight UTC."
echo -e "     To remove the limit: upgrade to a paid Twilio number in console.twilio.com"

# Admin .env
if [ ! -f "$ADMIN/.env" ]; then
  warn "admin/.env not found — creating from example"
  if [ -f "$ADMIN/.env.example" ]; then
    cp "$ADMIN/.env.example" "$ADMIN/.env"
  else
    echo "VITE_API_URL=http://localhost:3000" > "$ADMIN/.env"
    echo "VITE_ADMIN_KEY=" >> "$ADMIN/.env"
  fi
fi
ok "admin/.env exists"

# ── 3. Install dependencies ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}3. Installing dependencies${RESET}"

if [ ! -d "$BACKEND/node_modules" ]; then
  info "Installing backend dependencies..."
  (cd "$BACKEND" && npm install --silent)
  ok "Backend dependencies installed"
else
  ok "Backend node_modules present"
fi

if [ ! -d "$ADMIN/node_modules" ]; then
  info "Installing admin UI dependencies..."
  (cd "$ADMIN" && npm install --silent)
  ok "Admin UI dependencies installed"
else
  ok "Admin UI node_modules present"
fi

# ── 4. Database setup ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}4. Database setup${RESET}"

cd "$BACKEND"

info "Running Prisma migrations..."
if npx prisma migrate deploy 2>&1 | grep -q "error\|Error"; then
  fail "Migration failed — check DATABASE_URL in backend/.env"
else
  ok "Migrations applied"
fi

info "Generating Prisma client..."
npx prisma generate --silent 2>/dev/null
ok "Prisma client generated"

info "Seeding demo data (Arjun + Kunal, Sunset Villa)..."
if npx ts-node -r tsconfig-paths/register prisma/seed.ts 2>&1 | grep -q "Seeded:"; then
  ok "Seed complete"
else
  warn "Seed may have failed — check backend logs"
fi

# ── 5. Pre-flight check ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}5. Pre-flight check${RESET}"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}$ERRORS issue(s) found above — fix them before proceeding.${RESET}"
  echo ""
  echo -e "Common fixes:"
  echo -e "  PostgreSQL:   sudo service postgresql start"
  echo -e "  Redis:        redis-server --daemonize yes"
  echo -e "  .env keys:    nano backend/.env"
  echo ""
  read -p "Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

# ── 6. Start services ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}6. Starting services${RESET}"

# ── Backend ───────────────────────────────────────────────────────────────────
if curl -s http://localhost:3000/health 2>/dev/null | grep -q '"status":"ok"'; then
  ok "Backend already running at http://localhost:3000 — skipping start"
  BACKEND_PID=$(lsof -ti :3000 | head -1)
else
  # Only kill the port if nothing healthy is there
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 1

  info "Starting backend..."
  cd "$BACKEND"
  npm run start:dev > /tmp/ai-receptionist-backend.log 2>&1 &
  BACKEND_PID=$!

  echo -n "     Waiting for backend"
  for i in {1..20}; do
    sleep 1
    echo -n "."
    if curl -s http://localhost:3000/health 2>/dev/null | grep -q '"status":"ok"'; then
      echo ""
      ok "Backend ready at http://localhost:3000"
      break
    fi
    if [ $i -eq 20 ]; then
      echo ""
      fail "Backend didn't start — check /tmp/ai-receptionist-backend.log"
    fi
  done
fi

# ── Admin UI ──────────────────────────────────────────────────────────────────
ADMIN_PID=""
ADMIN_PORT=""

for port in 5173 5174 5175; do
  if curl -s http://localhost:$port 2>/dev/null | grep -q "html\|vite\|AI Receptionist" || \
     lsof -ti :$port &>/dev/null; then
    ok "Admin UI already running at http://localhost:$port — skipping start"
    ADMIN_PORT=$port
    ADMIN_PID=$(lsof -ti :$port | head -1)
    break
  fi
done

if [ -z "$ADMIN_PORT" ]; then
  info "Starting admin UI..."
  cd "$ADMIN"
  npm run dev > /tmp/ai-receptionist-admin.log 2>&1 &
  ADMIN_PID=$!
  sleep 4
  ADMIN_PORT=$(grep -oP '(?<=localhost:)\d+' /tmp/ai-receptionist-admin.log | head -1)
fi
ADMIN_PORT="${ADMIN_PORT:-5173}"
ok "Admin UI ready at http://localhost:$ADMIN_PORT"

# ── 7. Summary ────────────────────────────────────────────────────────────────
PROPERTY_ID=$(node -e "
const { DEFAULT_PROPERTY_ID } = require('./src/modules/property/property.constants');
console.log(DEFAULT_PROPERTY_ID);
" 2>/dev/null || echo "00000000-0000-0000-0000-000000000101")

echo ""
echo "────────────────────────────────────────"
echo -e "${GREEN}${BOLD}All services running!${RESET}"
echo "────────────────────────────────────────"
echo ""
echo -e "  ${BOLD}Admin dashboard${RESET}      http://localhost:$ADMIN_PORT"
echo -e "  ${BOLD}Backend API${RESET}          http://localhost:3000"
echo -e "  ${BOLD}API docs (Swagger)${RESET}   http://localhost:3000/api"
echo -e "  ${BOLD}Health check${RESET}         http://localhost:3000/health"
echo ""
echo -e "  ${BOLD}Guest registration form${RESET}"
echo -e "  http://localhost:$ADMIN_PORT/register?p=$PROPERTY_ID"
echo ""
echo -e "  ${BOLD}Backend log${RESET}   tail -f /tmp/ai-receptionist-backend.log"
echo -e "  ${BOLD}Admin log${RESET}     tail -f /tmp/ai-receptionist-admin.log"
echo ""
echo -e "  Send a test WhatsApp message to start a conversation:"
echo -e "  ${BLUE}curl -s -X POST http://localhost:3000/webhook/whatsapp \\${RESET}"
echo -e "  ${BLUE}  -H 'Content-Type: application/x-www-form-urlencoded' \\${RESET}"
echo -e "  ${BLUE}  --data-urlencode 'From=whatsapp:+918802078873' \\${RESET}"
echo -e "  ${BLUE}  --data-urlencode 'To=$TWILIO_WHATSAPP_NUMBER' \\${RESET}"
echo -e "  ${BLUE}  --data-urlencode 'Body=Hi'${RESET}"
echo ""
echo -e "  Stop everything:  kill $BACKEND_PID $ADMIN_PID"
echo ""

# Keep script alive so Ctrl+C stops both services
trap "echo ''; info 'Stopping...'; kill $BACKEND_PID $ADMIN_PID 2>/dev/null; exit 0" INT
wait
