# LearnHouse on Railway (iqexponencial.com)

This repository now uses LearnHouse as the base platform (web + api + collab).

## 1. What you need in Railway

1. Service A: app service from this repository (Dockerfile at project root).
2. Service B: PostgreSQL (you already have this).
3. Service C: Redis (recommended and required for stable auth/invites/collab cache).

## 2. Required environment variables

Use `.env.example` as reference and set those values in Railway variables.

Minimum required:

- `LEARNHOUSE_SQL_CONNECTION_STRING`
- `LEARNHOUSE_REDIS_CONNECTION_STRING`
- `LEARNHOUSE_AUTH_JWT_SECRET_KEY`
- `COLLAB_INTERNAL_KEY`
- `LEARNHOUSE_DOMAIN`
- `LEARNHOUSE_FRONTEND_DOMAIN`
- `LEARNHOUSE_ALLOWED_ORIGINS`
- `LEARNHOUSE_COOKIE_DOMAIN`
- `LEARNHOUSE_SSL`
- `LEARNHOUSE_INITIAL_ADMIN_EMAIL`
- `LEARNHOUSE_INITIAL_ADMIN_PASSWORD`
- `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL`
- `NEXT_PUBLIC_LEARNHOUSE_API_URL`
- `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`
- `NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN`
- `NEXT_PUBLIC_LEARNHOUSE_HTTPS`
- `NEXT_PUBLIC_COLLAB_URL`

## 3. Port behavior (important)

This repo is configured so:

- Railway public port (`PORT`) is used by nginx.
- Next.js internal port stays fixed at `LEARNHOUSE_WEB_INTERNAL_PORT` (default `8000`).
- API runs on `LEARNHOUSE_PORT` (default `9000`).
- Collab runs on `COLLAB_PORT` (default `4000`).

That avoids the classic Railway conflict where Next and nginx both try to use `PORT`.

## 4. DNS and domain

Point your domain to Railway and set:

- `LEARNHOUSE_DOMAIN=iqexponencial.com`
- `LEARNHOUSE_FRONTEND_DOMAIN=iqexponencial.com`
- `NEXT_PUBLIC_LEARNHOUSE_DOMAIN=iqexponencial.com`

## 5. First login

After first boot and migrations, log in with:

- `LEARNHOUSE_INITIAL_ADMIN_EMAIL`
- `LEARNHOUSE_INITIAL_ADMIN_PASSWORD`

Then change the admin password immediately from dashboard settings.
