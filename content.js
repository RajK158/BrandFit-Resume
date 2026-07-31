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
    var inventory = {};
    if (typeof AF.resolveAnswerInventory === "function") {
      inventory = AF.resolveAnswerInventory(profilePayload || {}, opts);
    } else if (typeof AF.buildAnswerInventory === "function") {
      inventory = AF.buildAnswerInventory(profilePayload || {}, opts);
    }

    // Ensure disability status is wired from masterProfile.demographics.disabilityStatus.
    var demo = (profilePayload && profilePayload.demographics) || {};
    var disability =
      (inventory && (inventory.disability_status || inventory.disabilityStatus || inventory["disability status"])) ||
      demo.disabilityStatus ||
      demo.disability_status ||
      demo["disability status"] ||
      "";
    disability = String(disability || "").trim();
    if (disability) {
      inventory = inventory || {};
      inventory.disability_status = disability;
      inventory.disabilityStatus = disability;
    }
    return inventory || {};
  }

  function fillFromInventory(inventory, options) {
    var opts = options || {};
    var AF = window.ImpulsoAutofill;
    if (!AF || typeof AF.fillBasicTextFields !== "function") {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 },
        error: "Autofill engine is not available on this page."
      };
    }

    var report = AF.fillBasicTextFields(document, inventory || {});

    // Ashby Yes/No radios only (jobs.ashbyhq.com); diagnostics stay in the console.
    if (typeof AF.fillAshbyYesNoRadios === "function") {
      var ashbyReport = AF.fillAshbyYesNoRadios(document, inventory || {});
      if (typeof AF.mergeAutofillReports === "function") {
        report = AF.mergeAutofillReports(report, ashbyReport);
      } else {
        report.results = (report.results || []).concat((ashbyReport && ashbyReport.results) || []);
      }
    }

    // Ashby gender radios when demographics are included (default on for Trigger Auto-Apply).
    if (typeof AF.fillAshbyGenderRadios === "function") {
      var genderReport = AF.fillAshbyGenderRadios(document, inventory || {}, {
        fillDemographics: opts.fillDemographics !== false
      });
      if (typeof AF.mergeAutofillReports === "function") {
        report = AF.mergeAutofillReports(report, genderReport);
      } else {
        report.results = (report.results || []).concat((genderReport && genderReport.results) || []);
      }
    }

    // Ashby veteran status (only when a saved veteranStatus exists).
    if (typeof AF.fillAshbyVeteranRadios === "function") {
      var veteranReport = AF.fillAshbyVeteranRadios(document, inventory || {});
      if (typeof AF.mergeAutofillReports === "function") {
        report = AF.mergeAutofillReports(report, veteranReport);
      } else {
        report.results = (report.results || []).concat((veteranReport && veteranReport.results) || []);
      }
    }

    // Ashby disability status — always invoked during Trigger Auto-Apply when engine is present.
    if (typeof AF.fillAshbyDisabilityRadios === "function") {
      var disabilityReport = AF.fillAshbyDisabilityRadios(document, inventory || {}, {
        demographics: opts.demographics || null,
        profile: opts.profile || null
      });
      if (typeof AF.mergeAutofillReports === "function") {
        report = AF.mergeAutofillReports(report, disabilityReport);
      } else {
        report.results = (report.results || []).concat((disabilityReport && disabilityReport.results) || []);
      }
    }

    return report;
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

  function runAutofill(profilePayload, resume, options) {
    var opts = options || {};
    var inventory = resolveInventory(profilePayload, resume);
    var report = fillFromInventory(inventory, {
      // Default on: include saved demographic answers automatically.
      fillDemographics: opts.fillDemographics !== false,
      profile: profilePayload || null,
      demographics: (profilePayload && profilePayload.demographics) || null
    });
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
        var result = runAutofill(profile, resume, { fillDemographics: true });
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
        sendResponse(
          runAutofill(message.profile, resume, {
            fillDemographics: message.fillDemographics !== false
          })
        );
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
