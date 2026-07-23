"""Shared AI provider interface and helpers for Impulso."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Tuple


def build_job_analysis_prompts(profile: Any, job_description: str) -> Tuple[str, str]:
    """Build reusable system and user prompts for job analysis."""
    first_name = ""
    last_name = ""
    email = ""

    if hasattr(profile, "first_name"):
        first_name = getattr(profile, "first_name", "") or ""
        last_name = getattr(profile, "last_name", "") or ""
        email = getattr(profile, "email", "") or ""
    elif isinstance(profile, dict):
        first_name = profile.get("first_name", "") or ""
        last_name = profile.get("last_name", "") or ""
        email = profile.get("email", "") or ""

    applicant = f"{first_name} {last_name}".strip() or "Applicant"

    system_instructions = (
        "You are the backend parsing engine for Impulso. Analyze the incoming job description. "
        "Extract critical tech stack keywords, framework proficiencies, and professional skills. "
        "You MUST reply only with a valid JSON object matching this structure exactly:\n"
        "{\n"
        '  "keywords": ["keyword1", "keyword2"],\n'
        '  "optimized_data": "Advice string here"\n'
        "}"
    )

    user_submission = (
        f"Applicant: {applicant}\n"
        f"Email: {email}\n\n"
        f"Job Description:\n{job_description}"
    )

    return system_instructions, user_submission


def success_result(keywords: List[str], optimized_data: str, message: str = "") -> Dict[str, Any]:
    return {
        "status": "success",
        "keywords": keywords,
        "optimized_data": optimized_data,
        "message": message,
    }


def error_result(message: str) -> Dict[str, Any]:
    return {
        "status": "error",
        "keywords": [],
        "optimized_data": "",
        "message": message,
    }


def dev_mode_result(message: str) -> Dict[str, Any]:
    return {
        "status": "dev_mode",
        "keywords": [],
        "optimized_data": "",
        "message": message,
    }


def _extract_json_object(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return ""

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def normalize_ai_response(raw_text: str, provider_name: str) -> Dict[str, Any]:
    """Parse provider text into the shared Impulso response structure."""
    if not raw_text or not str(raw_text).strip():
        return error_result(f"{provider_name} returned an empty response.")

    candidate = _extract_json_object(str(raw_text))
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return error_result(f"{provider_name} returned invalid JSON.")

    if not isinstance(parsed, dict):
        return error_result(f"{provider_name} returned JSON that was not an object.")

    keywords = parsed.get("keywords", [])
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(item).strip() for item in keywords if str(item).strip()]

    optimized_data = parsed.get("optimized_data", "")
    if optimized_data is None:
        optimized_data = ""
    else:
        optimized_data = str(optimized_data)

    message = parsed.get("message", "")
    if message is None:
        message = ""
    else:
        message = str(message)

    if not message:
        message = f"Analyzed job description with {provider_name}."

    return success_result(keywords, optimized_data, message)


class AIProvider(ABC):
    """Common interface for Impulso AI providers."""

    @abstractmethod
    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        """Analyze a job description against a user profile."""


class AIProviderError(Exception):
    """Raised for provider configuration or runtime failures."""
