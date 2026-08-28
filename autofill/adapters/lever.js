(function (global) {
  "use strict";

  var LEVER_HOST_RE = /(?:^|\.)lever\.co$/i;
  var ALLOWED_CATEGORIES = {
    work_authorization: true,
    sponsorship_now: true,
    sponsorship_later: true
  };

  function af() {
    return global.ImpulsoAutofill || null;
  }

  function trimText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return trimText(value).toLowerCase();
  }

  function explicitYesNo(value) {
    var text = normalizeText(value);
    if (text === "yes") return "yes";
    if (text === "no") return "no";
    return "";
  }

  function summarize(results, handledElements) {
    return {
      results: results || [],
      handledElements: handledElements || [],
      summary: {
        attempted: (results || []).length,
        filled: (results || []).filter(function (row) {
          return row.status === "filled";
        }).length,
        skipped: (results || []).filter(function (row) {
          return row.status === "skipped";
        }).length,
        failed: (results || []).filter(function (row) {
          return row.status === "failed";
        }).length
      }
    };
  }

  function markHandled(handledElements, el) {
    if (!el || !handledElements) return;
    if (handledElements.indexOf(el) === -1) handledElements.push(el);
  }

  function markGroupHandled(handledElements, radios) {
    (radios || []).forEach(function (radio) {
      markHandled(handledElements, radio);
    });
  }

  function isSupportedPage() {
    try {
      var host = String((global.location && global.location.hostname) || "");
      if (!LEVER_HOST_RE.test(host)) return false;

      return Boolean(
        document.querySelector(
          "#application-form, form.application-form"
        )
      );
    } catch (_) {
      return false;
    }
  }

  function classifyQuestion(questionText) {
    var engine = af();
    if (!engine || typeof engine.classifyLabel !== "function") {
      return { category: "unknown", confidence: 0 };
    }
    return (
      engine.classifyLabel(questionText, "radio", { optionLabels: ["Yes", "No"] }) || {
        category: "unknown",
        confidence: 0
      }
    );
  }

  function looksLikeExportControl(questionText) {
    var text = normalizeText(questionText);
    if (!text) return false;
    return (
      /\bexport\s+control\b/.test(text) ||
      /\bitar\b/.test(text) ||
      /\bu\.?\s*s\.?\s+person\b/.test(text) ||
      /\bus\s+person\b/.test(text)
    );
  }

  function isCombinedSponsorshipQuestion(questionText) {
    var text = normalizeText(questionText);
    if (!text) return false;
    if (!/\bsponsor/.test(text) && !/\bvisa\s+sponsorship\b/.test(text)) return false;
    var hasNow = /\bnow\b/.test(text) || /\bcurrent(?:ly)?\b/.test(text);
    var hasFuture = /\bfuture\b/.test(text) || /\blater\b/.test(text);
    return hasNow && hasFuture;
  }

  function resolveCombinedSponsorship(inventory) {
    var now = explicitYesNo(inventory && inventory.sponsorship_now);
    var later = explicitYesNo(inventory && inventory.sponsorship_later);
    if (now === "yes" || later === "yes") return "yes";
    if (now === "no" && later === "no") return "no";
    return "";
  }

  function resolveSavedAnswer(category, questionText, inventory) {
    var inv = inventory || {};
    if (category === "work_authorization") {
      return explicitYesNo(inv.work_authorization);
    }
    if (category !== "sponsorship_now" && category !== "sponsorship_later") return "";
    if (isCombinedSponsorshipQuestion(questionText)) {
      return resolveCombinedSponsorship(inv);
    }
    if (category === "sponsorship_later") return explicitYesNo(inv.sponsorship_later);
    return explicitYesNo(inv.sponsorship_now);
  }

  function questionTextFromWrapper(wrapper) {
    if (!wrapper) return "";
    var nodes = wrapper.querySelectorAll(
      ".application-question-label, .application-label, .question-label, .text"
    );
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i].querySelector && nodes[i].querySelector("input")) continue;
      var labeled = trimText(nodes[i].innerText || nodes[i].textContent || "");
      if (labeled) return labeled;
    }
    var clone = wrapper.cloneNode(true);
    Array.prototype.forEach.call(
      clone.querySelectorAll("input, select, textarea, button, ul"),
      function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    );
    return trimText(clone.innerText || clone.textContent || "").replace(/\b(yes|no)\s*$/i, "").trim();
  }

  function radioOptionToken(radio) {
    if (!radio) return "";
    var value = normalizeText(radio.value);
    if (value === "yes" || value === "no") return value;
    var aria = normalizeText(radio.getAttribute && radio.getAttribute("aria-label"));
    if (aria === "yes" || aria === "no") return aria;
    var labelText = "";
    if (radio.id) {
      try {
        var byFor = document.querySelector('label[for="' + CSS.escape(radio.id) + '"]');
        if (byFor) labelText = normalizeText(byFor.innerText || byFor.textContent || "");
      } catch (_) {}
    }
    if (!labelText) {
      var parentLabel = radio.closest && radio.closest("label");
      if (parentLabel) labelText = normalizeText(parentLabel.innerText || parentLabel.textContent || "");
    }
    if (labelText === "yes" || labelText === "no") return labelText;
    return "";
  }

  function isExactYesNoGroup(radios) {
    if (!radios || radios.length !== 2) return false;
    var seen = {};
    var i;
    for (i = 0; i < radios.length; i += 1) {
      var token = radioOptionToken(radios[i]);
      if (token !== "yes" && token !== "no") return false;
      if (seen[token]) return false;
      seen[token] = true;
    }
    return Boolean(seen.yes && seen.no);
  }

  function groupAlreadySelected(radios) {
    return (radios || []).some(function (radio) {
      return Boolean(radio && radio.checked);
    });
  }

  function matchExactYesNoRadio(radios, answer) {
    var want = explicitYesNo(answer);
    if (!want) return null;
    var i;
    for (i = 0; i < (radios || []).length; i += 1) {
      if (radioOptionToken(radios[i]) === want) return radios[i];
    }
    return null;
  }

  function selectExactYesNoRadio(radio) {
    if (!radio) return false;
    try {
      if (typeof radio.scrollIntoView === "function") {
        radio.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      var label = radio.closest && radio.closest("label");
      if (label && typeof label.click === "function") label.click();
      else if (typeof radio.click === "function") radio.click();
    } catch (_) {}
    try {
      radio.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}
    try {
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    if (!radio.checked) {
      try {
        radio.checked = true;
      } catch (_) {}
      try {
        radio.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (_) {}
      try {
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }
    return Boolean(radio.checked);
  }

  function resultRow(category, label, status, reason, ok, value) {
    return {
      category: category,
      label: label,
      status: status,
      reason: reason || "",
      ok: Boolean(ok),
      value: value || ""
    };
  }

  function collectNamedRadioGroups(wrapper) {
    var groups = [];
    var seen = {};
    var radios = wrapper.querySelectorAll('input[type="radio"]');
    Array.prototype.forEach.call(radios, function (radio) {
      var name = trimText(radio && radio.name);
      if (!name || seen[name]) return;
      seen[name] = true;
      var members = [];
      Array.prototype.forEach.call(radios, function (candidate) {
        if (trimText(candidate.name) === name) members.push(candidate);
      });
      groups.push({ name: name, radios: members });
    });
    return groups;
  }

  function fillYesNoRadioGroups(inventory, handledElements) {
    var results = [];
    var wrappers = document.querySelectorAll(
      "#application-form .application-question.custom-question"
    );
    Array.prototype.forEach.call(wrappers, function (wrapper) {
      var questionText = questionTextFromWrapper(wrapper);
      var classified = classifyQuestion(questionText);
      var category = (classified && classified.category) || "unknown";
      if (looksLikeExportControl(questionText) || category === "export_control_status") {
        return;
      }
      if (!ALLOWED_CATEGORIES[category]) return;

      var groups = collectNamedRadioGroups(wrapper);
      groups.forEach(function (group) {
        if (isSurveysResponsesName(group.name)) return;
        if (!isExactYesNoGroup(group.radios)) return;
        markGroupHandled(handledElements, group.radios);

        if (groupAlreadySelected(group.radios)) {
          results.push(
            resultRow(category, questionText, "skipped", "Field is already completed.", false, "")
          );
          return;
        }

        var answer = resolveSavedAnswer(category, questionText, inventory);
        if (!answer) {
          results.push(
            resultRow(category, questionText, "skipped", "No saved answer.", false, "")
          );
          return;
        }

        var matched = matchExactYesNoRadio(group.radios, answer);
        if (!matched) {
          results.push(
            resultRow(category, questionText, "failed", "No exact Yes/No option matched.", false, "")
          );
          return;
        }

        if (!selectExactYesNoRadio(matched) || !matched.checked) {
          results.push(
            resultRow(
              category,
              questionText,
              "failed",
              "Verification failed; selected radio did not remain checked.",
              false,
              ""
            )
          );
          return;
        }

        results.push(
          resultRow(category, questionText, "filled", "", true, answer === "yes" ? "Yes" : "No")
        );
      });
    });
    return results;
  }

  function looksLikeWorkAuthorizationQuestion(questionText) {
    var classified = classifyQuestion(questionText);
    if ((classified && classified.category) === "work_authorization") return true;
    var text = normalizeText(questionText);
    if (!text) return false;
    if (/\brelocatem?\b/.test(text) || /\bsponsor/.test(text)) return false;
    if (/\binternship\b/.test(text) || /\bsemester\b/.test(text) || /\bacademic\b/.test(text)) return false;
    if (looksLikeExportControl(questionText)) return false;
    return (
      /\blegally\s+authorized\b/.test(text) ||
      /\bauthorized\s+to\s+work\b/.test(text) ||
      /\bauthorization\s+to\s+work\b/.test(text) ||
      /\bwork\s+authorization\b/.test(text) ||
      /\beligible\s+to\s+work\b/.test(text) ||
      /\blegally\s+eligible\s+to\s+work\b/.test(text)
    );
  }

  function selectOptionYesNoToken(opt) {
    if (!opt) return "";
    var text = normalizeText(selectOptionLabel(opt) || opt.value || "");
    if (text === "yes" || text === "no") return text;
    return "";
  }

  function findYesNoSelectPair(select) {
    var yesOpts = [];
    var noOpts = [];
    Array.prototype.forEach.call((select && select.options) || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      var token = selectOptionYesNoToken(opt);
      if (token === "yes") yesOpts.push(opt);
      if (token === "no") noOpts.push(opt);
    });
    if (yesOpts.length !== 1 || noOpts.length !== 1) return null;
    return { yes: yesOpts[0], no: noOpts[0] };
  }

  function classifyCompositeWorkAuthOption(label) {
    var text = normalizeText(label);
    if (!text) return "";
    if (
      /\bwithout\s+sponsorship\b/.test(text) ||
      /\bno\s+sponsorship\b/.test(text) ||
      /\bnot\s+require.{0,40}sponsor/.test(text) ||
      /\bdo\s+not\s+require.{0,40}sponsor/.test(text)
    ) {
      return "authorized_no_sponsorship";
    }
    if (/\bsponsor/.test(text) && (/\bfuture\b/.test(text) || /\blater\b/.test(text))) {
      return "future_sponsorship";
    }
    if (
      /\bsponsor/.test(text) &&
      (/\bimmediate\b/.test(text) || /\bnow\b/.test(text) || /\bcurrent(?:ly)?\b/.test(text))
    ) {
      return "immediate_sponsorship";
    }
    return "";
  }

  function findCompositeWorkAuthOptions(select) {
    var buckets = {
      authorized_no_sponsorship: [],
      future_sponsorship: [],
      immediate_sponsorship: []
    };
    Array.prototype.forEach.call((select && select.options) || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      var kind = classifyCompositeWorkAuthOption(selectOptionLabel(opt));
      if (kind && buckets[kind]) buckets[kind].push(opt);
    });
    if (
      buckets.authorized_no_sponsorship.length === 1 &&
      buckets.future_sponsorship.length === 1 &&
      buckets.immediate_sponsorship.length === 1
    ) {
      return {
        authorized_no_sponsorship: buckets.authorized_no_sponsorship[0],
        future_sponsorship: buckets.future_sponsorship[0],
        immediate_sponsorship: buckets.immediate_sponsorship[0]
      };
    }
    return null;
  }

  function resolveCompositeWorkAuthChoice(inventory) {
    var inv = inventory || {};
    var auth = explicitYesNo(inv.work_authorization);
    var now = explicitYesNo(inv.sponsorship_now);
    var later = explicitYesNo(inv.sponsorship_later);

    if (now === "yes") return "immediate_sponsorship";
    if (now === "no" && later === "yes" && auth !== "no") return "future_sponsorship";
    if (auth === "yes" && now === "no" && later === "no") return "authorized_no_sponsorship";
    return "";
  }

  function fillWorkAuthorizationSelects(inventory, handledElements) {
    var results = [];
    var wrappers = document.querySelectorAll(
      "#application-form .application-question.custom-question"
    );
    Array.prototype.forEach.call(wrappers, function (wrapper) {
      var questionText = questionTextFromWrapper(wrapper);
      if (!looksLikeWorkAuthorizationQuestion(questionText)) return;

      var selects = wrapper.querySelectorAll("select");
      Array.prototype.forEach.call(selects, function (select) {
        if (!select) return;
        var name = trimText(select.name || "");
        if (eeoCategoryForName(name)) return;
        if (isSurveysResponsesName(name)) return;
        if (normalizeText(name).indexOf("signature") !== -1) return;
        if (handledElements.indexOf(select) !== -1) return;

        var composite = findCompositeWorkAuthOptions(select);
        var pair = composite ? null : findYesNoSelectPair(select);
        if (!composite && !pair) return;

        markHandled(handledElements, select);

        if (isSelectAlreadyFilled(select)) {
          results.push(
            resultRow("work_authorization", questionText, "skipped", "Field is already completed.", false, "")
          );
          return;
        }

        var matched = null;
        if (composite) {
          var choice = resolveCompositeWorkAuthChoice(inventory);
          if (!choice) {
            results.push(
              resultRow(
                "work_authorization",
                questionText,
                "skipped",
                "Saved work-authorization and sponsorship answers are incomplete or contradictory.",
                false,
                ""
              )
            );
            return;
          }
          matched = composite[choice];
        } else {
          var answer = explicitYesNo(inventory && inventory.work_authorization);
          if (!answer) {
            results.push(
              resultRow("work_authorization", questionText, "skipped", "No saved answer.", false, "")
            );
            return;
          }
          matched = answer === "yes" ? pair.yes : pair.no;
        }

        if (!matched) {
          results.push(
            resultRow(
              "work_authorization",
              questionText,
              "skipped",
              "No safe matching work-authorization option.",
              false,
              ""
            )
          );
          return;
        }

        if (!applySelectOption(select, matched)) {
          results.push(
            resultRow(
              "work_authorization",
              questionText,
              "failed",
              "Verification failed; selected option did not persist.",
              false,
              ""
            )
          );
          return;
        }

        results.push(
          resultRow("work_authorization", questionText, "filled", "", true, selectOptionLabel(matched))
        );
      });
    });
    return results;
  }

  function looksLikeReferralQuestion(questionText) {
    var engine = af();
    if (engine && typeof engine.looksLikeReferralSource === "function") {
      if (engine.looksLikeReferralSource(questionText)) return true;
    }
    var classified =
      engine && typeof engine.classifyLabel === "function"
        ? engine.classifyLabel(questionText, "textarea")
        : { category: "unknown" };
    return Boolean(classified && classified.category === "referral_source");
  }

  function skipReferralSourceFields(handledElements) {
    var results = [];
    var wrappers = document.querySelectorAll(
      "#application-form .application-question.custom-question"
    );
    Array.prototype.forEach.call(wrappers, function (wrapper) {
      var questionText = questionTextFromWrapper(wrapper);
      if (!looksLikeReferralQuestion(questionText)) return;
      var fields = wrapper.querySelectorAll("textarea, input, select");
      Array.prototype.forEach.call(fields, function (el) {
        if (!el) return;
        if (isSurveysResponsesName(el.name || "")) return;
        if (normalizeText(el.name || "").indexOf("signature") !== -1) return;
        markHandled(handledElements, el);
        if (trimText(el.value)) {
          results.push(
            resultRow("referral_source", questionText, "skipped", "Field is already completed.", false, "")
          );
          return;
        }
        results.push(
          resultRow("referral_source", questionText, "skipped", "Referral source is left manual.", false, "")
        );
      });
    });
    return results;
  }

  var EEO_SELECT_CATEGORIES = {
    "eeo[gender]": "gender",
    "eeo[race]": "race_ethnicity",
    "eeo[veteran]": "veteran_status",
    "eeo[disability]": "disability_status"
  };

  function eeoCategoryForName(name) {
    return EEO_SELECT_CATEGORIES[normalizeText(name)] || "";
  }

  function isPreferNotToAnswer(value) {
    var text = normalizeText(value);
    return text === "prefer not to answer" || text === "decline to self-identify";
  }

  function isPlaceholderSelectOption(opt) {
    if (!opt) return true;
    var text = normalizeText(opt.text || opt.label || opt.value || "");
    if (!text) return true;
    if (text === "select" || text.indexOf("select ") === 0) return true;
    if (text.indexOf("select...") === 0) return true;
    return false;
  }

  function selectOptionLabel(opt) {
    return trimText((opt && (opt.text || opt.label)) || "");
  }

  function isSelectAlreadyFilled(select) {
    if (!select || !select.options || select.selectedIndex < 0) return false;
    var opt = select.options[select.selectedIndex];
    if (!opt || opt.disabled) return false;
    if (isPlaceholderSelectOption(opt)) return false;
    return Boolean(selectOptionLabel(opt) || trimText(opt.value || ""));
  }

  function optionMatchesEeo(category, saved, optionLabel) {
    var savedNorm = normalizeText(saved);
    var optNorm = normalizeText(optionLabel);
    if (!savedNorm || !optNorm) return false;
    if (savedNorm === optNorm) return true;

    if (category === "gender") {
      if ((savedNorm === "man" || savedNorm === "male") && optNorm === "male") return true;
      if ((savedNorm === "woman" || savedNorm === "female") && optNorm === "female") return true;
      if (isPreferNotToAnswer(savedNorm) && optNorm === "decline to self-identify") return true;
      return false;
    }

    if (category === "race_ethnicity") {
      if (isPreferNotToAnswer(savedNorm) && optNorm === "decline to self-identify") return true;
      if (savedNorm === "hispanic or latino" && optNorm === "hispanic or latino") return true;
      if (savedNorm === "asian" && optNorm === "asian (not hispanic or latino)") return true;
      if (savedNorm === "white" && optNorm === "white (not hispanic or latino)") return true;
      if (
        savedNorm === "black or african american" &&
        optNorm === "black or african american (not hispanic or latino)"
      ) {
        return true;
      }
      if (
        (savedNorm === "native hawaiian or pacific islander" ||
          savedNorm === "native hawaiian or other pacific islander") &&
        optNorm === "native hawaiian or other pacific islander (not hispanic or latino)"
      ) {
        return true;
      }
      if (
        savedNorm === "american indian or alaska native" &&
        optNorm === "american indian or alaska native (not hispanic or latino)"
      ) {
        return true;
      }
      if (savedNorm === "two or more races" && optNorm === "two or more races (not hispanic or latino)") {
        return true;
      }
      return false;
    }

    if (category === "veteran_status") {
      if (
        isPreferNotToAnswer(savedNorm) &&
        optNorm === "i decline to self-identify for protected veteran status"
      ) {
        return true;
      }
      if (savedNorm === "i am not a protected veteran" && optNorm === "i am not a protected veteran") {
        return true;
      }
      if (
        savedNorm === "i identify as a protected veteran" &&
        optNorm === "i identify as one or more of the classifications of protected veteran listed above"
      ) {
        return true;
      }
      return false;
    }

    if (category === "disability_status") {
      if (isPreferNotToAnswer(savedNorm) && optNorm === "i do not want to answer") return true;
      if (
        savedNorm.indexOf("yes, i have a disability") === 0 &&
        optNorm.indexOf("yes, i have a disability") === 0
      ) {
        return true;
      }
      if (
        savedNorm.indexOf("no, i do not have a disability") === 0 &&
        optNorm.indexOf("no, i do not have a disability") === 0
      ) {
        return true;
      }
      return false;
    }

    return false;
  }

  function collectSelectOptionLabels(select) {
    var labels = [];
    Array.prototype.forEach.call((select && select.options) || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      var label = selectOptionLabel(opt);
      if (label) labels.push(label);
    });
    return labels;
  }

  function isProtectedVeteranOptionSet(labels) {
    return (labels || []).some(function (label) {
      return /\bprotected\s+veteran\b/.test(normalizeText(label));
    });
  }

  function isGeneralVeteranOptionSet(labels) {
    if (isProtectedVeteranOptionSet(labels)) return false;
    var seen = {};
    (labels || []).forEach(function (label) {
      seen[normalizeText(label)] = true;
    });
    return Boolean(seen["i am a veteran"] && seen["i am not a veteran"]);
  }

  function optionMatchesGeneralVeteran(savedGeneral, savedProtected, optionLabel) {
    var optNorm = normalizeText(optionLabel);
    var general = normalizeText(savedGeneral);
    var prot = normalizeText(savedProtected);
    if (!optNorm) return false;

    if (general === "i am a veteran" && optNorm === "i am a veteran") return true;
    if (general === "i am not a veteran" && optNorm === "i am not a veteran") return true;
    if (general && isPreferNotToAnswer(general) && optNorm === "decline to self-identify") return true;

    if (!general) {
      if (prot === "i identify as a protected veteran" && optNorm === "i am a veteran") return true;
      if (prot && isPreferNotToAnswer(prot) && optNorm === "decline to self-identify") return true;
    }
    return false;
  }

  function findGeneralVeteranOption(select, savedGeneral, savedProtected) {
    var matches = [];
    Array.prototype.forEach.call((select && select.options) || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      if (optionMatchesGeneralVeteran(savedGeneral, savedProtected, selectOptionLabel(opt))) {
        matches.push(opt);
      }
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function findEeoOption(select, category, saved) {
    var matches = [];
    Array.prototype.forEach.call(select.options || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      if (optionMatchesEeo(category, saved, selectOptionLabel(opt))) matches.push(opt);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function applySelectOption(select, option) {
    if (!select || !option) return false;
    try {
      if (typeof select.scrollIntoView === "function") {
        select.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      select.value = option.value;
      option.selected = true;
    } catch (_) {
      return false;
    }
    try {
      select.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}
    try {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    var selected = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    return Boolean(selected && selected === option);
  }

  function fillEeoSelects(inventory, handledElements, demographics) {
    var results = [];
    var form = document.querySelector("#application-form") || document.querySelector("form.application-form");
    if (!form || !form.querySelectorAll) return results;
    var inv = inventory || {};
    var demo = demographics || {};

    Array.prototype.forEach.call(form.querySelectorAll("select"), function (select) {
      var name = trimText(select && select.name);
      var category = eeoCategoryForName(name);
      if (!category) return;
      if (normalizeText(name).indexOf("signature") !== -1) return;
      if (normalizeText(name).indexOf("surveysresponses") !== -1) return;

      markHandled(handledElements, select);

      if (isSelectAlreadyFilled(select)) {
        results.push(resultRow(category, name, "skipped", "Field is already completed.", false, ""));
        return;
      }

      var matched = null;
      if (category === "veteran_status") {
        var labels = collectSelectOptionLabels(select);
        var generalSaved = trimText(demo.generalVeteranStatus || inv.general_veteran_status || "");
        var protectedSaved = trimText(inv.veteran_status || demo.veteranStatus || "");
        if (isGeneralVeteranOptionSet(labels)) {
          if (!generalSaved && !protectedSaved) {
            results.push(resultRow(category, name, "skipped", "No saved answer.", false, ""));
            return;
          }
          matched = findGeneralVeteranOption(select, generalSaved, protectedSaved);
        } else {
          if (!protectedSaved) {
            results.push(resultRow(category, name, "skipped", "No saved answer.", false, ""));
            return;
          }
          matched = findEeoOption(select, category, protectedSaved);
        }
      } else {
        var saved = trimText(inv[category] || "");
        if (!saved) {
          results.push(resultRow(category, name, "skipped", "No saved answer.", false, ""));
          return;
        }
        matched = findEeoOption(select, category, saved);
      }

      if (!matched) {
        results.push(
          resultRow(category, name, "skipped", "No safe matching dropdown option.", false, "")
        );
        return;
      }

      if (!applySelectOption(select, matched)) {
        results.push(
          resultRow(category, name, "failed", "Verification failed; selected option did not persist.", false, "")
        );
        return;
      }

      results.push(resultRow(category, name, "filled", "", true, selectOptionLabel(matched)));
    });

    return results;
  }

  function classifyExportControlOption(label) {
    var text = normalizeText(label);
    if (!text) return "";
    if (/\bforeign\s+person\b/.test(text)) return "foreign";
    if (/\bu\.s\.\s+person\b/.test(text) || /\bus\s+person\b/.test(text)) return "us";
    return "";
  }

  function looksLikeExportControlSelect(questionText, optionLabels) {
    var blob = normalizeText(questionText + " " + (optionLabels || []).join(" "));
    if (!blob) return false;
    return (
      /\bexport\b/.test(blob) ||
      /\bitar\b/.test(blob) ||
      /\bear\b/.test(blob) ||
      /\bu\.s\.\s+person\b/.test(blob) ||
      /\bus\s+person\b/.test(blob) ||
      /\bforeign\s+person\b/.test(blob)
    );
  }

  function exportControlSideFromSaved(saved) {
    var text = normalizeText(saved);
    if (!text) return "";
    if (text === "prefer not to answer") return "";
    if (text === "none of the above") return "foreign";
    if (text === "a united states citizen or national") return "us";
    if (text === "a lawful permanent resident of the united states (green card holder)") return "us";
    if (text === "a person admitted as a refugee to the united states") return "us";
    if (text === "a person admitted as an asylee to the united states") return "us";
    if (classifyExportControlOption(text) === "us") return "us";
    if (classifyExportControlOption(text) === "foreign") return "foreign";
    return "";
  }

  function savedExportControlStatus(inventory, profile, workAuthorization) {
    var fromInv = trimText(
      (inventory && (inventory.export_control_status || inventory.exportControlStatus)) || ""
    );
    if (fromInv) return fromInv;
    var work = (profile && profile.workAuthorization) || workAuthorization || {};
    return trimText(work.exportControlStatus || "");
  }

  function findExportControlPair(select) {
    var usOpts = [];
    var foreignOpts = [];
    var labels = [];
    Array.prototype.forEach.call((select && select.options) || [], function (opt) {
      if (!opt || opt.disabled) return;
      if (isPlaceholderSelectOption(opt)) return;
      var label = selectOptionLabel(opt);
      labels.push(label);
      var side = classifyExportControlOption(label);
      if (side === "us") usOpts.push(opt);
      if (side === "foreign") foreignOpts.push(opt);
    });
    if (usOpts.length !== 1 || foreignOpts.length !== 1) return null;
    return { us: usOpts[0], foreign: foreignOpts[0], labels: labels };
  }

  function fillExportControlSelects(inventory, profile, workAuthorization, handledElements) {
    var results = [];
    var wrappers = document.querySelectorAll(
      "#application-form .application-question.custom-question"
    );
    var saved = savedExportControlStatus(inventory, profile, workAuthorization);

    Array.prototype.forEach.call(wrappers, function (wrapper) {
      var selects = wrapper.querySelectorAll("select");
      Array.prototype.forEach.call(selects, function (select) {
        if (!select) return;
        var name = trimText(select.name || "");
        if (eeoCategoryForName(name)) return;
        if (normalizeText(name).indexOf("signature") !== -1) return;
        if (normalizeText(name).indexOf("surveysresponses") !== -1) return;
        if (handledElements.indexOf(select) !== -1) return;

        var pair = findExportControlPair(select);
        if (!pair) return;
        var questionText = questionTextFromWrapper(wrapper);
        if (!looksLikeExportControlSelect(questionText, pair.labels)) return;

        markHandled(handledElements, select);

        if (isSelectAlreadyFilled(select)) {
          results.push(
            resultRow("export_control_status", questionText, "skipped", "Field is already completed.", false, "")
          );
          return;
        }

        var side = exportControlSideFromSaved(saved);
        if (!side) {
          results.push(
            resultRow("export_control_status", questionText, "skipped", "No saved answer.", false, "")
          );
          return;
        }

        var matched = side === "us" ? pair.us : pair.foreign;
        if (!applySelectOption(select, matched)) {
          results.push(
            resultRow(
              "export_control_status",
              questionText,
              "failed",
              "Verification failed; selected option did not persist.",
              false,
              ""
            )
          );
          return;
        }

        results.push(
          resultRow("export_control_status", questionText, "filled", "", true, selectOptionLabel(matched))
        );
      });
    });

    return results;
  }

  var AGE_RANGE_OPTIONS = {
    "17 or younger": true,
    "18-20": true,
    "21-29": true,
    "30-39": true,
    "40-49": true,
    "50-59": true,
    "60 or older": true
  };

  var ETHNICITY_SURVEY_MAP = {
    white: "white / caucasian",
    "hispanic or latino": "hispanic, latino, or spanish origin",
    "black or african american": "black or african american",
    asian: "asian",
    "native hawaiian or pacific islander": "native hawaiian or other pacific islander",
    "american indian or alaska native":
      "indigenous peoples, first nations, native american, or alaska native",
    "middle eastern or north african": "middle eastern or north african"
  };

  function isSurveysResponsesName(name) {
    return /^surveysresponses\[/i.test(trimText(name));
  }

  function isProtectedSurveyControl(el) {
    if (!el) return true;
    var name = trimText(el.name || "");
    var nameNorm = normalizeText(name);
    if (!nameNorm) return false;
    if (eeoCategoryForName(name)) return true;
    if (nameNorm.indexOf("signature") !== -1) return true;
    if (nameNorm.indexOf("candidateselectedlocation") !== -1) return true;
    if (nameNorm.indexOf("disabilitysignature") !== -1) return true;
    return false;
  }

  function wrapperHasSurveysResponses(wrapper) {
    if (!wrapper || !wrapper.querySelectorAll) return false;
    var nodes = wrapper.querySelectorAll("input, select, textarea");
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (isSurveysResponsesName(nodes[i].name || "")) return true;
    }
    return false;
  }

  function normalizeQuestion(value) {
    return normalizeText(value)
      .replace(/[*]/g, " ")
      .replace(/\boptional\b/g, " ")
      .replace(/\brequired\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function choiceOptionLabel(el) {
    if (!el) return "";
    var labelText = "";
    if (el.id) {
      try {
        var byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (byFor) labelText = trimText(byFor.innerText || byFor.textContent || "");
      } catch (_) {}
    }
    if (!labelText) {
      var parentLabel = el.closest && el.closest("label");
      if (parentLabel) {
        labelText = trimText(parentLabel.innerText || parentLabel.textContent || "");
      }
    }
    if (!labelText) {
      labelText = trimText(el.getAttribute && el.getAttribute("aria-label"));
    }
    return labelText;
  }

  function collectChoiceLabels(elements) {
    return (elements || [])
      .map(function (el) {
        return choiceOptionLabel(el);
      })
      .filter(Boolean);
  }

  function collectNamedCheckboxGroups(wrapper) {
    var groups = [];
    var seen = {};
    var boxes = wrapper.querySelectorAll('input[type="checkbox"]');
    Array.prototype.forEach.call(boxes, function (box) {
      var name = trimText(box && box.name);
      if (!name || seen[name]) return;
      seen[name] = true;
      var members = [];
      Array.prototype.forEach.call(boxes, function (candidate) {
        if (trimText(candidate.name) === name) members.push(candidate);
      });
      groups.push({ name: name, boxes: members });
    });
    return groups;
  }

  function looksLikeAgeRangeQuestion(questionText, optionLabels) {
    var question = normalizeQuestion(questionText);
    if (question.indexOf("what is your age range") === -1) return false;
    var hits = 0;
    (optionLabels || []).forEach(function (label) {
      if (AGE_RANGE_OPTIONS[normalizeText(label)]) hits += 1;
    });
    return hits >= 3;
  }

  function looksLikeEthnicityQuestion(questionText, optionLabels) {
    var question = normalizeQuestion(questionText);
    if (question.indexOf("i identify my ethnicity as") === -1) return false;
    var hits = 0;
    (optionLabels || []).forEach(function (label) {
      var text = normalizeText(label);
      if (
        text === "white / caucasian" ||
        text === "hispanic, latino, or spanish origin" ||
        text === "black or african american" ||
        text === "asian" ||
        text === "native hawaiian or other pacific islander" ||
        text === "indigenous peoples, first nations, native american, or alaska native" ||
        text === "middle eastern or north african"
      ) {
        hits += 1;
      }
    });
    return hits >= 3;
  }

  function looksLikeGenderQuestion(questionText, optionLabels) {
    var question = normalizeQuestion(questionText);
    if (question.indexOf("what gender do you identify as") === -1) return false;
    var seen = {};
    (optionLabels || []).forEach(function (label) {
      seen[normalizeText(label)] = true;
    });
    return Boolean(seen.female && seen.male);
  }

  function savedAgeRange(demographics, profile) {
    var demo = demographics || (profile && profile.demographics) || {};
    return trimText(demo.ageRange || "");
  }

  function savedRaceEthnicity(demographics, profile) {
    var demo = demographics || (profile && profile.demographics) || {};
    return trimText(demo.raceEthnicity || "");
  }

  function savedGender(demographics, profile) {
    var demo = demographics || (profile && profile.demographics) || {};
    return trimText(demo.gender || "");
  }

  function mapSurveyAgeRange(saved) {
    var text = trimText(saved);
    if (!text || isPreferNotToAnswer(text)) return "";
    return AGE_RANGE_OPTIONS[normalizeText(text)] ? text : "";
  }

  function mapSurveyEthnicity(saved) {
    var text = normalizeText(saved);
    if (!text || isPreferNotToAnswer(text)) return "";
    if (text === "two or more races" || text === "self-describe") return "";
    return ETHNICITY_SURVEY_MAP[text] || "";
  }

  function mapSurveyGender(saved) {
    var text = normalizeText(saved);
    if (!text || isPreferNotToAnswer(text)) return "";
    if (text === "self-describe") return "";
    if (text === "man" || text === "male") return "male";
    if (text === "woman" || text === "female") return "female";
    if (text === "non-binary" || text === "nonbinary" || text === "non binary") return "non-binary";
    return "";
  }

  function findExactChoice(elements, wantedNorm) {
    if (!wantedNorm) return null;
    var matches = [];
    (elements || []).forEach(function (el) {
      if (normalizeText(choiceOptionLabel(el)) === wantedNorm) matches.push(el);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function selectSurveyRadio(radio) {
    return selectExactYesNoRadio(radio);
  }

  function checkSurveyCheckbox(box) {
    if (!box) return false;
    if (box.checked) return true;
    try {
      if (typeof box.scrollIntoView === "function") {
        box.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      var label = box.closest && box.closest("label");
      if (label && typeof label.click === "function") label.click();
      else if (typeof box.click === "function") box.click();
    } catch (_) {}
    try {
      box.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}
    try {
      box.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    if (!box.checked) {
      try {
        box.checked = true;
      } catch (_) {}
      try {
        box.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (_) {}
      try {
        box.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }
    return Boolean(box.checked);
  }

  function fillDemographicSurvey(profile, demographics, handledElements, fillDemographics) {
    var results = [];
    if (fillDemographics === false) return results;

    var wrappers = document.querySelectorAll("#application-form .application-question");
    Array.prototype.forEach.call(wrappers, function (wrapper) {
      if (!wrapperHasSurveysResponses(wrapper)) return;
      var questionText = questionTextFromWrapper(wrapper);

      var radioGroups = collectNamedRadioGroups(wrapper);
      radioGroups.forEach(function (group) {
        if (!isSurveysResponsesName(group.name)) return;
        if (group.radios.some(isProtectedSurveyControl)) return;
        var labels = collectChoiceLabels(group.radios);
        if (looksLikeAgeRangeQuestion(questionText, labels)) {
          fillSurveyAgeRange(group, questionText, demographics, profile, handledElements, results);
          return;
        }
        if (looksLikeGenderQuestion(questionText, labels)) {
          fillSurveyGender(group, questionText, demographics, profile, handledElements, results);
        }
      });

      var checkboxGroups = collectNamedCheckboxGroups(wrapper);
      checkboxGroups.forEach(function (group) {
        if (!isSurveysResponsesName(group.name)) return;
        if (group.boxes.some(isProtectedSurveyControl)) return;
        var labels = collectChoiceLabels(group.boxes);
        if (!looksLikeEthnicityQuestion(questionText, labels)) return;
        fillSurveyEthnicity(group, questionText, demographics, profile, handledElements, results);
      });
    });

    return results;
  }

  function fillSurveyAgeRange(group, questionText, demographics, profile, handledElements, results) {
    markGroupHandled(handledElements, group.radios);
    if (groupAlreadySelected(group.radios)) {
      results.push(resultRow("age_range", questionText, "skipped", "Field is already completed.", false, ""));
      return;
    }
    var saved = savedAgeRange(demographics, profile);
    if (!saved) {
      results.push(resultRow("age_range", questionText, "skipped", "No saved age range.", false, ""));
      return;
    }
    if (isPreferNotToAnswer(saved)) {
      results.push(
        resultRow("age_range", questionText, "skipped", "Prefer not to answer left manual.", false, "")
      );
      return;
    }
    var mapped = mapSurveyAgeRange(saved);
    if (!mapped) {
      results.push(
        resultRow("age_range", questionText, "skipped", "Unsupported age range left manual.", false, "")
      );
      return;
    }
    var matched = findExactChoice(group.radios, normalizeText(mapped));
    if (!matched) {
      results.push(
        resultRow("age_range", questionText, "skipped", "No exact matching age-range option.", false, "")
      );
      return;
    }
    if (!selectSurveyRadio(matched) || !matched.checked) {
      results.push(
        resultRow(
          "age_range",
          questionText,
          "failed",
          "Verification failed; selected radio did not remain checked.",
          false,
          ""
        )
      );
      return;
    }
    results.push(resultRow("age_range", questionText, "filled", "", true, choiceOptionLabel(matched)));
  }

  function fillSurveyGender(group, questionText, demographics, profile, handledElements, results) {
    markGroupHandled(handledElements, group.radios);
    if (groupAlreadySelected(group.radios)) {
      results.push(resultRow("gender", questionText, "skipped", "Field is already completed.", false, ""));
      return;
    }
    var saved = savedGender(demographics, profile);
    if (!saved) {
      results.push(resultRow("gender", questionText, "skipped", "No saved gender.", false, ""));
      return;
    }
    if (isPreferNotToAnswer(saved) || normalizeText(saved) === "self-describe") {
      results.push(
        resultRow("gender", questionText, "skipped", "No safe matching gender option.", false, "")
      );
      return;
    }
    var mapped = mapSurveyGender(saved);
    if (!mapped) {
      results.push(
        resultRow("gender", questionText, "skipped", "No safe matching gender option.", false, "")
      );
      return;
    }
    var matched = findExactChoice(group.radios, mapped);
    if (!matched) {
      results.push(
        resultRow("gender", questionText, "skipped", "No safe matching gender option.", false, "")
      );
      return;
    }
    if (!selectSurveyRadio(matched) || !matched.checked) {
      results.push(
        resultRow(
          "gender",
          questionText,
          "failed",
          "Verification failed; selected radio did not remain checked.",
          false,
          ""
        )
      );
      return;
    }
    results.push(resultRow("gender", questionText, "filled", "", true, choiceOptionLabel(matched)));
  }

  function fillSurveyEthnicity(group, questionText, demographics, profile, handledElements, results) {
    group.boxes.forEach(function (box) {
      markHandled(handledElements, box);
    });
    var saved = savedRaceEthnicity(demographics, profile);
    if (!saved) {
      results.push(
        resultRow("race_ethnicity", questionText, "skipped", "No saved ethnicity.", false, "")
      );
      return;
    }
    var mapped = mapSurveyEthnicity(saved);
    if (!mapped) {
      results.push(
        resultRow("race_ethnicity", questionText, "skipped", "No safe ethnicity mapping.", false, "")
      );
      return;
    }
    var matched = findExactChoice(group.boxes, mapped);
    if (!matched) {
      results.push(
        resultRow("race_ethnicity", questionText, "skipped", "No safe matching ethnicity option.", false, "")
      );
      return;
    }
    if (matched.checked) {
      results.push(
        resultRow("race_ethnicity", questionText, "skipped", "Field is already completed.", false, "")
      );
      return;
    }
    if (!checkSurveyCheckbox(matched) || !matched.checked) {
      results.push(
        resultRow(
          "race_ethnicity",
          questionText,
          "failed",
          "Verification failed; selected checkbox did not remain checked.",
          false,
          ""
        )
      );
      return;
    }
    results.push(
      resultRow("race_ethnicity", questionText, "filled", "", true, choiceOptionLabel(matched))
    );
  }

  function applicationForm() {
    return document.querySelector("#application-form") || document.querySelector("form.application-form");
  }

  function exactNamedInput(form, name) {
    if (!form || !form.querySelector) return null;
    try {
      return form.querySelector('input[name="' + name + '"]');
    } catch (_) {
      return null;
    }
  }

  function savedFullName(inventory, profile) {
    var fromInv = trimText(inventory && inventory.full_name);
    if (fromInv) return fromInv;
    var personal = (profile && profile.personal) || {};
    var first = trimText(personal.firstName);
    var last = trimText(personal.lastName);
    if (first && last) return trimText(first + " " + last);
    return "";
  }

  function todaysDateMmDdYyyy() {
    var now = new Date();
    var month = String(now.getMonth() + 1);
    var day = String(now.getDate());
    var year = String(now.getFullYear());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return month + "/" + day + "/" + year;
  }

  function applyInputValue(el, value) {
    if (!el) return false;
    try {
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      el.value = value;
    } catch (_) {
      return false;
    }
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    return trimText(el.value) === trimText(value);
  }

  function fillDisabilitySignatureFields(inventory, profile, handledElements) {
    var results = [];
    var form = applicationForm();
    if (!form) return results;

    var nameInput = exactNamedInput(form, "eeo[disabilitySignature]");
    if (nameInput) {
      markHandled(handledElements, nameInput);
      if (trimText(nameInput.value)) {
        results.push(
          resultRow(
            "disability_signature",
            "eeo[disabilitySignature]",
            "skipped",
            "Field is already completed.",
            false,
            ""
          )
        );
      } else {
        var fullName = savedFullName(inventory, profile);
        if (!fullName) {
          results.push(
            resultRow(
              "disability_signature",
              "eeo[disabilitySignature]",
              "skipped",
              "No saved full name.",
              false,
              ""
            )
          );
        } else if (!applyInputValue(nameInput, fullName)) {
          results.push(
            resultRow(
              "disability_signature",
              "eeo[disabilitySignature]",
              "failed",
              "Verification failed; name did not persist.",
              false,
              ""
            )
          );
        } else {
          results.push(
            resultRow(
              "disability_signature",
              "eeo[disabilitySignature]",
              "filled",
              "",
              true,
              fullName
            )
          );
        }
      }
    }

    var dateInput = exactNamedInput(form, "eeo[disabilitySignatureDate]");
    if (dateInput) {
      markHandled(handledElements, dateInput);
      if (trimText(dateInput.value)) {
        results.push(
          resultRow(
            "disability_signature_date",
            "eeo[disabilitySignatureDate]",
            "skipped",
            "Field is already completed.",
            false,
            ""
          )
        );
      } else {
        var today = todaysDateMmDdYyyy();
        if (!applyInputValue(dateInput, today)) {
          results.push(
            resultRow(
              "disability_signature_date",
              "eeo[disabilitySignatureDate]",
              "failed",
              "Verification failed; date did not persist.",
              false,
              ""
            )
          );
        } else {
          results.push(
            resultRow(
              "disability_signature_date",
              "eeo[disabilitySignatureDate]",
              "filled",
              "",
              true,
              today
            )
          );
        }
      }
    }

    return results;
  }

  function isCustomQuestionTextControl(el) {
    if (!el || el.disabled) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag !== "input") return false;
    var type = normalizeText(el.type || "text");
    return !type || type === "text" || type === "search";
  }

  function fillProjectHighlightFields(inventory, handledElements) {
    var results = [];
    var engine = af();
    var answer = trimText(inventory && inventory.project_highlight);
    var wrappers = document.querySelectorAll(
      "#application-form .application-question.custom-question"
    );

    Array.prototype.forEach.call(wrappers, function (wrapper) {
      var questionText = questionTextFromWrapper(wrapper);
      if (!questionText) return;

      var classified =
        engine && typeof engine.classifyLabel === "function"
          ? engine.classifyLabel(questionText, "textarea")
          : { category: "unknown" };
      if (!classified || classified.category !== "project_highlight") return;

      var fields = wrapper.querySelectorAll("textarea, input");
      Array.prototype.forEach.call(fields, function (el) {
        if (!isCustomQuestionTextControl(el)) return;
        if (isSurveysResponsesName(el.name || "")) return;
        if (normalizeText(el.name || "").indexOf("signature") !== -1) return;

        markHandled(handledElements, el);

        if (trimText(el.value)) {
          results.push(
            resultRow("project_highlight", questionText, "skipped", "Field is already completed.", false, "")
          );
          return;
        }
        if (!answer) {
          results.push(
            resultRow("project_highlight", questionText, "skipped", "No saved project highlight.", false, "")
          );
          return;
        }

        var ok = false;
        if (engine && typeof engine.fillTextElement === "function") {
          var fillResult = engine.fillTextElement(el, answer);
          if (fillResult && fillResult.status === "skipped") {
            results.push(
              resultRow(
                "project_highlight",
                questionText,
                "skipped",
                fillResult.reason || "Field is already completed.",
                false,
                ""
              )
            );
            return;
          }
          ok = Boolean(fillResult && fillResult.ok);
        } else {
          ok = applyInputValue(el, answer);
        }

        if (!ok) {
          results.push(
            resultRow(
              "project_highlight",
              questionText,
              "failed",
              "Verification failed; project text did not persist.",
              false,
              ""
            )
          );
          return;
        }
        results.push(resultRow("project_highlight", questionText, "filled", "", true, answer));
      });
    });

    return results;
  }

  function fillSupportedFields(context) {
    var ctx = context || {};
    var handledElements = ctx.handledElements || [];
    var results = [];

    if (isSupportedPage()) {
      results = results.concat(fillYesNoRadioGroups(ctx.inventory || {}, handledElements));
      results = results.concat(fillWorkAuthorizationSelects(ctx.inventory || {}, handledElements));
      results = results.concat(skipReferralSourceFields(handledElements));
      results = results.concat(fillProjectHighlightFields(ctx.inventory || {}, handledElements));
      results = results.concat(
        fillEeoSelects(ctx.inventory || {}, handledElements, ctx.demographics || null)
      );
      results = results.concat(
        fillExportControlSelects(
          ctx.inventory || {},
          ctx.profile || null,
          ctx.workAuthorization || null,
          handledElements
        )
      );
      results = results.concat(
        fillDemographicSurvey(
          ctx.profile || null,
          ctx.demographics || null,
          handledElements,
          ctx.fillDemographics
        )
      );
      results = results.concat(
        fillDisabilitySignatureFields(ctx.inventory || {}, ctx.profile || null, handledElements)
      );
    }

    return Promise.resolve(summarize(results, handledElements));
  }

  global.ImpulsoLeverAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
