"""OpenAI AI provider for Impulso."""

from __future__ import annotations

from typing import Any, Dict

from openai import OpenAI

from .base import (
    AIProvider,
    build_job_analysis_prompts,
    error_result,
    normalize_ai_response,
)


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", timeout_seconds: float = 60.0):
        self.api_key = api_key
        self.model = model
        self.client = OpenAI(api_key=api_key, timeout=timeout_seconds)

    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        system_instructions, user_submission = build_job_analysis_prompts(profile, job_description)

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": user_submission},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            if "timeout" in lowered or "timed out" in lowered:
                return error_result("OpenAI request timed out. Please try again.")
            return error_result(f"OpenAI provider error: {message}")

        try:
            raw_text = completion.choices[0].message.content if completion.choices else None
        except Exception:
            raw_text = None

        return normalize_ai_response(raw_text or "", "OpenAI")
