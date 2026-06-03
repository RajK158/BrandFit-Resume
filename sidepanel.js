// URL pointing to your future central web platform API endpoint
const CENTRAL_WEB_APP_URL = "http://localhost:8000/api/v1/optimize-resume"; 

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
    if (!data.currentJobDescription) {
      statusBox.innerText = "⚠️ Please click 'Extract Job Description' first before optimizing keywords!";
      return;
    }

    statusBox.innerText = "🔄 Connecting to BrandResume Web App to optimize keywords...";

    const payload = {
      user_profile: {
        first_name: data.firstName || "Raj",
        last_name: data.lastName || "Kundur",
        email: data.email || ""
      },
      job_description: data.currentJobDescription
    };

    try {
      const response = await fetch(CENTRAL_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Server communication breakdown.");
      
      const result = await response.json();
      
      chrome.storage.local.set({ 
        optimizedResumeData: result.optimized_data,
        tailoredKeywords: result.keywords 
      }, () => {
        statusBox.innerText = `✅ Success! Matched ${result.keywords.length} critical keywords. Ready to apply with optimized details.`;
        console.log("BrandResume Match Engine Results:", result);
      });

    } catch (error) {
      console.warn("Using Local AI Fallback Engine (Backend server offline during development)");
      simulateBackendOptimization(data.currentJobDescription, statusBox);
    }
  });
});

// 6. Local sandbox fallback routine
function simulateBackendOptimization(jdText, statusBox) {
  setTimeout(() => {
    const simulatedKeywords = ["React", "JavaScript", "REST APIs", "Automation Engine"];
    chrome.storage.local.set({
      optimizedResumeData: "Simulated Tailored Experience Content...",
      tailoredKeywords: simulatedKeywords
    }, () => {
      statusBox.innerText = `⚙️ [Dev Sandbox Mode]: Optimized! Extracted target keywords: ${simulatedKeywords.join(', ')}.`;
    });
  }, 1500);
}