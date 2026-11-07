from __future__ import annotations

from collections import Counter
from threading import Lock


class Metrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counts: Counter[str] = Counter()
        self._durations: list[float] = []

    def record(self, name: str, duration_ms: float) -> None:
        with self._lock:
            self._counts[name] += 1
            self._durations.append(duration_ms)
            if len(self._durations) > 1000:
                self._durations = self._durations[-500:]

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            durations = sorted(self._durations)
            p50 = durations[len(durations) // 2] if durations else 0.0
            p95 = durations[int(len(durations) * 0.95)] if durations else 0.0
            return {
                "requests": dict(self._counts),
                "latency_ms": {"p50": round(p50, 2), "p95": round(p95, 2)},
            }

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()
            self._durations.clear()


metrics = Metrics()
