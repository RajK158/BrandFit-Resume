import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from openai import OpenAI

app = FastAPI(title="BrandResume Core AI Engine")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "BrandResume Core AI Engine"
    }
# Configure CORS to accept extension requests seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

# Consolidated incoming request structure expected from extension sidepanel
class OptimizeRequest(BaseModel):
    user_profile: FullMasterProfile
    job_description: str

# Initialize OpenAI Client securely
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-fallback-key-here"))

@app.post("/api/v1/optimize-resume")
async def optimize_resume(payload: OptimizeRequest):
    if not payload.job_description:
        raise HTTPException(status_code=400, detail="Job description text is completely empty.")

    print(f"📥 Received data for applicant: {payload.user_profile.first_name} {payload.user_profile.last_name}")
    print(f"📝 Job description length: {len(payload.job_description)} characters")

    # If the user hasn't set up an OpenAI key yet, catch the crash gracefully and run Local Dev Mode
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your-fallback-key-here":
        print("⚠️ [Dev Sandbox Mode]: Running pure Python backup loop because OPENAI_API_KEY is not set.")
        return {
            "status": "success",
            "keywords": ["React", "Python", "REST APIs", "FastAPI", "Automation Engine"],
            "optimized_data": "Tailored baseline suggestions from your local Python server dev mode."
        }

    try:
        system_instructions = (
            "You are the backend parsing engine for BrandResume. Analyze the incoming job description. "
            "Extract critical tech stack keywords, framework proficiencies, and professional skills. "
            "You MUST reply only with a valid JSON object matching this structure exactly:\n"
            "{\n"
            "  \"keywords\": [\"keyword1\", \"keyword2\"],\n"
            "  \"optimized_data\": \"Advice string here\"\n"
            "}"
        )

        user_submission = f"Job Description:\n{payload.job_description}"

        # Execute completion request
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", content: system_instructions},
                {"role": "user", content: user_submission}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        # Safely capture response string without variable collision
        raw_json_text = completion.choices[0].message.content
        parsed_response = json.loads(raw_json_text)

        return {
            "status": "success",
            "keywords": parsed_response.get("keywords", ["React", "Python", "REST APIs"]),
            "optimized_data": parsed_response.get("optimized_data", "Tailored baseline suggestions.")
        }

    except Exception as error_context:
        print(f"CRITICAL BACKEND ERROR: {str(error_context)}")
        raise HTTPException(status_code=500, detail=str(error_context))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)