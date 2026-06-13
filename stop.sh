#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Receptionist — Stop all services cleanly
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
info() { echo -e "  ${BLUE}→${RESET}  $1"; }

echo ""
echo -e "${BOLD}AI Receptionist — Stopping services${RESET}"
echo "────────────────────────────────────────────────────────────────"
echo ""

STOPPED_COUNT=0

# Stop backend (port 3000)
pids=$(lsof -ti :3000 2>/dev/null)
if [ -n "$pids" ]; then
  echo "$pids" | xargs kill -TERM 2>/dev/null
  sleep 1
  # Force-kill if still running
  pids=$(lsof -ti :3000 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
  fi
  ok "Backend stopped (port 3000)"
  STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
  warn "Backend wasn't running (port 3000)"
fi

# Stop admin UI (ports 5173-5175 — try multiple in case of conflicts)
for port in 5173 5174 5175 5176; do
  pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -TERM 2>/dev/null
    sleep 1
    # Force-kill if still running
    pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null
    fi
    ok "Admin UI stopped (port $port)"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
    break
  fi
done

if [ $STOPPED_COUNT -eq 0 ]; then
  warn "No services were running"
fi

# Optional: Clean up log files
read -p "Clean up log files? [y/N] " clean_logs
if [[ "$clean_logs" =~ ^[Yy]$ ]]; then
  rm -f /tmp/ai-receptionist-backend.log /tmp/ai-receptionist-admin.log
  ok "Log files cleaned"
fi

# Optional: Kill all npm processes (if stuck)
read -p "Force-kill all npm processes? [y/N] " kill_npm
if [[ "$kill_npm" =~ ^[Yy]$ ]]; then
  pkill -f "npm run" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  sleep 1
  ok "All npm processes terminated"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ All done. Have a good day!${RESET}"
echo ""
echo -e "  To restart: ${BOLD}./start.sh${RESET}"
echo ""
