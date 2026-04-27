from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select
from src.db.organizations import Organization
from src.core.events.database import get_db_session
from src.core.ee_hooks import is_multi_org_allowed
from src.core.deployment_mode import get_deployment_mode
from src.services.platform.access_lock import (
    get_access_lock,
    get_request_ip_from_headers,
    is_ip_allowed,
)
from config.config import get_learnhouse_config

router = APIRouter()


def _strip_port(domain: str) -> str:
    """Strip port from a domain string (e.g. 'localhost:3000' -> 'localhost')."""
    return domain.split(":")[0] if ":" in domain else domain


@router.get("/info")
async def get_instance_info(db_session: Session = Depends(get_db_session)):
    """Public endpoint returning instance configuration."""
    # Get default org slug (first org by ID)
    default_org_slug = "default"
    try:
        statement = select(Organization).order_by(Organization.id).limit(1)
        first_org = db_session.exec(statement).first()
        if first_org:
            default_org_slug = first_org.slug
    except Exception:
        pass

    config = get_learnhouse_config()
    frontend_domain = config.hosting_config.frontend_domain
    top_domain = _strip_port(frontend_domain)

    return {
        "mode": get_deployment_mode(),
        "multi_org_enabled": is_multi_org_allowed(),
        "default_org_slug": default_org_slug,
        "frontend_domain": frontend_domain,
        "top_domain": top_domain,
    }


@router.get("/access-lock")
async def get_instance_access_lock(
    request: Request,
    db_session: Session = Depends(get_db_session),
):
    """Public endpoint used by the frontend proxy to enforce the global IP lock."""
    access_lock = get_access_lock(db_session)
    client_host = request.client.host if request.client else None
    request_ip = get_request_ip_from_headers(
        {
            "cf-connecting-ip": request.headers.get("x-learnhouse-client-ip") or request.headers.get("cf-connecting-ip"),
            "x-real-ip": request.headers.get("x-real-ip"),
            "x-forwarded-for": request.headers.get("x-forwarded-for"),
        },
        client_host,
    )
    return {
        "enabled": access_lock["enabled"],
        "allowed": is_ip_allowed(access_lock, request_ip),
    }
