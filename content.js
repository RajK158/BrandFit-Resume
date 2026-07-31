(function () {
  // Keep a single bridge listener across re-injections on the same tab.
  if (window.__IMPULSO_AUTOFILL_BRIDGE__) return;
  window.__IMPULSO_AUTOFILL_BRIDGE__ = true;

  var MESSAGE_TYPE = "IMPULSO_TRIGGER_AUTOFILL";
  var ASHBY_RACE_MAIN_TYPE = "IMPULSO_ASHBY_RACE_MAIN";
  var ASHBY_EXPORT_CONTROL_MAIN_TYPE = "IMPULSO_ASHBY_EXPORT_CONTROL_MAIN";

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
      report = mergeReport(report, AF.fillAshbyYesNoRadios(document, inventory || {}));
    }

    // Ashby gender radios when demographics are included (default on for Trigger Auto-Apply).
    if (typeof AF.fillAshbyGenderRadios === "function") {
      report = mergeReport(
        report,
        AF.fillAshbyGenderRadios(document, inventory || {}, {
          fillDemographics: opts.fillDemographics !== false
        })
      );
    }

    // Ashby veteran status (only when a saved veteranStatus exists).
    if (typeof AF.fillAshbyVeteranRadios === "function") {
      report = mergeReport(report, AF.fillAshbyVeteranRadios(document, inventory || {}));
    }

    // Ashby disability status — always invoked during Trigger Auto-Apply when engine is present.
    if (typeof AF.fillAshbyDisabilityRadios === "function") {
      report = mergeReport(
        report,
        AF.fillAshbyDisabilityRadios(document, inventory || {}, {
          demographics: opts.demographics || null,
          profile: opts.profile || null
        })
      );
    }

    // Ashby Race selection runs in the webpage MAIN world (via background.js).
    return report;
  }

  function requestAshbyRaceMainWorld(canonicalRaceValue, tabId) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          {
            type: ASHBY_RACE_MAIN_TYPE,
            tabId: typeof tabId === "number" ? tabId : undefined,
            canonicalRaceValue: String(canonicalRaceValue || "")
          },
          function (response) {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                selectedText: "",
                reason: "Race selection failed."
              });
              return;
            }
            resolve(
              response && typeof response === "object"
                ? response
                : {
                    success: false,
                    selectedText: "",
                    reason: "Race selection failed."
                  }
            );
          }
        );
      } catch (_) {
        resolve({
          success: false,
          selectedText: "",
          reason: "Race selection failed."
        });
      }
    });
  }

  async function fillAshbyRaceViaMainWorld(inventory, options, tabId) {
    var AF = window.ImpulsoAutofill;
    if (!AF || typeof AF.prepareAshbyRaceEthnicity !== "function") {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var prepared = AF.prepareAshbyRaceEthnicity(inventory || {}, {
      demographics: (options && options.demographics) || null,
      profile: (options && options.profile) || null
    });
    // Skip silently when no saved race/ethnicity value exists.
    if (!prepared || !prepared.shouldFill) {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var mainResult = await requestAshbyRaceMainWorld(prepared.canonicalRaceValue, tabId);
    if (typeof AF.raceReportFromMainWorldResult === "function") {
      return AF.raceReportFromMainWorldResult(mainResult);
    }

    return {
      results: [
        {
          category: "race_ethnicity",
          label: "Race",
          question: "Race",
          status: mainResult && mainResult.success ? "filled" : "failed",
          reason: (mainResult && mainResult.reason) || "",
          ok: Boolean(mainResult && mainResult.success),
          value: (mainResult && mainResult.success && mainResult.selectedText) || ""
        }
      ],
      summary: {
        attempted: 1,
        filled: mainResult && mainResult.success ? 1 : 0,
        skipped: 0,
        failed: mainResult && mainResult.success ? 0 : 1
      }
    };
  }

  function requestAshbyExportControlMainWorld(savedValue, tabId) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          {
            type: ASHBY_EXPORT_CONTROL_MAIN_TYPE,
            tabId: typeof tabId === "number" ? tabId : undefined,
            savedValue: String(savedValue || "")
          },
          function (response) {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                selectedText: "",
                reason: "Export-control selection failed."
              });
              return;
            }
            resolve(
              response && typeof response === "object"
                ? response
                : {
                    success: false,
                    selectedText: "",
                    reason: "Export-control selection failed."
                  }
            );
          }
        );
      } catch (_) {
        resolve({
          success: false,
          selectedText: "",
          reason: "Export-control selection failed."
        });
      }
    });
  }

  async function fillAshbyExportControlViaMainWorld(inventory, options, tabId) {
    var AF = window.ImpulsoAutofill;
    if (!AF || typeof AF.prepareAshbyExportControl !== "function") {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var prepared = AF.prepareAshbyExportControl(inventory || {}, {
      workAuthorization: (options && options.workAuthorization) || null,
      profile: (options && options.profile) || null
    });
    // Skip silently when no explicit saved export-control value exists.
    if (!prepared || !prepared.shouldFill) {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var mainResult = await requestAshbyExportControlMainWorld(prepared.savedValue, tabId);
    if (typeof AF.exportControlReportFromMainWorldResult === "function") {
      return AF.exportControlReportFromMainWorldResult(mainResult);
    }

    return {
      results: [
        {
          category: "export_control_status",
          label: "Export control / U.S. person status",
          question: "Export control / U.S. person status",
          status: mainResult && mainResult.success ? "filled" : "failed",
          reason: (mainResult && mainResult.reason) || "",
          ok: Boolean(mainResult && mainResult.success),
          value: (mainResult && mainResult.success && mainResult.selectedText) || ""
        }
      ],
      summary: {
        attempted: 1,
        filled: mainResult && mainResult.success ? 1 : 0,
        skipped: 0,
        failed: mainResult && mainResult.success ? 0 : 1
      }
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

  async function runAutofill(profilePayload, resume, options) {
    var opts = options || {};
    var inventory = resolveInventory(profilePayload, resume);
    var fillOpts = {
      // Default on: include saved demographic answers automatically.
      fillDemographics: opts.fillDemographics !== false,
      profile: profilePayload || null,
      demographics: (profilePayload && profilePayload.demographics) || null,
      workAuthorization: (profilePayload && profilePayload.workAuthorization) || null
    };
    var report = fillFromInventory(inventory, fillOpts);

    // Ashby Race: React handlers must run in the webpage MAIN world.
    var raceReport = await fillAshbyRaceViaMainWorld(inventory, fillOpts, opts.tabId);
    report = mergeReport(report, raceReport);

    // Ashby export-control / U.S. person: MAIN-world React handlers; never inferred.
    var exportReport = await fillAshbyExportControlViaMainWorld(
      inventory,
      fillOpts,
      opts.tabId
    );
    report = mergeReport(report, exportReport);

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

