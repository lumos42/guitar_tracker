#!/usr/bin/env bash
# Guitar Tracker – production log viewer
#
# Usage:
#   ./deploy/logs.sh backend            # backend error log (last 100 lines)
#   ./deploy/logs.sh backend access     # backend access log
#   ./deploy/logs.sh backend error      # backend error log
#   ./deploy/logs.sh frontend           # frontend journal log
#   ./deploy/logs.sh all                # both services, interleaved via journald
#
# Flags:
#   -f, --tail     Follow (tail -f / journalctl -f)
#   -n <lines>     Number of lines to show (default: 100)
#
# Examples:
#   ./deploy/logs.sh backend -f
#   ./deploy/logs.sh backend access -f -n 200
#   ./deploy/logs.sh frontend --tail

set -euo pipefail

LOG_DIR="/var/log/guitar-tracker"
BACKEND_SVC="guitar-tracker-backend"
FRONTEND_SVC="guitar-tracker-frontend"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

usage() {
  cat <<EOF
${BOLD}Guitar Tracker – log viewer${RESET}

Usage:
  $(basename "$0") <service> [log-type] [flags]

Services:
  ${CYAN}backend${RESET}   [access|error]   File logs in $LOG_DIR/
                           Default log type: error
  ${CYAN}frontend${RESET}                   systemd journal (serve)
  ${CYAN}all${RESET}                        Both services interleaved (journald)

Flags:
  ${GREEN}-f, --tail${RESET}        Follow log output (live stream)
  ${GREEN}-n <lines>${RESET}        Lines to show (default: 100)
  ${GREEN}-h, --help${RESET}        Show this help

Examples:
  $(basename "$0") backend
  $(basename "$0") backend access -f
  $(basename "$0") backend error -n 200 -f
  $(basename "$0") frontend --tail
  $(basename "$0") all -f
EOF
  exit 0
}

# ── Argument parsing ──────────────────────────────────────────────────────────
SERVICE=""
LOG_TYPE="error"
FOLLOW=false
LINES=100

while [[ $# -gt 0 ]]; do
  case "$1" in
    backend|frontend|all)
      SERVICE="$1"
      ;;
    access|error)
      LOG_TYPE="$1"
      ;;
    -f|--tail|--follow)
      FOLLOW=true
      ;;
    -n)
      shift
      LINES="${1:?'-n requires a number'}"
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo -e "\033[1;31m[ERR]\033[0m Unknown argument: $1" >&2
      usage
      ;;
  esac
  shift
done

[[ -z "$SERVICE" ]] && usage

# ── Helpers ───────────────────────────────────────────────────────────────────
print_header() {
  echo -e "${BOLD}${CYAN}━━━  $* ━━━${RESET}"
}

tail_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo -e "${YELLOW}[WARN]${RESET}  Log file not found: $file"
    echo -e "       The service may not have written any logs yet, or the path is wrong."
    exit 1
  fi

  if $FOLLOW; then
    tail -n "$LINES" -f "$file"
  else
    tail -n "$LINES" "$file"
  fi
}

journal_opts() {
  # Build journalctl options array
  local opts=("-u" "$1" "-n" "$LINES" "--no-pager" "--output=short-iso")
  $FOLLOW && opts+=("-f")
  echo "${opts[@]}"
}

# ── Main ──────────────────────────────────────────────────────────────────────
case "$SERVICE" in
  backend)
    case "$LOG_TYPE" in
      access)
        print_header "Backend – Access Log  ($LOG_DIR/backend-access.log)"
        tail_file "$LOG_DIR/backend-access.log"
        ;;
      error)
        print_header "Backend – Error Log  ($LOG_DIR/backend-error.log)"
        tail_file "$LOG_DIR/backend-error.log"
        ;;
    esac
    ;;

  frontend)
    print_header "Frontend – systemd journal  ($FRONTEND_SVC)"
    # shellcheck disable=SC2046
    journalctl -u "$FRONTEND_SVC" -n "$LINES" --no-pager --output=short-iso \
      $( $FOLLOW && echo "-f" || true )
    ;;

  all)
    print_header "All services – interleaved journal  ($BACKEND_SVC + $FRONTEND_SVC)"
    # shellcheck disable=SC2046
    journalctl -u "$BACKEND_SVC" -u "$FRONTEND_SVC" -n "$LINES" --no-pager --output=short-iso \
      $( $FOLLOW && echo "-f" || true )
    ;;
esac
