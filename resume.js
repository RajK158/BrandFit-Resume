(function (global) {
  "use strict";

  const MAX_RESUME_BYTES = 5 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
  const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  function ensureStorage() {
    if (!global.ImpulsoStorage) {
      throw new Error("ImpulsoStorage is not available. Load storage.js before resume.js.");
    }
    return global.ImpulsoStorage;
  }

  function createResumeId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return "resume_" + global.crypto.randomUUID();
    }
    return "resume_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function getExtension(filename) {
    const name = String(filename || "").toLowerCase();
    const index = name.lastIndexOf(".");
    return index === -1 ? "" : name.slice(index);
  }

  function validateFile(file) {
    if (!file) {
      return { ok: false, message: "No file selected." };
    }

    if (!file.size || file.size <= 0) {
      return { ok: false, message: "The selected file is empty." };
    }

    if (file.size > MAX_RESUME_BYTES) {
      return { ok: false, message: "Resume must be 5 MB or smaller." };
    }

    const extension = getExtension(file.name);
    const mime = String(file.type || "").toLowerCase();
    const extensionOk = ALLOWED_EXTENSIONS.includes(extension);
    const mimeOk = !mime || ALLOWED_MIME_TYPES.includes(mime);

    if (!extensionOk) {
      return {
        ok: false,
        message: "Unsupported format. Please upload a PDF or DOCX file."
      };
    }

    if (mime && !mimeOk) {
      return {
        ok: false,
        message: "Unsupported file type. Please upload a PDF or DOCX file."
      };
    }

    return { ok: true, message: "" };
  }

  function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(2) + " MB";
  }

  function formatUploadDate(isoString) {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return String(isoString);
    return date.toLocaleString();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string" || !reader.result) {
          reject(new Error("Failed to read file data."));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => {
        reject(new Error("File reading failed. Please try another file."));
      };
      reader.readAsDataURL(file);
    });
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

  async function refreshResumeUI() {
    const emptyState = document.getElementById("resumeEmptyState");
    const details = document.getElementById("resumeDetails");
    const fileNameEl = document.getElementById("resumeFileName");
    const fileSizeEl = document.getElementById("resumeFileSize");
    const uploadDateEl = document.getElementById("resumeUploadDate");
    const badgeEl = document.getElementById("resumeDefaultBadge");

    if (!emptyState || !details) return;

    try {
      const resume = await getDefaultResume();
      if (!resume) {
        emptyState.hidden = false;
        details.hidden = true;
        if (badgeEl) badgeEl.hidden = true;
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
    } catch (error) {
      setStatus(error.message || "Failed to load resume details.", true);
    }
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
          "Replace the current default resume with \"" + (file && file.name ? file.name : "this file") + "\"?"
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
              "Remove the default resume \"" +
                ((error.existing && error.existing.name) || "current file") +
                "\"? This cannot be undone."
            );
            if (!accepted) {
              setStatus("Remove cancelled.", false);
              return;
            }

            try {
              await removeDefaultResume({ removeConfirmed: true });
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
  }

  function init() {
    bindResumeUI();
    return refreshResumeUI();
  }

  global.ImpulsoResume = {
    init: init,
    refresh: refreshResumeUI,
    validateFile: validateFile,
    saveUploadedResume: saveUploadedResume,
    removeDefaultResume: removeDefaultResume,
    getDefaultResume: getDefaultResume,
    formatFileSize: formatFileSize,
    formatUploadDate: formatUploadDate,
    MAX_RESUME_BYTES: MAX_RESUME_BYTES
  };
})(typeof window !== "undefined" ? window : self);
