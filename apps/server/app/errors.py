from __future__ import annotations

from typing import Any


class ProviderError(Exception):
    """A model provider could not serve the request.

    The API maps this to a JSON body with a stable ``code`` so the panel and the
    test harness can tell a missing key from a missing model or an upstream
    failure without parsing prose.
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 503,
        provider: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.provider = provider
        self.detail = detail or {}

    def as_detail(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }
        if self.provider:
            payload["provider"] = self.provider
        payload.update(self.detail)
        return payload
