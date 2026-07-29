// URL pointing to the local FastAPI job-match endpoint
const JOB_MATCH_API_URL = "http://127.0.0.1:8000/api/v1/analyze-job-match";
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

  if (sectionId === "current-job") {
    if (window.ImpulsoJob) {
      window.ImpulsoJob.refresh();
    }
    refreshJobMatchAnalysis();
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
    await refreshJobMatchAnalysis();
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

  try {
    if (window.ImpulsoStorage) {
      const currentJob = await window.ImpulsoStorage.getCurrentJob();
      if (currentJob && currentJob.id) {
        await window.ImpulsoStorage.syncAutofillResumeForJob(currentJob.id);
      } else {
        const defaultResume = await window.ImpulsoStorage.getDefaultResume();
        await window.ImpulsoStorage.syncLegacyResume(defaultResume || null);
      }
    }
  } catch (error) {
    console.error("Failed to sync selected resume before autofill:", error);
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});

function escapeMatchHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setJobMatchStatus(message, isError) {
  const statusBox = document.getElementById("jdStatus");
  if (!statusBox) return;
  statusBox.hidden = !message;
  statusBox.innerText = message || "";
  statusBox.classList.toggle("is-error", Boolean(isError));
}

function setJobMatchStaleVisible(visible) {
  const banner = document.getElementById("jobMatchStaleBanner");
  if (!banner) return;
  banner.hidden = !visible;
}

function renderMatchChipList(items, chipClass) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return '<p class="job-match-empty">None</p>';
  }
  return (
    '<div class="job-match-chip-list">' +
    list
      .map(
        (item) =>
          '<span class="job-match-chip ' +
          chipClass +
          '">' +
          escapeMatchHtml(item) +
          "</span>"
      )
      .join("") +
    "</div>"
  );
}

function renderMatchTextList(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return '<p class="job-match-empty">None</p>';
  }
  return (
    '<ul class="job-match-list">' +
    list.map((item) => "<li>" + escapeMatchHtml(item) + "</li>").join("") +
    "</ul>"
  );
}

function renderMatchSection(title, count, bodyHtml, openByDefault) {
  return (
    '<details class="job-match-section"' +
    (openByDefault ? " open" : "") +
    ">" +
    "<summary><span>" +
    escapeMatchHtml(title) +
    '</span><span class="job-match-count">' +
    escapeMatchHtml(String(count)) +
    "</span></summary>" +
    '<div class="job-match-section-body">' +
    bodyHtml +
    "</div></details>"
  );
}

function scoreToneClass(score) {
  if (score >= 70) return "";
  if (score >= 40) return "is-mid";
  return "is-low";
}

function renderJobMatchResults(analysis) {
  const resultsEl = document.getElementById("jobMatchResults");
  if (!resultsEl) return;

  if (!analysis) {
    resultsEl.hidden = true;
    resultsEl.innerHTML = "";
    return;
  }

  const score = Math.max(0, Math.min(100, Number(analysis.matchScore) || 0));
  const summary = String(analysis.summary || "").trim();
  const matchedSkills = analysis.matchedSkills || [];
  const missingSkills = analysis.missingSkills || [];
  const matchedKeywords = analysis.matchedKeywords || [];
  const missingKeywords = analysis.missingKeywords || [];
  const strengths = analysis.strengths || [];
  const gaps = analysis.gaps || [];
  const recommendations = analysis.recommendations || [];

  resultsEl.hidden = false;
  resultsEl.innerHTML =
    '<div class="job-match-score-card">' +
    '<div class="job-match-score-value ' +
    scoreToneClass(score) +
    '">' +
    escapeMatchHtml(String(score)) +
    "</div>" +
    '<div class="job-match-score-meta">' +
    '<div class="job-match-score-label">Match score</div>' +
    (analysis.analysisLabel
      ? '<div class="job-match-analysis-label">' +
        escapeMatchHtml(analysis.analysisLabel) +
        "</div>"
      : "") +
    (summary
      ? '<div class="job-match-score-summary">' + escapeMatchHtml(summary) + "</div>"
      : "") +
    "</div></div>" +
    renderMatchSection(
      "Matched skills",
      matchedSkills.length,
      renderMatchChipList(matchedSkills, "is-matched"),
      true
    ) +
    renderMatchSection(
      "Missing skills",
      missingSkills.length,
      renderMatchChipList(missingSkills, "is-missing"),
      true
    ) +
    renderMatchSection(
      "Matched keywords",
      matchedKeywords.length,
      renderMatchChipList(matchedKeywords, "is-keyword"),
      false
    ) +
    renderMatchSection(
      "Missing keywords",
      missingKeywords.length,
      renderMatchChipList(missingKeywords, "is-keyword"),
      false
    ) +
    renderMatchSection("Strengths", strengths.length, renderMatchTextList(strengths), false) +
    renderMatchSection("Gaps", gaps.length, renderMatchTextList(gaps), false) +
    renderMatchSection(
      "Recommendations",
      recommendations.length,
      renderMatchTextList(recommendations),
      true
    );
}

async function refreshJobMatchAnalysis() {
  const resultsEl = document.getElementById("jobMatchResults");
  if (!window.ImpulsoStorage || !resultsEl) return;

  try {
    const currentJob = await window.ImpulsoStorage.getCurrentJob();
    if (!currentJob) {
      setJobMatchStaleVisible(false);
      renderJobMatchResults(null);
      return;
    }

    const lookup = await window.ImpulsoStorage.getJobMatchAnalysisForJob(currentJob.id);
    if (!lookup.analysis) {
      setJobMatchStaleVisible(false);
      renderJobMatchResults(null);
      return;
    }

    setJobMatchStaleVisible(Boolean(lookup.stale));
    if (lookup.stale) {
      const banner = document.getElementById("jobMatchStaleBanner");
      if (banner) {
        banner.textContent = "Profile or job changed. Run analysis again.";
      }
    }
    renderJobMatchResults(lookup.analysis);
  } catch (error) {
    console.error("Failed to restore job match analysis:", error);
  }
}

window.refreshJobMatchAnalysis = refreshJobMatchAnalysis;

function isValidJobMatchResponse(result) {
  return Boolean(
    result &&
      typeof result === "object" &&
      typeof result.status === "string" &&
      ("matchScore" in result ||
        result.status === "dev_mode" ||
        result.status === "error")
  );
}

async function runJobMatchAnalysis(options) {
  const opts = options || {};
  if (!window.ImpulsoStorage) {
    throw new Error("Storage is unavailable. Reload the extension and try again.");
  }

  let currentJob = opts.currentJob || null;
  if (!currentJob) {
    if (window.ImpulsoJob && typeof window.ImpulsoJob.getCurrentJobForAnalysis === "function") {
      currentJob = await window.ImpulsoJob.getCurrentJobForAnalysis();
    } else {
      currentJob = await window.ImpulsoStorage.getCurrentJob();
    }
  }

  if (!currentJob || !(currentJob.description || "").trim()) {
    throw new Error("No current job saved. Extract a job posting first.");
  }

  const context = await window.ImpulsoStorage.resolveJobMatchContext(currentJob.id, {
    job: currentJob,
    masterProfile: opts.masterProfile,
    selection: opts.selection,
    jobProfile: opts.jobProfile,
    tailoredResume: opts.tailoredResume,
    defaultResume: opts.defaultResume
  });

  // Explicit profile override (e.g. just-approved job profile) still uses job-specific source.
  let analysisProfile = opts.profile || context.profile;
  let profileSource = opts.profile
    ? window.ImpulsoStorage.normalizeProfileSource(opts.analyzedWith || opts.profileSource || "job-specific")
    : context.profileSource;
  let resumeId = context.resumeId;
  let profileUpdatedAt = context.profileUpdatedAt;
  let analysisLabel = context.analysisLabel;
  let analysisKey = context.analysisKey;
  let jobProfile = context.jobProfile;

  if (opts.profile && profileSource === "job-specific") {
    jobProfile = opts.jobProfile || context.jobProfile;
    resumeId =
      (opts.tailoredResume && opts.tailoredResume.id) ||
      (jobProfile && jobProfile.resumeId) ||
      context.resumeId;
    profileUpdatedAt =
      (jobProfile && jobProfile.updatedAt) || context.profileUpdatedAt;
    analysisLabel = window.ImpulsoStorage.analysisLabelForSource("job-specific");
    analysisKey = window.ImpulsoStorage.buildJobMatchAnalysisKey({
      jobId: currentJob.id,
      resumeId: resumeId,
      profileSource: "job-specific",
      profileUpdatedAt: profileUpdatedAt,
      jobUpdatedAt: currentJob.updatedAt || null
    });
  }

  const careerProfile = window.ImpulsoStorage.buildCareerRelevantProfile(analysisProfile);
  if (!window.ImpulsoStorage.profileHasCareerSignal(careerProfile)) {
    throw new Error(
      "Profile is incomplete for match analysis. Add skills, experience, education, or projects first."
    );
  }

  setJobMatchStatus("Analyzing job match...", false);
  const analyzeBtn = document.getElementById("analyzeJobMatchBtn");
  if (analyzeBtn) analyzeBtn.disabled = true;

  try {
    const response = await fetch(JOB_MATCH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        master_profile: careerProfile,
        current_job: {
          title: currentJob.title || "",
          company: currentJob.company || "",
          description: currentJob.description || ""
        }
      })
    });

    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw new Error("Backend returned an invalid response.");
    }

    if (!isValidJobMatchResponse(result)) {
      throw new Error("Backend returned an invalid match response.");
    }

    if (!response.ok) {
      throw new Error(result.detail || result.message || "HTTP " + response.status);
    }

    if (result.status === "dev_mode") {
      throw new Error(
        "AI provider is in development mode. " +
          (result.message || "Configure the API key in brandfit-backend/.env and restart the server.")
      );
    }

    if (result.status === "error") {
      throw new Error(result.message || "Job match analysis failed.");
    }

    if (result.status !== "success") {
      throw new Error("Unexpected backend status: " + (result.status || "unknown"));
    }

    const savedJob = await window.ImpulsoStorage.saveJobMatchAnalysis(currentJob.id, result, {
      analysisKey: analysisKey,
      profileSource: profileSource,
      resumeId: resumeId,
      profileUpdatedAt: profileUpdatedAt,
      jobUpdatedAt: currentJob.updatedAt || null,
      defaultResumeId:
        context.masterProfile && context.masterProfile.defaultResumeId != null
          ? context.masterProfile.defaultResumeId
          : null,
      tailoredResumeId: profileSource === "job-specific" ? resumeId : null,
      jobProfileUpdatedAt: jobProfile && jobProfile.updatedAt ? jobProfile.updatedAt : null,
      analysisLabel: analysisLabel,
      jobProfile: jobProfile,
      tailoredResume: opts.tailoredResume,
      selection: context.selection,
      masterProfile: context.masterProfile
    });

    const savedAnalysis =
      (savedJob.matchAnalyses && savedJob.matchAnalyses[analysisKey]) ||
      savedJob.matchAnalysis ||
      result;

    setJobMatchStaleVisible(false);
    renderJobMatchResults(savedAnalysis);
    setJobMatchStatus(
      savedAnalysis.analysisLabel
        ? savedAnalysis.analysisLabel + " saved."
        : result.message || "Job match analyzed successfully.",
      false
    );
    return savedJob;
  } catch (error) {
    if (error && /unavailable|Failed to fetch|NetworkError/i.test(String(error.message || error))) {
      throw new Error("Backend is unavailable. Start the FastAPI server and try again.");
    }
    throw error;
  } finally {
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
}

window.runJobMatchAnalysis = runJobMatchAnalysis;

// 5. Job Match Analysis
const analyzeJobMatchBtn = document.getElementById("analyzeJobMatchBtn");
if (analyzeJobMatchBtn) {
  analyzeJobMatchBtn.addEventListener("click", async () => {
    setJobMatchStatus("", false);
    try {
      await runJobMatchAnalysis({});
    } catch (error) {
      const code = error && error.code;
      if (code === "NO_CURRENT_JOB") {
        setJobMatchStatus("No current job saved. Extract a job posting first.", true);
      } else if (code === "STALE_JOB") {
        setJobMatchStatus(
          "Active tab differs from the stored job. Extract or replace the current job first.",
          true
        );
      } else {
        console.error("Job match request failed:", error);
        setJobMatchStatus(error.message || "Job match analysis failed.", true);
      }
    }
  });
}