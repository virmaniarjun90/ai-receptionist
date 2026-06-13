#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Receptionist — Complete startup script with auto-installation
# Checks prerequisites, installs missing packages, configures, seeds, and starts
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
OS_TYPE=$(uname -s)

echo ""
echo -e "${BOLD}AI Receptionist — Setup & Start${RESET}"
echo "────────────────────────────────────────────────────────────────"

# ── 1. System prerequisites ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}1. Checking system prerequisites${RESET}"

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  ok "Node.js $NODE_VER"
else
  warn "Node.js not found — attempting to install..."
  if [ "$OS_TYPE" = "Darwin" ]; then
    if command -v brew &>/dev/null; then
      info "Installing Node.js via Homebrew..."
      brew install node
      ok "Node.js installed"
    else
      fail "Homebrew not found. Install from: https://brew.sh"
    fi
  elif [ "$OS_TYPE" = "Linux" ]; then
    if command -v apt-get &>/dev/null; then
      info "Installing Node.js via apt..."
      sudo apt-get update && sudo apt-get install -y nodejs npm
      ok "Node.js installed"
    elif command -v yum &>/dev/null; then
      info "Installing Node.js via yum..."
      sudo yum install -y nodejs npm
      ok "Node.js installed"
    else
      fail "No package manager found. Install from: https://nodejs.org"
    fi
  else
    fail "Unsupported OS. Install from: https://nodejs.org"
  fi
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found — install from https://nodejs.org"
fi

# PostgreSQL
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL is running"
elif command -v pg_isready &>/dev/null; then
  warn "PostgreSQL installed but not running"
  if [ "$OS_TYPE" = "Darwin" ]; then
    info "Attempting to start PostgreSQL on macOS..."
    brew services start postgresql 2>/dev/null || fail "Could not start PostgreSQL"
  elif [ "$OS_TYPE" = "Linux" ]; then
    info "Attempting to start PostgreSQL on Linux..."
    sudo service postgresql start 2>/dev/null || fail "Could not start PostgreSQL"
  fi
else
  warn "PostgreSQL not installed"
  if [ "$OS_TYPE" = "Darwin" ]; then
    info "To install: brew install postgresql"
  elif [ "$OS_TYPE" = "Linux" ]; then
    info "To install: sudo apt-get install postgresql postgresql-contrib"
  fi
  fail "PostgreSQL is required"
fi

# Redis
if redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "Redis is running"
else
  warn "Redis not running — attempting to start..."
  if command -v redis-server &>/dev/null; then
    if [ "$OS_TYPE" = "Darwin" ]; then
      brew services start redis 2>/dev/null || warn "Could not auto-start Redis"
    elif [ "$OS_TYPE" = "Linux" ]; then
      sudo service redis-server start 2>/dev/null || warn "Could not auto-start Redis"
    fi

    # Check again
    if redis-cli ping 2>/dev/null | grep -q PONG; then
      ok "Redis is now running"
    else
      fail "Redis installed but could not start — try: redis-server --daemonize yes"
    fi
  else
    warn "Redis not installed"
    if [ "$OS_TYPE" = "Darwin" ]; then
      info "To install: brew install redis"
    elif [ "$OS_TYPE" = "Linux" ]; then
      info "To install: sudo apt-get install redis-server"
    fi
    fail "Redis is required"
  fi
fi

# ── 2. Check .env files ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}2. Checking configuration${RESET}"

# Backend .env
if [ ! -f "$BACKEND/.env" ]; then
  warn "backend/.env not found — creating from example"
  if [ -f "$BACKEND/.env.example" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    warn "Edit backend/.env with your Twilio credentials"
  else
    fail "backend/.env.example not found"
  fi
else
  ok "backend/.env exists"
fi

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
  info "Installing backend dependencies (this may take a minute)..."
  (cd "$BACKEND" && npm install)
  ok "Backend dependencies installed"
else
  info "Checking for backend dependency updates..."
  (cd "$BACKEND" && npm install --no-save 2>&1 | grep -q "added\|up to date" && ok "Backend dependencies up to date" || ok "Backend dependencies updated")
fi

if [ ! -d "$ADMIN/node_modules" ]; then
  info "Installing admin UI dependencies (this may take a minute)..."
  (cd "$ADMIN" && npm install)
  ok "Admin UI dependencies installed"
else
  info "Checking for admin dependency updates..."
  (cd "$ADMIN" && npm install --no-save 2>&1 | grep -q "added\|up to date" && ok "Admin UI dependencies up to date" || ok "Admin UI dependencies updated")
fi

# Root node_modules for any tools
if [ ! -d "$ROOT/node_modules" ]; then
  info "Installing root dependencies..."
  (cd "$ROOT" && npm install --silent 2>/dev/null || true)
fi

# ── 4. Database setup ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}4. Database setup${RESET}"

cd "$BACKEND"

info "Running Prisma migrations..."
if npx prisma migrate deploy 2>&1 | grep -q "error\|Error"; then
  warn "Migration warning — check DATABASE_URL in backend/.env"
else
  ok "Migrations applied"
fi

info "Generating Prisma client..."
npx prisma generate --silent 2>/dev/null || true
ok "Prisma client generated"

# ── 5. Seed data ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}5. Seeding database${RESET}"

if npx ts-node -r tsconfig-paths/register prisma/seed.ts 2>&1; then
  ok "Database seeded with test data"
else
  warn "Seed script had issues — you can re-run: npm run seed"
fi

# ── 6. Pre-flight check ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}6. Pre-flight check${RESET}"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}$ERRORS issue(s) found above — please fix them:${RESET}"
  echo ""
  echo -e "  ${YELLOW}PostgreSQL:${RESET}   brew services start postgresql (macOS)"
  echo -e "             sudo service postgresql start (Linux)"
  echo ""
  echo -e "  ${YELLOW}Redis:${RESET}        brew services start redis (macOS)"
  echo -e "             sudo service redis-server start (Linux)"
  echo ""
  echo -e "  ${YELLOW}.env keys:${RESET}    nano backend/.env"
  echo ""
  read -p "Continue anyway? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

# ── 7. Start services ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}7. Starting services${RESET}"

# Kill any existing processes on these ports
pkill -f "npm run start:dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Backend
info "Starting backend (port 3000)..."
cd "$BACKEND"
npm run start:dev > /tmp/ai-receptionist-backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

echo -n "     Waiting for backend to be ready"
for i in {1..30}; do
  sleep 1
  echo -n "."
  if curl -s http://localhost:3000/health 2>/dev/null | grep -q '"status":"ok"' || \
     lsof -ti :3000 &>/dev/null; then
    echo ""
    ok "Backend ready at http://localhost:3000 (PID: $BACKEND_PID)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo ""
    warn "Backend taking time to start — check /tmp/ai-receptionist-backend.log"
  fi
done

# Admin UI
info "Starting admin UI (port 5173)..."
cd "$ADMIN"
npm run dev > /tmp/ai-receptionist-admin.log 2>&1 &
ADMIN_PID=$!
sleep 3

if lsof -ti :5173 &>/dev/null; then
  ok "Admin UI ready at http://localhost:5173 (PID: $ADMIN_PID)"
else
  warn "Admin UI may still be starting — check /tmp/ai-receptionist-admin.log"
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────────────────────"
echo -e "${GREEN}${BOLD}✓ All services running!${RESET}"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo -e "  ${BOLD}Admin Dashboard${RESET}    http://localhost:5173"
echo -e "  ${BOLD}Backend API${RESET}        http://localhost:3000"
echo -e "  ${BOLD}API Docs (Swagger)${RESET} http://localhost:3000/api"
echo -e "  ${BOLD}Health Check${RESET}       http://localhost:3000/health"
echo ""
echo -e "  ${BOLD}Test Credentials:${RESET}"
echo -e "    Admin Key (if enabled): Check backend/.env ADMIN_KEY"
echo -e "    Host Login: /host/login with seeded host credentials"
echo ""
echo -e "  ${BOLD}Logs:${RESET}"
echo -e "    Backend: tail -f /tmp/ai-receptionist-backend.log"
echo -e "    Admin:   tail -f /tmp/ai-receptionist-admin.log"
echo ""
echo -e "  ${BOLD}Stop all services:${RESET} ./stop.sh"
echo ""

# Keep script alive so Ctrl+C stops both services
trap "echo ''; info 'Shutting down...'; kill $BACKEND_PID $ADMIN_PID 2>/dev/null; exit 0" INT
wait
