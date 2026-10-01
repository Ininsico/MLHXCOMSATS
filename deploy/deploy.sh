#!/usr/bin/env bash
#
# Deploys Aurora to the server. Run from the repository root:
#
#   HOST=169.58.119.44 SSH_USER=root bash deploy/deploy.sh
#
# Uses scp + ssh (or pscp + plink on Windows). Idempotent: every run replaces the
# deployed code and both archives are built fresh, so it is safe to re-run.

set -euo pipefail

HOST="${HOST:-169.58.119.44}"
SSH_USER="${SSH_USER:-root}"
REMOTE_APP="${REMOTE_APP:-/opt/aurora}"
REMOTE_WEB="${REMOTE_WEB:-/var/www/aurora}"
API_PORT="${API_PORT:-4400}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/tmp}"

# Windows ships pscp/plink; Linux and macOS ship scp/ssh.
if command -v pscp >/dev/null 2>&1; then
  COPY="pscp -batch"
  SHELL_CMD="plink -ssh -batch"
elif command -v scp >/dev/null 2>&1; then
  COPY="scp -o StrictHostKeyChecking=accept-new"
  SHELL_CMD="ssh -o StrictHostKeyChecking=accept-new"
else
  echo "Neither pscp nor scp is available." >&2
  exit 1
fi

REMOTE="${SSH_USER}@${HOST}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n=== %s ===\n' "$1"; }

say "building the frontend"
npm --prefix frontend ci --silent
npm --prefix frontend run build

say "packing the backend"
tar -czf "${ARCHIVE_DIR}/aurora-backend-${STAMP}.tgz" \
  --exclude node_modules --exclude .env \
  --exclude .wwebjs_auth --exclude .wwebjs_cache \
  --exclude logs --exclude '*.log' \
  -C backend .

say "packing the built frontend"
tar -czf "${ARCHIVE_DIR}/aurora-web-${STAMP}.tgz" -C frontend/dist .

say "uploading"
$COPY "${ARCHIVE_DIR}/aurora-backend-${STAMP}.tgz" "${REMOTE}:${ARCHIVE_DIR}/"
$COPY "${ARCHIVE_DIR}/aurora-web-${STAMP}.tgz" "${REMOTE}:${ARCHIVE_DIR}/"

say "deploying on the server"
$SHELL_CMD "$REMOTE" "set -e
  mkdir -p ${REMOTE_APP}/backend ${REMOTE_WEB}
  rm -rf ${REMOTE_APP}/backend/* ${REMOTE_WEB}/*
  tar -xzf ${ARCHIVE_DIR}/aurora-backend-${STAMP}.tgz -C ${REMOTE_APP}/backend
  tar -xzf ${ARCHIVE_DIR}/aurora-web-${STAMP}.tgz -C ${REMOTE_WEB}
  cd ${REMOTE_APP}/backend && npm install --omit=dev --no-audit --no-fund >/dev/null
  systemctl restart aurora-api
  sleep 4
  systemctl is-active aurora-api
  curl -s -o /dev/null -w 'api health: %{http_code}\n' http://127.0.0.1:${API_PORT}/api/health
"

say "checking the public site"
curl -s -o /dev/null -w 'origin: HTTP %{http_code}\n' -H "Host: aurora.artdevelopers.site" "http://${HOST}/"

say "deployed ${STAMP}"
