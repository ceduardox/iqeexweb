import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import jwt
from fastapi import HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import AccessAction, check_resource_access

logger = logging.getLogger(__name__)


class LiveSessionLaunchResponse(BaseModel):
    provider: str
    domain: str
    script_url: str
    room_name: str
    jwt: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None


def _is_live_session(details: dict | None) -> bool:
    return bool(details and details.get("type") == "live_session")


def _normalize_private_key(private_key: str) -> str:
    return private_key.replace("\\n", "\n").strip()


def _get_room_name(details: dict, activity_uuid: str) -> str:
    room_name = details.get("room_name")
    if room_name and isinstance(room_name, str):
        return room_name
    return f"live-{activity_uuid.replace('activity_', '')}"


async def _can_moderate(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> bool:
    if isinstance(current_user, AnonymousUser):
        return False

    try:
        await check_resource_access(
            request,
            db_session,
            current_user,
            course_uuid,
            AccessAction.UPDATE,
        )
        return True
    except HTTPException:
        return False


def _build_jaas_jwt(
    *,
    app_id: str,
    kid: str,
    private_key: str,
    display_name: str,
    email: Optional[str],
    is_moderator: bool,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "aud": "jitsi",
        "iss": "chat",
        "sub": app_id,
        "room": "*",
        "nbf": int((now - timedelta(seconds=30)).timestamp()),
        "exp": int((now + timedelta(hours=2)).timestamp()),
        "context": {
            "user": {
                "id": str(uuid4()),
                "name": display_name,
                "moderator": "true" if is_moderator else "false",
            },
            "features": {
                "livestreaming": False,
                "outbound-call": False,
                "transcription": False,
                "recording": False,
            },
            "room": {
                "regex": False,
            },
        },
    }

    if email:
        payload["context"]["user"]["email"] = email

    headers = {
        "kid": kid,
        "typ": "JWT",
    }

    return jwt.encode(
        payload,
        _normalize_private_key(private_key),
        algorithm="RS256",
        headers=headers,
    )


async def get_live_session_launch(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> LiveSessionLaunchResponse:
    statement = (
        select(Activity, Course)
        .join(Course)
        .where(Activity.activity_uuid == activity_uuid)
    )
    result = db_session.exec(statement).first()

    if not result:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity, course = result

    await check_resource_access(
        request,
        db_session,
        current_user,
        course.course_uuid,
        AccessAction.READ,
    )

    details = activity.details if isinstance(activity.details, dict) else {}
    if not _is_live_session(details):
        raise HTTPException(status_code=404, detail="Live session not found")

    room_name = _get_room_name(details, activity.activity_uuid)
    if isinstance(current_user, AnonymousUser):
        display_name = "Guest"
        email = None
    else:
        first_name = getattr(current_user, "first_name", "")
        last_name = getattr(current_user, "last_name", "")
        full_name = " ".join(part for part in [first_name, last_name] if part).strip()
        display_name = full_name or current_user.username or activity.name
        email = current_user.email

    app_id = os.environ.get("LEARNHOUSE_JITSI_APP_ID", "").strip()
    kid = os.environ.get("LEARNHOUSE_JITSI_KID", "").strip()
    private_key = os.environ.get("LEARNHOUSE_JITSI_PRIVATE_KEY", "").strip()

    if app_id and kid and private_key:
        domain = os.environ.get("LEARNHOUSE_JITSI_DOMAIN", "8x8.vc").strip() or "8x8.vc"
        is_moderator = await _can_moderate(
            request,
            course.course_uuid,
            current_user,
            db_session,
        )
        full_room_name = f"{app_id}/{room_name}"
        token = _build_jaas_jwt(
            app_id=app_id,
            kid=kid,
            private_key=private_key,
            display_name=display_name,
            email=email,
            is_moderator=is_moderator,
        )
        return LiveSessionLaunchResponse(
            provider="jaas",
            domain=domain,
            script_url=f"https://{domain}/{app_id}/external_api.js",
            room_name=full_room_name,
            jwt=token,
            display_name=display_name,
            email=email,
        )

    if app_id or kid or private_key:
        logger.warning(
            "Incomplete Jitsi JaaS configuration detected. Falling back to public Jitsi."
        )

    domain = (
        os.environ.get("LEARNHOUSE_JITSI_PUBLIC_DOMAIN", "meet.jit.si").strip()
        or "meet.jit.si"
    )
    return LiveSessionLaunchResponse(
        provider="public",
        domain=domain,
        script_url=f"https://{domain}/external_api.js",
        room_name=room_name,
        display_name=display_name,
        email=email,
    )
