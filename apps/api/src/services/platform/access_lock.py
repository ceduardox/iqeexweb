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


def normalize_ip(ip: str | None) -> str:
    if not ip:
        return ""
    value = ip.strip()
    if "," in value:
        value = value.split(",", 1)[0].strip()
    if value.startswith("::ffff:"):
        value = value[7:]
    if value.startswith("[") and "]" in value:
        value = value[1:value.index("]")]
    parts = value.rsplit(":", 1)
    if len(parts) == 2 and "." in parts[0] and parts[1].isdigit():
        value = parts[0]
    return value


def get_request_ip_from_headers(headers: Any, client_host: str | None = None) -> str:
    return normalize_ip(
        headers.get("cf-connecting-ip")
        or headers.get("x-real-ip")
        or headers.get("x-forwarded-for")
        or client_host
    )


def _ipv4_to_int(ip: str) -> int | None:
    try:
        parts = [int(part) for part in ip.split(".")]
    except ValueError:
        return None
    if len(parts) != 4 or any(part < 0 or part > 255 for part in parts):
        return None
    return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3])


def ip_matches_allowed_entry(request_ip: str, allowed_entry: str) -> bool:
    ip = normalize_ip(request_ip)
    entry = normalize_ip(allowed_entry)
    if not ip or not entry:
        return False
    if ip == entry:
        return True

    if "/" in entry:
        range_ip, prefix_text = entry.split("/", 1)
        try:
            prefix = int(prefix_text)
        except ValueError:
            return False
        if prefix < 0 or prefix > 32:
            return False
        range_number = _ipv4_to_int(range_ip)
        ip_number = _ipv4_to_int(ip)
        if range_number is None or ip_number is None:
            return False
        mask = 0 if prefix == 0 else (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF
        return (range_number & mask) == (ip_number & mask)

    return False


def is_ip_allowed(access_lock: dict[str, Any], request_ip: str) -> bool:
    if not access_lock.get("enabled"):
        return True
    allowed_ips = access_lock.get("allowed_ips") or []
    return any(ip_matches_allowed_entry(request_ip, entry) for entry in allowed_ips)


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
