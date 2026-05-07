#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Receptionist — Stop all services
# ─────────────────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }

echo ""
echo -e "${BOLD}AI Receptionist — Stopping services${RESET}"
echo "────────────────────────────────────────"
echo ""

stop_port() {
  local port=$1
  local name=$2
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -TERM 2>/dev/null
    sleep 1
    # Force-kill anything still alive
    pids=$(lsof -ti :"$port" 2>/dev/null)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
    ok "$name stopped (port $port)"
  else
    warn "$name wasn't running (port $port)"
  fi
}

stop_port 3000 "Backend"

for port in 5173 5174 5175; do
  pids=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -TERM 2>/dev/null
    sleep 1
    pids=$(lsof -ti :"$port" 2>/dev/null)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
    ok "Admin UI stopped (port $port)"
    break
  fi
done

echo ""
echo -e "${GREEN}${BOLD}All done. Have a good evening!${RESET}"
echo ""
