(function (global) {
  "use strict";

  const DB_NAME = "impulso-db";
  const DB_VERSION = 1;
  const MASTER_PROFILE_ID = "master";
  const SETTINGS_KEY = "impulsoSettings";

  const STORE_PROFILES = "profiles";
  const STORE_DOCUMENTS = "documents";
  const STORE_JOBS = "jobs";
  const STORE_APPLICATIONS = "applications";
  const STORE_JOB_PROFILES = "jobProfiles";

  const LEGACY_PROFILE_KEYS = [
    "firstName",
    "lastName",
    "email",
    "github",
    "linkedin",
    "resumeBase64",
    "resumeName"
  ];

  let dbPromise = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function createDefaultWorkAuthorization(overrides) {
    const base = {
      countryApplyingIn: "",
      legallyAuthorizedToWork: "",
      requireSponsorshipNow: "",
      requireSponsorshipFuture: "",
      currentVisaStatus: "",
      visaExpirationDate: ""
    };
    return { ...base, ...(overrides || {}) };
  }

  function createDefaultApplicationPreferences(overrides) {
    const base = {
      availableStartDate: "",
      noticePeriod: "",
      employmentTypePreference: "",
      willingToRelocate: "",
      preferredLocations: "",
      workLocationPreference: ""
    };
    return { ...base, ...(overrides || {}) };
  }

  function createDefaultCommonAnswers(overrides) {
    const base = {
      salaryExpectation: "",
      referralSource: "",
      linkedinMessageOrAdditionalInfo: "",
      defaultCoverLetter: "",
      whyInterestedInRole: "",
      anythingElseToKnow: ""
    };
    return { ...base, ...(overrides || {}) };
  }

  function createDefaultDemographics(overrides) {
    const base = {
      gender: "",
      raceEthnicity: "",
      veteranStatus: "",
      disabilityStatus: ""
    };
    return { ...base, ...(overrides || {}) };
  }

  function createDefaultMasterProfile(overrides) {
    const timestamp = nowIso();
    const base = {
      id: MASTER_PROFILE_ID,
      schemaVersion: 1,
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
      certifications: [],
      workAuthorization: createDefaultWorkAuthorization(),
      applicationPreferences: createDefaultApplicationPreferences(),
      commonAnswers: createDefaultCommonAnswers(),
      demographics: createDefaultDemographics(),
      defaultResumeId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (!overrides) return base;

    return {
      ...base,
      ...overrides,
      personal: { ...base.personal, ...(overrides.personal || {}) },
      links: { ...base.links, ...(overrides.links || {}) },
      experience: overrides.experience || base.experience,
      education: overrides.education || base.education,
      projects: overrides.projects || base.projects,
      skills: overrides.skills || base.skills,
      certifications: overrides.certifications || base.certifications,
      workAuthorization: createDefaultWorkAuthorization(overrides.workAuthorization),
      applicationPreferences: createDefaultApplicationPreferences(overrides.applicationPreferences),
      commonAnswers: createDefaultCommonAnswers(overrides.commonAnswers),
      demographics: createDefaultDemographics(overrides.demographics)
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB (" + DB_NAME + "): " + (request.error && request.error.message)));
      };

      request.onblocked = () => {
        reject(new Error("IndexedDB open blocked for " + DB_NAME + ". Close other Impulso tabs and try again."));
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
          db.createObjectStore(STORE_DOCUMENTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_JOBS)) {
          db.createObjectStore(STORE_JOBS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_APPLICATIONS)) {
          db.createObjectStore(STORE_APPLICATIONS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_JOB_PROFILES)) {
          db.createObjectStore(STORE_JOB_PROFILES, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  function getDb() {
    if (!dbPromise) {
      dbPromise = openDatabase().catch((error) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(new Error(request.error ? request.error.message : "IndexedDB request failed"));
      };
    });
  }

  function withStore(storeName, mode, work) {
    return getDb().then((db) => {
      return new Promise((resolve, reject) => {
        let settled = false;
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        tx.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(resultHolder.value);
          }
        };

        tx.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error(tx.error ? tx.error.message : "IndexedDB transaction failed"));
          }
        };

        tx.onabort = () => {
          if (!settled) {
            settled = true;
            reject(new Error(tx.error ? tx.error.message : "IndexedDB transaction aborted"));
          }
        };

        const resultHolder = { value: undefined };

        let workResult;
        try {
          workResult = work(store);
        } catch (error) {
          if (!settled) {
            settled = true;
            try {
              tx.abort();
            } catch (_) {
              /* ignore */
            }
            reject(error);
          }
          return;
        }

        Promise.resolve(workResult)
          .then((value) => {
            resultHolder.value = value;
          })
          .catch((error) => {
            if (!settled) {
              settled = true;
              try {
                tx.abort();
              } catch (_) {
                /* ignore */
              }
              reject(error);
            }
          });
      });
    });
  }

  function chromeStorageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(data || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function chromeStorageSet(values) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(values, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function readProfileFromStore(store) {
    return idbRequest(store.get(MASTER_PROFILE_ID));
  }

  function writeProfileToStore(store, profile) {
    return idbRequest(store.put(profile)).then(() => profile);
  }

  function syncLegacyKeysFromProfile(profile) {
    const personal = (profile && profile.personal) || {};
    const links = (profile && profile.links) || {};

    return chromeStorageSet({
      firstName: personal.firstName || "",
      lastName: personal.lastName || "",
      email: personal.email || "",
      github: links.github || "",
      linkedin: links.linkedin || ""
    });
  }

  function hasLegacyProfileValues(legacy) {
    return Boolean(
      (legacy.firstName && String(legacy.firstName).trim()) ||
      (legacy.lastName && String(legacy.lastName).trim()) ||
      (legacy.email && String(legacy.email).trim()) ||
      (legacy.github && String(legacy.github).trim()) ||
      (legacy.linkedin && String(legacy.linkedin).trim())
    );
  }

  function buildProfileFromLegacy(legacy) {
    const timestamp = nowIso();
    return createDefaultMasterProfile({
      personal: {
        firstName: legacy.firstName || "",
        lastName: legacy.lastName || "",
        email: legacy.email || "",
        phone: "",
        location: ""
      },
      links: {
        linkedin: legacy.linkedin || "",
        github: legacy.github || "",
        portfolio: ""
      },
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  async function migrateLegacyProfileIfNeeded() {
    const existing = await withStore(STORE_PROFILES, "readonly", (store) => readProfileFromStore(store));
    if (existing) {
      return existing;
    }

    const legacy = await chromeStorageGet(LEGACY_PROFILE_KEYS);
    if (!hasLegacyProfileValues(legacy)) {
      return null;
    }

    const migrated = buildProfileFromLegacy(legacy);
    try {
      await withStore(STORE_PROFILES, "readwrite", (store) => writeProfileToStore(store, migrated));
      await syncLegacyKeysFromProfile(migrated);
      return migrated;
    } catch (error) {
      throw new Error("Profile migration from chrome.storage.local failed: " + error.message);
    }
  }

  async function init() {
    await getDb();
    await migrateLegacyProfileIfNeeded();
    return true;
  }

  async function getMasterProfile() {
    await getDb();

    let profile = await withStore(STORE_PROFILES, "readonly", (store) => readProfileFromStore(store));
    if (!profile) {
      profile = await migrateLegacyProfileIfNeeded();
    }

    if (!profile) {
      profile = createDefaultMasterProfile();
      await withStore(STORE_PROFILES, "readwrite", (store) => writeProfileToStore(store, profile));
      await syncLegacyKeysFromProfile(profile);
    }

    return createDefaultMasterProfile(profile);
  }

  async function saveMasterProfile(profile) {
    if (!profile || typeof profile !== "object") {
      throw new Error("saveMasterProfile requires a profile object");
    }

    const existing = await withStore(STORE_PROFILES, "readonly", (store) => readProfileFromStore(store));
    const timestamp = nowIso();

    const toSave = createDefaultMasterProfile({
      ...profile,
      id: MASTER_PROFILE_ID,
      schemaVersion: profile.schemaVersion || 1,
      createdAt: (existing && existing.createdAt) || profile.createdAt || timestamp,
      updatedAt: timestamp,
      personal: profile.personal || {},
      links: profile.links || {},
      experience: Array.isArray(profile.experience) ? profile.experience : [],
      education: Array.isArray(profile.education) ? profile.education : [],
      projects: Array.isArray(profile.projects) ? profile.projects : [],
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
      workAuthorization: profile.workAuthorization || {},
      applicationPreferences: profile.applicationPreferences || {},
      commonAnswers: profile.commonAnswers || {},
      demographics: profile.demographics || {},
      defaultResumeId: profile.defaultResumeId == null ? null : profile.defaultResumeId
    });

    const validation = validateMasterProfile(toSave);
    if (!validation.ok) {
      const error = new Error(validation.errors.join(" "));
      error.code = "PROFILE_VALIDATION";
      error.validationErrors = validation.errors;
      throw error;
    }

    try {
      await withStore(STORE_PROFILES, "readwrite", (store) => writeProfileToStore(store, toSave));
    } catch (error) {
      throw new Error("Failed to save master profile to IndexedDB: " + error.message);
    }

    try {
      await syncLegacyKeysFromProfile(toSave);
    } catch (error) {
      throw new Error(
        "Master profile was saved to IndexedDB, but syncing chrome.storage.local autofill keys failed: " +
          error.message
      );
    }

    notifyProfileDataChanged();
    return toSave;
  }

  async function getSettings() {
    const data = await chromeStorageGet([SETTINGS_KEY]);
    return data[SETTINGS_KEY] || {};
  }

  async function saveSettings(settings) {
    if (!settings || typeof settings !== "object") {
      throw new Error("saveSettings requires a settings object");
    }
    await chromeStorageSet({ [SETTINGS_KEY]: settings });
    return settings;
  }

  async function syncLegacyResume(documentRecord) {
    if (!documentRecord) {
      return chromeStorageSet({
        resumeBase64: "",
        resumeName: ""
      });
    }

    return chromeStorageSet({
      resumeBase64: documentRecord.fileData || "",
      resumeName: documentRecord.name || ""
    });
  }

  async function getDocument(id) {
    if (!id) return null;
    try {
      return await withStore(STORE_DOCUMENTS, "readonly", (store) => idbRequest(store.get(id)));
    } catch (error) {
      throw new Error("Failed to read document from IndexedDB: " + error.message);
    }
  }

  async function listDocuments() {
    try {
      const docs = await withStore(STORE_DOCUMENTS, "readonly", (store) => idbRequest(store.getAll()));
      return Array.isArray(docs) ? docs : [];
    } catch (error) {
      throw new Error("Failed to list documents from IndexedDB: " + error.message);
    }
  }

  async function saveDocument(documentRecord) {
    if (!documentRecord || typeof documentRecord !== "object" || !documentRecord.id) {
      throw new Error("saveDocument requires a document object with an id");
    }

    const timestamp = nowIso();
    let fileHash = documentRecord.fileHash ? String(documentRecord.fileHash) : "";
    if (!fileHash && documentRecord.fileData) {
      try {
        fileHash = await hashFileData(documentRecord.fileData);
      } catch (_) {
        fileHash = "";
      }
    }

    const toSave = {
      id: String(documentRecord.id),
      name: documentRecord.name || "",
      type: documentRecord.type || "",
      size: Number(documentRecord.size) || 0,
      fileData: documentRecord.fileData || "",
      fileHash: fileHash || null,
      isDefault: Boolean(documentRecord.isDefault),
      jobId: documentRecord.jobId ? String(documentRecord.jobId) : null,
      documentType: documentRecord.documentType
        ? String(documentRecord.documentType)
        : documentRecord.isDefault
          ? "default-resume"
          : null,
      parentResumeId:
        documentRecord.parentResumeId == null ? null : String(documentRecord.parentResumeId),
      createdAt: documentRecord.createdAt || timestamp,
      updatedAt: timestamp
    };

    try {
      await withStore(STORE_DOCUMENTS, "readwrite", (store) => idbRequest(store.put(toSave)));
    } catch (error) {
      throw new Error("Failed to save document to IndexedDB: " + error.message);
    }

    notifyProfileDataChanged();
    return toSave;
  }

  async function hashFileData(fileDataOrBuffer) {
    let bytes;
    if (fileDataOrBuffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(fileDataOrBuffer);
    } else if (ArrayBuffer.isView(fileDataOrBuffer)) {
      bytes = new Uint8Array(
        fileDataOrBuffer.buffer,
        fileDataOrBuffer.byteOffset,
        fileDataOrBuffer.byteLength
      );
    } else {
      const dataUrl = String(fileDataOrBuffer || "");
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      if (!base64) {
        throw new Error("Cannot hash empty file data.");
      }
      let binary;
      try {
        binary = atob(base64);
      } catch (_) {
        throw new Error("Cannot hash unreadable file data.");
      }
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    }

    if (!global.crypto || !global.crypto.subtle || typeof global.crypto.subtle.digest !== "function") {
      throw new Error("SHA-256 hashing is unavailable in this browser context.");
    }

    const digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function hashFile(file) {
    if (!file) {
      throw new Error("No file provided for hashing.");
    }
    const buffer = await file.arrayBuffer();
    return hashFileData(buffer);
  }

  async function ensureDocumentFileHash(documentRecord) {
    if (!documentRecord) return null;
    if (documentRecord.fileHash) return String(documentRecord.fileHash);
    if (!documentRecord.fileData) return null;
    const hash = await hashFileData(documentRecord.fileData);
    const saved = await saveDocument({
      ...documentRecord,
      fileHash: hash,
      updatedAt: documentRecord.updatedAt
    });
    return saved.fileHash || hash;
  }

  async function deleteDocument(id) {
    if (!id) return false;
    try {
      await withStore(STORE_DOCUMENTS, "readwrite", (store) => idbRequest(store.delete(id)));
      notifyProfileDataChanged();
      return true;
    } catch (error) {
      throw new Error("Failed to delete document from IndexedDB: " + error.message);
    }
  }

  async function getDefaultResume() {
    const profile = await getMasterProfile();
    if (profile && profile.defaultResumeId) {
      const byId = await getDocument(profile.defaultResumeId);
      if (byId) return byId;
    }

    const docs = await listDocuments();
    const flagged = docs.find((doc) => doc && doc.isDefault);
    return flagged || null;
  }

  const JOB_SPECIFIC_RESUME_TYPE = "job-specific-resume";
  const JOB_RESUME_SELECTION_KEY = "jobResumeSelection";

  async function getJobSpecificResume(jobId) {
    if (!jobId) return null;
    const docs = await listDocuments();
    const matches = docs.filter(
      (doc) =>
        doc &&
        String(doc.jobId || "") === String(jobId) &&
        String(doc.documentType || "") === JOB_SPECIFIC_RESUME_TYPE
    );
    if (!matches.length) return null;
    matches.sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    return matches[0];
  }

  async function listJobSpecificResumes(jobId) {
    const docs = await listDocuments();
    return docs.filter(
      (doc) =>
        doc &&
        (!jobId || String(doc.jobId || "") === String(jobId)) &&
        String(doc.documentType || "") === JOB_SPECIFIC_RESUME_TYPE
    );
  }

  async function deleteJobSpecificResumesForJob(jobId) {
    if (!jobId) return [];
    const matches = await listJobSpecificResumes(jobId);
    for (let i = 0; i < matches.length; i += 1) {
      await deleteDocument(matches[i].id);
    }
    return matches;
  }

  function jobProfileIdForJob(jobId) {
    return "job-profile-" + String(jobId || "");
  }

  async function getJobProfile(jobId) {
    if (!jobId) return null;
    try {
      const byComposite = await withStore(STORE_JOB_PROFILES, "readonly", (store) =>
        idbRequest(store.get(jobProfileIdForJob(jobId)))
      );
      if (byComposite) return byComposite;
      return await withStore(STORE_JOB_PROFILES, "readonly", (store) =>
        idbRequest(store.get(String(jobId)))
      );
    } catch (error) {
      throw new Error("Failed to read job profile from IndexedDB: " + error.message);
    }
  }

  async function saveJobProfile(record) {
    if (!record || typeof record !== "object" || !record.jobId) {
      throw new Error("saveJobProfile requires a record with jobId");
    }
    const timestamp = nowIso();
    const existing = await getJobProfile(record.jobId);
    const toSave = {
      id: jobProfileIdForJob(record.jobId),
      jobId: String(record.jobId),
      resumeId: record.resumeId == null ? null : String(record.resumeId),
      baseProfileId: record.baseProfileId || MASTER_PROFILE_ID,
      parsedProfile: record.parsedProfile || null,
      approvedProfile: record.approvedProfile || null,
      differences: record.differences || null,
      createdAt: (existing && existing.createdAt) || record.createdAt || timestamp,
      updatedAt: timestamp
    };

    try {
      await withStore(STORE_JOB_PROFILES, "readwrite", (store) => idbRequest(store.put(toSave)));
    } catch (error) {
      throw new Error("Failed to save job profile to IndexedDB: " + error.message);
    }

    return toSave;
  }

  async function deleteJobProfile(jobId) {
    if (!jobId) return false;
    try {
      await withStore(STORE_JOB_PROFILES, "readwrite", (store) =>
        Promise.all([
          idbRequest(store.delete(jobProfileIdForJob(jobId))),
          idbRequest(store.delete(String(jobId)))
        ])
      );
      return true;
    } catch (error) {
      throw new Error("Failed to delete job profile from IndexedDB: " + error.message);
    }
  }

  async function getJobResumeSelectionMap() {
    const settings = await getSettings();
    const map = settings[JOB_RESUME_SELECTION_KEY];
    return map && typeof map === "object" ? Object.assign({}, map) : {};
  }

  async function getJobResumeSelection(jobId) {
    if (!jobId) return "default";
    const map = await getJobResumeSelectionMap();
    const value = map[String(jobId)];
    return value === "tailored" ? "tailored" : "default";
  }

  async function setJobResumeSelection(jobId, selection) {
    if (!jobId) return "default";
    const nextValue = selection === "tailored" ? "tailored" : "default";
    const settings = await getSettings();
    const map = Object.assign({}, settings[JOB_RESUME_SELECTION_KEY] || {});
    map[String(jobId)] = nextValue;
    await saveSettings(Object.assign({}, settings, { [JOB_RESUME_SELECTION_KEY]: map }));
    return nextValue;
  }

  async function getSelectedResumeDocumentForJob(jobId) {
    const selection = await getJobResumeSelection(jobId);
    if (selection === "tailored") {
      const tailored = await getJobSpecificResume(jobId);
      if (tailored) return { selection: "tailored", document: tailored };
    }
    const defaultResume = await getDefaultResume();
    return { selection: "default", document: defaultResume };
  }

  async function syncAutofillResumeForJob(jobId) {
    const selected = await getSelectedResumeDocumentForJob(jobId);
    await syncLegacyResume(selected.document || null);
    return selected;
  }

  function _stableJson(value) {
    try {
      return JSON.stringify(value == null ? null : value);
    } catch (_) {
      return String(value);
    }
  }

  function _skillKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function computeJobResumeDifferences(masterProfile, parsedProfile) {
    const master = masterProfile || createDefaultMasterProfile();
    const parsed = parsedProfile || {};
    const masterSkills = _asStringList(master.skills);
    const parsedSkills = _asStringList(parsed.skills);
    const masterSkillKeys = new Set(masterSkills.map(_skillKey));
    const parsedSkillKeys = new Set(parsedSkills.map(_skillKey));

    const addedSkills = parsedSkills.filter((skill) => !masterSkillKeys.has(_skillKey(skill)));
    const removedSkills = masterSkills.filter((skill) => !parsedSkillKeys.has(_skillKey(skill)));

    function sectionDiff(key, label) {
      const masterValue = Array.isArray(master[key]) ? master[key] : [];
      const parsedValue = Array.isArray(parsed[key]) ? parsed[key] : [];
      if (_stableJson(masterValue) === _stableJson(parsedValue)) {
        return null;
      }
      return {
        section: key,
        label: label,
        masterCount: masterValue.length,
        parsedCount: parsedValue.length,
        masterValue: masterValue,
        parsedValue: parsedValue
      };
    }

    const changedExperience = sectionDiff("experience", "Experience");
    const changedProjects = sectionDiff("projects", "Projects");
    const changedEducation = sectionDiff("education", "Education");
    const changedCertifications = sectionDiff("certifications", "Certifications");

    const changedPersonal = [];
    ["firstName", "lastName", "email", "phone", "location"].forEach((field) => {
      const masterValue = (master.personal && master.personal[field]) || "";
      const parsedValue = (parsed.personal && parsed.personal[field]) || "";
      if (_valuesConflict(masterValue, parsedValue)) {
        changedPersonal.push({
          field: field,
          path: "personal." + field,
          masterValue: masterValue,
          parsedValue: parsedValue
        });
      }
    });

    const changedLinks = [];
    ["linkedin", "github", "portfolio"].forEach((field) => {
      const masterValue = (master.links && master.links[field]) || "";
      const parsedValue = (parsed.links && parsed.links[field]) || "";
      if (_valuesConflict(masterValue, parsedValue)) {
        changedLinks.push({
          field: field,
          path: "links." + field,
          masterValue: masterValue,
          parsedValue: parsedValue
        });
      }
    });

    const unchangedSections = [];
    if (!addedSkills.length && !removedSkills.length) unchangedSections.push("skills");
    if (!changedExperience) unchangedSections.push("experience");
    if (!changedProjects) unchangedSections.push("projects");
    if (!changedEducation) unchangedSections.push("education");
    if (!changedCertifications) unchangedSections.push("certifications");
    if (!changedPersonal.length) unchangedSections.push("personal");
    if (!changedLinks.length) unchangedSections.push("links");

    return {
      addedSkills: addedSkills,
      removedSkills: removedSkills,
      changedExperience: changedExperience ? [changedExperience] : [],
      changedProjects: changedProjects ? [changedProjects] : [],
      changedEducation: changedEducation ? [changedEducation] : [],
      changedCertifications: changedCertifications ? [changedCertifications] : [],
      changedPersonal: changedPersonal,
      changedLinks: changedLinks,
      unchangedSections: unchangedSections
    };
  }

  function buildApprovedJobProfile(masterProfile, parsedProfile, approvals) {
    const master = createDefaultMasterProfile(masterProfile || {});
    const parsed = parsedProfile || {};
    const choices = approvals || {};
    const personalApprovals = choices.personal || {};
    const linkApprovals = choices.links || {};

    const personal = Object.assign({}, master.personal);
    Object.keys(personal).forEach((field) => {
      if (personalApprovals[field] && parsed.personal && parsed.personal[field] != null) {
        personal[field] = parsed.personal[field];
      }
    });

    const links = Object.assign({}, master.links);
    Object.keys(links).forEach((field) => {
      if (linkApprovals[field] && parsed.links && parsed.links[field] != null) {
        links[field] = parsed.links[field];
      }
    });

    return createDefaultMasterProfile({
      ...master,
      personal: personal,
      links: links,
      experience: Array.isArray(parsed.experience) ? parsed.experience : master.experience,
      education: Array.isArray(parsed.education) ? parsed.education : master.education,
      projects: Array.isArray(parsed.projects) ? parsed.projects : master.projects,
      skills: Array.isArray(parsed.skills) ? parsed.skills : master.skills,
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications
        : master.certifications,
      workAuthorization: master.workAuthorization,
      applicationPreferences: master.applicationPreferences,
      commonAnswers: master.commonAnswers,
      demographics: master.demographics,
      defaultResumeId: master.defaultResumeId
    });
  }

  async function getProfileForJobMatch(jobId) {
    const master = await getMasterProfile();
    if (!jobId) {
      return { profile: master, source: "master", jobProfile: null };
    }
    const selection = await getJobResumeSelection(jobId);
    const jobProfile = await getJobProfile(jobId);
    if (
      selection === "tailored" &&
      jobProfile &&
      jobProfile.approvedProfile &&
      typeof jobProfile.approvedProfile === "object"
    ) {
      return {
        profile: createDefaultMasterProfile(jobProfile.approvedProfile),
        source: "tailored",
        jobProfile: jobProfile
      };
    }
    return { profile: master, source: "master", jobProfile: jobProfile };
  }

  const CURRENT_JOB_ID_KEY = "currentJobId";

  function normalizeJobUrl(url) {
    try {
      const parsed = new URL(String(url || ""));
      parsed.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "trk", "refId"].forEach(
        (param) => parsed.searchParams.delete(param)
      );
      let normalized = parsed.origin + parsed.pathname.replace(/\/+$/, "");
      const query = parsed.searchParams.toString();
      if (query) normalized += "?" + query;
      return normalized.toLowerCase();
    } catch (_) {
      return String(url || "")
        .trim()
        .toLowerCase()
        .replace(/\/+$/, "");
    }
  }

  function hashJobKey(input) {
    const text = String(input || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function buildStableJobId(url, company, title) {
    const key = [
      normalizeJobUrl(url),
      String(company || "")
        .trim()
        .toLowerCase(),
      String(title || "")
        .trim()
        .toLowerCase()
    ].join("|");
    return "job-" + hashJobKey(key);
  }

  function createJobRecord(overrides) {
    const timestamp = nowIso();
    const source = overrides || {};
    const title = String(source.title || "").trim();
    const company = String(source.company || "").trim();
    const url = String(source.url || "").trim();
    const id = source.id || buildStableJobId(url, company, title);

    return {
      id: id,
      title: title,
      company: company,
      location: String(source.location || "").trim(),
      description: String(source.description || "").trim(),
      url: url,
      domain: String(source.domain || "").trim(),
      atsPlatform: String(source.atsPlatform || "generic").trim() || "generic",
      extractedAt: source.extractedAt || timestamp,
      createdAt: source.createdAt || timestamp,
      updatedAt: timestamp,
      matchAnalysis: source.matchAnalysis || null,
      matchAnalyses:
        source.matchAnalyses && typeof source.matchAnalyses === "object"
          ? source.matchAnalyses
          : {}
    };
  }

  async function getJob(id) {
    if (!id) return null;
    try {
      return await withStore(STORE_JOBS, "readonly", (store) => idbRequest(store.get(id)));
    } catch (error) {
      throw new Error("Failed to read job from IndexedDB: " + error.message);
    }
  }

  async function listJobs() {
    try {
      const jobs = await withStore(STORE_JOBS, "readonly", (store) => idbRequest(store.getAll()));
      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      throw new Error("Failed to list jobs from IndexedDB: " + error.message);
    }
  }

  async function saveJob(jobRecord) {
    if (!jobRecord || typeof jobRecord !== "object") {
      throw new Error("saveJob requires a job object");
    }

    const existing = jobRecord.id ? await getJob(jobRecord.id) : null;
    const preservedAnalysis =
      jobRecord.matchAnalysis !== undefined
        ? jobRecord.matchAnalysis
        : (existing && existing.matchAnalysis) || null;
    const preservedAnalyses =
      jobRecord.matchAnalyses !== undefined
        ? jobRecord.matchAnalyses
        : (existing && existing.matchAnalyses) || {};
    const toSave = createJobRecord({
      ...jobRecord,
      id: jobRecord.id || buildStableJobId(jobRecord.url, jobRecord.company, jobRecord.title),
      createdAt: (existing && existing.createdAt) || jobRecord.createdAt,
      updatedAt: nowIso(),
      matchAnalysis: preservedAnalysis,
      matchAnalyses: preservedAnalyses
    });

    try {
      await withStore(STORE_JOBS, "readwrite", (store) => idbRequest(store.put(toSave)));
    } catch (error) {
      throw new Error("Failed to save job to IndexedDB: " + error.message);
    }

    return toSave;
  }

  function _asStringList(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    value.forEach((item) => {
      const text = String(item == null ? "" : item).trim();
      if (text && out.indexOf(text) === -1) out.push(text);
    });
    return out;
  }

  function buildCareerRelevantProfile(profile) {
    const source = profile || {};
    const experience = Array.isArray(source.experience)
      ? source.experience.map((item) => {
          const row = item || {};
          return {
            company: String(row.company || row.company_name || "").trim(),
            title: String(row.title || row.job_title || "").trim(),
            location: String(row.location || "").trim(),
            startDate: String(row.startDate || row.start_date || "").trim(),
            endDate: String(row.endDate || row.end_date || "").trim(),
            description: String(row.description || "").trim(),
            bullets: _asStringList(row.bullets || row.bullet_points)
          };
        })
      : [];
    const education = Array.isArray(source.education)
      ? source.education.map((item) => {
          const row = item || {};
          return {
            institution: String(row.institution || row.school_name || "").trim(),
            degree: String(row.degree || row.degree_type || "").trim(),
            field: String(row.field || row.major || "").trim(),
            startDate: String(row.startDate || "").trim(),
            endDate: String(row.endDate || row.graduation_year || "").trim()
          };
        })
      : [];
    const projects = Array.isArray(source.projects)
      ? source.projects.map((item) => {
          const row = item || {};
          return {
            name: String(row.name || "").trim(),
            description: String(row.description || "").trim(),
            technologies: _asStringList(row.technologies)
          };
        })
      : [];

    return {
      skills: _asStringList(source.skills || source.skills_inventory),
      experience: experience,
      education: education,
      projects: projects,
      certifications: _asStringList(source.certifications)
    };
  }

  function profileHasCareerSignal(profileOrPayload) {
    const payload = buildCareerRelevantProfile(profileOrPayload);
    return Boolean(
      (payload.skills && payload.skills.length) ||
        (payload.experience && payload.experience.length) ||
        (payload.education && payload.education.length) ||
        (payload.projects && payload.projects.length) ||
        (payload.certifications && payload.certifications.length)
    );
  }

  function normalizeProfileSource(source) {
    if (source === "tailored" || source === "job-specific") return "job-specific";
    return "master";
  }

  function analysisLabelForSource(profileSource) {
    return normalizeProfileSource(profileSource) === "job-specific"
      ? "Tailored resume analysis"
      : "Default resume analysis";
  }

  function buildJobMatchAnalysisKey(parts) {
    const source = parts || {};
    return [
      String(source.jobId || ""),
      String(source.resumeId || "none"),
      normalizeProfileSource(source.profileSource),
      String(source.profileUpdatedAt || ""),
      String(source.jobUpdatedAt || "")
    ].join("::");
  }

  function migrateJobMatchAnalyses(job) {
    const analyses =
      job && job.matchAnalyses && typeof job.matchAnalyses === "object"
        ? Object.assign({}, job.matchAnalyses)
        : {};
    if (job && job.matchAnalysis && job.matchAnalysis.analysisKey) {
      const key = String(job.matchAnalysis.analysisKey);
      if (!analyses[key]) analyses[key] = job.matchAnalysis;
    } else if (job && job.matchAnalysis && job.matchAnalysis.analyzedAt) {
      const legacy = job.matchAnalysis;
      const key = buildJobMatchAnalysisKey({
        jobId: job.id,
        resumeId:
          legacy.tailoredResumeId ||
          legacy.resumeId ||
          legacy.defaultResumeId ||
          "none",
        profileSource:
          legacy.profileSource ||
          (legacy.analyzedWith === "tailored" ? "job-specific" : "master"),
        profileUpdatedAt: legacy.profileUpdatedAt,
        jobUpdatedAt: legacy.jobUpdatedAt
      });
      if (!analyses[key]) {
        analyses[key] = Object.assign({}, legacy, {
          analysisKey: key,
          jobId: job.id,
          resumeId: legacy.tailoredResumeId || legacy.resumeId || legacy.defaultResumeId || null,
          profileSource: normalizeProfileSource(
            legacy.profileSource ||
              (legacy.analyzedWith === "tailored" ? "job-specific" : "master")
          )
        });
      }
    }
    return analyses;
  }

  async function resolveJobMatchContext(jobId, options) {
    const opts = options || {};
    const job = opts.job || (await getJob(jobId));
    if (!job) {
      throw new Error("Job not found for match analysis context.");
    }

    const master = opts.masterProfile || (await getMasterProfile());
    const selection =
      opts.selection || (await getJobResumeSelection(jobId));
    const defaultResume = opts.defaultResume || (await getDefaultResume());
    const tailoredResume =
      opts.tailoredResume || (await getJobSpecificResume(jobId));
    const jobProfile = opts.jobProfile || (await getJobProfile(jobId));

    const useTailored =
      selection === "tailored" &&
      tailoredResume &&
      jobProfile &&
      jobProfile.approvedProfile &&
      typeof jobProfile.approvedProfile === "object";

    if (useTailored) {
      return {
        job: job,
        masterProfile: master,
        selection: "tailored",
        profileSource: "job-specific",
        resumeId: tailoredResume.id,
        resume: tailoredResume,
        profile: createDefaultMasterProfile(jobProfile.approvedProfile),
        profileUpdatedAt: jobProfile.updatedAt || null,
        jobUpdatedAt: job.updatedAt || null,
        jobProfile: jobProfile,
        defaultResume: defaultResume,
        analysisLabel: analysisLabelForSource("job-specific"),
        analysisKey: buildJobMatchAnalysisKey({
          jobId: job.id,
          resumeId: tailoredResume.id,
          profileSource: "job-specific",
          profileUpdatedAt: jobProfile.updatedAt || null,
          jobUpdatedAt: job.updatedAt || null
        })
      };
    }

    return {
      job: job,
      masterProfile: master,
      selection: "default",
      profileSource: "master",
      resumeId: defaultResume && defaultResume.id ? defaultResume.id : null,
      resume: defaultResume,
      profile: master,
      profileUpdatedAt: master.updatedAt || null,
      jobUpdatedAt: job.updatedAt || null,
      jobProfile: jobProfile,
      defaultResume: defaultResume,
      tailoredResume: tailoredResume,
      analysisLabel: analysisLabelForSource("master"),
      analysisKey: buildJobMatchAnalysisKey({
        jobId: job.id,
        resumeId: defaultResume && defaultResume.id ? defaultResume.id : null,
        profileSource: "master",
        profileUpdatedAt: master.updatedAt || null,
        jobUpdatedAt: job.updatedAt || null
      })
    };
  }

  function normalizeJobMatchAnalysis(backendResult, meta) {
    const source = backendResult || {};
    const context = meta || {};
    const profileSource = normalizeProfileSource(
      context.profileSource || context.analyzedWith || "master"
    );
    const analysisKey =
      context.analysisKey ||
      buildJobMatchAnalysisKey({
        jobId: context.jobId,
        resumeId: context.resumeId,
        profileSource: profileSource,
        profileUpdatedAt: context.profileUpdatedAt,
        jobUpdatedAt: context.jobUpdatedAt
      });

    return {
      status: String(source.status || "success"),
      matchScore: Math.max(0, Math.min(100, Number(source.matchScore) || 0)),
      matchedSkills: _asStringList(source.matchedSkills),
      missingSkills: _asStringList(source.missingSkills),
      matchedKeywords: _asStringList(source.matchedKeywords),
      missingKeywords: _asStringList(source.missingKeywords),
      strengths: _asStringList(source.strengths),
      gaps: _asStringList(source.gaps),
      recommendations: _asStringList(source.recommendations),
      summary: String(source.summary || "").trim(),
      message: String(source.message || "").trim(),
      scoreComponents:
        source.scoreComponents && typeof source.scoreComponents === "object"
          ? source.scoreComponents
          : null,
      analyzedAt: context.analyzedAt || nowIso(),
      profileUpdatedAt: context.profileUpdatedAt || null,
      jobUpdatedAt: context.jobUpdatedAt || null,
      resumeId: context.resumeId == null ? null : String(context.resumeId),
      defaultResumeId:
        context.defaultResumeId == null ? null : String(context.defaultResumeId),
      tailoredResumeId:
        context.tailoredResumeId == null ? null : String(context.tailoredResumeId),
      jobProfileUpdatedAt: context.jobProfileUpdatedAt || null,
      profileSource: profileSource,
      analyzedWith: profileSource === "job-specific" ? "tailored" : "master",
      analysisKey: analysisKey,
      jobId: context.jobId == null ? null : String(context.jobId),
      analysisLabel: context.analysisLabel || analysisLabelForSource(profileSource)
    };
  }

  function findRelatedJobMatchAnalysis(analyses, identity) {
    const jobId = String((identity && identity.jobId) || "");
    const resumeId = String((identity && identity.resumeId) || "none");
    const profileSource = normalizeProfileSource(identity && identity.profileSource);
    const entries = Object.keys(analyses || {}).map(function (key) {
      return analyses[key];
    });
    const matches = entries.filter(function (entry) {
      if (!entry || typeof entry !== "object") return false;
      const entryResume = String(entry.resumeId || "none");
      const entrySource = normalizeProfileSource(entry.profileSource || entry.analyzedWith);
      const entryJob = String(entry.jobId || jobId);
      return entryJob === jobId && entryResume === resumeId && entrySource === profileSource;
    });
    matches.sort(function (a, b) {
      return String(b.analyzedAt || "").localeCompare(String(a.analyzedAt || ""));
    });
    return matches[0] || null;
  }

  function isJobMatchAnalysisStale(analysis, context) {
    if (!analysis || typeof analysis !== "object") return true;
    if (!analysis.analyzedAt) return true;
    const ctx = context || {};
    if (String(analysis.profileUpdatedAt || "") !== String(ctx.profileUpdatedAt || "")) {
      return true;
    }
    if (String(analysis.jobUpdatedAt || "") !== String(ctx.jobUpdatedAt || "")) {
      return true;
    }
    if (String(analysis.resumeId || "none") !== String(ctx.resumeId || "none")) {
      return true;
    }
    if (
      normalizeProfileSource(analysis.profileSource || analysis.analyzedWith) !==
      normalizeProfileSource(ctx.profileSource)
    ) {
      return true;
    }
    return false;
  }

  async function getJobMatchAnalysisForJob(jobId, options) {
    const context = await resolveJobMatchContext(jobId, options || {});
    const analyses = migrateJobMatchAnalyses(context.job);
    const exact = analyses[context.analysisKey] || null;
    if (exact) {
      return {
        context: context,
        analysis: exact,
        stale: isJobMatchAnalysisStale(exact, context),
        missing: false
      };
    }

    const related = findRelatedJobMatchAnalysis(analyses, {
      jobId: context.job.id,
      resumeId: context.resumeId,
      profileSource: context.profileSource
    });
    if (related) {
      return {
        context: context,
        analysis: related,
        stale: true,
        missing: false
      };
    }

    return {
      context: context,
      analysis: null,
      stale: false,
      missing: true
    };
  }

  async function saveJobMatchAnalysis(jobId, backendResult, context) {
    if (!jobId) {
      throw new Error("saveJobMatchAnalysis requires a job id");
    }
    const existing = await getJob(jobId);
    if (!existing) {
      throw new Error("Cannot save match analysis: job not found.");
    }

    const meta = context || {};
    const resolved =
      meta.analysisKey && meta.profileSource
        ? meta
        : await resolveJobMatchContext(jobId, {
            job: existing,
            masterProfile: meta.masterProfile,
            selection: meta.selection,
            jobProfile: meta.jobProfile,
            tailoredResume: meta.tailoredResume,
            defaultResume: meta.defaultResume
          });

    const profileSource = normalizeProfileSource(
      meta.profileSource || resolved.profileSource || meta.analyzedWith || "master"
    );
    const resumeId =
      meta.resumeId != null
        ? meta.resumeId
        : resolved.resumeId != null
          ? resolved.resumeId
          : null;
    const profileUpdatedAt =
      meta.profileUpdatedAt != null ? meta.profileUpdatedAt : resolved.profileUpdatedAt;
    const jobUpdatedAt =
      meta.jobUpdatedAt != null ? meta.jobUpdatedAt : existing.updatedAt || null;
    const analysisKey =
      meta.analysisKey ||
      resolved.analysisKey ||
      buildJobMatchAnalysisKey({
        jobId: jobId,
        resumeId: resumeId,
        profileSource: profileSource,
        profileUpdatedAt: profileUpdatedAt,
        jobUpdatedAt: jobUpdatedAt
      });

    const matchAnalysis = normalizeJobMatchAnalysis(backendResult, {
      analyzedAt: nowIso(),
      jobId: jobId,
      resumeId: resumeId,
      profileSource: profileSource,
      profileUpdatedAt: profileUpdatedAt,
      jobUpdatedAt: jobUpdatedAt,
      defaultResumeId: meta.defaultResumeId,
      tailoredResumeId:
        profileSource === "job-specific" ? resumeId : meta.tailoredResumeId || null,
      jobProfileUpdatedAt: meta.jobProfileUpdatedAt || null,
      analysisKey: analysisKey,
      analysisLabel: meta.analysisLabel || analysisLabelForSource(profileSource),
      analyzedWith: profileSource === "job-specific" ? "tailored" : "master"
    });

    const analyses = migrateJobMatchAnalyses(existing);
    analyses[analysisKey] = matchAnalysis;

    const toSave = {
      ...existing,
      matchAnalyses: analyses,
      matchAnalysis: matchAnalysis
    };

    try {
      await withStore(STORE_JOBS, "readwrite", (store) => idbRequest(store.put(toSave)));
    } catch (error) {
      throw new Error("Failed to save job match analysis: " + error.message);
    }

    return toSave;
  }

  async function clearJobMatchAnalysis(jobId, options) {
    if (!jobId) return null;
    const existing = await getJob(jobId);
    if (!existing) return null;
    const opts = options || {};
    const analyses = migrateJobMatchAnalyses(existing);

    if (opts.analysisKey) {
      delete analyses[opts.analysisKey];
    } else if (opts.profileSource || opts.resumeId) {
      Object.keys(analyses).forEach(function (key) {
        const entry = analyses[key];
        if (!entry) return;
        const sourceMatch =
          !opts.profileSource ||
          normalizeProfileSource(entry.profileSource) ===
            normalizeProfileSource(opts.profileSource);
        const resumeMatch =
          opts.resumeId == null ||
          String(entry.resumeId || "none") === String(opts.resumeId || "none");
        if (sourceMatch && resumeMatch) delete analyses[key];
      });
    } else {
      Object.keys(analyses).forEach(function (key) {
        delete analyses[key];
      });
    }

    const toSave = {
      ...existing,
      matchAnalyses: analyses,
      matchAnalysis: null
    };
    await withStore(STORE_JOBS, "readwrite", (store) => idbRequest(store.put(toSave)));
    return toSave;
  }

  async function deleteJob(id) {
    if (!id) return false;
    try {
      await withStore(STORE_JOBS, "readwrite", (store) => idbRequest(store.delete(id)));
      return true;
    } catch (error) {
      throw new Error("Failed to delete job from IndexedDB: " + error.message);
    }
  }

  async function getCurrentJobId() {
    const settings = await getSettings();
    return settings[CURRENT_JOB_ID_KEY] || null;
  }

  async function setCurrentJobId(jobId) {
    const settings = await getSettings();
    const next = Object.assign({}, settings);
    if (jobId) {
      next[CURRENT_JOB_ID_KEY] = String(jobId);
    } else {
      delete next[CURRENT_JOB_ID_KEY];
    }
    await saveSettings(next);
    return jobId || null;
  }

  async function getCurrentJob() {
    const jobId = await getCurrentJobId();
    if (!jobId) return null;
    return getJob(jobId);
  }

  async function setCurrentJob(jobRecord) {
    const saved = await saveJob(jobRecord);
    await setCurrentJobId(saved.id);
    return saved;
  }

  async function clearCurrentJob() {
    const currentId = await getCurrentJobId();
    await setCurrentJobId(null);
    return currentId;
  }

  function _isNonEmptyValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  function _valuesConflict(existingValue, parsedValue) {
    if (!_isNonEmptyValue(existingValue) || !_isNonEmptyValue(parsedValue)) {
      return false;
    }
    try {
      return JSON.stringify(existingValue) !== JSON.stringify(parsedValue);
    } catch (_) {
      return String(existingValue) !== String(parsedValue);
    }
  }

  function detectProfileConflicts(masterProfile, parsedDraft) {
    const master = masterProfile || createDefaultMasterProfile();
    const draft = parsedDraft || {};
    const conflicts = [];

    const personalFields = ["firstName", "lastName", "email", "phone", "location"];
    personalFields.forEach((field) => {
      const existingValue = (master.personal && master.personal[field]) || "";
      const parsedValue = (draft.personal && draft.personal[field]) || "";
      if (_valuesConflict(existingValue, parsedValue)) {
        conflicts.push({
          id: "personal." + field,
          path: "personal." + field,
          label: "Personal · " + field,
          existingValue: existingValue,
          parsedValue: parsedValue
        });
      }
    });

    const linkFields = ["linkedin", "github", "portfolio"];
    linkFields.forEach((field) => {
      const existingValue = (master.links && master.links[field]) || "";
      const parsedValue = (draft.links && draft.links[field]) || "";
      if (_valuesConflict(existingValue, parsedValue)) {
        conflicts.push({
          id: "links." + field,
          path: "links." + field,
          label: "Links · " + field,
          existingValue: existingValue,
          parsedValue: parsedValue
        });
      }
    });

    [
      { key: "experience", label: "Experience" },
      { key: "education", label: "Education" },
      { key: "projects", label: "Projects" },
      { key: "skills", label: "Skills" },
      { key: "certifications", label: "Certifications" }
    ].forEach((section) => {
      const existingValue = Array.isArray(master[section.key]) ? master[section.key] : [];
      const parsedValue = Array.isArray(draft[section.key]) ? draft[section.key] : [];
      if (_valuesConflict(existingValue, parsedValue)) {
        conflicts.push({
          id: section.key,
          path: section.key,
          label: section.label,
          existingValue: existingValue,
          parsedValue: parsedValue,
          isSection: true
        });
      }
    });

    return conflicts;
  }

  function _pickScalar(existingValue, parsedValue, choice) {
    if (!_isNonEmptyValue(existingValue)) return parsedValue || "";
    if (!_isNonEmptyValue(parsedValue)) return existingValue || "";
    if (!_valuesConflict(existingValue, parsedValue)) return parsedValue || existingValue || "";
    return choice === "existing" ? existingValue : parsedValue;
  }

  function _pickSection(existingValue, parsedValue, choice) {
    const existing = Array.isArray(existingValue) ? existingValue : [];
    const parsed = Array.isArray(parsedValue) ? parsedValue : [];
    if (!_isNonEmptyValue(existing)) return parsed;
    if (!_isNonEmptyValue(parsed)) return existing;
    if (!_valuesConflict(existing, parsed)) return parsed;
    return choice === "existing" ? existing : parsed;
  }

  function mergeApprovedProfileDraft(masterProfile, reviewedDraft, resolutions) {
    const master = masterProfile || createDefaultMasterProfile();
    const draft = reviewedDraft || {};
    const choices = resolutions || {};
    const timestamp = nowIso();

    const merged = {
      ...master,
      id: MASTER_PROFILE_ID,
      schemaVersion: master.schemaVersion || 1,
      personal: {
        firstName: _pickScalar(
          master.personal && master.personal.firstName,
          draft.personal && draft.personal.firstName,
          choices["personal.firstName"]
        ),
        lastName: _pickScalar(
          master.personal && master.personal.lastName,
          draft.personal && draft.personal.lastName,
          choices["personal.lastName"]
        ),
        email: _pickScalar(
          master.personal && master.personal.email,
          draft.personal && draft.personal.email,
          choices["personal.email"]
        ),
        phone: _pickScalar(
          master.personal && master.personal.phone,
          draft.personal && draft.personal.phone,
          choices["personal.phone"]
        ),
        location: _pickScalar(
          master.personal && master.personal.location,
          draft.personal && draft.personal.location,
          choices["personal.location"]
        )
      },
      links: {
        linkedin: _pickScalar(
          master.links && master.links.linkedin,
          draft.links && draft.links.linkedin,
          choices["links.linkedin"]
        ),
        github: _pickScalar(
          master.links && master.links.github,
          draft.links && draft.links.github,
          choices["links.github"]
        ),
        portfolio: _pickScalar(
          master.links && master.links.portfolio,
          draft.links && draft.links.portfolio,
          choices["links.portfolio"]
        )
      },
      experience: _pickSection(master.experience, draft.experience, choices.experience),
      education: _pickSection(master.education, draft.education, choices.education),
      projects: _pickSection(master.projects, draft.projects, choices.projects),
      skills: _pickSection(master.skills, draft.skills, choices.skills),
      certifications: _pickSection(
        master.certifications,
        draft.certifications,
        choices.certifications
      ),
      workAuthorization: createDefaultWorkAuthorization(master.workAuthorization),
      applicationPreferences: createDefaultApplicationPreferences(master.applicationPreferences),
      commonAnswers: createDefaultCommonAnswers(master.commonAnswers),
      demographics: createDefaultDemographics(master.demographics),
      defaultResumeId: master.defaultResumeId == null ? null : master.defaultResumeId,
      createdAt: master.createdAt || timestamp,
      updatedAt: timestamp
    };

    return merged;
  }

  function notifyProfileDataChanged() {
    if (typeof global.refreshProfileReadiness === "function") {
      try {
        global.refreshProfileReadiness();
      } catch (_) {
        // Readiness UI refresh is best-effort.
      }
    }
    if (typeof global.refreshJobMatchAnalysis === "function") {
      try {
        global.refreshJobMatchAnalysis();
      } catch (_) {
        // Match analysis stale refresh is best-effort.
      }
    }
  }

  function _trimText(value) {
    return String(value == null ? "" : value).trim();
  }

  function _isFilled(value) {
    return Boolean(_trimText(value));
  }

  function isValidEmailFormat(email) {
    const value = _trimText(email);
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  const EMAIL_DOMAIN_TYPOS = {
    "gnail.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmail.con": "gmail.com",
    "hotnail.com": "hotmail.com",
    "outlook.con": "outlook.com"
  };

  function suggestEmailCorrection(email) {
    const value = _trimText(email);
    if (!value || value.indexOf("@") < 0) return null;

    const atIndex = value.lastIndexOf("@");
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1).toLowerCase();
    if (!local || !domain) return null;

    const correctedDomain = EMAIL_DOMAIN_TYPOS[domain];
    if (!correctedDomain) return null;

    return local + "@" + correctedDomain;
  }

  function isValidUrlFormat(url) {
    const value = _trimText(url);
    if (!value) return true;
    try {
      const withProtocol = /^https?:\/\//i.test(value) ? value : "https://" + value;
      const parsed = new URL(withProtocol);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function _parseFlexibleDate(value) {
    const text = _trimText(value);
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const date = new Date(text + "T00:00:00");
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function _dateRangeInvalid(startValue, endValue) {
    const start = _parseFlexibleDate(startValue);
    const end = _parseFlexibleDate(endValue);
    if (!start || !end) return false;
    return start.getTime() > end.getTime();
  }

  function findDuplicateSkills(skills) {
    const seen = new Set();
    const duplicates = [];
    (Array.isArray(skills) ? skills : []).forEach((skill) => {
      const label = _trimText(skill);
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) {
        if (!duplicates.includes(label)) duplicates.push(label);
      } else {
        seen.add(key);
      }
    });
    return duplicates;
  }

  function validateMasterProfile(profile) {
    const errors = [];
    const data = createDefaultMasterProfile(profile || {});
    const personal = data.personal || {};
    const links = data.links || {};

    if (_isFilled(personal.email) && !isValidEmailFormat(personal.email)) {
      errors.push("Email format is invalid.");
    }

    if (_isFilled(links.linkedin) && !isValidUrlFormat(links.linkedin)) {
      errors.push("LinkedIn URL format is invalid.");
    }
    if (_isFilled(links.github) && !isValidUrlFormat(links.github)) {
      errors.push("GitHub URL format is invalid.");
    }
    if (_isFilled(links.portfolio) && !isValidUrlFormat(links.portfolio)) {
      errors.push("Portfolio URL format is invalid.");
    }

    (data.projects || []).forEach((project, index) => {
      if (project && _isFilled(project.url) && !isValidUrlFormat(project.url)) {
        errors.push("Project " + (index + 1) + " URL format is invalid.");
      }
    });

    const duplicates = findDuplicateSkills(data.skills);
    if (duplicates.length) {
      errors.push("Duplicate skills are not allowed (" + duplicates.join(", ") + ").");
    }

    (data.experience || []).forEach((item, index) => {
      if (!item) return;
      if (_dateRangeInvalid(item.startDate, item.endDate)) {
        errors.push("Experience " + (index + 1) + ": start date cannot be after end date.");
      }
    });

    (data.education || []).forEach((item, index) => {
      if (!item) return;
      if (_dateRangeInvalid(item.startDate, item.endDate)) {
        errors.push("Education " + (index + 1) + ": start date cannot be after end date.");
      }
    });

    return {
      ok: errors.length === 0,
      errors: errors
    };
  }

  function assessProfileReadiness(profile, options) {
    const opts = options || {};
    const masterProfile = profile || {};
    const data = createDefaultMasterProfile(masterProfile);
    const personal = data.personal || {};
    const work = createDefaultWorkAuthorization(
      masterProfile.workAuthorization || data.workAuthorization
    );
    const prefs = data.applicationPreferences || {};
    const hasDefaultResume =
      opts.hasDefaultResume != null
        ? Boolean(opts.hasDefaultResume)
        : Boolean(data.defaultResumeId && String(data.defaultResumeId).trim());

    const checks = [
      {
        id: "firstName",
        label: "First name",
        complete: _isFilled(personal.firstName)
      },
      {
        id: "lastName",
        label: "Last name",
        complete: _isFilled(personal.lastName)
      },
      {
        id: "email",
        label: "Email",
        complete: _isFilled(personal.email)
      },
      {
        id: "phone",
        label: "Phone",
        complete: _isFilled(personal.phone)
      },
      {
        id: "location",
        label: "Location",
        complete: _isFilled(personal.location)
      },
      {
        id: "defaultResume",
        label: "Default resume uploaded",
        complete: hasDefaultResume
      },
      {
        id: "experience",
        label: "At least one experience entry",
        complete: Array.isArray(data.experience) && data.experience.length > 0
      },
      {
        id: "education",
        label: "At least one education entry",
        complete: Array.isArray(data.education) && data.education.length > 0
      },
      {
        id: "skills",
        label: "Skills",
        complete: Array.isArray(data.skills) && data.skills.some((skill) => _isFilled(skill))
      },
      {
        id: "workAuthorization",
        label: "Work authorization",
        complete:
          _isFilled(work.countryApplyingIn) &&
          _isFilled(work.legallyAuthorizedToWork) &&
          _isFilled(work.requireSponsorshipNow) &&
          _isFilled(work.requireSponsorshipFuture)
      },
      {
        id: "availability",
        label: "Availability",
        complete:
          _isFilled(prefs.availableStartDate) &&
          _isFilled(prefs.noticePeriod) &&
          _isFilled(prefs.employmentTypePreference) &&
          _isFilled(prefs.willingToRelocate) &&
          _isFilled(prefs.preferredLocations) &&
          _isFilled(prefs.workLocationPreference)
      }
    ];

    const completedCount = checks.filter((check) => check.complete).length;
    const score = Math.round((completedCount / checks.length) * 100);
    const missing = checks.filter((check) => !check.complete).map((check) => check.label);
    const ready = missing.length === 0;

    return {
      score: score,
      ready: ready,
      statusLabel: ready ? "Ready to Apply" : "Profile Incomplete",
      missing: missing,
      checks: checks,
      completedCount: completedCount,
      totalCount: checks.length
    };
  }

  async function getProfileReadiness() {
    const masterProfile = await getMasterProfile();
    const resume = await getDefaultResume();
    return assessProfileReadiness(masterProfile, {
      hasDefaultResume: Boolean(resume && resume.id)
    });
  }

  global.ImpulsoStorage = {
    init: init,
    getMasterProfile: getMasterProfile,
    saveMasterProfile: saveMasterProfile,
    getSettings: getSettings,
    saveSettings: saveSettings,
    createDefaultMasterProfile: createDefaultMasterProfile,
    createDefaultWorkAuthorization: createDefaultWorkAuthorization,
    createDefaultApplicationPreferences: createDefaultApplicationPreferences,
    createDefaultCommonAnswers: createDefaultCommonAnswers,
    createDefaultDemographics: createDefaultDemographics,
    getDocument: getDocument,
    listDocuments: listDocuments,
    saveDocument: saveDocument,
    deleteDocument: deleteDocument,
    getDefaultResume: getDefaultResume,
    getJobSpecificResume: getJobSpecificResume,
    listJobSpecificResumes: listJobSpecificResumes,
    deleteJobSpecificResumesForJob: deleteJobSpecificResumesForJob,
    getJobProfile: getJobProfile,
    saveJobProfile: saveJobProfile,
    deleteJobProfile: deleteJobProfile,
    getJobResumeSelection: getJobResumeSelection,
    setJobResumeSelection: setJobResumeSelection,
    getSelectedResumeDocumentForJob: getSelectedResumeDocumentForJob,
    syncAutofillResumeForJob: syncAutofillResumeForJob,
    computeJobResumeDifferences: computeJobResumeDifferences,
    buildApprovedJobProfile: buildApprovedJobProfile,
    getProfileForJobMatch: getProfileForJobMatch,
    JOB_SPECIFIC_RESUME_TYPE: JOB_SPECIFIC_RESUME_TYPE,
    normalizeJobUrl: normalizeJobUrl,
    buildStableJobId: buildStableJobId,
    createJobRecord: createJobRecord,
    getJob: getJob,
    listJobs: listJobs,
    saveJob: saveJob,
    deleteJob: deleteJob,
    getCurrentJob: getCurrentJob,
    setCurrentJob: setCurrentJob,
    clearCurrentJob: clearCurrentJob,
    getCurrentJobId: getCurrentJobId,
    setCurrentJobId: setCurrentJobId,
    buildCareerRelevantProfile: buildCareerRelevantProfile,
    profileHasCareerSignal: profileHasCareerSignal,
    normalizeProfileSource: normalizeProfileSource,
    analysisLabelForSource: analysisLabelForSource,
    buildJobMatchAnalysisKey: buildJobMatchAnalysisKey,
    resolveJobMatchContext: resolveJobMatchContext,
    normalizeJobMatchAnalysis: normalizeJobMatchAnalysis,
    isJobMatchAnalysisStale: isJobMatchAnalysisStale,
    getJobMatchAnalysisForJob: getJobMatchAnalysisForJob,
    saveJobMatchAnalysis: saveJobMatchAnalysis,
    clearJobMatchAnalysis: clearJobMatchAnalysis,
    hashFileData: hashFileData,
    hashFile: hashFile,
    ensureDocumentFileHash: ensureDocumentFileHash,
    syncLegacyResume: syncLegacyResume,
    detectProfileConflicts: detectProfileConflicts,
    mergeApprovedProfileDraft: mergeApprovedProfileDraft,
    validateMasterProfile: validateMasterProfile,
    assessProfileReadiness: assessProfileReadiness,
    getProfileReadiness: getProfileReadiness,
    isValidEmailFormat: isValidEmailFormat,
    isValidUrlFormat: isValidUrlFormat,
    suggestEmailCorrection: suggestEmailCorrection
  };
})(typeof window !== "undefined" ? window : self);
