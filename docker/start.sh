#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

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
pm2 start uv --cwd /app/api --name learnhouse-api -- run app.py
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
