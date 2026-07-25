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
    """Parse provider text into the shared Impulso job-analysis response structure."""
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


def empty_profile_draft() -> Dict[str, Any]:
    """Canonical empty structured resume draft."""
    return {
        "personal": {
            "firstName": "",
            "lastName": "",
            "email": "",
            "phone": "",
            "location": "",
        },
        "links": {
            "linkedin": "",
            "github": "",
            "portfolio": "",
        },
        "experience": [],
        "education": [],
        "projects": [],
        "skills": [],
        "certifications": [],
    }


def build_resume_parse_prompts(resume_text: str) -> Tuple[str, str]:
    """Build reusable system and user prompts for resume parsing."""
    schema_example = json.dumps(empty_profile_draft(), indent=2)
    system_instructions = (
        "You are the resume parsing engine for Impulso. "
        "Extract structured profile data from the resume text. "
        "Rules:\n"
        "1. Extract only information explicitly present in the resume.\n"
        "2. Never invent missing names, dates, employers, skills, or links.\n"
        "3. Preserve technical skills accurately and keep them as a flat string array.\n"
        "4. Keep experience bullets as separate strings in the bullets array when possible.\n"
        "5. Use empty strings, empty arrays, or false when a value is not present.\n"
        "6. Return valid JSON only. No markdown fences or commentary.\n"
        "7. The JSON MUST match this structure exactly:\n"
        f"{schema_example}"
    )
    user_submission = "Resume text:\n" + (resume_text or "")
    return system_instructions, user_submission


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_str_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [_as_str(item) for item in value if _as_str(item)]


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y"}
    return False


def normalize_profile_draft(raw_draft: Any) -> Dict[str, Any]:
    """Normalize AI JSON into the shared Impulso profile draft shape."""
    draft = empty_profile_draft()
    if not isinstance(raw_draft, dict):
        return draft

    personal_in = raw_draft.get("personal") if isinstance(raw_draft.get("personal"), dict) else {}
    links_in = raw_draft.get("links") if isinstance(raw_draft.get("links"), dict) else {}

    draft["personal"] = {
        "firstName": _as_str(personal_in.get("firstName")),
        "lastName": _as_str(personal_in.get("lastName")),
        "email": _as_str(personal_in.get("email")),
        "phone": _as_str(personal_in.get("phone")),
        "location": _as_str(personal_in.get("location")),
    }
    draft["links"] = {
        "linkedin": _as_str(links_in.get("linkedin")),
        "github": _as_str(links_in.get("github")),
        "portfolio": _as_str(links_in.get("portfolio")),
    }

    experience_out: List[Dict[str, Any]] = []
    for item in raw_draft.get("experience") or []:
        if not isinstance(item, dict):
            continue
        experience_out.append(
            {
                "company": _as_str(item.get("company")),
                "title": _as_str(item.get("title")),
                "location": _as_str(item.get("location")),
                "startDate": _as_str(item.get("startDate")),
                "endDate": _as_str(item.get("endDate")),
                "isCurrent": _as_bool(item.get("isCurrent")),
                "description": _as_str(item.get("description")),
                "bullets": _as_str_list(item.get("bullets")),
            }
        )
    draft["experience"] = experience_out

    education_out: List[Dict[str, Any]] = []
    for item in raw_draft.get("education") or []:
        if not isinstance(item, dict):
            continue
        education_out.append(
            {
                "institution": _as_str(item.get("institution")),
                "degree": _as_str(item.get("degree")),
                "field": _as_str(item.get("field")),
                "location": _as_str(item.get("location")),
                "startDate": _as_str(item.get("startDate")),
                "endDate": _as_str(item.get("endDate")),
                "gpa": _as_str(item.get("gpa")),
            }
        )
    draft["education"] = education_out

    projects_out: List[Dict[str, Any]] = []
    for item in raw_draft.get("projects") or []:
        if not isinstance(item, dict):
            continue
        projects_out.append(
            {
                "name": _as_str(item.get("name")),
                "description": _as_str(item.get("description")),
                "technologies": _as_str_list(item.get("technologies")),
                "url": _as_str(item.get("url")),
            }
        )
    draft["projects"] = projects_out

    draft["skills"] = _as_str_list(raw_draft.get("skills"))
    draft["certifications"] = _as_str_list(raw_draft.get("certifications"))
    return draft


def normalize_resume_parse_response(raw_text: str, provider_name: str) -> Dict[str, Any]:
    """Parse provider text into a resume parse result payload."""
    if not raw_text or not str(raw_text).strip():
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "message": f"{provider_name} returned an empty response.",
        }

    candidate = _extract_json_object(str(raw_text))
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "message": f"{provider_name} returned invalid JSON.",
        }

    if not isinstance(parsed, dict):
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "message": f"{provider_name} returned JSON that was not an object.",
        }

    # Allow either a wrapped object or a bare draft.
    if "personal" in parsed or "experience" in parsed or "skills" in parsed:
        draft_source = parsed
    elif isinstance(parsed.get("profile_draft"), dict):
        draft_source = parsed["profile_draft"]
    else:
        draft_source = parsed

    return {
        "status": "success",
        "profile_draft": normalize_profile_draft(draft_source),
        "message": "Resume parsed successfully.",
    }


class AIProvider(ABC):
    """Common interface for Impulso AI providers."""

    @abstractmethod
    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        """Analyze a job description against a user profile."""

    @abstractmethod
    def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        """Parse resume text into a structured profile draft."""


class AIProviderError(Exception):
    """Raised for provider configuration or runtime failures."""
