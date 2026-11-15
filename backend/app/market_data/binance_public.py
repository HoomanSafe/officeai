from datetime import datetime, timezone
from typing import Optional


def is_feed_stale(last_fetched_iso: Optional[str], stale_threshold_seconds: int = 45, now_utc: Optional[datetime] = None) -> tuple[bool, Optional[int]]:
    if not last_fetched_iso:
        return True, None
    now = now_utc or datetime.now(timezone.utc)
    fetched = datetime.fromisoformat(last_fetched_iso.replace("Z", "+00:00"))
    age_seconds = max(0, int((now - fetched).total_seconds()))
    return age_seconds > stale_threshold_seconds, age_seconds
