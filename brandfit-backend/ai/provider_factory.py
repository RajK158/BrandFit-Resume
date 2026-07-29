"""Factory for selecting the configured Impulso AI provider."""

from __future__ import annotations

import os
from typing import Any, Dict, Tuple, Union

from job_matcher import empty_job_match_result

from .base import AIProvider, AIProviderError, dev_mode_result, error_result
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider

ProviderResult = Union[AIProvider, Dict[str, Any]]


def _clean_env(name: str, default: str = "") -> str:
    value = os.getenv(name, default)
    if value is None:
        return default
    return str(value).strip()


def unavailable_job_match_result(status_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a provider status dict (dev_mode / error) into the job-match response shape.

    Never invent fake match scores when the API key is missing.
    """
    return empty_job_match_result(
        status=str(status_payload.get("status") or "error"),
        message=str(status_payload.get("message") or "AI provider unavailable."),
        match_score=0,
    )


def get_ai_provider() -> Tuple[ProviderResult, str]:
    """
    Resolve the configured AI provider.

    Returns:
        (provider_or_status_dict, provider_name)

    If configuration is incomplete or invalid, the first value is a status dict
    (dev_mode or error) instead of a provider instance.
    """
    provider_name = _clean_env("AI_PROVIDER", "gemini").lower()

    if provider_name not in {"gemini", "openai"}:
        return (
            error_result(
                f"Invalid AI_PROVIDER '{provider_name}'. "
                "Set AI_PROVIDER to 'gemini' or 'openai' in brandfit-backend/.env."
            ),
            provider_name or "unknown",
        )

    if provider_name == "gemini":
        api_key = _clean_env("GEMINI_API_KEY")
        model = _clean_env("GEMINI_MODEL", "gemini-flash-latest") or "gemini-flash-latest"
        if not api_key:
            return (
                dev_mode_result("GEMINI_API_KEY is not configured."),
                "gemini",
            )
        try:
            return GeminiProvider(api_key=api_key, model=model), "gemini"
        except Exception as exc:
            raise AIProviderError(f"Failed to initialize Gemini provider: {exc}") from exc

    api_key = _clean_env("OPENAI_API_KEY")
    model = _clean_env("OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"
    if not api_key or api_key == "your-fallback-key-here":
        return (
            dev_mode_result("OPENAI_API_KEY is not configured."),
            "openai",
        )

    try:
        return OpenAIProvider(api_key=api_key, model=model), "openai"
    except Exception as exc:
        raise AIProviderError(f"Failed to initialize OpenAI provider: {exc}") from exc
