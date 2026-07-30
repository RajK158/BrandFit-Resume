(function () {
  // Keep a single bridge listener across re-injections on the same tab.
  if (window.__IMPULSO_AUTOFILL_BRIDGE__) return;
  window.__IMPULSO_AUTOFILL_BRIDGE__ = true;

  var MESSAGE_TYPE = "IMPULSO_TRIGGER_AUTOFILL";

  function findLabelText(input) {
    if (window.ImpulsoAutofill && typeof window.ImpulsoAutofill.findLabelText === "function") {
      return window.ImpulsoAutofill.findLabelText(input);
    }
    if (input.id) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) return label.innerText;
    }
    var parentLabel = input.closest("label");
    return parentLabel ? parentLabel.innerText : "";
  }

  function getIdentityBlob(input) {
    if (window.ImpulsoAutofill && typeof window.ImpulsoAutofill.getFieldIdentity === "function") {
      var identity = window.ImpulsoAutofill.getFieldIdentity(input);
      return String(identity.blob || "").toLowerCase();
    }
    var nameAttr = (input.name || "").toLowerCase();
    var idAttr = (input.id || "").toLowerCase();
    var placeholderAttr = (input.placeholder || "").toLowerCase();
    var labelText = findLabelText(input).toLowerCase();
    return (nameAttr + " " + idAttr + " " + placeholderAttr + " " + labelText).trim();
  }

  function buildProfileFromLegacyStorage(data) {
    var raw = data || {};
    if (raw.masterProfile && typeof raw.masterProfile === "object") {
      return raw.masterProfile;
    }
    var prefs = raw.applicationPreferences || {};
    return {
      personal: {
        firstName: raw.firstName || "",
        lastName: raw.lastName || "",
        preferredName: raw.preferredName || "",
        email: raw.email || "",
        phone: raw.phone || "",
        location: raw.location || ""
      },
      links: {
        linkedin: raw.linkedin || "",
        github: raw.github || "",
        portfolio: raw.portfolio || ""
      },
      commonAnswers: {
        projectHighlight: raw.projectHighlight || "",
        referralSource: raw.referralSource || "",
        additionalInformation:
          raw.additionalInformation || raw.linkedinMessageOrAdditionalInfo || "",
        defaultCoverLetter: raw.defaultCoverLetter || raw.coverLetter || "",
        linkedinMessageOrAdditionalInfo:
          raw.additionalInformation || raw.linkedinMessageOrAdditionalInfo || "",
        whyInterestedInRole: raw.whyInterestedInRole || "",
        anythingElseToKnow: raw.anythingElseToKnow || ""
      },
      applicationPreferences: {
        availableStartDate:
          prefs.availableStartDate || raw.availableStartDate || ""
      }
    };
  }

  function resolveInventory(profilePayload, resume) {
    var AF = window.ImpulsoAutofill;
    if (!AF) return {};
    var opts = {
      hasResume: Boolean(resume && resume.resumeBase64 && resume.resumeName),
      resumeName: (resume && resume.resumeName) || ""
    };
    if (typeof AF.resolveAnswerInventory === "function") {
      return AF.resolveAnswerInventory(profilePayload || {}, opts);
    }
    if (typeof AF.buildAnswerInventory === "function") {
      return AF.buildAnswerInventory(profilePayload || {}, opts);
    }
    return {};
  }

  function fillFromInventory(inventory) {
    var AF = window.ImpulsoAutofill;
    if (AF && typeof AF.fillBasicTextFields === "function") {
      return AF.fillBasicTextFields(document, inventory || {});
    }
    return {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 },
      error: "Autofill engine is not available on this page."
    };
  }

  function uploadResumeIfPresent(resume) {
    if (!resume || !resume.resumeBase64 || !resume.resumeName) return;
    document.querySelectorAll('input[type="file"]').forEach(function (fileInput) {
      var identity = getIdentityBlob(fileInput);
      if (
        (/\bresume\b/.test(identity) || /\bcv\b/.test(identity)) &&
        !/\bcover\b/.test(identity) &&
        !/\bletter\b/.test(identity)
      ) {
        uploadFileToInput(fileInput, resume.resumeBase64, resume.resumeName);
      }
    });
  }

  function runAutofill(profilePayload, resume) {
    var inventory = resolveInventory(profilePayload, resume);
    var report = fillFromInventory(inventory);
    uploadResumeIfPresent(resume);
    return {
      ok: !report.error,
      error: report.error || "",
      report: report,
      usedLegacyFallback: false
    };
  }

  function runLegacyFallback(resumeFromMessage, sendResponse) {
    chrome.storage.local.get(
      [
        "firstName",
        "lastName",
        "email",
        "phone",
        "preferredName",
        "location",
        "github",
        "linkedin",
        "portfolio",
        "projectHighlight",
        "referralSource",
        "defaultCoverLetter",
        "coverLetter",
        "additionalInformation",
        "linkedinMessageOrAdditionalInfo",
        "whyInterestedInRole",
        "anythingElseToKnow",
        "availableStartDate",
        "masterProfile",
        "resumeBase64",
        "resumeName"
      ],
      function (data) {
        var profile = buildProfileFromLegacyStorage(data);
        var resume = resumeFromMessage || {
          resumeBase64: data.resumeBase64 || "",
          resumeName: data.resumeName || ""
        };
        if (!resume.resumeBase64 && data.resumeBase64) {
          resume = {
            resumeBase64: data.resumeBase64,
            resumeName: data.resumeName || ""
          };
        }
        var result = runAutofill(profile, resume);
        result.usedLegacyFallback = true;
        sendResponse(result);
      }
    );
  }

  function uploadFileToInput(inputElement, base64Data, filename) {
    try {
      var arr = base64Data.split(",");
      var mime = arr[0].match(/:(.*?);/)[1];
      var bstr = atob(arr[1]);
      var n = bstr.length;
      var u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      var fileBlob = new Blob([u8arr], { type: mime });
      var file = new File([fileBlob], filename, { type: mime });

      var dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
      console.error("File input error:", err);
    }
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== MESSAGE_TYPE) return;

    try {
      var resume = message.resume || {};
      if (message.profile && typeof message.profile === "object") {
        sendResponse(runAutofill(message.profile, resume));
        return;
      }
      // Fallback only when no profile payload was received.
      runLegacyFallback(resume, sendResponse);
      return true;
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Autofill failed.",
        report: { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } }
      });
    }
  });
})();
