// URL pointing to the local FastAPI optimize endpoint
const CENTRAL_WEB_APP_URL = "http://127.0.0.1:8000/api/v1/optimize-resume";
const ACTIVE_SECTION_KEY = "impulsoActiveSection";
const VALID_SECTIONS = [
  "home",
  "profile",
  "current-job",
  "applications",
  "analytics",
  "settings"
];

function showSection(sectionId) {
  if (!VALID_SECTIONS.includes(sectionId)) {
    sectionId = "current-job";
  }

  document.querySelectorAll(".view-section").forEach((section) => {
    const isActive = section.id === "section-" + sectionId;
    section.classList.toggle("active", isActive);
    if (isActive) {
      section.removeAttribute("hidden");
    } else {
      section.setAttribute("hidden", "");
    }
  });

  document.querySelectorAll(".side-nav [role='tab']").forEach((button) => {
    const isActive = button.dataset.section === sectionId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.tabIndex = isActive ? 0 : -1;
  });

  chrome.storage.local.set({ [ACTIVE_SECTION_KEY]: sectionId });

  if (sectionId === "home") {
    refreshHomeStatus();
  }

  if (sectionId === "current-job" && window.ImpulsoJob) {
    window.ImpulsoJob.refresh();
  }

  if (sectionId === "profile") {
    refreshProfileReadiness();
    if (window.ImpulsoResume) {
      window.ImpulsoResume.refresh();
    }
  }
}

function renderReadinessBlock(prefix, readiness) {
  const scoreEl = document.getElementById(prefix + "ReadinessScore");
  const badgeEl = document.getElementById(prefix + "ReadinessBadge");
  const missingEl = document.getElementById(prefix + "ReadinessMissing");
  const cardEl = document.getElementById(prefix + "Readiness");
  if (!scoreEl || !badgeEl || !missingEl) return;

  const score = readiness && typeof readiness.score === "number" ? readiness.score : 0;
  const ready = Boolean(readiness && readiness.ready);
  const missing = (readiness && readiness.missing) || [];

  scoreEl.textContent = "Profile readiness: " + score + "%";
  badgeEl.textContent = ready ? "Ready to Apply" : "Profile Incomplete";
  badgeEl.classList.toggle("ready", ready);
  badgeEl.classList.toggle("incomplete", !ready);
  if (cardEl) {
    cardEl.classList.toggle("is-ready", ready);
    cardEl.classList.toggle("is-incomplete", !ready);
  }

  missingEl.innerHTML = "";
  if (!ready && missing.length) {
    missing.slice(0, 8).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      missingEl.appendChild(li);
    });
    if (missing.length > 8) {
      const more = document.createElement("li");
      more.textContent = "+" + (missing.length - 8) + " more";
      missingEl.appendChild(more);
    }
  } else if (ready) {
    const li = document.createElement("li");
    li.className = "readiness-ok";
    li.textContent = "All required profile items are complete.";
    missingEl.appendChild(li);
  }
}

async function refreshProfileReadiness() {
  if (!window.ImpulsoStorage || typeof window.ImpulsoStorage.getProfileReadiness !== "function") {
    return;
  }

  try {
    const readiness = await window.ImpulsoStorage.getProfileReadiness();
    renderReadinessBlock("home", readiness);
    renderReadinessBlock("profile", readiness);
  } catch (error) {
    const fallback = {
      score: 0,
      ready: false,
      missing: ["Unable to calculate readiness"]
    };
    renderReadinessBlock("home", fallback);
    renderReadinessBlock("profile", fallback);
    console.error("Profile readiness refresh failed:", error);
  }
}

window.refreshProfileReadiness = refreshProfileReadiness;

function refreshHomeStatus() {
  const profileEl = document.getElementById("homeProfileStatus");
  const jobEl = document.getElementById("homeJobStatus");
  const appsEl = document.getElementById("homeApplicationCount");

  if (appsEl) {
    appsEl.textContent = "0 applications tracked (coming soon)";
  }

  chrome.storage.local.get(["firstName", "lastName", "email"], (data) => {
    const firstName = (data.firstName || "").trim();
    const lastName = (data.lastName || "").trim();
    const email = (data.email || "").trim();
    const hasProfile = Boolean(firstName || lastName || email);

    if (profileEl) {
      if (hasProfile) {
        const name = [firstName, lastName].filter(Boolean).join(" ").trim();
        profileEl.textContent = name
          ? "Saved — " + name + (email ? " (" + email + ")" : "")
          : "Saved — " + email;
      } else {
        profileEl.textContent = "Incomplete — add your name and email in Profile";
      }
    }
  });

  refreshHomeJobStatus();
  refreshProfileReadiness();
}

async function refreshHomeJobStatus() {
  const jobEl = document.getElementById("homeJobStatus");
  if (!jobEl) return;

  try {
    if (window.ImpulsoJob && typeof window.ImpulsoJob.getCurrentJob === "function") {
      const current = await window.ImpulsoJob.getCurrentJob();
      if (current) {
        const label = [current.title, current.company].filter(Boolean).join(" @ ");
        const stale = await window.ImpulsoJob.getStaleState();
        jobEl.textContent = stale.stale
          ? "Saved (stale tab) — " + (label || "Current job")
          : "Saved — " + (label || "Current job");
        return;
      }
    }
  } catch (_) {
    // Fall through to legacy description preview.
  }

  chrome.storage.local.get(["currentJobDescription"], (data) => {
    const jd = (data.currentJobDescription || "").trim();
    if (jd) {
      const preview = jd.length > 80 ? jd.slice(0, 80) + "…" : jd;
      jobEl.textContent = "Captured — " + preview;
    } else {
      jobEl.textContent = "No current job saved yet";
    }
  });
}

window.refreshHomeStatus = refreshHomeStatus;

let applicationInfoBaseline = null;

function setApplicationInfoStatus(message, isError) {
  const statusEl = document.getElementById("applicationInfoStatus");
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

function setApplicationInfoFooterVisible(visible) {
  const footer = document.getElementById("applicationInfoFooter");
  if (footer) footer.hidden = !visible;
}

function readApplicationInfoFromForm() {
  const storage = window.ImpulsoStorage;
  const workAuthorization = storage.createDefaultWorkAuthorization();
  const applicationPreferences = storage.createDefaultApplicationPreferences();
  const commonAnswers = storage.createDefaultCommonAnswers();
  const demographics = storage.createDefaultDemographics();

  document.querySelectorAll("[data-app-section][data-app-field]").forEach((el) => {
    const section = el.getAttribute("data-app-section");
    const field = el.getAttribute("data-app-field");
    const value = String(el.value || "");
    if (section === "workAuthorization") workAuthorization[field] = value;
    if (section === "applicationPreferences") applicationPreferences[field] = value;
    if (section === "commonAnswers") commonAnswers[field] = value;
    if (section === "demographics") demographics[field] = value;
  });

  return {
    workAuthorization: workAuthorization,
    applicationPreferences: applicationPreferences,
    commonAnswers: commonAnswers,
    demographics: demographics
  };
}

function applyApplicationInfoToForm(data) {
  const storage = window.ImpulsoStorage;
  const payload = {
    workAuthorization: storage.createDefaultWorkAuthorization(data && data.workAuthorization),
    applicationPreferences: storage.createDefaultApplicationPreferences(
      data && data.applicationPreferences
    ),
    commonAnswers: storage.createDefaultCommonAnswers(data && data.commonAnswers),
    demographics: storage.createDefaultDemographics(data && data.demographics)
  };

  document.querySelectorAll("[data-app-section][data-app-field]").forEach((el) => {
    const section = el.getAttribute("data-app-section");
    const field = el.getAttribute("data-app-field");
    const sectionData = payload[section] || {};
    const value = sectionData[field];
    el.value = value == null ? "" : String(value);

    if (el.tagName === "SELECT" && value && !Array.from(el.options).some((opt) => opt.value === value)) {
      const custom = document.createElement("option");
      custom.value = String(value);
      custom.textContent = String(value);
      el.appendChild(custom);
      el.value = String(value);
    }
  });

  return payload;
}

function cloneApplicationInfo(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

async function loadApplicationInformation() {
  setApplicationInfoStatus("Loading application information…", false);
  setApplicationInfoFooterVisible(true);
  try {
    const profile = await window.ImpulsoStorage.getMasterProfile();
    const loaded = applyApplicationInfoToForm(profile);
    applicationInfoBaseline = cloneApplicationInfo(loaded);
    setApplicationInfoStatus("Loaded from local storage.", false);
  } catch (error) {
    applicationInfoBaseline = null;
    setApplicationInfoStatus(error.message || "Failed to load application information.", true);
  }
}

function clearApplicationInformationForm(options) {
  const opts = options || {};
  applyApplicationInfoToForm({});
  applicationInfoBaseline = null;
  if (!opts.keepStatus) {
    setApplicationInfoStatus("", false);
  }
  setApplicationInfoFooterVisible(false);
}

async function saveApplicationInformation() {
  try {
    const existing = await window.ImpulsoStorage.getMasterProfile();
    const formData = readApplicationInfoFromForm();
    const updated = {
      ...existing,
      workAuthorization: formData.workAuthorization,
      applicationPreferences: formData.applicationPreferences,
      commonAnswers: formData.commonAnswers,
      demographics: formData.demographics,
      defaultResumeId: existing.defaultResumeId == null ? null : existing.defaultResumeId,
      createdAt: existing.createdAt
    };

    const validation = window.ImpulsoStorage.validateMasterProfile(updated);
    if (!validation.ok) {
      setApplicationInfoStatus(validation.errors.join(" "), true);
      return;
    }

    await window.ImpulsoStorage.saveMasterProfile(updated);

    const masterProfile = await window.ImpulsoStorage.getMasterProfile();
    applicationInfoBaseline = cloneApplicationInfo({
      workAuthorization: masterProfile.workAuthorization,
      applicationPreferences: masterProfile.applicationPreferences,
      commonAnswers: masterProfile.commonAnswers,
      demographics: masterProfile.demographics
    });

    const details = document.getElementById("applicationInfoDetails");
    const summary = details && details.querySelector("summary");
    if (details) {
      details.open = false;
    }
    clearApplicationInformationForm({ keepStatus: true });
    setApplicationInfoStatus("Application information saved.", false);
    if (summary && typeof summary.scrollIntoView === "function") {
      summary.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const resume = await window.ImpulsoStorage.getDefaultResume();
    const readiness = window.ImpulsoStorage.assessProfileReadiness(masterProfile, {
      hasDefaultResume: Boolean(resume && resume.id)
    });
    renderReadinessBlock("home", readiness);
    renderReadinessBlock("profile", readiness);
  } catch (error) {
    setApplicationInfoStatus(error.message || "Failed to save application information.", true);
  }
}

function cancelApplicationInformationChanges() {
  if (!applicationInfoBaseline) {
    clearApplicationInformationForm();
    const details = document.getElementById("applicationInfoDetails");
    if (details) details.open = false;
    return;
  }
  applyApplicationInfoToForm(applicationInfoBaseline);
  setApplicationInfoStatus("Unsaved changes discarded.", false);
}

function initApplicationInformationUI() {
  const details = document.getElementById("applicationInfoDetails");
  const saveBtn = document.getElementById("applicationInfoSaveBtn");
  const cancelBtn = document.getElementById("applicationInfoCancelBtn");

  if (details) {
    details.addEventListener("toggle", () => {
      if (details.open) {
        loadApplicationInformation();
      } else {
        clearApplicationInformationForm();
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveApplicationInformation();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      cancelApplicationInformationChanges();
    });
  }
}

function initNavigation() {
  const navButtons = document.querySelectorAll(".side-nav [role='tab']");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.section);
    });

    button.addEventListener("keydown", (event) => {
      const tabs = Array.from(navButtons);
      const index = tabs.indexOf(button);
      let nextIndex = index;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      tabs[nextIndex].focus();
      showSection(tabs[nextIndex].dataset.section);
    });
  });

  chrome.storage.local.get([ACTIVE_SECTION_KEY], (data) => {
    const saved = data[ACTIVE_SECTION_KEY];
    showSection(VALID_SECTIONS.includes(saved) ? saved : "current-job");
  });
}

function updateEmailTypoWarning(emailValue) {
  const warningEl = document.getElementById("emailTypoWarning");
  if (!warningEl || !window.ImpulsoStorage) return;

  const suggestion = window.ImpulsoStorage.suggestEmailCorrection(emailValue);
  if (suggestion && suggestion.toLowerCase() !== String(emailValue || "").trim().toLowerCase()) {
    warningEl.hidden = false;
    warningEl.textContent = "Did you mean " + suggestion + "?";
  } else {
    warningEl.hidden = true;
    warningEl.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  initApplicationInformationUI();

  const emailInput = document.getElementById("email");
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      updateEmailTypoWarning(emailInput.value);
    });
    emailInput.addEventListener("blur", () => {
      updateEmailTypoWarning(emailInput.value);
    });
  }

  try {
    await window.ImpulsoStorage.init();
    const profile = await window.ImpulsoStorage.getMasterProfile();
    const personal = (profile && profile.personal) || {};

    if (personal.firstName) document.getElementById("firstName").value = personal.firstName;
    if (personal.lastName) document.getElementById("lastName").value = personal.lastName;
    if (personal.email) {
      document.getElementById("email").value = personal.email;
      updateEmailTypoWarning(personal.email);
    }

    if (window.ImpulsoResume) {
      await window.ImpulsoResume.init();
    }
    if (window.ImpulsoJob) {
      await window.ImpulsoJob.init();
    }
  } catch (error) {
    console.error("ImpulsoStorage init/load failed:", error);
    alert("Failed to load profile storage: " + (error.message || error));
  }

  refreshHomeStatus();
});

// 2. Profile Cache Updates
document.getElementById("saveBtn").addEventListener("click", async () => {
  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const email = document.getElementById("email").value;

  try {
    if (email.trim() && !window.ImpulsoStorage.isValidEmailFormat(email)) {
      alert("Email format is invalid.");
      return;
    }

    updateEmailTypoWarning(email);

    const existing = await window.ImpulsoStorage.getMasterProfile();
    const updated = {
      ...existing,
      personal: {
        ...existing.personal,
        firstName: firstName,
        lastName: lastName,
        email: email
      }
    };

    const validation = window.ImpulsoStorage.validateMasterProfile(updated);
    if (!validation.ok) {
      alert(validation.errors.join("\n"));
      return;
    }

    await window.ImpulsoStorage.saveMasterProfile(updated);
    refreshHomeStatus();
    if (
      window.ImpulsoResume &&
      typeof window.ImpulsoResume.loadMasterProfileEditor === "function" &&
      document.getElementById("masterProfileDetails") &&
      document.getElementById("masterProfileDetails").open
    ) {
      await window.ImpulsoResume.loadMasterProfileEditor();
    }

    const suggestion = window.ImpulsoStorage.suggestEmailCorrection(email);
    if (suggestion && suggestion.toLowerCase() !== email.trim().toLowerCase()) {
      alert("Profile cached!\n\nDid you mean " + suggestion + "?");
    } else {
      alert("Profile cached!");
    }
  } catch (error) {
    console.error("ImpulsoStorage save failed:", error);
    alert("Failed to save profile: " + (error.message || error));
  }
});

// 3. Current job extraction is handled by window.ImpulsoJob (job.js).

// 4. Form Filling Orchestration Call
document.getElementById("fillBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});

// 5. Keyword Tuning and Server Pipeline Exchange
document.getElementById("optimizeBtn").addEventListener("click", async () => {
  const statusBox = document.getElementById("jdStatus");
  if (statusBox) statusBox.hidden = false;

  try {
    let currentJob = null;
    if (window.ImpulsoJob && typeof window.ImpulsoJob.getCurrentJobForAnalysis === "function") {
      currentJob = await window.ImpulsoJob.getCurrentJobForAnalysis();
    }

    chrome.storage.local.get(["firstName", "lastName", "email"], async (data) => {
      const firstName = (data.firstName || "").trim();
      const lastName = (data.lastName || "").trim();
      const email = (data.email || "").trim();
      const jobDescription = (currentJob && currentJob.description ? currentJob.description : "").trim();

      const missing = [];
      if (!firstName) missing.push("first name");
      if (!lastName) missing.push("last name");
      if (!email) missing.push("email");
      if (!jobDescription) missing.push("job description");

      if (missing.length > 0) {
        statusBox.innerText =
          "⚠️ Missing required data: " + missing.join(", ") +
          ". Save your profile and extract a current job before optimizing.";
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
  } catch (error) {
    if (statusBox) {
      statusBox.innerText = "⚠️ " + (error.message || "Current job is unavailable for analysis.");
    }
  }
});
