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
      workAuthorization: {},
      commonAnswers: {},
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
      workAuthorization: overrides.workAuthorization || base.workAuthorization,
      commonAnswers: overrides.commonAnswers || base.commonAnswers
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

    return profile;
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
      commonAnswers: profile.commonAnswers || {},
      defaultResumeId: profile.defaultResumeId == null ? null : profile.defaultResumeId
    });

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
    const toSave = {
      id: String(documentRecord.id),
      name: documentRecord.name || "",
      type: documentRecord.type || "",
      size: Number(documentRecord.size) || 0,
      fileData: documentRecord.fileData || "",
      isDefault: Boolean(documentRecord.isDefault),
      createdAt: documentRecord.createdAt || timestamp,
      updatedAt: timestamp
    };

    try {
      await withStore(STORE_DOCUMENTS, "readwrite", (store) => idbRequest(store.put(toSave)));
    } catch (error) {
      throw new Error("Failed to save document to IndexedDB: " + error.message);
    }

    return toSave;
  }

  async function deleteDocument(id) {
    if (!id) return false;
    try {
      await withStore(STORE_DOCUMENTS, "readwrite", (store) => idbRequest(store.delete(id)));
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
      workAuthorization: master.workAuthorization || {},
      commonAnswers: master.commonAnswers || {},
      defaultResumeId: master.defaultResumeId == null ? null : master.defaultResumeId,
      createdAt: master.createdAt || timestamp,
      updatedAt: timestamp
    };

    return merged;
  }

  global.ImpulsoStorage = {
    init: init,
    getMasterProfile: getMasterProfile,
    saveMasterProfile: saveMasterProfile,
    getSettings: getSettings,
    saveSettings: saveSettings,
    createDefaultMasterProfile: createDefaultMasterProfile,
    getDocument: getDocument,
    listDocuments: listDocuments,
    saveDocument: saveDocument,
    deleteDocument: deleteDocument,
    getDefaultResume: getDefaultResume,
    syncLegacyResume: syncLegacyResume,
    detectProfileConflicts: detectProfileConflicts,
    mergeApprovedProfileDraft: mergeApprovedProfileDraft
  };
})(typeof window !== "undefined" ? window : self);
