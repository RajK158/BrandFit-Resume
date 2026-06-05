import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI(title="BrandResume Core AI Engine")

# Crucial: Allow your Chrome Extension to communicate with localhost without CORS blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits extensions to hit the endpoint safely
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the incoming data contracts matching your sidepanel payload
class UserProfile(BaseModel):
    first_name: str
    last_name: str
    email: str

class OptimizeRequest(BaseModel):
    user_profile: UserProfile
    job_description: str

# Initialize OpenAI Client (Make sure to set your OS environment variable: export OPENAI_API_KEY="sk-...")
# You can easily swap this client out for Anthropic, Ollama, or any LLM wrapper later
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-fallback-key-here"))

@app.post("/api/v1/optimize-resume")
async def optimize_resume(payload: OptimizeRequest):
    if not payload.job_description:
        raise HTTPException(status_code=400, detail="Missing target job description text body.")

    try:
        # System instructions to extract keywords and optimize descriptions like JobRight
        system_prompt = (
            "You are the core AI matching engine for BrandResume. Your job is to analyze the provided "
            "job description and extract critical tech stack keywords, framework proficiencies, and soft skills. "
            "Then, output a clean JSON response containing an array of 'keywords' and a string of 'optimized_data' "
            "offering targeted bullet-point adjustment advice for the user's experience section."
        )

        user_content = f"Job Description:\n{payload.job_description}"

        # Call a lightweight, fast model to keep the extension interface snappy
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", content: system_prompt},
                {"role": "user", content: user_content}
            ],
            temperature=0.3,
            # Force the model to return structured JSON to ensure data contracts never break
            response_format={"type": "json_object"}
        )

        # Parse output safely back down to the chrome sidepanel runtime
        import json
        ai_raw_output = response.choices[0].message.content
        structured_data = json.loads(ai_raw_output)

        return {
            "status": "success",
            "keywords": structured_data.get("keywords", ["React", "Python", "REST APIs"]),
            "optimized_data": structured_data.get("optimized_data", "Tailored experience baseline details.")
        }

    except Exception as e:
        print(f"Internal Optimization Breakdown: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Optimization Pipeline Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Start the local development server on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)