#!/usr/bin/env bash
# Update the server to the latest commit and restart Kleandeck.
#
#   ./deploy.sh
#
# Pulls the current branch, rebuilds and restarts the containers, waits until
# they're healthy, and creates a first admin (owner) account if none exists.
# Override the first admin's details with env vars, e.g.
#   ADMIN_EMAIL=me@example.com ADMIN_PASSWORD='long-password' ./deploy.sh
# Without ADMIN_PASSWORD a random one is generated and printed once.
set -euo pipefail

cd "$(dirname "$0")"

ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@kleandeck.com}"

if [ ! -f .env ]; then
  echo "No .env here. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Rebuilding and restarting containers"
docker compose up -d --build --remove-orphans --wait --wait-timeout 300

echo "==> Checking for an admin account"
if [ "$(docker compose exec -T backend python manage.py shell -c \
  "from django.contrib.auth import get_user_model; print(get_user_model().objects.filter(is_superuser=True, is_active=True).exists())")" = "True" ]; then
  echo "    An admin already exists; leaving accounts alone."
else
  generated=""
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
    generated=1
  fi
  docker compose exec -T \
    -e ADMIN_USERNAME="$ADMIN_USERNAME" \
    -e ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    backend python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
get_user_model().objects.create_superuser(
    os.environ['ADMIN_USERNAME'], os.environ['ADMIN_EMAIL'], os.environ['ADMIN_PASSWORD']
)"
  echo "    Created admin account:"
  echo "      email:    $ADMIN_EMAIL"
  if [ -n "$generated" ]; then
    echo "      password: $ADMIN_PASSWORD"
    echo "    Save this password now; it isn't shown again. Change it after signing in."
  fi
fi

echo "==> Removing old images"
docker image prune -f >/dev/null

echo "==> Done"
docker compose ps
