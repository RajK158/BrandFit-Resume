"""Structured resume-to-job match analysis for Impulso."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCORE_WEIGHTS = {
    "requiredSkills": 0.30,
    "preferredSkills": 0.15,
    "experience": 0.25,
    "education": 0.10,
    "projects": 0.10,
    "keywords": 0.10,
}


def empty_job_match_result(
    status: str = "error",
    message: str = "",
    *,
    match_score: int = 0,
) -> Dict[str, Any]:
    return {
        "status": status,
        "matchScore": int(match_score),
        "matchedSkills": [],
        "missingSkills": [],
        "matchedKeywords": [],
        "missingKeywords": [],
        "strengths": [],
        "gaps": [],
        "recommendations": [],
        "summary": "",
        "message": str(message or ""),
    }


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"[,;\n|/]+", value)
        return [part.strip() for part in parts if part and part.strip()]
    if not isinstance(value, (list, tuple, set)):
        text = _as_str(value)
        return [text] if text else []
    out: List[str] = []
    for item in value:
        text = _as_str(item)
        if text and text not in out:
            out.append(text)
    return out


def _dedupe_preserve(items: Iterable[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        text = _as_str(item)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", "", _as_str(value).lower())


def _profile_skill_set(profile_payload: Dict[str, Any]) -> List[str]:
    skills = list(profile_payload.get("skills") or [])
    for project in profile_payload.get("projects") or []:
        if isinstance(project, dict):
            skills.extend(_as_str_list(project.get("technologies")))
    for cert in profile_payload.get("certifications") or []:
        skills.append(_as_str(cert))
    return _dedupe_preserve(skills)


def _text_blob(parts: Sequence[Any]) -> str:
    chunks: List[str] = []
    for part in parts:
        if part is None:
            continue
        if isinstance(part, dict):
            chunks.append(" ".join(_as_str(v) for v in part.values() if _as_str(v)))
        elif isinstance(part, (list, tuple)):
            chunks.append(" ".join(_as_str(v) for v in part if _as_str(v)))
        else:
            chunks.append(_as_str(part))
    return " ".join(chunk for chunk in chunks if chunk).lower()


def skill_mentioned_in_text(skill: str, text: str) -> bool:
    needle = _as_str(skill)
    if not needle or not text:
        return False
    haystack = text.lower()
    lower = needle.lower()
    if lower in haystack:
        return True
    compact_skill = _normalize_token(needle)
    compact_text = _normalize_token(haystack)
    return bool(compact_skill) and compact_skill in compact_text


def skill_in_profile(skill: str, profile_skills: Sequence[str]) -> bool:
    needle = _normalize_token(skill)
    if not needle:
        return False
    for candidate in profile_skills:
        cand = _normalize_token(candidate)
        if not cand:
            continue
        if needle == cand or needle in cand or cand in needle:
            return True
    return False


def build_career_relevant_profile(profile: Any) -> Dict[str, Any]:
    """Extract only career-relevant fields. Never include demographics or visa expiration."""
    source: Dict[str, Any] = {}
    if hasattr(profile, "model_dump"):
        try:
            source = profile.model_dump()
        except Exception:
            source = {}
    elif isinstance(profile, dict):
        source = profile

    skills = _as_str_list(source.get("skills") or source.get("skills_inventory"))

    experience_out: List[Dict[str, Any]] = []
    for item in source.get("experience") or []:
        if not isinstance(item, dict):
            continue
        experience_out.append(
            {
                "company": _as_str(item.get("company") or item.get("company_name")),
                "title": _as_str(item.get("title") or item.get("job_title")),
                "location": _as_str(item.get("location")),
                "startDate": _as_str(item.get("startDate") or item.get("start_date")),
                "endDate": _as_str(item.get("endDate") or item.get("end_date")),
                "description": _as_str(item.get("description")),
                "bullets": _as_str_list(item.get("bullets") or item.get("bullet_points")),
            }
        )

    education_out: List[Dict[str, Any]] = []
    for item in source.get("education") or []:
        if not isinstance(item, dict):
            continue
        education_out.append(
            {
                "institution": _as_str(item.get("institution") or item.get("school_name")),
                "degree": _as_str(item.get("degree") or item.get("degree_type")),
                "field": _as_str(item.get("field") or item.get("major")),
                "startDate": _as_str(item.get("startDate")),
                "endDate": _as_str(item.get("endDate") or item.get("graduation_year")),
            }
        )

    projects_out: List[Dict[str, Any]] = []
    for item in source.get("projects") or []:
        if not isinstance(item, dict):
            continue
        projects_out.append(
            {
                "name": _as_str(item.get("name")),
                "description": _as_str(item.get("description")),
                "technologies": _as_str_list(item.get("technologies")),
            }
        )

    certifications = _as_str_list(source.get("certifications"))

    return {
        "skills": _dedupe_preserve(skills),
        "experience": experience_out,
        "education": education_out,
        "projects": projects_out,
        "certifications": certifications,
    }


def build_career_relevant_job(job: Any) -> Dict[str, Any]:
    source: Dict[str, Any] = {}
    if hasattr(job, "model_dump"):
        try:
            source = job.model_dump()
        except Exception:
            source = {}
    elif isinstance(job, dict):
        source = job

    return {
        "title": _as_str(source.get("title") or source.get("job_title")),
        "company": _as_str(source.get("company") or source.get("company_name")),
        "description": _as_str(source.get("description") or source.get("job_description")),
    }


def profile_has_career_signal(profile_payload: Dict[str, Any]) -> bool:
    return bool(
        profile_payload.get("skills")
        or profile_payload.get("experience")
        or profile_payload.get("education")
        or profile_payload.get("projects")
        or profile_payload.get("certifications")
    )


def build_job_match_prompts(
    profile_payload: Dict[str, Any],
    job_payload: Dict[str, Any],
) -> Tuple[str, str]:
    schema_example = {
        "matchScore": 0,
        "scoreComponents": {
            "requiredSkills": 0,
            "preferredSkills": 0,
            "experience": 0,
            "education": 0,
            "projects": 0,
            "keywords": 0,
        },
        "matchedSkills": [],
        "missingSkills": [],
        "matchedKeywords": [],
        "missingKeywords": [],
        "strengths": [],
        "gaps": [],
        "recommendations": [],
        "summary": "",
    }

    system_instructions = (
        "You are the resume-to-job match engine for Impulso. "
        "Compare the candidate career profile to the job posting and return JSON only.\n"
        "Rules:\n"
        "1. Use only evidence present in the provided profile and job description.\n"
        "2. Never invent skills, experience, education, projects, or certifications.\n"
        "3. matchedSkills may include only skills that appear in the candidate profile.\n"
        "4. missingSkills may include only skills explicitly requested by the job description "
        "and absent from the candidate profile.\n"
        "5. Separate hard skills from broader keywords. Put tools/languages/frameworks in skills; "
        "put softer or general terms in keywords.\n"
        "6. scoreComponents values must be integers from 0 to 100 for: "
        "requiredSkills, preferredSkills, experience, education, projects, keywords.\n"
        "7. matchScore should reflect overall fit from 0 to 100.\n"
        "8. recommendations must suggest truthful improvements only. "
        "Never tell the candidate to claim experience or skills they do not have.\n"
        "9. If the profile is thin or the job is vague, lower the score and explain gaps clearly.\n"
        "10. Return valid JSON only matching this structure:\n"
        f"{json.dumps(schema_example, indent=2)}"
    )

    user_submission = (
        "Candidate career profile (skills, experience, education, projects, certifications only):\n"
        f"{json.dumps(profile_payload, indent=2)}\n\n"
        "Job posting (title, company, description only):\n"
        f"{json.dumps(job_payload, indent=2)}"
    )
    return system_instructions, user_submission


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


def _clamp_score(value: Any, default: int = 0) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, number))


def _string_list_field(parsed: Dict[str, Any], key: str) -> List[str]:
    return _dedupe_preserve(_as_str_list(parsed.get(key)))


def compute_weighted_match_score(components: Dict[str, Any], fallback: int = 0) -> int:
    total_weight = 0.0
    weighted = 0.0
    for key, weight in SCORE_WEIGHTS.items():
        if key not in components:
            continue
        weighted += _clamp_score(components.get(key), 0) * weight
        total_weight += weight
    if total_weight <= 0:
        return _clamp_score(fallback, 0)
    return _clamp_score(weighted / total_weight, fallback)


def filter_matched_skills(skills: Sequence[str], profile_skills: Sequence[str]) -> List[str]:
    return _dedupe_preserve(
        [skill for skill in skills if skill_in_profile(skill, profile_skills)]
    )


def filter_missing_skills(
    skills: Sequence[str],
    *,
    job_text: str,
    profile_skills: Sequence[str],
) -> List[str]:
    out: List[str] = []
    for skill in skills:
        text = _as_str(skill)
        if not text:
            continue
        if skill_in_profile(text, profile_skills):
            continue
        if not skill_mentioned_in_text(text, job_text):
            continue
        out.append(text)
    return _dedupe_preserve(out)


def filter_keyword_list(keywords: Sequence[str], job_text: str) -> List[str]:
    return _dedupe_preserve(
        [item for item in keywords if skill_mentioned_in_text(item, job_text)]
    )


def sanitize_recommendations(items: Sequence[str]) -> List[str]:
    banned = re.compile(
        r"\b(add|invent|fabricate|claim|pretend|fake)\b.{0,40}\b(experience|skill|project|certification)s?\b",
        re.IGNORECASE,
    )
    out: List[str] = []
    for item in items:
        text = _as_str(item)
        if not text:
            continue
        if banned.search(text):
            continue
        out.append(text)
    return _dedupe_preserve(out)


def normalize_job_match_response(
    raw_text: str,
    provider_name: str,
    profile_payload: Dict[str, Any],
    job_payload: Dict[str, Any],
) -> Dict[str, Any]:
    if not raw_text or not str(raw_text).strip():
        return empty_job_match_result(
            status="error",
            message=f"{provider_name} returned an empty match response.",
        )

    candidate = _extract_json_object(str(raw_text))
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return empty_job_match_result(
            status="error",
            message=f"{provider_name} returned invalid JSON.",
        )

    if not isinstance(parsed, dict):
        return empty_job_match_result(
            status="error",
            message=f"{provider_name} returned JSON that was not an object.",
        )

    profile_skills = _profile_skill_set(profile_payload)
    job_text = _text_blob(
        [
            job_payload.get("title"),
            job_payload.get("company"),
            job_payload.get("description"),
        ]
    )

    components_raw = parsed.get("scoreComponents") or parsed.get("score_components") or {}
    if not isinstance(components_raw, dict):
        components_raw = {}
    components = {
        key: _clamp_score(components_raw.get(key), 0)
        for key in SCORE_WEIGHTS
    }

    ai_score = _clamp_score(parsed.get("matchScore", parsed.get("match_score", 0)), 0)
    match_score = compute_weighted_match_score(components, fallback=ai_score)
    if all(value == 0 for value in components.values()) and ai_score > 0:
        match_score = ai_score

    matched_skills = filter_matched_skills(
        _string_list_field(parsed, "matchedSkills")
        or _string_list_field(parsed, "matched_skills"),
        profile_skills,
    )
    missing_skills = filter_missing_skills(
        _string_list_field(parsed, "missingSkills")
        or _string_list_field(parsed, "missing_skills"),
        job_text=job_text,
        profile_skills=profile_skills,
    )

    matched_keywords = _dedupe_preserve(
        _string_list_field(parsed, "matchedKeywords")
        or _string_list_field(parsed, "matched_keywords")
    )
    missing_keywords = _dedupe_preserve(
        [
            item
            for item in (
                _string_list_field(parsed, "missingKeywords")
                or _string_list_field(parsed, "missing_keywords")
            )
            if skill_mentioned_in_text(item, job_text)
        ]
    )

    # Keep skills and keywords disjoint when possible.
    skill_keys = {item.lower() for item in matched_skills + missing_skills}
    matched_keywords = [item for item in matched_keywords if item.lower() not in skill_keys]
    missing_keywords = [item for item in missing_keywords if item.lower() not in skill_keys]

    strengths = _string_list_field(parsed, "strengths")
    gaps = _string_list_field(parsed, "gaps")
    recommendations = sanitize_recommendations(
        _string_list_field(parsed, "recommendations")
    )
    summary = _as_str(parsed.get("summary"))
    message = _as_str(parsed.get("message")) or f"Job match analyzed with {provider_name}."

    return {
        "status": "success",
        "matchScore": match_score,
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills,
        "matchedKeywords": matched_keywords,
        "missingKeywords": missing_keywords,
        "strengths": strengths,
        "gaps": gaps,
        "recommendations": recommendations,
        "summary": summary,
        "message": message,
    }


def incomplete_profile_match_result(job_payload: Dict[str, Any]) -> Dict[str, Any]:
    result = empty_job_match_result(
        status="success",
        message="Profile has little career evidence to evaluate against this job.",
        match_score=0,
    )
    result["gaps"] = [
        "Add skills, experience, education, or projects to improve match analysis."
    ]
    result["recommendations"] = [
        "Complete your master profile with real skills and experience before relying on match scores."
    ]
    result["summary"] = (
        f"Unable to score fit for {job_payload.get('title') or 'this role'} "
        "because the career profile is incomplete."
    )
    if job_payload.get("description"):
        result["missingKeywords"] = []
    return result
