from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.events.database import engine
from src.services.platform.access_lock import (
    get_access_lock,
    get_request_ip_from_headers,
    is_ip_allowed,
)
from sqlmodel import Session


EXEMPT_PATHS = {
    "/",
    "/api/v1/health",
    "/api/v1/instance/info",
    "/api/v1/instance/access-lock",
    "/api/v1/ee/superadmin/status",
    "/api/v1/ee/superadmin/access-lock",
    "/api/v1/users/session",
}


class AccessLockMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            path in EXEMPT_PATHS
            or path.startswith("/api/v1/auth")
            or path.startswith("/api/v1/orgs/slug/")
            or path.startswith("/docs")
            or path.startswith("/openapi")
        ):
            return await call_next(request)

        try:
            with Session(engine) as session:
                access_lock = get_access_lock(session)
        except Exception:
            # If the table is not ready yet, avoid breaking boot/deploy.
            return await call_next(request)

        if not access_lock.get("enabled"):
            return await call_next(request)

        client_host = request.client.host if request.client else None
        request_ip = get_request_ip_from_headers(request.headers, client_host)
        if is_ip_allowed(access_lock, request_ip):
            return await call_next(request)

        return Response(status_code=403, content=b"", headers={"x-robots-tag": "noindex, nofollow"})
