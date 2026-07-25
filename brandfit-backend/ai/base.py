"""Shared AI provider interface and helpers for Impulso."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse


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


PLACEHOLDER_LINK_VALUES = {
    "portfolio",
    "link",
    "website",
    "github",
    "linkedin",
    "url",
    "http",
    "https",
    "www",
}


def build_resume_parse_prompts(
    resume_text: str,
    detected_links: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[str, str]:
    """Build reusable system and user prompts for resume parsing."""
    schema_example = json.dumps(empty_profile_draft(), indent=2)
    links_payload = detected_links or []
    system_instructions = (
        "You are the resume parsing engine for Impulso. "
        "Extract structured profile data from the resume text and the extracted hyperlink list. "
        "Rules:\n"
        "1. Extract only information explicitly present in the resume text or extracted hyperlinks.\n"
        "2. Never invent missing names, dates, employers, skills, technologies, or links.\n"
        "3. Never invent URLs. Only use URLs that appear in the resume text or extracted hyperlinks list.\n"
        "4. Never use placeholder values such as portfolio, link, website, or github as URLs.\n"
        "5. Prefer extracted hyperlink URLs over ambiguous visible labels.\n"
        "6. Extract EVERY clearly listed project. Each project object must include a non-empty name "
        "and a useful description when available, plus technologies explicitly mentioned for that project.\n"
        "7. For projects, set project.url only when the URL clearly matches that project "
        "via anchor text or project name. If unsure, leave project.url empty.\n"
        "8. Never emit blank project objects with empty name and empty description.\n"
        "9. Experience fields must be separated clearly:\n"
        "   - title = job title only\n"
        "   - company = employer only\n"
        "   - location = location only\n"
        "   - startDate/endDate = dates only\n"
        "   Never leave title empty when a job title is clearly visible near that role.\n"
        "   Never put the company, location, or dates inside the title field.\n"
        "10. For each project, populate technologies ONLY from that project's own title and description. "
        "Do not copy technologies from the global skills section or from other projects.\n"
        "11. Use a concise meaningful project title. Never use bullet fragments, incomplete sentences, "
        "or copied paragraph text as the project name.\n"
        "12. Preserve technical skills as individual items whenever the resume lists them separately "
        "(for example keep JavaScript and TypeScript separate unless written as one token).\n"
        "13. Keep experience bullets as separate strings in the bullets array when possible.\n"
        "14. If endDate is Present, Current, or Now, set isCurrent to true.\n"
        "15. Extract experience location only when clearly present. Never invent location.\n"
        "16. Use empty strings, empty arrays, or false when a value is not present.\n"
        "17. Return valid JSON only. No markdown fences or commentary.\n"
        "18. The JSON MUST match this structure exactly:\n"
        f"{schema_example}"
    )
    user_submission = (
        "Extracted hyperlinks (authoritative URI values when available):\n"
        f"{json.dumps(links_payload, indent=2)}\n\n"
        "Resume text:\n"
        f"{resume_text or ''}"
    )
    return system_instructions, user_submission


def _clean_field_text(value: Any) -> str:
    """Clean field text without rewriting meaning."""
    if value is None:
        return ""
    text = str(value).replace("\t", " ").strip()
    if not text:
        return ""
    try:
        from resume_parser import clean_extracted_text

        text = clean_extracted_text(text)
    except Exception:
        text = re.sub(r"\s+([,.;:!?)\]}])", r"\1", text)
        text = re.sub(r" {2,}", " ", text).strip()
    return text


def _normalize_job_title(title: str) -> str:
    """Normalize titles like 'Software Engineer- Temporary'."""
    value = _clean_field_text(title)
    if not value:
        return ""
    value = re.sub(
        r"([A-Za-z])\s*-\s*(Temporary|Contract|Intern(?:ship)?|Part[-\s]?Time|Full[-\s]?Time)\b",
        r"\1 - \2",
        value,
        flags=re.IGNORECASE,
    )
    return re.sub(r" {2,}", " ", value).strip()


_LOCATION_RE = re.compile(r"\b([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})\b")


def _extract_location_from_text(value: str) -> str:
    match = _LOCATION_RE.search(_as_str(value))
    return _as_str(match.group(1)) if match else ""


def _split_company_and_location(company: str, location: str) -> Tuple[str, str]:
    """If company embeds a City, ST value, separate it into location."""
    company = _as_str(company)
    location = _as_str(location)
    if location:
        # Still strip embedded location from company when duplicated.
        embedded = _extract_location_from_text(company)
        if embedded and embedded.lower() in company.lower():
            company = _as_str(company.replace(embedded, "").strip(" ,|-"))
        return company, location

    embedded = _extract_location_from_text(company)
    if not embedded:
        return company, ""
    company = _as_str(company.replace(embedded, "").strip(" ,|-"))
    return company, embedded


def _recover_location_from_resume(company: str, location: str, resume_text: str) -> str:
    """Extract a clearly available City, ST location near the company line."""
    current = _as_str(location)
    if current:
        return current
    company = _as_str(company)
    resume_text = resume_text or ""
    if not company:
        return ""

    # Company itself may already contain the location.
    embedded = _extract_location_from_text(company)
    if embedded:
        return embedded

    if not resume_text:
        return ""

    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    company_lower = company.lower()
    for index, line in enumerate(lines):
        if company_lower not in line.lower():
            continue
        window = " ".join(lines[max(0, index - 1) : min(len(lines), index + 3)])
        match = _LOCATION_RE.search(window)
        if match:
            return _as_str(match.group(1))
    return ""


def _as_str(value: Any) -> str:
    return _clean_field_text(value)


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


def _is_placeholder_url(value: str) -> bool:
    cleaned = _as_str(value).lower().rstrip("/")
    if not cleaned:
        return True
    if cleaned in PLACEHOLDER_LINK_VALUES:
        return True
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        remainder = cleaned.split("://", 1)[-1].strip("/")
        if remainder in PLACEHOLDER_LINK_VALUES:
            return True
        return False
    # Non-URL labels are invalid as URLs.
    if "/" not in cleaned and "." not in cleaned:
        return True
    return cleaned in PLACEHOLDER_LINK_VALUES


def _sanitize_url(value: str) -> str:
    url = _as_str(value)
    if not url or _is_placeholder_url(url):
        return ""
    return url


def _end_date_implies_current(end_date: str) -> bool:
    return _as_str(end_date).lower() in {"present", "current", "now"}


_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
    r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_DATE_TOKEN = rf"(?:{_MONTH}\.?\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
_DATE_RANGE_RE = re.compile(
    rf"(?i)\b(?:{_DATE_TOKEN})\s*(?:[-–—]|to)\s*(?:present|current|now|{_DATE_TOKEN})\b"
)

_TITLE_HINT_RE = re.compile(
    r"(?i)\b("
    r"engineer|developer|scientist|analyst|manager|intern|consultant|architect|"
    r"designer|specialist|lead|director|officer|administrator|programmer|"
    r"researcher|founder|co-?founder|owner|associate|coordinator|technician"
    r")\b"
)


def _strip_date_ranges(value: str) -> str:
    return _DATE_RANGE_RE.sub("", value or "").strip(" |-–—,;")


def _looks_like_title(value: str) -> bool:
    text = _as_str(value)
    if not text or len(text) > 80:
        return False
    if _DATE_RANGE_RE.search(text):
        return False
    return bool(_TITLE_HINT_RE.search(text))


def _split_combined_role_fields(
    title: str,
    company: str,
    location: str,
) -> Tuple[str, str, str]:
    """Separate title/company/location when the model merged them."""
    title = _as_str(title)
    company = _as_str(company)
    location = _as_str(location)

    title = _strip_date_ranges(title)
    company = _strip_date_ranges(company)

    # "Title at Company" / "Title | Company" / "Title - Company"
    if not title and company:
        for pattern in (
            r"^(?P<title>.+?)\s+(?:at|@)\s+(?P<company>.+)$",
            r"^(?P<title>.+?)\s*[|•·]\s*(?P<company>.+)$",
            r"^(?P<title>.+?)\s+[-–—]\s+(?P<company>.+)$",
        ):
            match = re.match(pattern, company, flags=re.IGNORECASE)
            if not match:
                continue
            maybe_title = _as_str(match.group("title"))
            maybe_company = _as_str(match.group("company"))
            if _looks_like_title(maybe_title):
                title = maybe_title
                company = maybe_company
                break

    # Title accidentally includes company: "Software Engineer, Acme Corp"
    if title and company and company.lower() in title.lower() and title.lower() != company.lower():
        trimmed = re.sub(re.escape(company), "", title, flags=re.IGNORECASE)
        trimmed = _as_str(re.sub(r"[\s,|•·/-]+$", "", trimmed))
        if _looks_like_title(trimmed):
            title = trimmed

    # Title accidentally includes location.
    if title and location and location.lower() in title.lower():
        trimmed = re.sub(re.escape(location), "", title, flags=re.IGNORECASE)
        trimmed = _as_str(re.sub(r"[\s,|•·/-]+$", "", trimmed))
        if trimmed:
            title = trimmed

    return title, company, location


def _recover_title_from_resume(
    title: str,
    company: str,
    resume_text: str,
) -> str:
    """Recover a visible job title near the company when title is empty."""
    title = _as_str(title)
    if title:
        return title

    company = _as_str(company)
    resume_text = resume_text or ""
    if not company or not resume_text:
        return ""

    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    company_lower = company.lower()

    for index, line in enumerate(lines):
        line_lower = line.lower()
        if company_lower not in line_lower:
            continue

        # Same line: "Software Engineer | Acme"
        if _looks_like_title(line) and line_lower != company_lower:
            same_line_title, _, _ = _split_combined_role_fields("", line, "")
            if same_line_title:
                return same_line_title

        # Previous non-empty line often holds the title.
        if index > 0:
            prev = _strip_date_ranges(lines[index - 1])
            if _looks_like_title(prev) and company_lower not in prev.lower():
                return prev

        # Next line fallback for layouts that put company first.
        if index + 1 < len(lines):
            nxt = _strip_date_ranges(lines[index + 1])
            if _looks_like_title(nxt) and company_lower not in nxt.lower():
                return nxt

    return ""


def _mention_exists(haystack: str, needle: str) -> bool:
    needle = _as_str(needle)
    haystack = haystack or ""
    if not needle or not haystack:
        return False
    # Do not treat '.' as a word character here; resumes often end tokens with
    # punctuation ("Python." / "React,"). Keep + # / for tech tokens like C++ and CI/CD.
    pattern = re.compile(
        r"(?<![A-Za-z0-9_+#/])" + re.escape(needle) + r"(?![A-Za-z0-9_+#/])",
        flags=re.IGNORECASE,
    )
    return bool(pattern.search(haystack))


def _split_tech_phrase(phrase: str, local_text: str) -> List[str]:
    """
    Split a tech phrase into individual skills only when local text supports it.
    Preserves explicit combined tokens like 'JavaScript/TypeScript' or 'CI/CD'.
    """
    phrase = _as_str(phrase)
    if not phrase:
        return []

    if "/" in phrase and _mention_exists(local_text, phrase):
        return [phrase]

    if "/" in phrase:
        parts = [_as_str(part) for part in phrase.split("/")]
        parts = [part for part in parts if part]
        if parts and all(_mention_exists(local_text, part) for part in parts):
            return parts
        if _mention_exists(local_text, phrase):
            return [phrase]

    return [phrase]


def _preserve_individual_skills(skills: List[str], resume_text: str) -> List[str]:
    preserved: List[str] = []
    for skill in skills or []:
        for part in _split_tech_phrase(skill, resume_text):
            if part and part not in preserved:
                preserved.append(part)
    return preserved


def _project_own_text(project: Dict[str, Any]) -> str:
    return "\n".join(
        part
        for part in (_as_str(project.get("name")), _as_str(project.get("description")))
        if part
    )


def _extract_project_technologies(project: Dict[str, Any]) -> List[str]:
    """Keep only technologies explicitly present in this project's title and description."""
    name = _as_str(project.get("name"))
    description = _as_str(project.get("description"))
    search_text = _project_own_text(project)
    if not search_text:
        return []

    candidates: List[str] = []
    for item in _as_str_list(project.get("technologies")):
        for part in _split_tech_phrase(item, search_text):
            if part and part not in candidates:
                candidates.append(part)

    for tech_line in re.finditer(
        r"(?i)\b(?:technologies|tech stack|built with|tools)\s*[:\-]\s*(.+)$",
        description,
        flags=re.MULTILINE,
    ):
        for part in re.split(r"[,;•·|]|\band\b", tech_line.group(1)):
            for token in _split_tech_phrase(part, search_text):
                if token and token not in candidates:
                    candidates.append(token)

    # Also allow tokens from the title itself when clearly present.
    selected: List[str] = []
    for candidate in candidates:
        if _mention_exists(search_text, candidate) and (
            _mention_exists(name, candidate) or _mention_exists(description, candidate)
        ):
            if candidate not in selected:
                selected.append(candidate)
    return selected


def _is_meaningful_project_name(name: str) -> bool:
    value = _as_str(name)
    if not value or len(value) < 3:
        return False
    if re.match(r"^[\d\.\)\-]+$", value):
        return False
    if re.match(r"(?i)^\d+(\.\d+)?%?\b", value):
        return False
    if value[:1].islower() and not value.startswith(("iOS", "e-")):
        return False
    if re.match(
        r"(?i)^(and|with|using|to|for|that|which|the|a|an|of|in|on|from|by|as)\b",
        value,
    ) and len(value.split()) <= 6:
        return False
    if re.search(r"(?i)\b(and|with|or|the|a|an|to|for|of)$", value):
        return False
    # Copied paragraph / bullet continuation heuristics.
    if value.count(",") >= 3 and len(value) > 120:
        return False
    if value.endswith(("...", "…")):
        return False
    return True


def _normalize_project_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", _as_str(name).lower())


def _description_similarity(left: str, right: str) -> float:
    left_words = {w for w in re.findall(r"[a-z0-9]+", _as_str(left).lower()) if len(w) > 2}
    right_words = {w for w in re.findall(r"[a-z0-9]+", _as_str(right).lower()) if len(w) > 2}
    if not left_words or not right_words:
        return 0.0
    intersection = len(left_words & right_words)
    union = len(left_words | right_words)
    return intersection / union if union else 0.0


def _project_completeness(project: Dict[str, Any]) -> int:
    score = 0
    if _as_str(project.get("name")):
        score += 3
    if _as_str(project.get("description")):
        score += 2 + min(len(_as_str(project.get("description"))), 200) // 40
    score += len(_as_str_list(project.get("technologies")))
    if _sanitize_url(project.get("url", "")):
        score += 2
    return score


def _is_blank_project(project: Dict[str, Any]) -> bool:
    return not _as_str(project.get("name"))


def _description_belongs_to_project(project: Dict[str, Any], all_projects: List[Dict[str, Any]]) -> bool:
    name = _as_str(project.get("name"))
    description = _as_str(project.get("description"))
    if not description:
        return True
    if not name:
        return False

    # Reject descriptions that clearly belong to another project title.
    for other in all_projects:
        other_name = _as_str(other.get("name"))
        if not other_name or other_name.lower() == name.lower():
            continue
        if description.lower().startswith(other_name.lower()):
            return False
        if _normalize_project_key(other_name) and _normalize_project_key(other_name) in _normalize_project_key(
            description
        ):
            # If another full project title appears as the description lead-in, reject.
            if description.lower().find(other_name.lower()) == 0:
                return False
    return True


def _repo_name_from_url(url: str) -> str:
    parsed = urlparse(_sanitize_url(url))
    parts = [part for part in (parsed.path or "").split("/") if part]
    if not parts:
        return ""
    return _as_str(parts[-1].replace("-", " ").replace("_", " "))


def _link_matches_project(link: Dict[str, Any], project: Dict[str, Any]) -> bool:
    url = _as_str(link.get("url")).lower()
    anchor = _as_str(link.get("anchor_text")).lower()
    name = _as_str(project.get("name")).lower()
    if not url or not name:
        return False

    compact_name = re.sub(r"[^a-z0-9]+", "", name)
    compact_anchor = re.sub(r"[^a-z0-9]+", "", anchor)
    compact_url = re.sub(r"[^a-z0-9]+", "", url)

    if compact_name and compact_name in compact_anchor:
        return True
    if compact_name and len(compact_name) >= 4 and compact_name in compact_url:
        return True

    repo = url.rstrip("/").split("/")[-1]
    compact_repo = re.sub(r"[^a-z0-9]+", "", repo)
    if compact_name and compact_repo and (
        compact_name == compact_repo
        or compact_name in compact_repo
        or compact_repo in compact_name
    ):
        return True
    return False


def _merge_project_from_block(project: Dict[str, Any], block: Dict[str, str]) -> None:
    if not _as_str(project.get("name")) and block.get("name"):
        project["name"] = _as_str(block.get("name"))
    if not _as_str(project.get("description")) and block.get("description"):
        project["description"] = _as_str(block.get("description"))


def _recover_projects_from_resume(
    draft: Dict[str, Any],
    resume_text: str,
    detected_links: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    """
    Restore missing project names/descriptions using Projects-section order.
    Never creates blank project objects.
    """
    warnings: List[str] = []
    try:
        from resume_parser import extract_project_blocks
    except Exception:
        extract_project_blocks = None  # type: ignore

    blocks = extract_project_blocks(resume_text) if extract_project_blocks else []
    projects = [p for p in (draft.get("projects") or []) if isinstance(p, dict)]

    # Fill incomplete AI projects from ordered resume blocks.
    for index, project in enumerate(projects):
        if index < len(blocks):
            _merge_project_from_block(project, blocks[index])

    # If AI missed projects that are clearly listed, append recovered blocks.
    existing_names = {
        re.sub(r"[^a-z0-9]+", "", _as_str(p.get("name")).lower())
        for p in projects
        if _as_str(p.get("name"))
    }
    for block in blocks:
        block_name = _as_str(block.get("name"))
        key = re.sub(r"[^a-z0-9]+", "", block_name.lower()) if block_name else ""
        if key and key in existing_names:
            continue
        if not block_name and not _as_str(block.get("description")):
            continue
        # Avoid duplicates when name is empty but description already captured.
        if not key:
            desc = _as_str(block.get("description")).lower()
            if any(_as_str(p.get("description")).lower() == desc for p in projects if desc):
                continue
        if not _is_meaningful_project_name(block_name):
            continue
        projects.append(
            {
                "name": block_name,
                "description": _as_str(block.get("description")),
                "technologies": [],
                "url": "",
            }
        )
        if key:
            existing_names.add(key)

    # Match project hyperlinks by name first, then by section order.
    links = [link for link in (detected_links or []) if isinstance(link, dict)]
    project_links = [l for l in links if l.get("classification") == "project"]
    used_urls = {
        _sanitize_url(p.get("url", "")).lower()
        for p in projects
        if _sanitize_url(p.get("url", ""))
    }

    for project in projects:
        if _sanitize_url(project.get("url", "")):
            continue
        matches = [
            link
            for link in project_links
            if _sanitize_url(link.get("url", ""))
            and _sanitize_url(link.get("url", "")).lower() not in used_urls
            and _link_matches_project(link, project)
        ]
        if len(matches) == 1:
            url = _sanitize_url(matches[0].get("url", ""))
            project["url"] = url
            used_urls.add(url.lower())
            if not _as_str(project.get("name")):
                project["name"] = _as_str(matches[0].get("anchor_text")) or _repo_name_from_url(url)

    # Ordered fallback for remaining project links <-> projects missing URLs.
    projects_needing_url = [p for p in projects if not _sanitize_url(p.get("url", ""))]
    unmatched_links = [
        link
        for link in project_links
        if _sanitize_url(link.get("url", ""))
        and _sanitize_url(link.get("url", "")).lower() not in used_urls
    ]
    for project, link in zip(projects_needing_url, unmatched_links):
        url = _sanitize_url(link.get("url", ""))
        if not url:
            continue
        project["url"] = url
        used_urls.add(url.lower())
        if not _as_str(project.get("name")):
            recovered = _as_str(link.get("anchor_text")) or _repo_name_from_url(url)
            if recovered:
                project["name"] = recovered
            elif blocks:
                # Keep section order alignment without creating a new blank object.
                for block in blocks:
                    block_name = _as_str(block.get("name"))
                    if block_name and not any(
                        _as_str(p.get("name")).lower() == block_name.lower() for p in projects
                    ):
                        project["name"] = block_name
                        if not _as_str(project.get("description")):
                            project["description"] = _as_str(block.get("description"))
                        break

    draft["projects"] = projects

    if blocks and not any(not _is_blank_project(p) for p in projects):
        warnings.append(
            "Projects were detected in the resume text but could not be structured."
        )
    elif blocks and len([p for p in projects if not _is_blank_project(p)]) < len(blocks):
        warnings.append(
            "Some projects were detected in the resume text but could not be fully structured."
        )

    return warnings


def refine_profile_draft(
    draft: Dict[str, Any],
    resume_text: Optional[str] = None,
    detected_links: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, Any], List[str]]:
    """Post-process titles/projects/technologies using resume text evidence only."""
    warnings: List[str] = []
    resume_text = resume_text or ""
    skills = _preserve_individual_skills(_as_str_list(draft.get("skills")), resume_text)

    for item in draft.get("experience") or []:
        title, company, location = _split_combined_role_fields(
            item.get("title", ""),
            item.get("company", ""),
            item.get("location", ""),
        )
        if not title:
            title = _recover_title_from_resume(title, company, resume_text)
        title = _normalize_job_title(title)
        company, location = _split_company_and_location(company, location)
        if not location:
            location = _recover_location_from_resume(company, location, resume_text)
        item["title"] = title
        item["company"] = company
        item["location"] = location
        item["description"] = _as_str(item.get("description"))
        item["bullets"] = [_as_str(b) for b in (item.get("bullets") or []) if _as_str(b)]
        item["startDate"] = _as_str(item.get("startDate"))
        item["endDate"] = _as_str(item.get("endDate"))
        if _end_date_implies_current(item["endDate"]):
            item["isCurrent"] = True

    warnings.extend(_recover_projects_from_resume(draft, resume_text, detected_links))

    for project in draft.get("projects") or []:
        project["name"] = _as_str(project.get("name"))
        project["description"] = _as_str(project.get("description"))
        project["url"] = _sanitize_url(project.get("url", ""))
        project["technologies"] = _extract_project_technologies(project)

    draft["skills"] = skills
    return draft, warnings


def _dedupe_projects(projects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique: List[Dict[str, Any]] = []
    for project in projects:
        name_key = _normalize_project_key(project.get("name", ""))
        merged = False
        for index, existing in enumerate(unique):
            existing_key = _normalize_project_key(existing.get("name", ""))
            same_name = bool(name_key and existing_key and name_key == existing_key)
            similar_desc = _description_similarity(
                project.get("description", ""),
                existing.get("description", ""),
            ) >= 0.72
            if same_name or (
                similar_desc
                and name_key
                and existing_key
                and (name_key in existing_key or existing_key in name_key)
            ):
                # Keep the richer project entry.
                if _project_completeness(project) > _project_completeness(existing):
                    # Prefer non-empty fields from the winner, fill gaps from loser.
                    winner = dict(project)
                    for key in ("description", "url"):
                        if not _as_str(winner.get(key)) and _as_str(existing.get(key)):
                            winner[key] = existing.get(key)
                    if not winner.get("technologies") and existing.get("technologies"):
                        winner["technologies"] = existing.get("technologies")
                    unique[index] = winner
                else:
                    if not _as_str(existing.get("description")) and _as_str(project.get("description")):
                        existing["description"] = project.get("description")
                    if not _sanitize_url(existing.get("url", "")) and _sanitize_url(project.get("url", "")):
                        existing["url"] = project.get("url")
                    if not existing.get("technologies") and project.get("technologies"):
                        existing["technologies"] = project.get("technologies")
                merged = True
                break
        if not merged:
            unique.append(project)
    return unique


def validate_and_cleanup_projects(
    draft: Dict[str, Any],
    resume_text: Optional[str] = None,
) -> List[str]:
    """
    Final project validation:
    - require meaningful project names
    - drop fragments/duplicates
    - keep technologies as a subset of each project's own text
    """
    warnings: List[str] = []
    resume_text = resume_text or ""
    projects = [p for p in (draft.get("projects") or []) if isinstance(p, dict)]

    validated: List[Dict[str, Any]] = []
    for project in projects:
        project["name"] = _as_str(project.get("name"))
        project["description"] = _as_str(project.get("description"))
        project["url"] = _sanitize_url(project.get("url", ""))
        project["technologies"] = _extract_project_technologies(project)

        if not _is_meaningful_project_name(project.get("name", "")):
            continue
        if not _description_belongs_to_project(project, projects):
            # Keep the project name/url, drop mismatched description rather than inventing.
            project["description"] = ""
            project["technologies"] = _extract_project_technologies(project)
        validated.append(project)

    cleaned = _dedupe_projects(validated)
    # Ensure technologies remain local after merges.
    for project in cleaned:
        project["technologies"] = _extract_project_technologies(project)

    draft["projects"] = cleaned

    try:
        from resume_parser import extract_project_blocks

        blocks = extract_project_blocks(resume_text)
    except Exception:
        blocks = []

    if blocks and not cleaned:
        warnings.append(
            "Projects were detected in the resume text but could not be structured."
        )
    return warnings

def apply_detected_links(
    draft: Dict[str, Any],
    detected_links: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Deterministically enrich a profile draft using extracted hyperlinks.
    Never invents URLs that were not detected. Never creates blank projects.
    """
    warnings: List[str] = []
    links = [link for link in (detected_links or []) if isinstance(link, dict)]
    valid_urls = {
        _sanitize_url(_as_str(link.get("url")))
        for link in links
        if _sanitize_url(_as_str(link.get("url")))
    }

    # Drop invented / placeholder URLs from AI output.
    for key in ("linkedin", "github", "portfolio"):
        current = _sanitize_url(draft.get("links", {}).get(key, ""))
        if current and current not in valid_urls and not any(
            current.lower() == url.lower() for url in valid_urls
        ):
            draft["links"][key] = ""
        else:
            draft["links"][key] = current

    for project in draft.get("projects") or []:
        project_url = _sanitize_url(project.get("url", ""))
        if project_url and not any(project_url.lower() == url.lower() for url in valid_urls):
            # Keep AI URL only when it matches an extracted hyperlink.
            project["url"] = ""
        else:
            project["url"] = project_url

    linkedin_links = [l for l in links if l.get("classification") == "linkedin"]
    github_links = [l for l in links if l.get("classification") == "github"]
    portfolio_links = [l for l in links if l.get("classification") == "portfolio"]
    project_links = [l for l in links if l.get("classification") == "project"]

    if not draft["links"].get("linkedin") and linkedin_links:
        draft["links"]["linkedin"] = _sanitize_url(linkedin_links[0].get("url", ""))
    if not draft["links"].get("github") and github_links:
        draft["links"]["github"] = _sanitize_url(github_links[0].get("url", ""))
    if not draft["links"].get("portfolio") and portfolio_links:
        draft["links"]["portfolio"] = _sanitize_url(portfolio_links[0].get("url", ""))

    used_project_urls = {
        _sanitize_url(p.get("url", "")).lower()
        for p in (draft.get("projects") or [])
        if _sanitize_url(p.get("url", ""))
    }

    for project in draft.get("projects") or []:
        if project.get("url"):
            continue

        matches = [
            link
            for link in project_links
            if _sanitize_url(link.get("url", ""))
            and _sanitize_url(link.get("url", "")).lower() not in used_project_urls
            and _link_matches_project(link, project)
        ]
        if len(matches) == 1:
            matched_url = _sanitize_url(matches[0].get("url", ""))
            project["url"] = matched_url
            used_project_urls.add(matched_url.lower())
            if not _as_str(project.get("name")):
                project["name"] = (
                    _as_str(matches[0].get("anchor_text"))
                    or _repo_name_from_url(matched_url)
                )
        elif len(matches) > 1:
            warnings.append(
                f"Multiple possible links found for project '{project.get('name', '')}'; left project.url empty."
            )

    # Section-order fallback for remaining project links.
    projects_needing_url = [
        p for p in (draft.get("projects") or []) if not _sanitize_url(p.get("url", ""))
    ]
    unmatched_links = [
        link
        for link in project_links
        if _sanitize_url(link.get("url", ""))
        and _sanitize_url(link.get("url", "")).lower() not in used_project_urls
    ]
    for project, link in zip(projects_needing_url, unmatched_links):
        url = _sanitize_url(link.get("url", ""))
        if not url:
            continue
        project["url"] = url
        used_project_urls.add(url.lower())
        if not _as_str(project.get("name")):
            project["name"] = _as_str(link.get("anchor_text")) or _repo_name_from_url(url)

    still_unmatched = [
        link
        for link in unmatched_links
        if _sanitize_url(link.get("url", "")).lower() not in used_project_urls
    ]
    for link in still_unmatched:
        warnings.append(
            f"Detected project/demo link could not be matched confidently: {link.get('url')}"
        )

    return draft, warnings


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
        "linkedin": _sanitize_url(links_in.get("linkedin")),
        "github": _sanitize_url(links_in.get("github")),
        "portfolio": _sanitize_url(links_in.get("portfolio")),
    }

    experience_out: List[Dict[str, Any]] = []
    for item in raw_draft.get("experience") or []:
        if not isinstance(item, dict):
            continue
        end_date = _as_str(item.get("endDate"))
        is_current = _as_bool(item.get("isCurrent")) or _end_date_implies_current(end_date)
        experience_out.append(
            {
                "company": _as_str(item.get("company")),
                "title": _as_str(item.get("title")),
                "location": _as_str(item.get("location")),
                "startDate": _as_str(item.get("startDate")),
                "endDate": end_date,
                "isCurrent": is_current,
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
        project = {
            "name": _as_str(item.get("name")),
            "description": _as_str(item.get("description")),
            "technologies": _as_str_list(item.get("technologies")),
            "url": _sanitize_url(item.get("url")),
        }
        if _is_blank_project(project):
            continue
        projects_out.append(project)
    draft["projects"] = projects_out

    draft["skills"] = _as_str_list(raw_draft.get("skills"))
    draft["certifications"] = _as_str_list(raw_draft.get("certifications"))
    return draft


def normalize_resume_parse_response(
    raw_text: str,
    provider_name: str,
    detected_links: Optional[List[Dict[str, Any]]] = None,
    resume_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse provider text into a resume parse result payload."""
    if not raw_text or not str(raw_text).strip():
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "warnings": [],
            "message": f"{provider_name} returned an empty response.",
        }

    candidate = _extract_json_object(str(raw_text))
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "warnings": [],
            "message": f"{provider_name} returned invalid JSON.",
        }

    if not isinstance(parsed, dict):
        return {
            "status": "error",
            "profile_draft": empty_profile_draft(),
            "warnings": [],
            "message": f"{provider_name} returned JSON that was not an object.",
        }

    # Allow either a wrapped object or a bare draft.
    if "personal" in parsed or "experience" in parsed or "skills" in parsed:
        draft_source = parsed
    elif isinstance(parsed.get("profile_draft"), dict):
        draft_source = parsed["profile_draft"]
    else:
        draft_source = parsed

    draft = normalize_profile_draft(draft_source)
    draft, refine_warnings = refine_profile_draft(
        draft,
        resume_text=resume_text,
        detected_links=detected_links,
    )
    draft, link_warnings = apply_detected_links(draft, detected_links)
    cleanup_warnings = validate_and_cleanup_projects(draft, resume_text=resume_text)

    # Recompute technologies after link/name recovery using each project's own text only.
    for project in draft.get("projects") or []:
        project["technologies"] = _extract_project_technologies(project)

    # Final deterministic pass: detected_links win over AI URL variants; repair emails.
    try:
        from resume_parser import finalize_parsed_profile

        draft = finalize_parsed_profile(draft, detected_links=detected_links)
    except Exception:
        pass

    warnings: List[str] = []
    for warning in refine_warnings + link_warnings + cleanup_warnings:
        if warning and warning not in warnings:
            warnings.append(warning)

    return {
        "status": "success",
        "profile_draft": draft,
        "warnings": warnings,
        "message": "Resume parsed successfully.",
    }


class AIProvider(ABC):
    """Common interface for Impulso AI providers."""

    @abstractmethod
    def analyze_job(self, profile: Any, job_description: str) -> Dict[str, Any]:
        """Analyze a job description against a user profile."""

    @abstractmethod
    def parse_resume(
        self,
        resume_text: str,
        detected_links: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Parse resume text into a structured profile draft."""


class AIProviderError(Exception):
    """Raised for provider configuration or runtime failures."""
