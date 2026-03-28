#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Backward-compatible env mapping from legacy deployment variables.
if [ -z "$LEARNHOUSE_SQL_CONNECTION_STRING" ] && [ -n "$DATABASE_PUBLIC_URL" ]; then
    export LEARNHOUSE_SQL_CONNECTION_STRING="$DATABASE_PUBLIC_URL"
fi
if [ -z "$LEARNHOUSE_SQL_CONNECTION_STRING" ] && [ -n "$DATABASE_URL" ]; then
    export LEARNHOUSE_SQL_CONNECTION_STRING="$DATABASE_URL"
fi

if [ -z "$LEARNHOUSE_REDIS_CONNECTION_STRING" ] && [ -n "$REDIS_URL" ]; then
    export LEARNHOUSE_REDIS_CONNECTION_STRING="$REDIS_URL"
fi
if [ -z "$LEARNHOUSE_REDIS_CONNECTION_STRING" ] && [ -n "$REDIS_PUBLIC_URL" ]; then
    export LEARNHOUSE_REDIS_CONNECTION_STRING="$REDIS_PUBLIC_URL"
fi

if [ -z "$LEARNHOUSE_AUTH_JWT_SECRET_KEY" ] && [ -n "$APP_AUTH_SECRET" ]; then
    export LEARNHOUSE_AUTH_JWT_SECRET_KEY="$APP_AUTH_SECRET"
fi
if [ -z "$LEARNHOUSE_AUTH_JWT_SECRET_KEY" ]; then
    export LEARNHOUSE_AUTH_JWT_SECRET_KEY="learnhouse_fallback_secret_key_change_in_env_2026_03_28"
fi
if [ "${#LEARNHOUSE_AUTH_JWT_SECRET_KEY}" -lt 32 ]; then
    export LEARNHOUSE_AUTH_JWT_SECRET_KEY="${LEARNHOUSE_AUTH_JWT_SECRET_KEY}_______________________________"
fi

if [ -z "$COLLAB_INTERNAL_KEY" ]; then
    export COLLAB_INTERNAL_KEY="$LEARNHOUSE_AUTH_JWT_SECRET_KEY"
fi

if [ -z "$LEARNHOUSE_INITIAL_ADMIN_EMAIL" ] && [ -n "$ADMIN_EMAIL" ]; then
    export LEARNHOUSE_INITIAL_ADMIN_EMAIL="$ADMIN_EMAIL"
fi
if [ -z "$LEARNHOUSE_INITIAL_ADMIN_EMAIL" ]; then
    export LEARNHOUSE_INITIAL_ADMIN_EMAIL="admin@iqexponencial.com"
fi
if [ -z "$LEARNHOUSE_INITIAL_ADMIN_PASSWORD" ] && [ -n "$ADMIN_PASSWORD" ]; then
    export LEARNHOUSE_INITIAL_ADMIN_PASSWORD="$ADMIN_PASSWORD"
fi
if [ -z "$LEARNHOUSE_INITIAL_ADMIN_PASSWORD" ] && [ -n "$APP_AUTH_SECRET" ]; then
    export LEARNHOUSE_INITIAL_ADMIN_PASSWORD="$APP_AUTH_SECRET"
fi
if [ -z "$LEARNHOUSE_INITIAL_ADMIN_PASSWORD" ]; then
    export LEARNHOUSE_INITIAL_ADMIN_PASSWORD="Admin!ChangeThisNow2026"
fi

if [ -z "$LEARNHOUSE_DOMAIN" ] && [ -n "$NEXT_PUBLIC_LEARNHOUSE_DOMAIN" ]; then
    export LEARNHOUSE_DOMAIN="$NEXT_PUBLIC_LEARNHOUSE_DOMAIN"
fi
if [ -z "$LEARNHOUSE_FRONTEND_DOMAIN" ] && [ -n "$LEARNHOUSE_DOMAIN" ]; then
    export LEARNHOUSE_FRONTEND_DOMAIN="$LEARNHOUSE_DOMAIN"
fi

PUBLIC_PORT="${PORT:-8080}"
WEB_INTERNAL_PORT="${LEARNHOUSE_WEB_INTERNAL_PORT:-8000}"

# Keep internal ports explicit. Railway PORT is only for nginx public entrypoint.
export LEARNHOUSE_PORT="${LEARNHOUSE_PORT:-9000}"
export COLLAB_PORT="${COLLAB_PORT:-4000}"

# Reuse backend redis connection for collab if a dedicated one is not provided.
if [ -z "$LEARNHOUSE_REDIS_URL" ] && [ -n "$LEARNHOUSE_REDIS_CONNECTION_STRING" ]; then
    export LEARNHOUSE_REDIS_URL="$LEARNHOUSE_REDIS_CONNECTION_STRING"
fi

# Wait for database and redis if connection strings point to external services
# (In docker-compose, depends_on handles this, but useful for standalone)
if [ -n "$LEARNHOUSE_SQL_CONNECTION_STRING" ]; then
    DB_HOST=$(echo "$LEARNHOUSE_SQL_CONNECTION_STRING" | sed -n 's#.*@\([^:/]*\)\(:[0-9]*\)\{0,1\}/.*#\1#p')
    DB_PORT=$(echo "$LEARNHOUSE_SQL_CONNECTION_STRING" | sed -n 's#.*@[^:/]*:\([0-9]*\)/.*#\1#p')
    if [ -z "$DB_PORT" ]; then
        DB_PORT=5432
    fi
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
        echo "Waiting for external database at $DB_HOST:$DB_PORT..."
        timeout 30 sh -c "until nc -z $DB_HOST $DB_PORT; do sleep 1; done" || true
    fi
fi

# Start the services
# Use server-wrapper.js for runtime environment variable injection
PORT="$WEB_INTERNAL_PORT" pm2 start server-wrapper.js --cwd /app/web --name learnhouse-web > /dev/null 2>&1

# Start API with project virtualenv when available (most reliable in production).
if [ -x "/app/api/.venv/bin/python" ]; then
    pm2 start /app/api/.venv/bin/python --cwd /app/api --name learnhouse-api -- -m uvicorn app:app --host 0.0.0.0 --port "$LEARNHOUSE_PORT"
else
    pm2 start uv --cwd /app/api --name learnhouse-api -- run app.py
fi

pm2 start node --cwd /app/collab --name learnhouse-collab -- dist/index.js

# Check if the services are running and log the status
pm2 status

# Set nginx public listen port dynamically (Railway sets PORT)
if [ -f /etc/nginx/conf.d/default.conf ]; then
    sed -i "s/listen 80;/listen ${PUBLIC_PORT};/" /etc/nginx/conf.d/default.conf
fi

# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail PM2 logs with proper formatting
pm2 logs --raw
