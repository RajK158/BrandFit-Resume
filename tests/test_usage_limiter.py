import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "brandfit-backend"))

from usage_limiter import DailyUsageLimiter


class DailyUsageLimiterTests(unittest.TestCase):
    def test_enforces_limit_per_client(self):
        limiter = DailyUsageLimiter(2)
        now = datetime(2026, 8, 27, tzinfo=timezone.utc)

        self.assertEqual(limiter.consume("client-a", now), (True, 1))
        self.assertEqual(limiter.consume("client-a", now), (True, 0))
        self.assertEqual(limiter.consume("client-a", now), (False, 0))
        self.assertEqual(limiter.consume("client-b", now), (True, 1))

    def test_resets_on_new_utc_day(self):
        limiter = DailyUsageLimiter(1)
        first = datetime(2026, 8, 27, 23, 59, tzinfo=timezone.utc)
        second = datetime(2026, 8, 28, 0, 1, tzinfo=timezone.utc)

        self.assertEqual(limiter.consume("client-a", first), (True, 0))
        self.assertEqual(limiter.consume("client-a", first), (False, 0))
        self.assertEqual(limiter.consume("client-a", second), (True, 0))


if __name__ == "__main__":
    unittest.main()
