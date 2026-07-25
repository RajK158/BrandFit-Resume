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
    build_resume_parse_prompts,
    empty_profile_draft,
    error_result,
    normalize_ai_response,
    normalize_resume_parse_response,
)


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", timeout_seconds: float = 60.0):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.client = genai.Client(api_key=api_key)

    def _extract_text(self, response: Any) -> str:
        raw_text = getattr(response, "text", None)
        if raw_text:
            return raw_text
        try:
            candidates = getattr(response, "candidates", None) or []
            if candidates:
                content = getattr(candidates[0], "content", None)
                parts = getattr(content, "parts", None) or []
                return "".join(getattr(part, "text", "") or "" for part in parts)
        except Exception:
            return ""
        return ""

    def _generate_json(self, system_instructions: str, user_submission: str) -> Any:
        def _generate():
            return self.client.models.generate_content(
                model=self.model,
                contents=user_submission,
                config=types.GenerateContentConfig(
                    system_instruction=system_instructions,
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_generate)
            return future.result(timeout=self.timeout_seconds)

    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        system_instructions, user_submission = build_job_analysis_prompts(profile, job_description)

        try:
            response = self._generate_json(system_instructions, user_submission)
        except FuturesTimeoutError:
            return error_result("Gemini request timed out. Please try again.")
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            if "timeout" in lowered or "timed out" in lowered:
                return error_result("Gemini request timed out. Please try again.")
            return error_result(f"Gemini provider error: {message}")

        return normalize_ai_response(self._extract_text(response), "Gemini")

    def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        system_instructions, user_submission = build_resume_parse_prompts(resume_text)

        try:
            response = self._generate_json(system_instructions, user_submission)
        except FuturesTimeoutError:
            return {
                "status": "error",
                "profile_draft": empty_profile_draft(),
                "message": "Gemini request timed out. Please try again.",
            }
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            if "timeout" in lowered or "timed out" in lowered:
                return {
                    "status": "error",
                    "profile_draft": empty_profile_draft(),
                    "message": "Gemini request timed out. Please try again.",
                }
            return {
                "status": "error",
                "profile_draft": empty_profile_draft(),
                "message": f"Gemini provider error: {message}",
            }

        return normalize_resume_parse_response(self._extract_text(response), "Gemini")
