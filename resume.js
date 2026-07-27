(function (global) {
  "use strict";

  const MAX_RESUME_BYTES = 5 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
  const PARSE_RESUME_URL = "http://127.0.0.1:8000/api/v1/parse-resume";

  let pendingDraft = null;
  let parsedSnapshot = null;
  let masterSnapshot = null;
  let scalarConflicts = {};
  let arrayModes = {};
  let conflictResolutions = {};
  let sectionOpenState = {
    personal: true,
    links: true,
    experience: true,
    education: false,
    projects: false,
    skills: true,
    certifications: false
  };
  let parsingInProgress = false;

  // Permanent master-profile editor (separate from temporary parse review)
  let masterEditDraft = null;
  let masterEditBaseline = null;
  let masterEditLoaded = false;
  let masterSectionOpenState = {
    personal: true,
    links: true,
    experience: true,
    education: false,
    projects: false,
    skills: true,
    certifications: false
  };

  function ensureStorage() {
    if (!global.ImpulsoStorage) {
      throw new Error("ImpulsoStorage is not available.");
    }
    return global.ImpulsoStorage;
  }

  function getExtension(fileName) {
    const name = String(fileName || "").toLowerCase();
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx) : "";
  }

  function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  }

  function formatUploadDate(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString();
  }

  function validateFile(file) {
    if (!file) {
      return { ok: false, message: "No resume file selected." };
    }
    const extension = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        ok: false,
        message: "Unsupported file type. Upload a PDF or DOCX resume."
      };
    }
    if (file.size > MAX_RESUME_BYTES) {
      return {
        ok: false,
        message: "Resume is too large. Maximum size is 5 MB."
      };
    }
    return { ok: true, message: "" };
  }

  function createResumeId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return "resume-" + global.crypto.randomUUID();
    }
    return "resume-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected resume file."));
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf(",") < 0) {
      throw new Error("Stored resume data is unreadable.");
    }
    const parts = dataUrl.split(",");
    const meta = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mime = (mimeMatch && mimeMatch[1]) || "application/octet-stream";
    let binary;
    try {
      binary = atob(base64);
    } catch (_) {
      throw new Error("Stored resume data is unreadable.");
    }
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  function emptyDraft() {
    return {
      personal: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        location: ""
      },
      links: {
        linkedin: "",
        github: "",
        portfolio: ""
      },
      experience: [],
      education: [],
      projects: [],
      skills: [],
      certifications: []
    };
  }

  function cloneDraft(draft) {
    return JSON.parse(JSON.stringify(draft || emptyDraft()));
  }

  function normalizeDraft(raw) {
    const base = emptyDraft();
    const source = raw && typeof raw === "object" ? raw : {};
    const personal = source.personal || {};
    const links = source.links || {};

    base.personal = {
      firstName: String(personal.firstName || ""),
      lastName: String(personal.lastName || ""),
      email: String(personal.email || ""),
      phone: String(personal.phone || ""),
      location: String(personal.location || "")
    };
    base.links = {
      linkedin: String(links.linkedin || ""),
      github: String(links.github || ""),
      portfolio: String(links.portfolio || "")
    };

    base.experience = Array.isArray(source.experience)
      ? source.experience.map((item) => ({
          company: String((item && item.company) || ""),
          title: String((item && item.title) || ""),
          location: String((item && item.location) || ""),
          startDate: String((item && item.startDate) || ""),
          endDate: String((item && item.endDate) || ""),
          isCurrent: Boolean(item && item.isCurrent),
          description: String((item && item.description) || ""),
          bullets: Array.isArray(item && item.bullets)
            ? item.bullets.map((b) => String(b || "")).filter(Boolean)
            : []
        }))
      : [];

    base.education = Array.isArray(source.education)
      ? source.education.map((item) => ({
          institution: String((item && item.institution) || ""),
          degree: String((item && item.degree) || ""),
          field: String((item && item.field) || ""),
          location: String((item && item.location) || ""),
          startDate: String((item && item.startDate) || ""),
          endDate: String((item && item.endDate) || ""),
          gpa: String((item && item.gpa) || "")
        }))
      : [];

    base.projects = Array.isArray(source.projects)
      ? source.projects.map((item) => ({
          name: String((item && item.name) || ""),
          description: String((item && item.description) || ""),
          technologies: Array.isArray(item && item.technologies)
            ? item.technologies.map((t) => String(t || "")).filter(Boolean)
            : [],
          url: String((item && item.url) || "")
        }))
      : [];

    base.skills = Array.isArray(source.skills)
      ? source.skills.map((s) => String(s || "")).filter(Boolean)
      : [];
    base.certifications = Array.isArray(source.certifications)
      ? source.certifications.map((c) => String(c || "")).filter(Boolean)
      : [];

    return base;
  }

  async function getDefaultResume() {
    return ensureStorage().getDefaultResume();
  }

  async function saveUploadedResume(file, options) {
    const opts = options || {};
    const storage = ensureStorage();
    const validation = validateFile(file);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const existing = await storage.getDefaultResume();
    if (existing && !opts.replaceConfirmed) {
      const error = new Error("A default resume already exists. Confirm before replacing it.");
      error.code = "CONFIRM_REPLACE";
      error.existing = existing;
      throw error;
    }

    let fileData;
    try {
      fileData = await readFileAsDataUrl(file);
    } catch (error) {
      throw new Error(error.message || "Could not read the selected resume file.");
    }

    const timestamp = new Date().toISOString();
    const resumeId = createResumeId();
    const extension = getExtension(file.name);
    const mimeType =
      file.type ||
      (extension === ".pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const documentRecord = {
      id: resumeId,
      name: file.name,
      type: mimeType,
      size: file.size,
      fileData: fileData,
      isDefault: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    try {
      await storage.saveDocument(documentRecord);
    } catch (error) {
      throw new Error(error.message || "Failed to store resume in IndexedDB.");
    }

    if (existing && existing.id && existing.id !== resumeId) {
      try {
        await storage.deleteDocument(existing.id);
      } catch (error) {
        throw new Error(
          "New resume was saved, but removing the previous default resume failed: " +
            (error.message || error)
        );
      }
    }

    try {
      const profile = await storage.getMasterProfile();
      await storage.saveMasterProfile({
        ...profile,
        defaultResumeId: resumeId
      });
    } catch (error) {
      throw new Error(
        "Resume file was saved, but updating defaultResumeId failed: " + (error.message || error)
      );
    }

    try {
      await storage.syncLegacyResume(documentRecord);
    } catch (error) {
      throw new Error(
        "Resume was saved locally, but syncing autofill resume data failed: " +
          (error.message || error)
      );
    }

    return documentRecord;
  }

  async function removeDefaultResume(options) {
    const opts = options || {};
    const storage = ensureStorage();
    const existing = await storage.getDefaultResume();

    if (!existing) {
      return null;
    }

    if (!opts.removeConfirmed) {
      const error = new Error("Confirm before removing the default resume.");
      error.code = "CONFIRM_REMOVE";
      error.existing = existing;
      throw error;
    }

    try {
      await storage.deleteDocument(existing.id);
    } catch (error) {
      throw new Error(error.message || "Failed to remove resume from IndexedDB.");
    }

    try {
      const profile = await storage.getMasterProfile();
      await storage.saveMasterProfile({
        ...profile,
        defaultResumeId: null
      });
    } catch (error) {
      throw new Error(
        "Resume was deleted, but clearing defaultResumeId failed: " + (error.message || error)
      );
    }

    try {
      await storage.syncLegacyResume(null);
    } catch (error) {
      throw new Error(
        "Resume was removed, but clearing autofill resume data failed: " +
          (error.message || error)
      );
    }

    return existing;
  }

  function setStatus(message, isError) {
    const statusEl = document.getElementById("resumeStatus");
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function setReviewStatus(message, isError) {
    const statusEl = document.getElementById("resumeReviewStatus");
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncateText(value, maxLen) {
    const text = String(value == null ? "" : value);
    const limit = maxLen || 80;
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)) + "…";
  }

  function isNonEmptyScalar(value) {
    return Boolean(String(value == null ? "" : value).trim());
  }

  function valuesDiffer(a, b) {
    try {
      return JSON.stringify(a) !== JSON.stringify(b);
    } catch (_) {
      return String(a) !== String(b);
    }
  }

  function exactEntryKey(item) {
    try {
      return JSON.stringify(item || {});
    } catch (_) {
      return String(item);
    }
  }

  function dedupeEntries(entries) {
    const seen = new Set();
    const out = [];
    (entries || []).forEach((item) => {
      const key = exactEntryKey(item);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function dedupeStrings(values) {
    const seen = new Set();
    const out = [];
    (values || []).forEach((raw) => {
      const value = String(raw || "").trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
    return out;
  }

  function detectScalarConflicts(master, draft) {
    const conflicts = {};
    const personalFields = ["firstName", "lastName", "email", "phone", "location"];
    personalFields.forEach((field) => {
      const existingValue = (master.personal && master.personal[field]) || "";
      const parsedValue = (draft.personal && draft.personal[field]) || "";
      if (isNonEmptyScalar(existingValue) && isNonEmptyScalar(parsedValue) && valuesDiffer(existingValue, parsedValue)) {
        conflicts["personal." + field] = {
          id: "personal." + field,
          label: field,
          existingValue: existingValue,
          parsedValue: parsedValue
        };
      }
    });

    const linkFields = ["linkedin", "github", "portfolio"];
    linkFields.forEach((field) => {
      const existingValue = (master.links && master.links[field]) || "";
      const parsedValue = (draft.links && draft.links[field]) || "";
      if (isNonEmptyScalar(existingValue) && isNonEmptyScalar(parsedValue) && valuesDiffer(existingValue, parsedValue)) {
        conflicts["links." + field] = {
          id: "links." + field,
          label: field,
          existingValue: existingValue,
          parsedValue: parsedValue
        };
      }
    });

    return conflicts;
  }

  function initialArrayMode(existingList, parsedList) {
    const existing = Array.isArray(existingList) ? existingList : [];
    const parsed = Array.isArray(parsedList) ? parsedList : [];
    if (existing.length && parsed.length && valuesDiffer(existing, parsed)) {
      return "both";
    }
    if (parsed.length) return "parsed";
    if (existing.length) return "existing";
    return "parsed";
  }

  function resolveArrayByMode(section, mode) {
    const existing = cloneDraft(masterSnapshot || emptyDraft())[section] || [];
    const parsed = cloneDraft(parsedSnapshot || emptyDraft())[section] || [];
    if (mode === "existing") return cloneDraft({ [section]: existing })[section];
    if (mode === "both") {
      if (section === "skills" || section === "certifications") {
        return dedupeStrings([].concat(existing, parsed));
      }
      return dedupeEntries([].concat(existing, parsed));
    }
    return cloneDraft({ [section]: parsed })[section];
  }

  function applyArrayMode(section) {
    if (!pendingDraft) return;
    const mode = arrayModes[section] || "parsed";
    pendingDraft[section] = resolveArrayByMode(section, mode);
  }

  function entrySummary(section, item) {
    if (!item) return "(empty)";
    if (section === "experience") {
      const title = item.title || "Role";
      const company = item.company || "Company";
      const dates = [item.startDate, item.endDate || (item.isCurrent ? "Present" : "")]
        .filter(Boolean)
        .join(" – ");
      return truncateText(title + " · " + company + (dates ? " · " + dates : ""), 90);
    }
    if (section === "education") {
      const degree = item.degree || "Degree";
      const school = item.institution || "School";
      return truncateText(degree + " · " + school, 90);
    }
    if (section === "projects") {
      const name = item.name || "Project";
      const techs = (item.technologies || []).slice(0, 3).join(", ");
      return truncateText(name + (techs ? " · " + techs : ""), 90);
    }
    return truncateText(JSON.stringify(item), 90);
  }

  function countScalarConflictsIn(prefix) {
    return Object.keys(scalarConflicts).filter((id) => id.startsWith(prefix)).length;
  }

  function renderParseSummary() {
    const el = document.getElementById("resumeParseSummary");
    if (!el || !pendingDraft) {
      if (el) el.innerHTML = "";
      return;
    }

    const draft = pendingDraft;
    const name = [draft.personal.firstName, draft.personal.lastName].filter(Boolean).join(" ").trim();
    const conflictCount = Object.keys(scalarConflicts).length;
    const arrayConflictCount = ["experience", "education", "projects", "skills", "certifications"].filter(
      (key) => {
        const existing = (masterSnapshot && masterSnapshot[key]) || [];
        const parsed = (parsedSnapshot && parsedSnapshot[key]) || [];
        return existing.length && parsed.length && valuesDiffer(existing, parsed);
      }
    ).length;

    el.innerHTML =
      '<div class="parse-summary-main">' +
      "<strong>" +
      escapeHtml(name || "Parsed profile") +
      "</strong>" +
      '<span class="parse-summary-meta">' +
      draft.experience.length +
      " exp · " +
      draft.education.length +
      " edu · " +
      draft.projects.length +
      " projects · " +
      draft.skills.length +
      " skills · " +
      draft.certifications.length +
      " certs</span></div>" +
      (conflictCount || arrayConflictCount
        ? '<div class="parse-summary-flags">' +
          (conflictCount ? conflictCount + " field conflict" + (conflictCount === 1 ? "" : "s") : "") +
          (conflictCount && arrayConflictCount ? " · " : "") +
          (arrayConflictCount
            ? arrayConflictCount + " list overlap" + (arrayConflictCount === 1 ? "" : "s")
            : "") +
          "</div>"
        : '<div class="parse-summary-flags muted">No conflicts detected</div>');
  }

  async function refreshResumeUI() {
    const emptyState = document.getElementById("resumeEmptyState");
    const details = document.getElementById("resumeDetails");
    const fileNameEl = document.getElementById("resumeFileName");
    const fileSizeEl = document.getElementById("resumeFileSize");
    const uploadDateEl = document.getElementById("resumeUploadDate");
    const badgeEl = document.getElementById("resumeDefaultBadge");
    const parseBtn = document.getElementById("resumeParseBtn");

    if (!emptyState || !details) return;

    try {
      const resume = await getDefaultResume();
      if (!resume) {
        emptyState.hidden = false;
        details.hidden = true;
        if (badgeEl) badgeEl.hidden = true;
        if (parseBtn) parseBtn.disabled = true;
        return;
      }

      emptyState.hidden = true;
      details.hidden = false;
      if (fileNameEl) fileNameEl.textContent = resume.name || "Untitled resume";
      if (fileSizeEl) fileSizeEl.textContent = formatFileSize(resume.size);
      if (uploadDateEl) {
        uploadDateEl.textContent = formatUploadDate(resume.createdAt || resume.updatedAt);
      }
      if (badgeEl) {
        badgeEl.hidden = !resume.isDefault;
      }
      if (parseBtn) parseBtn.disabled = parsingInProgress;
    } catch (error) {
      setStatus(error.message || "Failed to load resume details.", true);
    }
  }

  function clearReviewDraftState() {
    pendingDraft = null;
    parsedSnapshot = null;
    masterSnapshot = null;
    scalarConflicts = {};
    arrayModes = {};
    conflictResolutions = {};
    const summary = document.getElementById("resumeParseSummary");
    if (summary) summary.innerHTML = "";
    const editor = document.getElementById("resumeReviewEditor");
    if (editor) editor.innerHTML = "";
    setReviewStatus("", false);
  }

  function hideReviewPanel() {
    const panel = document.getElementById("resumeReviewPanel");
    const details = document.getElementById("resumeReviewDetails");
    const footer = document.getElementById("resumeReviewFooter");
    const actions = document.getElementById("resumeReviewActions");

    clearReviewDraftState();

    if (details) details.open = false;
    if (footer) footer.hidden = true;
    if (actions) actions.hidden = true;
    if (panel) panel.hidden = true;
  }

  function showReviewPanel(options) {
    const opts = options || {};
    const panel = document.getElementById("resumeReviewPanel");
    const details = document.getElementById("resumeReviewDetails");
    const footer = document.getElementById("resumeReviewFooter");
    const actions = document.getElementById("resumeReviewActions");

    if (!panel) return;

    panel.hidden = false;
    if (footer) footer.hidden = false;
    if (actions) actions.hidden = false;
    if (details) {
      details.open = opts.expanded !== false;
    }
  }

  function fieldInput(label, name, value, multiline) {
    const safeName = escapeHtml(name);
    const safeLabel = escapeHtml(label);
    if (multiline) {
      return (
        '<label class="review-field">' +
        safeLabel +
        '<textarea data-field="' +
        safeName +
        '" rows="3">' +
        escapeHtml(value) +
        "</textarea></label>"
      );
    }
    return (
      '<label class="review-field">' +
      safeLabel +
      '<input type="text" data-field="' +
      safeName +
      '" value="' +
      escapeHtml(value) +
      '"></label>'
    );
  }

  function renderScalarField(label, path, value, options) {
    const opts = options || {};
    const includeConflicts = opts.includeConflicts !== false;
    const conflict = includeConflicts ? scalarConflicts[path] : null;
    const choice = conflictResolutions[path] || "parsed";
    let html =
      '<div class="review-scalar" data-scalar-path="' + escapeHtml(path) + '">' +
      '<div class="review-scalar-label">' +
      escapeHtml(label) +
      "</div>";

    if (conflict) {
      html +=
        '<div class="review-field-choices">' +
        '<button type="button" class="choice-chip' +
        (choice === "existing" ? " active" : "") +
        '" data-scalar-choice="existing" data-path="' +
        escapeHtml(path) +
        '"><span class="choice-kicker">Existing</span>' +
        escapeHtml(truncateText(conflict.existingValue, 64)) +
        "</button>" +
        '<button type="button" class="choice-chip' +
        (choice === "parsed" ? " active" : "") +
        '" data-scalar-choice="parsed" data-path="' +
        escapeHtml(path) +
        '"><span class="choice-kicker">Parsed</span>' +
        escapeHtml(truncateText(conflict.parsedValue, 64)) +
        "</button>" +
        "</div>";
    }

    html +=
      '<input type="text" data-field="' +
      escapeHtml(path) +
      '" value="' +
      escapeHtml(value || "") +
      '">' +
      "</div>";
    return html;
  }

  function renderArraySourceLists(section) {
    const existing = (masterSnapshot && masterSnapshot[section]) || [];
    const parsed = (parsedSnapshot && parsedSnapshot[section]) || [];
    const hasOverlap = existing.length && parsed.length && valuesDiffer(existing, parsed);
    if (!existing.length && !parsed.length) return "";

    let html = '<div class="array-source-lists">';
    if (existing.length) {
      html +=
        '<div class="array-source"><div class="array-source-title">Existing (' +
        existing.length +
        ")</div><ul>" +
        existing
          .map((item) => "<li>" + escapeHtml(entrySummary(section, item)) + "</li>")
          .join("") +
        "</ul></div>";
    }
    if (parsed.length) {
      html +=
        '<div class="array-source"><div class="array-source-title">Parsed (' +
        parsed.length +
        ")</div><ul>" +
        parsed
          .map((item) => "<li>" + escapeHtml(entrySummary(section, item)) + "</li>")
          .join("") +
        "</ul></div>";
    }
    html += "</div>";

    if (hasOverlap) {
      const mode = arrayModes[section] || "both";
      html +=
        '<div class="array-mode-choices" data-array-section="' +
        escapeHtml(section) +
        '">' +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="existing"' +
        (mode === "existing" ? " checked" : "") +
        "> Keep existing</label>" +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="parsed"' +
        (mode === "parsed" ? " checked" : "") +
        "> Use parsed</label>" +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="both"' +
        (mode === "both" ? " checked" : "") +
        "> Keep both</label>" +
        "</div>";
    }

    return html;
  }

  function renderExperienceEntry(item, index) {
    const bulletsText = (item.bullets || []).join("\n");
    return (
      '<div class="review-entry" data-section="experience" data-index="' +
      index +
      '">' +
      '<div class="review-entry-header"><strong>Experience ' +
      (index + 1) +
      '</strong><button type="button" class="btn-link review-remove" data-remove="experience" data-index="' +
      index +
      '">Remove</button></div>' +
      fieldInput("Title", "experience." + index + ".title", item.title || "") +
      fieldInput("Company", "experience." + index + ".company", item.company || "") +
      fieldInput("Location", "experience." + index + ".location", item.location || "") +
      '<div class="row">' +
      fieldInput("Start", "experience." + index + ".startDate", item.startDate || "") +
      fieldInput("End", "experience." + index + ".endDate", item.endDate || "") +
      "</div>" +
      '<label class="review-field review-check"><input type="checkbox" data-field="experience.' +
      index +
      '.isCurrent"' +
      (item.isCurrent ? " checked" : "") +
      "> Current role</label>" +
      fieldInput(
        "Description",
        "experience." + index + ".description",
        item.description || "",
        true
      ) +
      fieldInput(
        "Bullets (one per line)",
        "experience." + index + ".bullets",
        bulletsText,
        true
      ) +
      "</div>"
    );
  }

  function renderEducationEntry(item, index) {
    return (
      '<div class="review-entry" data-section="education" data-index="' +
      index +
      '">' +
      '<div class="review-entry-header"><strong>Education ' +
      (index + 1) +
      '</strong><button type="button" class="btn-link review-remove" data-remove="education" data-index="' +
      index +
      '">Remove</button></div>' +
      fieldInput("Institution", "education." + index + ".institution", item.institution || "") +
      fieldInput("Degree", "education." + index + ".degree", item.degree || "") +
      fieldInput("Field", "education." + index + ".field", item.field || "") +
      fieldInput("Location", "education." + index + ".location", item.location || "") +
      '<div class="row">' +
      fieldInput("Start", "education." + index + ".startDate", item.startDate || "") +
      fieldInput("End", "education." + index + ".endDate", item.endDate || "") +
      "</div>" +
      fieldInput("GPA", "education." + index + ".gpa", item.gpa || "") +
      "</div>"
    );
  }

  function renderProjectEntry(item, index) {
    return (
      '<div class="review-entry" data-section="projects" data-index="' +
      index +
      '">' +
      '<div class="review-entry-header"><strong>Project ' +
      (index + 1) +
      '</strong><button type="button" class="btn-link review-remove" data-remove="projects" data-index="' +
      index +
      '">Remove</button></div>' +
      fieldInput("Name", "projects." + index + ".name", item.name || "") +
      fieldInput(
        "Description",
        "projects." + index + ".description",
        item.description || "",
        true
      ) +
      fieldInput(
        "Technologies (comma-separated)",
        "projects." + index + ".technologies",
        (item.technologies || []).join(", ")
      ) +
      fieldInput("URL", "projects." + index + ".url", item.url || "") +
      "</div>"
    );
  }

  function renderSkillChips(skills, idPrefix) {
    const prefix = idPrefix || "review";
    const list = Array.isArray(skills) ? skills : [];
    return (
      '<div class="skill-chip-list">' +
      (list.length
        ? list
            .map(
              (skill, index) =>
                '<span class="skill-chip">' +
                escapeHtml(skill) +
                '<button type="button" class="skill-chip-remove" data-skill-index="' +
                index +
                '" aria-label="Remove skill">×</button></span>'
            )
            .join("")
        : '<span class="resume-hint">No skills yet.</span>') +
      "</div>" +
      '<div class="skill-add-row">' +
      '<input type="text" id="' +
      escapeHtml(prefix) +
      'AddSkillInput" placeholder="Add skill" maxlength="80">' +
      '<button type="button" class="action btn-secondary" id="' +
      escapeHtml(prefix) +
      'AddSkillBtn">Add Skill</button>' +
      "</div>"
    );
  }

  function renderStringListMode(section, label, options) {
    const opts = options || {};
    const draft = opts.draft || pendingDraft;
    const showConflictUi = opts.showConflictUi !== false;
    const existing = (masterSnapshot && masterSnapshot[section]) || [];
    const parsed = (parsedSnapshot && parsedSnapshot[section]) || [];
    const hasOverlap =
      showConflictUi && existing.length && parsed.length && valuesDiffer(existing, parsed);
    let html = "";

    if (showConflictUi && (existing.length || parsed.length)) {
      html += '<div class="array-source-lists">';
      if (existing.length) {
        html +=
          '<div class="array-source"><div class="array-source-title">Existing</div><div class="chip-preview">' +
          existing.map((s) => '<span class="mini-chip">' + escapeHtml(s) + "</span>").join("") +
          "</div></div>";
      }
      if (parsed.length) {
        html +=
          '<div class="array-source"><div class="array-source-title">Parsed</div><div class="chip-preview">' +
          parsed.map((s) => '<span class="mini-chip">' + escapeHtml(s) + "</span>").join("") +
          "</div></div>";
      }
      html += "</div>";
    }

    if (hasOverlap) {
      const mode = arrayModes[section] || "both";
      html +=
        '<div class="array-mode-choices" data-array-section="' +
        escapeHtml(section) +
        '">' +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="existing"' +
        (mode === "existing" ? " checked" : "") +
        "> Keep existing</label>" +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="parsed"' +
        (mode === "parsed" ? " checked" : "") +
        "> Use parsed</label>" +
        '<label><input type="radio" name="array-mode-' +
        escapeHtml(section) +
        '" value="both"' +
        (mode === "both" ? " checked" : "") +
        "> Keep both</label>" +
        "</div>";
    }

    if (section === "skills") {
      if (showConflictUi) {
        html += '<div class="review-selected-label">Selected ' + escapeHtml(label) + "</div>";
      }
      html += renderSkillChips((draft && draft.skills) || [], opts.skillIdPrefix || "review");
    } else {
      html += fieldInput(
        showConflictUi ? "Selected certifications (one per line)" : "Certifications (one per line)",
        "certifications",
        ((draft && draft.certifications) || []).join("\n"),
        true
      );
    }

    return html;
  }

  function collapsibleSection(id, title, badgeText, bodyHtml, openStateMap) {
    const openMap = openStateMap || sectionOpenState;
    const open = openMap[id] !== false;
    return (
      '<details class="review-section" data-section-id="' +
      escapeHtml(id) +
      '"' +
      (open ? " open" : "") +
      ">" +
      "<summary><span>" +
      escapeHtml(title) +
      "</span>" +
      (badgeText
        ? '<span class="section-badge">' + escapeHtml(badgeText) + "</span>"
        : "") +
      "</summary>" +
      '<div class="review-section-body">' +
      bodyHtml +
      "</div></details>"
    );
  }

  function captureSectionOpenState(editorEl, openStateMap) {
    const editor = editorEl || document.getElementById("resumeReviewEditor");
    const stateMap = openStateMap || sectionOpenState;
    if (!editor) return;
    editor.querySelectorAll("details.review-section[data-section-id]").forEach((el) => {
      const id = el.getAttribute("data-section-id");
      if (id) stateMap[id] = el.open;
    });
  }

  function renderReviewEditor() {
    const editor = document.getElementById("resumeReviewEditor");
    if (!editor || !pendingDraft) return;

    const draft = pendingDraft;
    const personalConflicts = countScalarConflictsIn("personal.");
    const linkConflicts = countScalarConflictsIn("links.");
    const scalarOpts = { includeConflicts: true };

    editor.innerHTML =
      collapsibleSection(
        "personal",
        "Personal information",
        personalConflicts ? personalConflicts + " conflict" + (personalConflicts === 1 ? "" : "s") : "",
        renderScalarField("First name", "personal.firstName", draft.personal.firstName, scalarOpts) +
          renderScalarField("Last name", "personal.lastName", draft.personal.lastName, scalarOpts) +
          renderScalarField("Email", "personal.email", draft.personal.email, scalarOpts) +
          renderScalarField("Phone", "personal.phone", draft.personal.phone, scalarOpts) +
          renderScalarField("Location", "personal.location", draft.personal.location, scalarOpts),
        sectionOpenState
      ) +
      collapsibleSection(
        "links",
        "Links",
        linkConflicts ? linkConflicts + " conflict" + (linkConflicts === 1 ? "" : "s") : "",
        renderScalarField("LinkedIn", "links.linkedin", draft.links.linkedin, scalarOpts) +
          renderScalarField("GitHub", "links.github", draft.links.github, scalarOpts) +
          renderScalarField("Portfolio", "links.portfolio", draft.links.portfolio, scalarOpts),
        sectionOpenState
      ) +
      collapsibleSection(
        "experience",
        "Experience",
        String(draft.experience.length),
        renderArraySourceLists("experience") +
          '<div class="review-selected-label">Selected experience</div>' +
          (draft.experience.length
            ? draft.experience.map(renderExperienceEntry).join("")
            : '<p class="resume-hint">No experience entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="experience">Add experience</button>',
        sectionOpenState
      ) +
      collapsibleSection(
        "education",
        "Education",
        String(draft.education.length),
        renderArraySourceLists("education") +
          '<div class="review-selected-label">Selected education</div>' +
          (draft.education.length
            ? draft.education.map(renderEducationEntry).join("")
            : '<p class="resume-hint">No education entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="education">Add education</button>',
        sectionOpenState
      ) +
      collapsibleSection(
        "projects",
        "Projects",
        String(draft.projects.length),
        renderArraySourceLists("projects") +
          '<div class="review-selected-label">Selected projects</div>' +
          (draft.projects.length
            ? draft.projects.map(renderProjectEntry).join("")
            : '<p class="resume-hint">No project entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="projects">Add project</button>',
        sectionOpenState
      ) +
      collapsibleSection(
        "skills",
        "Skills",
        String(draft.skills.length),
        renderStringListMode("skills", "skills", {
          draft: draft,
          showConflictUi: true,
          skillIdPrefix: "review"
        }),
        sectionOpenState
      ) +
      collapsibleSection(
        "certifications",
        "Certifications",
        String(draft.certifications.length),
        renderStringListMode("certifications", "certifications", {
          draft: draft,
          showConflictUi: true
        }),
        sectionOpenState
      );

    bindReviewEditorEvents(editor);
    renderParseSummary();
  }

  function bindReviewEditorEvents(editor) {
    editor.querySelectorAll("details.review-section").forEach((el) => {
      el.addEventListener("toggle", () => {
        const id = el.getAttribute("data-section-id");
        if (id) sectionOpenState[id] = el.open;
      });
    });

    editor.querySelectorAll("[data-scalar-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const path = btn.getAttribute("data-path");
        const choice = btn.getAttribute("data-scalar-choice");
        const conflict = path && scalarConflicts[path];
        if (!path || !conflict || !pendingDraft) return;
        conflictResolutions[path] = choice;
        const value = choice === "existing" ? conflict.existingValue : conflict.parsedValue;
        if (path.startsWith("personal.")) {
          pendingDraft.personal[path.split(".")[1]] = String(value || "");
        } else if (path.startsWith("links.")) {
          pendingDraft.links[path.split(".")[1]] = String(value || "");
        }
        captureSectionOpenState(editor, sectionOpenState);
        renderReviewEditor();
      });
    });

    editor.querySelectorAll(".array-mode-choices input[type='radio']").forEach((input) => {
      input.addEventListener("change", () => {
        const wrap = input.closest(".array-mode-choices");
        const section = wrap && wrap.getAttribute("data-array-section");
        if (!section) return;
        arrayModes[section] = input.value;
        applyArrayMode(section);
        captureSectionOpenState(editor, sectionOpenState);
        renderReviewEditor();
      });
    });

    editor.querySelectorAll(".review-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingDraft = syncDraftFromEditorElement(editor, pendingDraft);
        const section = btn.getAttribute("data-add");
        addEmptyEntry(pendingDraft, section);
        captureSectionOpenState(editor, sectionOpenState);
        renderReviewEditor();
      });
    });

    editor.querySelectorAll(".review-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingDraft = syncDraftFromEditorElement(editor, pendingDraft);
        const section = btn.getAttribute("data-remove");
        const index = Number(btn.getAttribute("data-index"));
        if (!section || Number.isNaN(index)) return;
        if (Array.isArray(pendingDraft[section])) {
          pendingDraft[section].splice(index, 1);
        }
        captureSectionOpenState(editor, sectionOpenState);
        renderReviewEditor();
      });
    });

    editor.querySelectorAll(".skill-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-skill-index"));
        if (Number.isNaN(index) || !pendingDraft) return;
        pendingDraft.skills.splice(index, 1);
        captureSectionOpenState(editor, sectionOpenState);
        renderReviewEditor();
      });
    });

    const addSkillBtn = editor.querySelector("#reviewAddSkillBtn");
    const addSkillInput = editor.querySelector("#reviewAddSkillInput");
    const addSkill = () => {
      if (!pendingDraft || !addSkillInput) return;
      const value = String(addSkillInput.value || "").trim();
      if (!value) return;
      pendingDraft.skills = dedupeStrings(pendingDraft.skills.concat([value]));
      addSkillInput.value = "";
      captureSectionOpenState(editor, sectionOpenState);
      renderReviewEditor();
      const next = document.getElementById("reviewAddSkillInput");
      if (next) next.focus();
    };
    if (addSkillBtn) addSkillBtn.addEventListener("click", addSkill);
    if (addSkillInput) {
      addSkillInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addSkill();
        }
      });
    }

    editor.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => {
        const field = el.getAttribute("data-field") || "";
        if (scalarConflicts[field]) {
          conflictResolutions[field] = "parsed";
          const wrap = el.closest(".review-scalar");
          if (wrap) {
            wrap.querySelectorAll(".choice-chip").forEach((chip) => {
              chip.classList.toggle("active", chip.getAttribute("data-scalar-choice") === "parsed");
            });
          }
        }
      });
    });
  }

  function addEmptyEntry(draft, section) {
    if (!draft || !section) return;
    if (section === "experience") {
      draft.experience.push({
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
        bullets: []
      });
    } else if (section === "education") {
      draft.education.push({
        institution: "",
        degree: "",
        field: "",
        location: "",
        startDate: "",
        endDate: "",
        gpa: ""
      });
    } else if (section === "projects") {
      draft.projects.push({
        name: "",
        description: "",
        technologies: [],
        url: ""
      });
    }
  }

  function setPathValue(target, path, value) {
    const parts = String(path || "").split(".");
    if (!parts.length) return;

    let cursor = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      const next = parts[i + 1];
      const keyIsIndex = /^\d+$/.test(key);
      const nextIsIndex = /^\d+$/.test(next);

      if (keyIsIndex) {
        const idx = Number(key);
        if (!Array.isArray(cursor)) return;
        if (cursor[idx] == null) {
          cursor[idx] = nextIsIndex ? [] : {};
        }
        cursor = cursor[idx];
      } else {
        if (cursor[key] == null) {
          cursor[key] = nextIsIndex ? [] : {};
        }
        cursor = cursor[key];
      }
    }

    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      if (!Array.isArray(cursor)) return;
      cursor[Number(last)] = value;
    } else {
      cursor[last] = value;
    }
  }

  function syncDraftFromEditorElement(editor, currentDraft) {
    if (!editor || !currentDraft) return currentDraft;

    const draft = cloneDraft(currentDraft);
    editor.querySelectorAll("[data-field]").forEach((el) => {
      const field = el.getAttribute("data-field");
      if (!field) return;

      if (field === "certifications") {
        draft.certifications = dedupeStrings(
          String(el.value || "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
        return;
      }

      if (field.endsWith(".isCurrent")) {
        setPathValue(draft, field, Boolean(el.checked));
        return;
      }

      if (field.endsWith(".bullets")) {
        const bullets = String(el.value || "")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        setPathValue(draft, field, bullets);
        return;
      }

      if (field.endsWith(".technologies")) {
        const techs = String(el.value || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setPathValue(draft, field, techs);
        return;
      }

      setPathValue(draft, field, String(el.value || ""));
    });

    draft.skills = dedupeStrings(draft.skills);
    draft.experience = dedupeEntries(draft.experience);
    draft.education = dedupeEntries(draft.education);
    draft.projects = dedupeEntries(draft.projects);
    return normalizeDraft(draft);
  }

  function syncDraftFromEditor() {
    if (!pendingDraft) return;
    const editor = document.getElementById("resumeReviewEditor");
    pendingDraft = syncDraftFromEditorElement(editor, pendingDraft);
  }

  function setMasterProfileStatus(message, isError) {
    const statusEl = document.getElementById("masterProfileStatus");
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function setMasterProfileFooterVisible(visible) {
    const footer = document.getElementById("masterProfileFooter");
    if (footer) footer.hidden = !visible;
  }

  function clearMasterEditor(options) {
    const opts = options || {};
    masterEditDraft = null;
    masterEditBaseline = null;
    masterEditLoaded = false;
    const editor = document.getElementById("masterProfileEditor");
    if (editor) editor.innerHTML = "";
    if (!opts.keepStatus) {
      setMasterProfileStatus("", false);
    }
    setMasterProfileFooterVisible(false);
  }

  function renderMasterEditor() {
    const editor = document.getElementById("masterProfileEditor");
    if (!editor || !masterEditDraft) return;

    const draft = masterEditDraft;
    const scalarOpts = { includeConflicts: false };

    editor.innerHTML =
      collapsibleSection(
        "personal",
        "Personal information",
        "",
        renderScalarField("First name", "personal.firstName", draft.personal.firstName, scalarOpts) +
          renderScalarField("Last name", "personal.lastName", draft.personal.lastName, scalarOpts) +
          renderScalarField("Email", "personal.email", draft.personal.email, scalarOpts) +
          renderScalarField("Phone", "personal.phone", draft.personal.phone, scalarOpts) +
          renderScalarField("Location", "personal.location", draft.personal.location, scalarOpts),
        masterSectionOpenState
      ) +
      collapsibleSection(
        "links",
        "Links",
        "",
        renderScalarField("LinkedIn", "links.linkedin", draft.links.linkedin, scalarOpts) +
          renderScalarField("GitHub", "links.github", draft.links.github, scalarOpts) +
          renderScalarField("Portfolio", "links.portfolio", draft.links.portfolio, scalarOpts),
        masterSectionOpenState
      ) +
      collapsibleSection(
        "experience",
        "Experience",
        String(draft.experience.length),
        (draft.experience.length
          ? draft.experience.map(renderExperienceEntry).join("")
          : '<p class="resume-hint">No experience entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="experience">Add experience</button>',
        masterSectionOpenState
      ) +
      collapsibleSection(
        "education",
        "Education",
        String(draft.education.length),
        (draft.education.length
          ? draft.education.map(renderEducationEntry).join("")
          : '<p class="resume-hint">No education entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="education">Add education</button>',
        masterSectionOpenState
      ) +
      collapsibleSection(
        "projects",
        "Projects",
        String(draft.projects.length),
        (draft.projects.length
          ? draft.projects.map(renderProjectEntry).join("")
          : '<p class="resume-hint">No project entries.</p>') +
          '<button type="button" class="action btn-secondary review-add" data-add="projects">Add project</button>',
        masterSectionOpenState
      ) +
      collapsibleSection(
        "skills",
        "Skills",
        String(draft.skills.length),
        renderStringListMode("skills", "skills", {
          draft: draft,
          showConflictUi: false,
          skillIdPrefix: "master"
        }),
        masterSectionOpenState
      ) +
      collapsibleSection(
        "certifications",
        "Certifications",
        String(draft.certifications.length),
        renderStringListMode("certifications", "certifications", {
          draft: draft,
          showConflictUi: false
        }),
        masterSectionOpenState
      );

    bindMasterEditorEvents(editor);
    setMasterProfileFooterVisible(true);
  }

  function bindMasterEditorEvents(editor) {
    editor.querySelectorAll("details.review-section").forEach((el) => {
      el.addEventListener("toggle", () => {
        const id = el.getAttribute("data-section-id");
        if (id) masterSectionOpenState[id] = el.open;
      });
    });

    editor.querySelectorAll(".review-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        masterEditDraft = syncDraftFromEditorElement(editor, masterEditDraft);
        addEmptyEntry(masterEditDraft, btn.getAttribute("data-add"));
        captureSectionOpenState(editor, masterSectionOpenState);
        renderMasterEditor();
      });
    });

    editor.querySelectorAll(".review-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        masterEditDraft = syncDraftFromEditorElement(editor, masterEditDraft);
        const section = btn.getAttribute("data-remove");
        const index = Number(btn.getAttribute("data-index"));
        if (!section || Number.isNaN(index)) return;
        if (Array.isArray(masterEditDraft[section])) {
          masterEditDraft[section].splice(index, 1);
        }
        captureSectionOpenState(editor, masterSectionOpenState);
        renderMasterEditor();
      });
    });

    editor.querySelectorAll(".skill-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-skill-index"));
        if (Number.isNaN(index) || !masterEditDraft) return;
        masterEditDraft.skills.splice(index, 1);
        captureSectionOpenState(editor, masterSectionOpenState);
        renderMasterEditor();
      });
    });

    const addSkillBtn = editor.querySelector("#masterAddSkillBtn");
    const addSkillInput = editor.querySelector("#masterAddSkillInput");
    const addSkill = () => {
      if (!masterEditDraft || !addSkillInput) return;
      const value = String(addSkillInput.value || "").trim();
      if (!value) return;
      masterEditDraft.skills = dedupeStrings(masterEditDraft.skills.concat([value]));
      addSkillInput.value = "";
      captureSectionOpenState(editor, masterSectionOpenState);
      renderMasterEditor();
      const next = document.getElementById("masterAddSkillInput");
      if (next) next.focus();
    };
    if (addSkillBtn) addSkillBtn.addEventListener("click", addSkill);
    if (addSkillInput) {
      addSkillInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addSkill();
        }
      });
    }
  }

  async function loadMasterProfileEditor() {
    const storage = ensureStorage();
    setMasterProfileStatus("Loading saved profile…", false);
    try {
      const profile = await storage.getMasterProfile();
      masterEditDraft = normalizeDraft(profile);
      masterEditBaseline = cloneDraft(masterEditDraft);
      masterEditLoaded = true;
      renderMasterEditor();
      setMasterProfileStatus("Loaded from local storage. Edit and save when ready.", false);
    } catch (error) {
      clearMasterEditor();
      setMasterProfileStatus(error.message || "Failed to load master profile.", true);
      setMasterProfileFooterVisible(false);
    }
  }

  async function saveMasterProfileEdits() {
    if (!masterEditDraft) {
      setMasterProfileStatus("Open View / Edit Master Profile to load your saved profile first.", true);
      return;
    }

    const storage = ensureStorage();
    const editor = document.getElementById("masterProfileEditor");
    masterEditDraft = syncDraftFromEditorElement(editor, masterEditDraft);

    try {
      const existing = await storage.getMasterProfile();
      const draft = normalizeDraft(masterEditDraft);
      const updated = {
        ...existing,
        personal: draft.personal,
        links: draft.links,
        experience: draft.experience,
        education: draft.education,
        projects: draft.projects,
        skills: draft.skills,
        certifications: draft.certifications,
        workAuthorization: existing.workAuthorization || {},
        commonAnswers: existing.commonAnswers || {},
        defaultResumeId: existing.defaultResumeId == null ? null : existing.defaultResumeId,
        createdAt: existing.createdAt
      };

      const saved = await storage.saveMasterProfile(updated);
      masterEditDraft = normalizeDraft(saved);
      masterEditBaseline = cloneDraft(masterEditDraft);
      masterEditLoaded = true;
      refreshCoreProfileInputs(saved);
      if (typeof global.refreshHomeStatus === "function") {
        global.refreshHomeStatus();
      }

      const details = document.getElementById("masterProfileDetails");
      const summary = details && details.querySelector("summary");
      if (details) {
        details.open = false;
      }
      clearMasterEditor({ keepStatus: true });
      setMasterProfileStatus("Master profile updated.", false);
      if (summary && typeof summary.scrollIntoView === "function") {
        summary.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (error) {
      setMasterProfileStatus(error.message || "Failed to save master profile.", true);
    }
  }

  function cancelMasterProfileEdits() {
    if (!masterEditBaseline) {
      clearMasterEditor();
      const details = document.getElementById("masterProfileDetails");
      if (details) details.open = false;
      return;
    }
    masterEditDraft = cloneDraft(masterEditBaseline);
    renderMasterEditor();
    setMasterProfileStatus("Unsaved changes discarded.", false);
  }

  async function refreshMasterProfileEditorIfOpen() {
    const details = document.getElementById("masterProfileDetails");
    if (!details || !details.open) return;
    await loadMasterProfileEditor();
  }

  function openReview(draft, masterProfile) {
    const master = masterProfile || {};
    parsedSnapshot = normalizeDraft(draft);
    masterSnapshot = normalizeDraft({
      personal: master.personal,
      links: master.links,
      experience: master.experience,
      education: master.education,
      projects: master.projects,
      skills: master.skills,
      certifications: master.certifications
    });
    pendingDraft = cloneDraft(parsedSnapshot);
    scalarConflicts = detectScalarConflicts(masterSnapshot, parsedSnapshot);
    conflictResolutions = {};
    Object.keys(scalarConflicts).forEach((id) => {
      conflictResolutions[id] = "parsed";
    });

    arrayModes = {
      experience: initialArrayMode(masterSnapshot.experience, parsedSnapshot.experience),
      education: initialArrayMode(masterSnapshot.education, parsedSnapshot.education),
      projects: initialArrayMode(masterSnapshot.projects, parsedSnapshot.projects),
      skills: initialArrayMode(masterSnapshot.skills, parsedSnapshot.skills),
      certifications: initialArrayMode(masterSnapshot.certifications, parsedSnapshot.certifications)
    };

    ["experience", "education", "projects", "skills", "certifications"].forEach((section) => {
      applyArrayMode(section);
    });

    showReviewPanel({ expanded: true });
    renderReviewEditor();
    setReviewStatus("Review the extracted profile, then approve to save.", false);
    const panel = document.getElementById("resumeReviewPanel");
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function mapParseError(result, response) {
    if (!response) {
      return "Backend is unavailable. Start the FastAPI server and try again.";
    }
    if (!result || typeof result !== "object") {
      return "Backend returned an invalid response.";
    }
    if (result.status === "dev_mode") {
      return (
        "AI provider is not configured (dev_mode). " +
        (result.message || "Set the API key in brandfit-backend/.env and restart the server.")
      );
    }

    const detailText = String(
      result.message ||
        (typeof result.detail === "string" ? result.detail : "") ||
        "Resume parsing failed."
    );

    if (/unreadable|could not extract|failed to extract|empty text|no text/i.test(detailText)) {
      return "Resume is unreadable. Try a different PDF or DOCX file.";
    }

    if (result.status === "error") {
      return detailText;
    }
    if (!response.ok) {
      return "Parse failed: " + (detailText || "HTTP " + response.status);
    }
    return "Backend returned an invalid response.";
  }

  async function parseStoredResume() {
    if (parsingInProgress) return;

    const storage = ensureStorage();
    const parseBtn = document.getElementById("resumeParseBtn");

    setStatus("Parsing resume...", false);
    setReviewStatus("", false);
    parsingInProgress = true;
    if (parseBtn) parseBtn.disabled = true;

    try {
      const resume = await storage.getDefaultResume();
      if (!resume || !resume.fileData) {
        throw new Error("No default resume is uploaded. Upload a resume before parsing.");
      }

      let blob;
      try {
        blob = dataUrlToBlob(resume.fileData);
      } catch (error) {
        throw new Error(error.message || "Stored resume data is unreadable.");
      }

      const fileName = resume.name || "resume.pdf";
      const file = new File([blob], fileName, {
        type: resume.type || blob.type || "application/octet-stream"
      });

      const formData = new FormData();
      formData.append("file", file);

      let response;
      try {
        response = await fetch(PARSE_RESUME_URL, {
          method: "POST",
          body: formData
        });
      } catch (_) {
        throw new Error("Backend is unavailable. Start the FastAPI server and try again.");
      }

      let result;
      try {
        result = await response.json();
      } catch (_) {
        throw new Error("Backend returned an invalid response.");
      }

      if (!response.ok || !result || result.status !== "success") {
        throw new Error(mapParseError(result, response));
      }

      if (!result.profile_draft || typeof result.profile_draft !== "object") {
        throw new Error("Backend returned an invalid response.");
      }

      const master = await storage.getMasterProfile();
      openReview(result.profile_draft, master);
      setStatus("Parse complete. Review the draft below — nothing is saved yet.", false);
    } catch (error) {
      hideReviewPanel();
      setStatus(error.message || "Failed to parse resume.", true);
    } finally {
      parsingInProgress = false;
      if (parseBtn) parseBtn.disabled = false;
      await refreshResumeUI();
    }
  }

  function refreshCoreProfileInputs(profile) {
    const personal = (profile && profile.personal) || {};
    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const email = document.getElementById("email");
    if (firstName) firstName.value = personal.firstName || "";
    if (lastName) lastName.value = personal.lastName || "";
    if (email) email.value = personal.email || "";
  }

  async function approveReviewedDraft() {
    if (!pendingDraft) {
      setReviewStatus("Nothing to approve. Parse a resume first.", true);
      return;
    }

    const storage = ensureStorage();
    syncDraftFromEditor();

    try {
      const master = await storage.getMasterProfile();
      const reviewed = normalizeDraft(pendingDraft);
      // List sections are already resolved in the reviewed draft (existing/parsed/both + dedupe).
      // Force merge to use the reviewed arrays while still honoring per-field scalar choices.
      const resolutions = Object.assign({}, conflictResolutions, {
        experience: "parsed",
        education: "parsed",
        projects: "parsed",
        skills: "parsed",
        certifications: "parsed"
      });
      const merged = storage.mergeApprovedProfileDraft(master, reviewed, resolutions);
      await storage.saveMasterProfile(merged);
      refreshCoreProfileInputs(merged);
      if (typeof global.refreshHomeStatus === "function") {
        global.refreshHomeStatus();
      }
      hideReviewPanel();
      setStatus("Parsed profile approved and saved to master profile.", false);
      refreshMasterProfileEditorIfOpen();
    } catch (error) {
      setReviewStatus(error.message || "Failed to save approved profile.", true);
    }
  }

  function cancelReview() {
    hideReviewPanel();
    setStatus("Parse review cancelled. Master profile unchanged.", false);
  }

  async function handleSelectedFile(file, replaceConfirmed) {
    setStatus("Saving resume…", false);
    try {
      await saveUploadedResume(file, { replaceConfirmed: Boolean(replaceConfirmed) });
      await refreshResumeUI();
      setStatus("Resume saved as default.", false);
    } catch (error) {
      if (error && error.code === "CONFIRM_REPLACE") {
        const accepted = window.confirm(
          'Replace the current default resume with "' +
            (file && file.name ? file.name : "this file") +
            '"?'
        );
        if (!accepted) {
          setStatus("Replace cancelled.", false);
          return;
        }
        await handleSelectedFile(file, true);
        return;
      }
      setStatus(error.message || "Failed to save resume.", true);
    }
  }

  function bindResumeUI() {
    const uploadInput = document.getElementById("resumeFileInput");
    const replaceInput = document.getElementById("resumeReplaceInput");
    const uploadBtn = document.getElementById("resumeUploadBtn");
    const replaceBtn = document.getElementById("resumeReplaceBtn");
    const removeBtn = document.getElementById("resumeRemoveBtn");
    const parseBtn = document.getElementById("resumeParseBtn");
    const approveBtn = document.getElementById("resumeApproveBtn");
    const cancelBtn = document.getElementById("resumeCancelReviewBtn");
    const masterDetails = document.getElementById("masterProfileDetails");
    const masterSaveBtn = document.getElementById("masterProfileSaveBtn");
    const masterCancelBtn = document.getElementById("masterProfileCancelBtn");

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener("click", () => uploadInput.click());
    }

    if (replaceBtn && replaceInput) {
      replaceBtn.addEventListener("click", () => replaceInput.click());
    }

    if (uploadInput) {
      uploadInput.addEventListener("change", async () => {
        const file = uploadInput.files && uploadInput.files[0];
        uploadInput.value = "";
        if (!file) return;
        await handleSelectedFile(file, false);
      });
    }

    if (replaceInput) {
      replaceInput.addEventListener("change", async () => {
        const file = replaceInput.files && replaceInput.files[0];
        replaceInput.value = "";
        if (!file) return;
        await handleSelectedFile(file, false);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        try {
          await removeDefaultResume({ removeConfirmed: false });
        } catch (error) {
          if (error && error.code === "CONFIRM_REMOVE") {
            const accepted = window.confirm(
              'Remove the default resume "' +
                ((error.existing && error.existing.name) || "current file") +
                '"? This cannot be undone.'
            );
            if (!accepted) {
              setStatus("Remove cancelled.", false);
              return;
            }

            try {
              await removeDefaultResume({ removeConfirmed: true });
              hideReviewPanel();
              await refreshResumeUI();
              setStatus("Default resume removed.", false);
            } catch (removeError) {
              setStatus(removeError.message || "Failed to remove resume.", true);
            }
            return;
          }
          setStatus(error.message || "Failed to remove resume.", true);
        }
      });
    }

    if (parseBtn) {
      parseBtn.addEventListener("click", () => {
        parseStoredResume();
      });
    }

    if (approveBtn) {
      approveBtn.addEventListener("click", () => {
        approveReviewedDraft();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        cancelReview();
      });
    }

    if (masterDetails) {
      masterDetails.addEventListener("toggle", () => {
        if (masterDetails.open) {
          loadMasterProfileEditor();
        } else {
          // Collapse hides the editor UI; discard unsaved working copy until reopened.
          clearMasterEditor();
        }
      });
    }

    if (masterSaveBtn) {
      masterSaveBtn.addEventListener("click", () => {
        saveMasterProfileEdits();
      });
    }

    if (masterCancelBtn) {
      masterCancelBtn.addEventListener("click", () => {
        cancelMasterProfileEdits();
      });
    }
  }

  function init() {
    bindResumeUI();
    clearMasterEditor();
    hideReviewPanel();
    return refreshResumeUI();
  }

  global.ImpulsoResume = {
    init: init,
    refresh: refreshResumeUI,
    validateFile: validateFile,
    saveUploadedResume: saveUploadedResume,
    removeDefaultResume: removeDefaultResume,
    getDefaultResume: getDefaultResume,
    parseStoredResume: parseStoredResume,
    loadMasterProfileEditor: loadMasterProfileEditor,
    formatFileSize: formatFileSize,
    formatUploadDate: formatUploadDate,
    MAX_RESUME_BYTES: MAX_RESUME_BYTES
  };
})(typeof window !== "undefined" ? window : self);
