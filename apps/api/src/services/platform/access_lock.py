from datetime import datetime
from typing import Any

from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from src.db.platform_settings import PlatformSetting


ACCESS_LOCK_KEY = "access_lock"
DEFAULT_ACCESS_LOCK = {
    "enabled": False,
    "allowed_ips": [],
}


def normalize_access_lock(value: dict[str, Any] | None) -> dict[str, Any]:
    data = {**DEFAULT_ACCESS_LOCK, **(value or {})}
    allowed_ips = data.get("allowed_ips") or []
    if isinstance(allowed_ips, str):
        allowed_ips = [line.strip() for line in allowed_ips.replace(",", "\n").splitlines()]

    return {
        "enabled": bool(data.get("enabled", False)),
        "allowed_ips": [
            ip.strip()
            for ip in allowed_ips
            if isinstance(ip, str) and ip.strip()
        ],
    }


def get_access_lock(db_session: Session) -> dict[str, Any]:
    setting = db_session.exec(
        select(PlatformSetting).where(PlatformSetting.key == ACCESS_LOCK_KEY)
    ).first()
    return normalize_access_lock(setting.value if setting else None)


def save_access_lock(
    db_session: Session,
    *,
    enabled: bool,
    allowed_ips: list[str],
) -> dict[str, Any]:
    now = datetime.now().isoformat()
    value = normalize_access_lock({"enabled": enabled, "allowed_ips": allowed_ips})
    setting = db_session.exec(
        select(PlatformSetting).where(PlatformSetting.key == ACCESS_LOCK_KEY)
    ).first()

    if setting:
        setting.value = value
        setting.update_date = now
        flag_modified(setting, "value")
    else:
        setting = PlatformSetting(
            key=ACCESS_LOCK_KEY,
            value=value,
            creation_date=now,
            update_date=now,
        )

    db_session.add(setting)
    db_session.commit()
    db_session.refresh(setting)
    return normalize_access_lock(setting.value)
