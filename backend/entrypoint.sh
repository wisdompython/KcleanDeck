#!/bin/sh
set -e

python manage.py migrate --noinput
# Fills in starter services/areas/FAQs only where missing; never overwrites admin edits.
python manage.py seed

# Optional first admin login: set DJANGO_SUPERUSER_USERNAME / _EMAIL / _PASSWORD.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput 2>/dev/null || true
fi

exec "$@"
