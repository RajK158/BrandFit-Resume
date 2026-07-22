// URL pointing to the local FastAPI optimize endpoint
const CENTRAL_WEB_APP_URL = "http://127.0.0.1:8000/api/v1/optimize-resume";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial State Hydration from local sync storage
  chrome.storage.local.get(['firstName', 'lastName', 'email'], (data) => {
    if (data.firstName) document.getElementById('firstName').value = data.firstName;
    if (data.lastName) document.getElementById('lastName').value = data.lastName;
    if (data.email) document.getElementById('email').value = data.email;
  });
});

// 2. Profile Cache Updates
document.getElementById('saveBtn').addEventListener('click', () => {
  chrome.storage.local.set({
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value
  }, () => {
    alert('Profile cached!');
  });
});

// 3. Bulletproof Job Description Extraction Engine (Forced Injection Protocol)
document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const statusBox = document.getElementById('jdStatus');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  statusBox.innerText = "🔍 Parsing webpage DOM...";

  // Force execute script parameters directly on the active window frame context
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selectors = [
        '#main',
        '#content',
        '[class*="description"]',
        '[id*="description"]',
        '#job-details',
        '.job-body',
        'article'
      ];

      let foundText = "";
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim().length > 200) {
          foundText = el.innerText;
          break;
        }
      }

      // ATS Form Fallback optimization (Greenhouse / Lever scraper variant)
      if (!foundText || foundText.length < 300) {
        const bodyClone = document.body.cloneNode(true);
        // Clean up interactive and structural nodes to shield raw description metrics
        bodyClone.querySelectorAll('script, style, nav, footer, input, button, label').forEach(el => el.remove());
        foundText = bodyClone.innerText;
      }

      return foundText.replace(/\s+/g, ' ').trim();
    }
  }, (results) => {
    if (results && results[0] && results[0].result) {
      const extractedJD = results[0].result;
      statusBox.innerText = extractedJD.substring(0, 300) + "...";
      chrome.storage.local.set({ currentJobDescription: extractedJD });
    } else {
      statusBox.innerText = "❌ Extraction failed. Ensure you are on an active job page.";
    }
  });
});

// 4. Form Filling Orchestration Call
document.getElementById('fillBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// 5. Keyword Tuning and Server Pipeline Exchange
document.getElementById('optimizeBtn').addEventListener('click', async () => {
  const statusBox = document.getElementById('jdStatus');

  chrome.storage.local.get(['currentJobDescription', 'firstName', 'lastName', 'email'], async (data) => {
    const firstName = (data.firstName || "").trim();
    const lastName = (data.lastName || "").trim();
    const email = (data.email || "").trim();
    const jobDescription = (data.currentJobDescription || "").trim();

    const missing = [];
    if (!firstName) missing.push("first name");
    if (!lastName) missing.push("last name");
    if (!email) missing.push("email");
    if (!jobDescription) missing.push("job description");

    if (missing.length > 0) {
      statusBox.innerText =
        "⚠️ Missing required data: " + missing.join(", ") +
        ". Save your profile and extract a job description before optimizing.";
      return;
    }

    statusBox.innerText = "🔄 Connecting to BrandResume Web App to optimize keywords...";

    const payload = {
      user_profile: {
        first_name: firstName,
        last_name: lastName,
        email: email
      },
      job_description: jobDescription
    };

    try {
      const response = await fetch(CENTRAL_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let result;
      try {
        result = await response.json();
      } catch (_) {
        statusBox.innerText = "❌ Backend returned an invalid response.";
        return;
      }

      if (!response.ok) {
        const detail = result.detail || result.message || `HTTP ${response.status}`;
        statusBox.innerText = `❌ Error: ${detail}`;
        return;
      }

      if (result.status === "dev_mode") {
        statusBox.innerText =
          "⚠️ OPENAI_API_KEY is not configured. " +
          (result.message || "Set the key in brandfit-backend/.env and restart the server.");
        return;
      }

      if (result.status === "error") {
        statusBox.innerText = `❌ Error: ${result.message || "Optimization failed."}`;
        return;
      }

      if (result.status === "success") {
        const keywords = Array.isArray(result.keywords) ? result.keywords : [];
        const optimizedData = result.optimized_data || "";

        chrome.storage.local.set({
          optimizedResumeData: optimizedData,
          tailoredKeywords: keywords
        }, () => {
          const advice = optimizedData ? ` ${optimizedData}` : "";
          statusBox.innerText =
            `✅ Success! Matched ${keywords.length} critical keywords.${advice}`;
          console.log("BrandResume Match Engine Results:", result);
        });
        return;
      }

      statusBox.innerText = `❌ Unexpected backend status: ${result.status || "unknown"}`;
    } catch (error) {
      console.error("Backend request failed:", error);
      statusBox.innerText = "Backend is unavailable. Start the FastAPI server and try again.";
    }
  });
});
