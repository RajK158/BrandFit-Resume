"""Gemini AI provider for Impulso."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Any, Dict

from google import genai
from google.genai import types

from .base import (
    AIProvider,
    build_job_analysis_prompts,
    error_result,
    normalize_ai_response,
)


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", timeout_seconds: float = 60.0):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.client = genai.Client(api_key=api_key)

    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        system_instructions, user_submission = build_job_analysis_prompts(profile, job_description)

        def _generate():
            return self.client.models.generate_content(
                model=self.model,
                contents=user_submission,
                config=types.GenerateContentConfig(
                    system_instruction=system_instructions,
                    temperature=0.3,
                    response_mime_type="application/json",
                ),
            )

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_generate)
                response = future.result(timeout=self.timeout_seconds)
        except FuturesTimeoutError:
            return error_result("Gemini request timed out. Please try again.")
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            if "timeout" in lowered or "timed out" in lowered:
                return error_result("Gemini request timed out. Please try again.")
            return error_result(f"Gemini provider error: {message}")

        raw_text = getattr(response, "text", None)
        if not raw_text:
            try:
                candidates = getattr(response, "candidates", None) or []
                if candidates:
                    content = getattr(candidates[0], "content", None)
                    parts = getattr(content, "parts", None) or []
                    raw_text = "".join(getattr(part, "text", "") or "" for part in parts)
            except Exception:
                raw_text = None

        return normalize_ai_response(raw_text or "", "Gemini")
