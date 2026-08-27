from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Optional, Tuple


class DailyUsageLimiter:
    def __init__(self, limit: int):
        self.limit = max(1, int(limit))
        self._day = ""
        self._counts: Dict[str, int] = {}
        self._lock = Lock()

    def consume(self, client_id: str, now: Optional[datetime] = None) -> Tuple[bool, int]:
        current = now or datetime.now(timezone.utc)
        day = current.astimezone(timezone.utc).date().isoformat()
        key = str(client_id or "anonymous").strip()[:128] or "anonymous"

        with self._lock:
            if day != self._day:
                self._day = day
                self._counts.clear()

            used = self._counts.get(key, 0)
            if used >= self.limit:
                return False, 0

            used += 1
            self._counts[key] = used
            return True, self.limit - used
