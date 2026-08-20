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

  function fillEeoSelects(inventory, handledElements) {
    var results = [];
    var form = document.querySelector("#application-form") || document.querySelector("form.application-form");
    if (!form || !form.querySelectorAll) return results;
    var inv = inventory || {};

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

      var saved = trimText(inv[category] || "");
      if (!saved) {
        results.push(resultRow(category, name, "skipped", "No saved answer.", false, ""));
        return;
      }

      var matched = findEeoOption(select, category, saved);
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

  function fillSupportedFields(context) {
    var ctx = context || {};
    var handledElements = ctx.handledElements || [];
    var results = [];

    if (isSupportedPage()) {
      results = fillYesNoRadioGroups(ctx.inventory || {}, handledElements);
      results = results.concat(fillEeoSelects(ctx.inventory || {}, handledElements));
    }

    return Promise.resolve(summarize(results, handledElements));
  }

  global.ImpulsoLeverAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
