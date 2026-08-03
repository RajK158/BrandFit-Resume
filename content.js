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

    // Ensure disability / race-ethnicity are wired from masterProfile.demographics.
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

    var raceEthnicity =
      (inventory && (inventory.race_ethnicity || inventory.raceEthnicity || inventory["race ethnicity"])) ||
      demo.raceEthnicity ||
      demo.race_ethnicity ||
      demo["race ethnicity"] ||
      "";
    raceEthnicity = String(raceEthnicity || "").trim();
    if (raceEthnicity) {
      inventory = inventory || {};
      inventory.race_ethnicity = raceEthnicity;
      inventory.raceEthnicity = raceEthnicity;
    }

    var work = (profilePayload && profilePayload.workAuthorization) || {};
    var exportControl =
      (inventory && (inventory.export_control_status || inventory.exportControlStatus)) ||
      work.exportControlStatus ||
      work.export_control_status ||
      "";
    exportControl = String(exportControl || "").trim();
    if (exportControl) {
      inventory = inventory || {};
      inventory.export_control_status = exportControl;
      inventory.exportControlStatus = exportControl;
    }
    return inventory || {};
  }

  function mergeReport(report, next) {
    var AF = window.ImpulsoAutofill;
    if (AF && typeof AF.mergeAutofillReports === "function") {
      return AF.mergeAutofillReports(report, next);
    }
    var merged = report || { results: [], summary: {} };
    merged.results = (merged.results || []).concat((next && next.results) || []);
    return merged;
  }

  function fillFromInventory(inventory, options) {
    var AF = window.ImpulsoAutofill;
    var opts = options || {};
    if (!AF || typeof AF.fillBasicTextFields !== "function") {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 },
        handledElements: opts.handledElements || [],
        error: "Autofill engine is not available on this page."
      };
    }

    return AF.fillBasicTextFields(document, inventory || {}, {
      handledElements: opts.handledElements || []
    });
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

  function detectActiveAts() {
    var Ashby = window.ImpulsoAshbyAdapter;
    if (Ashby && typeof Ashby.isSupportedPage === "function" && Ashby.isSupportedPage()) {
      return "ashby";
    }
    var Greenhouse = window.ImpulsoGreenhouseAdapter;
    if (Greenhouse && typeof Greenhouse.isSupportedPage === "function" && Greenhouse.isSupportedPage()) {
      return "greenhouse";
    }
    return "generic";
  }

  function nationalPhoneForSeparateCountryCode(phone, countryCode) {
    var raw = String(phone == null ? "" : phone).replace(/\s+/g, " ").trim();
    if (!raw) return "";
    var AF = window.ImpulsoAutofill;
    var digits =
      AF && typeof AF.phoneDigitsOnly === "function"
        ? AF.phoneDigitsOnly(raw)
        : raw.replace(/\D/g, "");
    var codeDigits =
      AF && typeof AF.phoneDigitsOnly === "function"
        ? AF.phoneDigitsOnly(countryCode)
        : String(countryCode == null ? "" : countryCode).replace(/\D/g, "");
    if (codeDigits && digits.indexOf(codeDigits) === 0 && digits.length > codeDigits.length + 6) {
      return digits.slice(codeDigits.length) || raw;
    }
    return raw;
  }

  function loadLatestMasterProfileSnapshot() {
    return new Promise(function (resolve) {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.local) {
          resolve(null);
          return;
        }
        chrome.storage.local.get(["masterProfile"], function (data) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(data && data.masterProfile && typeof data.masterProfile === "object" ? data.masterProfile : null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function runAutofill(profilePayload, resume, options) {
    var opts = options || {};
    // Refresh from the latest synced master profile immediately before autofill.
    var latestMaster = await loadLatestMasterProfileSnapshot();
    var profile = profilePayload && typeof profilePayload === "object" ? Object.assign({}, profilePayload) : {};
    if (latestMaster) {
      if (Array.isArray(latestMaster.education)) {
        profile.education = latestMaster.education;
      }
      if (latestMaster.personal && typeof latestMaster.personal === "object") {
        profile.personal = Object.assign({}, profile.personal || {}, latestMaster.personal);
      }
      if (latestMaster.links && typeof latestMaster.links === "object") {
        profile.links = Object.assign({}, profile.links || {}, latestMaster.links);
      }
      if (latestMaster.workAuthorization && typeof latestMaster.workAuthorization === "object") {
        profile.workAuthorization = Object.assign(
          {},
          profile.workAuthorization || {},
          latestMaster.workAuthorization
        );
      }
      if (latestMaster.demographics && typeof latestMaster.demographics === "object") {
        profile.demographics = Object.assign({}, profile.demographics || {}, latestMaster.demographics);
      }
    }

    var inventory = resolveInventory(profile, resume);
    var handledElements = [];
    var ats = detectActiveAts();

    // Keep ordered education records from the latest master profile for multi-entry Greenhouse fill.
    var AF = window.ImpulsoAutofill;
    if (AF && typeof AF.listValidEducationRecords === "function") {
      inventory = Object.assign({}, inventory, {
        education_records: AF.listValidEducationRecords(profile.education)
      });
    } else if (Array.isArray(profile.education)) {
      inventory = Object.assign({}, inventory, {
        education_records: profile.education
      });
    }

    // Greenhouse phone widgets use a separate country dropdown + national number input.
    if (ats === "greenhouse" && inventory && inventory.phone_country_code) {
      inventory = Object.assign({}, inventory, {
        phone: nationalPhoneForSeparateCountryCode(inventory.phone, inventory.phone_country_code)
      });
    }

    var fillOpts = {
      // Default on: include saved demographic answers automatically.
      fillDemographics: opts.fillDemographics !== false,
      profile: profile || null,
      demographics: (profile && profile.demographics) || null,
      workAuthorization: (profile && profile.workAuthorization) || null,
      handledElements: handledElements
    };
    var report = fillFromInventory(inventory, fillOpts);

    if (ats === "ashby") {
      var Ashby = window.ImpulsoAshbyAdapter;
      if (Ashby && typeof Ashby.fillSupportedFields === "function") {
        var ashbyReport = await Ashby.fillSupportedFields({
          root: document,
          inventory: inventory,
          fillDemographics: fillOpts.fillDemographics,
          profile: fillOpts.profile,
          demographics: fillOpts.demographics,
          workAuthorization: fillOpts.workAuthorization,
          tabId: opts.tabId
        });
        report = mergeReport(report, ashbyReport);
      }
    } else if (ats === "greenhouse") {
      var Greenhouse = window.ImpulsoGreenhouseAdapter;
      if (Greenhouse && typeof Greenhouse.fillSupportedFields === "function") {
        var greenhouseReport = await Greenhouse.fillSupportedFields({
          root: document,
          inventory: inventory,
          fillDemographics: fillOpts.fillDemographics,
          profile: fillOpts.profile,
          demographics: fillOpts.demographics,
          workAuthorization: fillOpts.workAuthorization,
          resume: resume || null,
          handledElements: handledElements,
          tabId: opts.tabId
        });
        report = mergeReport(report, greenhouseReport);
      }
    }

    uploadResumeIfPresent(resume);
    return {
      ok: !report.error,
      error: report.error || "",
      report: report,
      usedLegacyFallback: false
    };
  }

  function runLegacyFallback(resumeFromMessage, sendResponse, tabId) {
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
        runAutofill(profile, resume, { fillDemographics: true, tabId: tabId })
          .then(function (result) {
            result.usedLegacyFallback = true;
            sendResponse(result);
          })
          .catch(function (error) {
            sendResponse({
              ok: false,
              error: error && error.message ? error.message : "Autofill failed.",
              report: { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } },
              usedLegacyFallback: true
            });
          });
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

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== MESSAGE_TYPE) return;

    var tabId =
      typeof message.tabId === "number" && message.tabId > 0
        ? message.tabId
        : sender && sender.tab && typeof sender.tab.id === "number"
          ? sender.tab.id
          : undefined;

    try {
      var resume = message.resume || {};
      if (message.profile && typeof message.profile === "object") {
        runAutofill(message.profile, resume, {
          fillDemographics: message.fillDemographics !== false,
          tabId: tabId
        })
          .then(sendResponse)
          .catch(function (error) {
            sendResponse({
              ok: false,
              error: error && error.message ? error.message : "Autofill failed.",
              report: { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } }
            });
          });
        return true;
      }
      // Fallback only when no profile payload was received.
      runLegacyFallback(resume, sendResponse, tabId);
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

