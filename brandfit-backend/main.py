from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from ai import get_ai_provider
from ai.base import AIProvider, AIProviderError, empty_profile_draft
from resume_parser import ResumeExtractionError, extract_resume_text

load_dotenv()

app = FastAPI(title="Impulso Core AI Engine")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Impulso Core AI Engine",
    }


# Configure CORS to accept extension requests seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NEW EXPANDED SUB-MODELS FOR COMPLEX RECRUITING FORMS ---


class ContactAndLocation(BaseModel):
    phone_number: str
    street_address: str
    city: str
    state: str
    zip_code: str
    country: str
    portfolio_url: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    github_url: Optional[str] = ""
    twitter_url: Optional[str] = ""


class EeocDemographics(BaseModel):
    gender: str            # Male, Female, Non-Binary, Decline to Self-Identify
    race_ethnicity: str    # Asian, Black, White, Hispanic, Two or More, Decline to Identify
    veteran_status: str    # Protected Veteran, Not a Veteran, Decline to Identify
    disability_status: str  # Yes I Have a Disability, No, Decline to Identify


class WorkAuthorization(BaseModel):
    is_legally_authorized: bool        # "Are you legally authorized to work in the US?"
    will_require_sponsorship: bool      # "Will you now or in the future require visa sponsorship?"
    current_visa_status: Optional[str] = "None"  # STEM OPT, H1-B, CPT, None


class EducationHistory(BaseModel):
    school_name: str
    degree_type: str                    # Bachelors, Masters, PhD, High School
    major: str
    gpa: Optional[float] = None
    graduation_year: str


class WorkExperienceItem(BaseModel):
    company_name: str
    job_title: str
    start_date: str
    end_date: str                       # e.g., "Present" or "August 2025"
    bullet_points: List[str]            # Storing original strings for the AI to tailor later


# --- THE MASTER USER PROFILE CONTRACT ---


class FullMasterProfile(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    contact: ContactAndLocation
    demographics: EeocDemographics
    legal_authorization: WorkAuthorization
    education: List[EducationHistory]
    experience: List[WorkExperienceItem]
    skills_inventory: List[str]          # Technical stacks like ["Python", "React", "FastAPI"]


# Lightweight profile used by the current side-panel optimize request
class LightweightUserProfile(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


# Consolidated incoming request structure expected from extension sidepanel
class OptimizeRequest(BaseModel):
    user_profile: LightweightUserProfile
    job_description: str


@app.post("/api/v1/optimize-resume")
async def optimize_resume(payload: OptimizeRequest):
    if not payload.job_description or not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description text is completely empty.")

    print(f"Job description length: {len(payload.job_description)} characters")

    try:
        provider_or_status, provider_name = get_ai_provider()
    except AIProviderError as exc:
        print(f"AI provider initialization error: {exc}")
        return {
            "status": "error",
            "keywords": [],
            "optimized_data": "",
            "message": str(exc),
        }

    if not isinstance(provider_or_status, AIProvider):
        print(f"AI provider unavailable ({provider_name}): {provider_or_status.get('message')}")
        return provider_or_status

    try:
        result = provider_or_status.analyze_job(payload.user_profile, payload.job_description)
        return result
    except Exception as error_context:
        print(f"CRITICAL BACKEND ERROR: {error_context}")
        return {
            "status": "error",
            "keywords": [],
            "optimized_data": "",
            "message": str(error_context),
        }


@app.post("/api/v1/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    file_bytes = await file.read()
    print(
        "Resume parse request received "
        f"(bytes={len(file_bytes)}, content_type={file.content_type or 'unknown'})"
    )

    try:
        extracted = extract_resume_text(file.filename, file.content_type, file_bytes)
    except ResumeExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Resume extraction failure: {type(exc).__name__}")
        raise HTTPException(
            status_code=400,
            detail="Failed to extract text from the uploaded resume.",
        ) from exc

    warnings = list(extracted.warnings)
    detected_links = extracted.detected_link_dicts
    print(
        f"Resume text extracted (characters={extracted.character_count}, "
        f"links={len(detected_links)})"
    )

    try:
        provider_or_status, provider_name = get_ai_provider()
    except AIProviderError as exc:
        print(f"AI provider initialization error: {exc}")
        return {
            "status": "error",
            "file_name": extracted.file_name,
            "character_count": extracted.character_count,
            "profile_draft": empty_profile_draft(),
            "detected_links": detected_links,
            "warnings": warnings,
            "message": str(exc),
        }

    if not isinstance(provider_or_status, AIProvider):
        status = provider_or_status.get("status", "error")
        message = provider_or_status.get("message", "AI provider unavailable.")
        print(f"AI provider unavailable ({provider_name}): configuration issue")
        return {
            "status": status,
            "file_name": extracted.file_name,
            "character_count": extracted.character_count,
            "profile_draft": {},
            "detected_links": detected_links,
            "warnings": warnings,
            "message": message,
        }

    try:
        parse_result = provider_or_status.parse_resume(
            extracted.ai_text,
            detected_links=detected_links,
        )
    except Exception as error_context:
        print(f"CRITICAL RESUME PARSE ERROR: {type(error_context).__name__}")
        return {
            "status": "error",
            "file_name": extracted.file_name,
            "character_count": extracted.character_count,
            "profile_draft": empty_profile_draft(),
            "detected_links": detected_links,
            "warnings": warnings,
            "message": "Resume parsing failed due to an unexpected provider error.",
        }

    warnings.extend(parse_result.get("warnings") or [])

    status = parse_result.get("status", "error")
    if status != "success":
        return {
            "status": status,
            "file_name": extracted.file_name,
            "character_count": extracted.character_count,
            "profile_draft": parse_result.get("profile_draft") or empty_profile_draft(),
            "detected_links": detected_links,
            "warnings": warnings,
            "message": parse_result.get("message") or "Resume parsing failed.",
        }

    return {
        "status": "success",
        "file_name": extracted.file_name,
        "character_count": extracted.character_count,
        "profile_draft": parse_result.get("profile_draft") or empty_profile_draft(),
        "detected_links": detected_links,
        "warnings": warnings,
        "message": parse_result.get("message") or "Resume parsed successfully.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
