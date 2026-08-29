(function (global) {
  "use strict";

  const APPLICATION_STATUSES = ["Applied", "Interview", "Rejected", "Offer", "Withdrawn"];
  const CSV_COLUMNS = [
    ["application_id", "id"],
    ["company", "company"],
    ["job_title", "title"],
    ["job_url", "jobUrl"],
    ["location", "location"],
    ["platform", "atsPlatform"],
    ["date_applied", "appliedAt"],
    ["status", "status"],
    ["status_updated_at", "statusUpdatedAt"],
    ["resume_type", "resumeType"],
    ["resume_name", "resumeName"],
    ["match_score", "matchScore"],
    ["notes", "notes"]
  ];

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeStatus(value) {
    const text = clean(value).toLowerCase();
    const match = APPLICATION_STATUSES.find((status) => status.toLowerCase() === text);
    return match || "Applied";
  }

  function scoreFromAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return null;
    const raw = analysis.matchScore != null ? analysis.matchScore : analysis.match_score;
    const score = Number(raw);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
  }

  function findStoredMatchScore(currentJob, lookup) {
    const direct = scoreFromAnalysis(lookup && lookup.analysis);
    if (direct != null) return direct;
    const latest = scoreFromAnalysis(currentJob && currentJob.matchAnalysis);
    if (latest != null) return latest;
    const analyses = currentJob && currentJob.matchAnalyses;
    if (!analyses || typeof analyses !== "object") return null;
    const ordered = Object.keys(analyses)
      .map((key) => analyses[key])
      .filter(Boolean)
      .sort((left, right) =>
        String(right.analyzedAt || "").localeCompare(String(left.analyzedAt || ""))
      );
    for (const analysis of ordered) {
      const score = scoreFromAnalysis(analysis);
      if (score != null) return score;
    }
    return null;
  }

  function hashText(value) {
    const text = clean(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function normalizeApplication(input) {
    const source = input && typeof input === "object" ? input : {};
    const company = clean(source.company);
    const title = clean(source.title || source.jobTitle);
    const jobUrl = clean(source.jobUrl || source.url);
    const jobId = clean(source.jobId) || "job-" + hashText([jobUrl, company, title].join("|"));
    const hasScore =
      source.matchScore !== null &&
      source.matchScore !== undefined &&
      clean(source.matchScore) !== "";
    const score = hasScore ? Number(source.matchScore) : NaN;
    const resumeType = ["default", "tailored", "none"].includes(source.resumeType)
      ? source.resumeType
      : "none";
    const timestamp = new Date().toISOString();

    return {
      id: clean(source.id) || "application-" + jobId,
      jobId: jobId,
      company: company,
      title: title,
      jobUrl: jobUrl,
      location: clean(source.location),
      atsPlatform: clean(source.atsPlatform || source.platform) || "generic",
      appliedAt: clean(source.appliedAt || source.dateApplied) || timestamp,
      status: normalizeStatus(source.status),
      statusUpdatedAt: clean(source.statusUpdatedAt) || timestamp,
      resumeId: clean(source.resumeId),
      resumeName: clean(source.resumeName),
      resumeType: resumeType,
      matchScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
      notes: clean(source.notes),
      createdAt: clean(source.createdAt) || timestamp,
      updatedAt: clean(source.updatedAt) || timestamp
    };
  }

  function escapeCsvValue(value) {
    const text = value == null ? "" : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function applicationsToCsv(applications) {
    const rows = [CSV_COLUMNS.map((column) => escapeCsvValue(column[0])).join(",")];
    (Array.isArray(applications) ? applications : []).forEach((application) => {
      const row = normalizeApplication(application);
      rows.push(
        CSV_COLUMNS.map((column) => escapeCsvValue(row[column[1]])).join(",")
      );
    });
    return rows.join("\r\n");
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const source = String(text || "");

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const next = source[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          value += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          value += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(value);
        value = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        if (row.some((item) => clean(item))) rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some((item) => clean(item))) rows.push(row);
    return rows;
  }

  function parseApplicationsCsv(text) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => clean(header).toLowerCase());
    const indexByHeader = {};
    headers.forEach((header, index) => {
      indexByHeader[header] = index;
    });

    return rows
      .slice(1)
      .map((row) => {
        const source = {};
        CSV_COLUMNS.forEach((column) => {
          const index = indexByHeader[column[0]];
          if (index !== undefined) source[column[1]] = row[index] || "";
        });
        return normalizeApplication(source);
      })
      .filter((application) => application.company || application.title || application.jobUrl);
  }

  function setListStatus(message, isError) {
    if (typeof document === "undefined") return;
    const element = document.getElementById("applicationListStatus");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  function setTrackStatus(message, isError) {
    if (typeof document === "undefined") return;
    const element = document.getElementById("applicationTrackStatus");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return clean(value) || "Not available";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatPlatform(value) {
    const key = clean(value).toLowerCase();
    const labels = {
      greenhouse: "Greenhouse",
      smartrecruiters: "SmartRecruiters",
      workday: "Workday",
      lever: "Lever",
      ashby: "Ashby",
      icims: "iCIMS",
      generic: "Other"
    };
    return labels[key] || clean(value) || "Other";
  }

  function addMeta(container, label, value) {
    const item = document.createElement("div");
    item.className = "application-meta-item";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const text = document.createElement("span");
    text.textContent = value || "Not available";
    item.appendChild(strong);
    item.appendChild(text);
    container.appendChild(item);
  }

  function isSafeJobUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function renderApplicationCard(application) {
    const card = document.createElement("article");
    card.className = "application-card";

    const header = document.createElement("div");
    header.className = "application-card-header";
    const heading = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "application-card-title";
    title.textContent = application.title || "Untitled role";
    const company = document.createElement("div");
    company.className = "application-card-company";
    company.textContent = application.company || "Unknown company";
    heading.appendChild(title);
    heading.appendChild(company);
    header.appendChild(heading);

    if (isSafeJobUrl(application.jobUrl)) {
      const link = document.createElement("a");
      link.className = "application-link";
      link.href = application.jobUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open job";
      header.appendChild(link);
    }

    const meta = document.createElement("div");
    meta.className = "application-meta";
    addMeta(meta, "Applied", formatDate(application.appliedAt));
    addMeta(meta, "Platform", formatPlatform(application.atsPlatform));
    addMeta(
      meta,
      "Resume",
      application.resumeName || (application.resumeType === "tailored" ? "Tailored resume" : "Default resume")
    );
    addMeta(
      meta,
      "Match score",
      application.matchScore == null ? "Not analyzed" : application.matchScore + "%"
    );

    const editor = document.createElement("div");
    editor.className = "application-editor";
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Status";
    const statusSelect = document.createElement("select");
    statusSelect.className = "application-status-select";
    APPLICATION_STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
    statusSelect.value = normalizeStatus(application.status);
    statusSelect.addEventListener("change", async () => {
      try {
        await global.ImpulsoStorage.saveApplication({
          ...application,
          status: statusSelect.value
        });
        setListStatus("Status updated.", false);
        await refreshApplications();
      } catch (error) {
        setListStatus(error.message || "Failed to update status.", true);
      }
    });

    const notesLabel = document.createElement("label");
    notesLabel.textContent = "Notes";
    const notes = document.createElement("textarea");
    notes.className = "application-notes";
    notes.placeholder = "Interview date, recruiter name, or follow-up reminder";
    notes.value = application.notes || "";

    const actions = document.createElement("div");
    actions.className = "application-card-actions";
    const saveButton = document.createElement("button");
    saveButton.className = "action btn-secondary";
    saveButton.type = "button";
    saveButton.textContent = "Save Notes";
    saveButton.addEventListener("click", async () => {
      try {
        await global.ImpulsoStorage.saveApplication({
          ...application,
          notes: notes.value
        });
        setListStatus("Notes saved.", false);
        await refreshApplications();
      } catch (error) {
        setListStatus(error.message || "Failed to save notes.", true);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "action btn-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      if (!global.confirm("Delete this tracked application?")) return;
      try {
        await global.ImpulsoStorage.deleteApplication(application.id);
        setListStatus("Application deleted.", false);
        await refreshApplications();
        if (typeof global.refreshHomeStatus === "function") global.refreshHomeStatus();
      } catch (error) {
        setListStatus(error.message || "Failed to delete application.", true);
      }
    });

    actions.appendChild(saveButton);
    actions.appendChild(deleteButton);
    editor.appendChild(statusLabel);
    editor.appendChild(statusSelect);
    editor.appendChild(notesLabel);
    editor.appendChild(notes);
    editor.appendChild(actions);
    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(editor);
    return card;
  }

  async function refreshApplications() {
    if (typeof document === "undefined" || !global.ImpulsoStorage) return [];
    const list = document.getElementById("applicationsList");
    const empty = document.getElementById("applicationEmptyState");
    const summary = document.getElementById("applicationSummary");
    const filter = document.getElementById("applicationStatusFilter");
    if (!list || !empty || !summary) return [];

    try {
      const applications = await global.ImpulsoStorage.listApplications();
      const filterValue = filter ? filter.value : "all";
      const visible = applications.filter(
        (application) => filterValue === "all" || application.status === filterValue
      );
      const interviews = applications.filter((application) => application.status === "Interview").length;
      const offers = applications.filter((application) => application.status === "Offer").length;
      summary.textContent =
        applications.length +
        (applications.length === 1 ? " application" : " applications") +
        " · " +
        interviews +
        " interviews · " +
        offers +
        " offers";

      list.innerHTML = "";
      visible.forEach((application) => list.appendChild(renderApplicationCard(application)));
      list.hidden = visible.length === 0;
      empty.hidden = visible.length > 0;
      empty.textContent = applications.length
        ? "No applications match this status."
        : "No applications tracked yet. Mark a submitted application from Current Job.";
      return applications;
    } catch (error) {
      setListStatus(error.message || "Failed to load applications.", true);
      return [];
    }
  }

  async function refreshMarkButton() {
    if (typeof document === "undefined" || !global.ImpulsoStorage) return;
    const button = document.getElementById("markAppliedBtn");
    if (!button) return;
    try {
      const job = await global.ImpulsoStorage.getCurrentJob();
      if (!job) {
        button.textContent = "Mark as Applied";
        return;
      }
      const existing = await global.ImpulsoStorage.getApplication("application-" + job.id);
      button.textContent = existing ? "Application Tracked" : "Mark as Applied";
    } catch (_) {
      button.textContent = "Mark as Applied";
    }
  }

  async function markCurrentJobApplied() {
    if (!global.ImpulsoStorage) throw new Error("Application storage is unavailable.");
    const currentJob = await global.ImpulsoStorage.getCurrentJob();
    if (!currentJob || !currentJob.id) {
      throw new Error("Extract the current job before marking it as applied.");
    }

    const id = "application-" + currentJob.id;
    const existing = await global.ImpulsoStorage.getApplication(id);
    if (existing) {
      setTrackStatus("This application is already tracked.", false);
      return existing;
    }

    let selected = { selection: "none", document: null };
    try {
      selected = await global.ImpulsoStorage.getSelectedResumeDocumentForJob(currentJob.id);
    } catch (_) {
      selected = { selection: "none", document: null };
    }

    let matchScore = null;
    try {
      const match = await global.ImpulsoStorage.getJobMatchAnalysisForJob(currentJob.id);
      matchScore = findStoredMatchScore(currentJob, match);
    } catch (_) {
      matchScore = findStoredMatchScore(currentJob, null);
    }

    const resumeDocument = selected.document || null;
    const saved = await global.ImpulsoStorage.saveApplication({
      id: id,
      jobId: currentJob.id,
      company: currentJob.company,
      title: currentJob.title,
      jobUrl: currentJob.url,
      location: currentJob.location,
      atsPlatform: currentJob.atsPlatform,
      status: "Applied",
      resumeId: resumeDocument && resumeDocument.id,
      resumeName: resumeDocument && resumeDocument.name,
      resumeType: resumeDocument ? selected.selection : "none",
      matchScore: matchScore,
      appliedAt: new Date().toISOString()
    });

    setTrackStatus("Application saved as Applied.", false);
    await refreshMarkButton();
    await refreshApplications();
    if (typeof global.refreshHomeStatus === "function") global.refreshHomeStatus();
    return saved;
  }

  async function exportApplications() {
    const applications = await global.ImpulsoStorage.listApplications();
    if (!applications.length) {
      setListStatus("No applications to export.", true);
      return;
    }
    const csv = applicationsToCsv(applications);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "impulso-applications-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setListStatus(applications.length + " applications exported.", false);
  }

  async function importApplications(file) {
    const applications = parseApplicationsCsv(await file.text());
    if (!applications.length) {
      throw new Error("No valid applications were found in this CSV.");
    }
    for (const application of applications) {
      await global.ImpulsoStorage.saveApplication(application);
    }
    setListStatus(applications.length + " applications imported.", false);
    await refreshApplications();
    if (typeof global.refreshHomeStatus === "function") global.refreshHomeStatus();
  }

  function initUi() {
    const markButton = document.getElementById("markAppliedBtn");
    const filter = document.getElementById("applicationStatusFilter");
    const exportButton = document.getElementById("exportApplicationsBtn");
    const importButton = document.getElementById("importApplicationsBtn");
    const fileInput = document.getElementById("applicationsCsvInput");

    if (markButton) {
      markButton.addEventListener("click", async () => {
        setTrackStatus("Saving application...", false);
        try {
          await markCurrentJobApplied();
        } catch (error) {
          setTrackStatus(error.message || "Failed to save application.", true);
        }
      });
    }
    if (filter) filter.addEventListener("change", refreshApplications);
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        exportApplications().catch((error) =>
          setListStatus(error.message || "Failed to export applications.", true)
        );
      });
    }
    if (importButton && fileInput) {
      importButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          await importApplications(file);
        } catch (error) {
          setListStatus(error.message || "Failed to import applications.", true);
        } finally {
          fileInput.value = "";
        }
      });
    }

    refreshMarkButton();
    refreshApplications();
  }

  global.ImpulsoApplications = {
    APPLICATION_STATUSES: APPLICATION_STATUSES.slice(),
    normalizeApplication: normalizeApplication,
    findStoredMatchScore: findStoredMatchScore,
    applicationsToCsv: applicationsToCsv,
    parseApplicationsCsv: parseApplicationsCsv,
    refresh: refreshApplications,
    refreshMarkButton: refreshMarkButton,
    markCurrentJobApplied: markCurrentJobApplied
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initUi);
  }
})(typeof window !== "undefined" ? window : globalThis);
