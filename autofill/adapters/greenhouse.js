(function (global) {
  "use strict";

  var ASHBY_HOST_RE = /(?:^|\.)ashbyhq\.com$/i;
  var GREENHOUSE_HOST_RE = /(?:^|\.)greenhouse\.io$/i;

  function trimText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return trimText(value).toLowerCase();
  }

  function emptyReport() {
    return {
      results: [],
      handledElements: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
  }

  function summarize(results, handledElements) {
    return {
      results: results || [],
      handledElements: handledElements || [],
      summary: {
        attempted: (results || []).length,
        filled: (results || []).filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: (results || []).filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: (results || []).filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function phoneDigitsOnly(value) {
    var engine = af();
    if (engine && typeof engine.phoneDigitsOnly === "function") {
      return engine.phoneDigitsOnly(value);
    }
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function phoneValuesMatch(expected, actual) {
    var engine = af();
    if (engine && typeof engine.phoneValuesMatch === "function") {
      return engine.phoneValuesMatch(expected, actual);
    }
    var want = phoneDigitsOnly(expected);
    var got = phoneDigitsOnly(actual);
    if (!want || !got) return false;
    return want === got || want.endsWith(got) || got.endsWith(want);
  }

  function looksLikeEducationDateField(blob) {
    var engine = af();
    if (engine && typeof engine.looksLikeEducationDateField === "function") {
      return engine.looksLikeEducationDateField(blob);
    }
    var text = normalizeText(blob);
    if (!text) return false;
    return (
      /\bstart\s+date\s+year\b/.test(text) ||
      /\bend\s+date\s+year\b/.test(text) ||
      /\bstart\s+date\s+month\b/.test(text) ||
      /\bend\s+date\s+month\b/.test(text) ||
      /\beducation\s+(start|end)\s+year\b/.test(text) ||
      /\beducation\s+(start|end)\s+month\b/.test(text)
    );
  }

  function mergeReports(primary, secondary) {
    if (global.ImpulsoAutofill && typeof global.ImpulsoAutofill.mergeAutofillReports === "function") {
      return global.ImpulsoAutofill.mergeAutofillReports(primary, secondary);
    }
    var results = ((primary && primary.results) || []).concat((secondary && secondary.results) || []);
    return summarize(results);
  }

  function af() {
    return global.ImpulsoAutofill || null;
  }

  function detectCategoryFromMeta(meta) {
    var engine = af();
    if (engine && typeof engine.detectCategoryFromMeta === "function") {
      return engine.detectCategoryFromMeta(meta);
    }
    return { category: "unknown", confidence: 0 };
  }

  function findLabelText(el) {
    var engine = af();
    if (engine && typeof engine.findLabelText === "function") {
      return trimText(engine.findLabelText(el));
    }
    if (!el) return "";
    if (el.id) {
      try {
        var byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (byFor) return trimText(byFor.innerText || byFor.textContent || "");
      } catch (_) {}
    }
    var parentLabel = el.closest && el.closest("label");
    if (parentLabel) return trimText(parentLabel.innerText || parentLabel.textContent || "");
    return trimText((el.getAttribute && el.getAttribute("aria-label")) || "");
  }

  function isFilledValue(value) {
    return Boolean(trimText(value));
  }

  function readValue(el) {
    var engine = af();
    if (engine && typeof engine.readElementTextValue === "function") {
      return trimText(engine.readElementTextValue(el));
    }
    if (!el) return "";
    if (el.type === "checkbox" || el.type === "radio") return el.checked ? "true" : "";
    if (el.tagName && el.tagName.toLowerCase() === "select") {
      var opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      return trimText((opt && (opt.text || opt.label || opt.value)) || el.value || "");
    }
    return trimText(el.value || "");
  }

  function valuesMatch(expected, actual) {
    var engine = af();
    if (engine && typeof engine.textValuesMatch === "function") {
      return engine.textValuesMatch(expected, actual);
    }
    return normalizeText(expected) === normalizeText(actual);
  }

  function setNativeValue(el, value) {
    var engine = af();
    if (engine && typeof engine.setNativeValue === "function") {
      return engine.setNativeValue(el, value);
    }
    if (!el) return false;
    el.value = value == null ? "" : String(value);
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    return true;
  }

  function isGreenhouseHost() {
    try {
      var host = String((global.location && global.location.hostname) || "");
      if (GREENHOUSE_HOST_RE.test(host)) return true;
      if (/^job-boards\.greenhouse\.io$/i.test(host)) return true;
      if (/^boards\.greenhouse\.io$/i.test(host)) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function hasEmbeddedGreenhouseForm(doc) {
    var root = doc || document;
    try {
      if (root.querySelector("#grnhse_app, #greenhouse-job-application, #application_form, form#application")) {
        return true;
      }
      if (root.querySelector('form[action*="greenhouse"], form[data-greenhouse], [data-greenhouse], .application--form')) {
        return true;
      }
      if (root.querySelector('iframe[src*="greenhouse.io"], iframe[src*="grnhse"]')) {
        return true;
      }
      if (root.querySelector('input[name="job_application[first_name]"], input#first_name[name*="first_name"]')) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isSupportedPage() {
    try {
      var host = String((global.location && global.location.hostname) || "");
      if (ASHBY_HOST_RE.test(host)) return false;
    } catch (_) {}
    if (isGreenhouseHost()) return true;
    return hasEmbeddedGreenhouseForm(document);
  }

  function normalizeOptionText(value) {
    var text = "";
    if (value && value.nodeType === 1) {
      text = trimText(value.innerText || value.textContent || value.value || "");
    } else {
      text = trimText(value);
    }
    text = text.split(/\s+[-–—]\s+/)[0] || text;
    text = text.replace(/\s*\([^)]*\)/g, "");
    text = text.toLowerCase();
    text = text.replace(/[^\w\s]/g, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function polarityOfYesNo(value) {
    var text = normalizeText(value);
    if (!text) return "";
    if (/^(yes|y|true|1)$/.test(text)) return "yes";
    if (/^(no|n|false|0)$/.test(text)) return "no";
    if (/\bauthorized\b/.test(text) && !/\bnot\s+authorized\b/.test(text) && !/\bunauthorized\b/.test(text)) {
      return "yes";
    }
    if (/\bnot\s+authorized\b/.test(text) || /\bunauthorized\b/.test(text)) return "no";
    if (/\bdo\s+not\b/.test(text) || /\bwill\s+not\b/.test(text) || /\bwon'?t\b/.test(text)) {
      return "no";
    }
    return "";
  }

  function mapGender(saved) {
    var text = normalizeText(saved);
    if (!text) return "";
    if (text === "man" || text === "male") return "male";
    if (text === "woman" || text === "female") return "female";
    if (
      text === "prefer not to answer" ||
      text === "prefer not to say" ||
      text === "decline to self-identify" ||
      text === "decline to self identify"
    ) {
      return "decline";
    }
    if (text === "non-binary" || text === "nonbinary" || text === "non binary") return "nonbinary";
    return normalizeOptionText(saved);
  }

  function mapDemographicAlias(category, saved) {
    var canon = normalizeOptionText(saved);
    if (!canon) return "";
    if (category === "gender") return mapGender(saved);
    if (
      canon === "prefer not to answer" ||
      canon === "decline to self identify" ||
      canon === "i do not want to answer"
    ) {
      return "decline";
    }
    if (category === "race_ethnicity") {
      if (canon === "two or more race" || canon === "two or more races") return "two or more races";
      if (canon.indexOf("native hawaiian") !== -1) return "native hawaiian or other pacific islander";
      if (canon === "white not hispanic or latino" || canon === "white") return "white";
      return canon;
    }
    if (category === "veteran_status") {
      if (canon.indexOf("not a veteran") !== -1 || canon === "i am not a protected veteran") {
        return "not a veteran";
      }
      if (canon.indexOf("protected veteran") !== -1) return "protected veteran";
      return canon === "decline" ? "decline" : canon;
    }
    if (category === "disability_status") {
      if (canon.indexOf("yes") === 0 && canon.indexOf("disability") !== -1) return "yes";
      if (canon.indexOf("no") === 0 && canon.indexOf("disability") !== -1) return "no";
      return canon === "decline" ? "decline" : canon;
    }
    return canon;
  }

  function optionMatches(category, savedValue, optionLabel) {
    var savedCanon = mapDemographicAlias(category, savedValue);
    var optCanon = mapDemographicAlias(category, optionLabel);
    if (!savedCanon || !optCanon) return false;
    if (savedCanon === optCanon) return true;

    if (category === "work_authorization" || category === "sponsorship_now" || category === "sponsorship_later" || category === "relocation") {
      var want = polarityOfYesNo(savedValue);
      var got = polarityOfYesNo(optionLabel);
      return Boolean(want && got && want === got);
    }

    if (savedCanon === "decline") {
      return (
        optCanon === "decline" ||
        optCanon.indexOf("decline") !== -1 ||
        optCanon.indexOf("prefer not") !== -1 ||
        optCanon === "i do not want to answer"
      );
    }

    if (category === "gender" && savedCanon === "male") {
      return optCanon === "male" || optCanon === "man";
    }
    if (category === "gender" && savedCanon === "female") {
      return optCanon === "female" || optCanon === "woman";
    }
    return false;
  }

  function getInventoryAnswer(category, inventory, options) {
    var inv = inventory || {};
    var opts = options || {};
    var engine = af();
    if (engine && typeof engine.getProposedAnswer === "function") {
      var proposed = engine.getProposedAnswer(category, inv);
      if (proposed && proposed !== (engine.NO_SAVED_ANSWER || "No saved answer")) {
        return trimText(proposed);
      }
    }
    if (category === "address") return trimText(inv.address || "");
    if (category === "cover_letter") return trimText(inv.cover_letter || "");
    if (category === "referral_source") return trimText(inv.referral_source || "");
    if (category === "project_highlight") return trimText(inv.project_highlight || "");
    if (category === "additional_information") return trimText(inv.additional_information || "");
    if (category === "gender") return trimText(inv.gender || (opts.demographics && opts.demographics.gender) || "");
    if (category === "race_ethnicity") {
      return trimText(inv.race_ethnicity || (opts.demographics && opts.demographics.raceEthnicity) || "");
    }
    if (category === "veteran_status") {
      return trimText(inv.veteran_status || (opts.demographics && opts.demographics.veteranStatus) || "");
    }
    if (category === "disability_status") {
      return trimText(inv.disability_status || (opts.demographics && opts.demographics.disabilityStatus) || "");
    }
    if (category === "work_authorization") return trimText(inv.work_authorization || "");
    if (category === "sponsorship_now") return trimText(inv.sponsorship_now || "");
    if (category === "sponsorship_later") return trimText(inv.sponsorship_later || "");
    if (category === "phone_country") {
      return trimText(inv.phone_country || inv.phoneCountry || "");
    }
    if (category === "phone_country_code") {
      return trimText(inv.phone_country_code || inv.phoneCountryCode || "");
    }
    return trimText(inv[category] || "");
  }

  function isSensitive(category) {
    return (
      category === "gender" ||
      category === "hispanic_latino" ||
      category === "transgender" ||
      category === "race_ethnicity" ||
      category === "veteran_status" ||
      category === "disability_status"
    );
  }

  function collectOptionLabels(el) {
    var labels = [];
    if (!el) return labels;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "select") {
      Array.prototype.forEach.call(el.options || [], function (opt) {
        var t = trimText(opt.text || opt.label || opt.value || "");
        if (t) labels.push(t);
      });
      return labels;
    }
    if (el.type === "radio" || el.type === "checkbox") {
      var name = trimText(el.name || "");
      var root = el.form || el.closest("fieldset") || el.closest(".field") || document;
      var selector =
        el.type === "radio"
          ? 'input[type="radio"]'
          : 'input[type="checkbox"]';
      Array.prototype.forEach.call(root.querySelectorAll(selector), function (input) {
        if (name && trimText(input.name || "") !== name) return;
        labels.push(getOptionLabelForInput(input));
      });
    }
    return labels.filter(Boolean);
  }

  function getOptionLabelForInput(input) {
    if (!input) return "";
    var label = input.closest("label");
    if (label) {
      var clone = label.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("input"), function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      var text = trimText(clone.innerText || clone.textContent || "");
      if (text) return text;
    }
    return trimText(input.value || findLabelText(input) || "");
  }

  function fieldMeta(el) {
    var label = findLabelText(el);
    var optionLabels = collectOptionLabels(el);
    return {
      tagName: (el.tagName || "").toLowerCase(),
      inputType: normalizeText(el.type || ""),
      type: normalizeText(el.type || ""),
      label: label,
      ariaLabel: trimText(el.getAttribute && el.getAttribute("aria-label")),
      name: trimText(el.name || ""),
      id: trimText(el.id || ""),
      nearby: "",
      autocomplete: trimText(el.getAttribute && el.getAttribute("autocomplete")),
      placeholder: trimText(el.placeholder || ""),
      optionLabels: optionLabels
    };
  }

  function classifyField(el) {
    var meta = fieldMeta(el);
    var detected = detectCategoryFromMeta(meta);
    var cue = normalizeText([meta.label, meta.ariaLabel, meta.name, meta.id].join(" "));
    if (
      (detected.category === "country" || isPhoneCountryCue(cue)) &&
      !isAddressOrCitizenshipCountryCue(cue)
    ) {
      var phoneInput = findPhoneInput(el.form || document);
      var container = fieldContainer(el);
      if (
        phoneInput &&
        container &&
        (container.contains(phoneInput) || fieldContainer(phoneInput) === container)
      ) {
        return { category: "phone_country", confidence: 0.95 };
      }
      if (isPhoneCountryCue(cue)) {
        return { category: "phone_country", confidence: 0.9 };
      }
    }
    return detected;
  }

  function isPhoneLikeField(el, category, label) {
    if (category === "phone") return true;
    var type = normalizeText(el && el.type);
    if (type === "tel") return true;
    var cue = normalizeText([label, el && el.name, el && el.id, el && el.getAttribute && el.getAttribute("aria-label")].join(" "));
    return /\bphone\b/.test(cue) || /\bmobile\b/.test(cue);
  }

  function verifyField(el, expected, category) {
    if (!el) return false;
    var type = normalizeText(el.type || "");
    if (type === "radio" || type === "checkbox") {
      return Boolean(el.checked);
    }
    if ((el.tagName || "").toLowerCase() === "select") {
      var selected = readValue(el);
      return valuesMatch(expected, selected) || normalizeOptionText(selected) === normalizeOptionText(expected);
    }
    if (type === "file") {
      return Boolean(el.files && el.files.length > 0);
    }
    var actual = readValue(el);
    if (isPhoneLikeField(el, category, findLabelText(el))) {
      return phoneValuesMatch(expected, actual);
    }
    return valuesMatch(expected, actual);
  }

  function nationalPhoneForGreenhouse(phone, countryCode) {
    var raw = trimText(phone);
    if (!raw) return "";
    var codeDigits = phoneDigitsOnly(countryCode);
    var digits = phoneDigitsOnly(raw);
    if (codeDigits && digits.indexOf(codeDigits) === 0 && digits.length > codeDigits.length + 6) {
      var rest = digits.slice(codeDigits.length);
      return rest || raw;
    }
    return raw;
  }

  function fillTextLike(el, answer, category) {
    var engine = af();
    var value = answer;
    if (isPhoneLikeField(el, category, findLabelText(el))) {
      // Prefer national number when a separate country dropdown is present.
      value = nationalPhoneForGreenhouse(answer, "");
    }
    if (engine && typeof engine.fillTextElement === "function") {
      var engineResult = engine.fillTextElement(el, value);
      if (engineResult && isPhoneLikeField(el, category, findLabelText(el))) {
        if (engineResult.status === "failed" && phoneValuesMatch(value, readValue(el))) {
          return { ok: true, status: "filled", reason: "" };
        }
      }
      return engineResult;
    }
    if (isFilledValue(readValue(el))) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }
    if (!trimText(value)) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    if (!setNativeValue(el, value)) {
      return { ok: false, status: "failed", reason: "Could not set field value." };
    }
    if (!verifyField(el, value, category)) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "" };
  }

  function fieldContainer(el) {
    if (!el || !el.closest) return null;
    return (
      el.closest(".field") ||
      el.closest(".application-field") ||
      el.closest("[class*='field']") ||
      el.closest("fieldset") ||
      el.closest("label") ||
      el.parentElement
    );
  }

  function visibleText(el) {
    if (!el) return "";
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return "";
    } catch (_) {}
    return trimText(el.innerText || el.textContent || "");
  }

  function comboboxRoot(node) {
    if (!node) return null;
    return (
      (node.closest &&
        (node.closest("[class*='select__container']") ||
          node.closest("[class*='select-container']") ||
          node.closest("[class*='Select']") ||
          node.closest("[data-testid*='select']") ||
          node.closest(".select"))) ||
      node
    );
  }

  function findComboboxControl(fromNode) {
    if (!fromNode) return null;
    if (fromNode.getAttribute && fromNode.getAttribute("role") === "combobox") return fromNode;
    if (fromNode.matches && fromNode.matches("[class*='select__control'], [class*='Select-control']")) {
      return fromNode;
    }
    var root = comboboxRoot(fromNode) || fromNode;
    return (
      root.querySelector("[role='combobox']") ||
      root.querySelector("button[aria-haspopup='listbox']") ||
      root.querySelector("[class*='select__control']") ||
      root.querySelector("[class*='Select-control']") ||
      (fromNode.getAttribute && fromNode.getAttribute("aria-haspopup") === "listbox" ? fromNode : null)
    );
  }

  function readComboboxSelectedText(control) {
    if (!control) return "";
    var root = comboboxRoot(control) || control;
    var valueNode =
      root.querySelector("[class*='single-value']") ||
      root.querySelector("[class*='singleValue']") ||
      root.querySelector("[class*='Select-value-label']") ||
      root.querySelector("[class*='select__value']") ||
      null;
    var text = visibleText(valueNode);
    if (text) return text;
    text = trimText(control.getAttribute && control.getAttribute("aria-valuetext"));
    if (text) return text;
    var labelled = trimText(control.textContent || "");
    if (labelled && !/^select(\s|$)/i.test(labelled) && labelled.toLowerCase().indexOf("select...") === -1) {
      return labelled;
    }
    return "";
  }

  function isComboboxAlreadyFilled(control) {
    var selected = readComboboxSelectedText(control);
    if (!selected) return false;
    var norm = normalizeText(selected);
    if (!norm) return false;
    if (norm === "select..." || norm === "select" || norm.indexOf("select an option") !== -1) return false;
    if (norm.indexOf("choose") === 0) return false;
    return true;
  }

  function labelForCombobox(control) {
    if (!control) return "";
    var labelledBy = trimText(control.getAttribute && control.getAttribute("aria-labelledby"));
    if (labelledBy) {
      var parts = labelledBy.split(/\s+/);
      var texts = [];
      parts.forEach(function (id) {
        var node = document.getElementById(id);
        if (node) texts.push(visibleText(node));
      });
      var joined = trimText(texts.join(" "));
      if (joined) return joined;
    }
    var aria = trimText(control.getAttribute && control.getAttribute("aria-label"));
    if (aria) return aria;
    var container = fieldContainer(control);
    if (container) {
      var labelEl = container.querySelector("label");
      if (labelEl) {
        var clone = labelEl.cloneNode(true);
        Array.prototype.forEach.call(clone.querySelectorAll("input, select, textarea, button"), function (n) {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        var t = trimText(clone.innerText || clone.textContent || "");
        if (t) return t;
      }
      var legend = container.querySelector("legend");
      if (legend) {
        var lt = visibleText(legend);
        if (lt) return lt;
      }
    }
    return findLabelText(control);
  }

  function isListboxOpen(box) {
    if (!box) return false;
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(box) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      if (box.getAttribute("hidden") != null) return false;
      if (box.offsetParent === null && style && style.position !== "fixed") return false;
    } catch (_) {}
    return (box.querySelectorAll("[role='option']") || []).length > 0;
  }

  function findVisibleListbox() {
    var boxes = document.querySelectorAll("[role='listbox']");
    for (var i = 0; i < boxes.length; i += 1) {
      if (isListboxOpen(boxes[i])) return boxes[i];
    }
    return null;
  }

  function canonicalReactSelectComboboxInput(node) {
    if (!node) return null;
    var tag = (node.tagName || "").toLowerCase();
    if (tag === "input" && node.getAttribute && node.getAttribute("role") === "combobox") {
      return node;
    }
    var root = null;
    if (node.closest) {
      root =
        node.closest(".select__container") ||
        node.closest("[class*='select__container']") ||
        node.closest("[class*='select-container']");
    }
    if (!root) root = comboboxRoot(node) || node;
    var input = null;
    if (root && root.querySelector) {
      input =
        root.querySelector("input[role='combobox'].select__input") ||
        root.querySelector("input.select__input[role='combobox']") ||
        root.querySelector("input[role='combobox']");
    }
    if (input) return input;
    if (node.getAttribute && node.getAttribute("role") === "combobox") return node;
    return null;
  }

  function findExactReactSelectListbox(control) {
    var input = canonicalReactSelectComboboxInput(control);
    var id = trimText(input && input.id);
    if (!id) return null;
    var box = document.getElementById("react-select-" + id + "-listbox");
    if (!box) return null;
    if (!isListboxOpen(box)) return null;
    if (!(box.querySelectorAll("[role='option']") || []).length) return null;
    return box;
  }

  function findListboxForControl(control) {
    if (!control) return null;

    var owned =
      trimText(control.getAttribute && control.getAttribute("aria-controls")) ||
      trimText(control.getAttribute && control.getAttribute("aria-owns")) ||
      "";
    if (owned) {
      var ids = owned.split(/\s+/);
      for (var i = 0; i < ids.length; i += 1) {
        var byId = document.getElementById(ids[i]);
        if (isListboxOpen(byId)) return byId;
        if (byId) {
          var nested = byId.getAttribute && byId.getAttribute("role") === "listbox" ? byId : byId.querySelector("[role='listbox']");
          if (isListboxOpen(nested)) return nested;
        }
      }
    }

    var comboInput = canonicalReactSelectComboboxInput(control);
    if (comboInput && comboInput !== control) {
      var inputOwned =
        trimText(comboInput.getAttribute && comboInput.getAttribute("aria-controls")) ||
        trimText(comboInput.getAttribute && comboInput.getAttribute("aria-owns")) ||
        "";
      if (inputOwned) {
        var inputIds = inputOwned.split(/\s+/);
        var n;
        for (n = 0; n < inputIds.length; n += 1) {
          var ownedBox = document.getElementById(inputIds[n]);
          if (isListboxOpen(ownedBox)) return ownedBox;
          if (ownedBox) {
            var ownedNested =
              ownedBox.getAttribute && ownedBox.getAttribute("role") === "listbox"
                ? ownedBox
                : ownedBox.querySelector("[role='listbox']");
            if (isListboxOpen(ownedNested)) return ownedNested;
          }
        }
      }
    }

    var root = comboboxRoot(control);
    if (root) {
      var local = root.querySelector("[role='listbox']");
      if (isListboxOpen(local)) return local;
    }

    return null;
  }

  async function waitForListboxForControl(control, attempts, delay) {
    var max = attempts == null ? 10 : attempts;
    var waitMs = delay == null ? 60 : delay;
    var comboInput = canonicalReactSelectComboboxInput(control);
    var allowGlobal = !trimText(comboInput && comboInput.id);
    var listbox = null;
    var i;
    for (i = 0; i < max; i += 1) {
      listbox = findExactReactSelectListbox(control);
      if (!listbox) listbox = findListboxForControl(control);
      if (!listbox && allowGlobal) listbox = findVisibleListbox();
      if (listbox && collectListboxOptions(listbox).length) return listbox;
      await sleep(waitMs);
    }
    return listbox && collectListboxOptions(listbox).length ? listbox : null;
  }

  function closeReactSelectMenu(control) {
    var input = canonicalReactSelectComboboxInput(control) || control;
    try {
      if (input) {
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
        );
      }
    } catch (_) {}
  }

  async function openEducationDropdown(control) {
    var input = canonicalReactSelectComboboxInput(control);
    if (!input) return null;
    var existing = findExactReactSelectListbox(input);
    if (existing) return existing;

    var root = null;
    if (input.closest) {
      root =
        input.closest(".select__container") ||
        input.closest("[class*='select__container']") ||
        input.closest("[class*='select-container']");
    }
    if (!root) root = comboboxRoot(input) || input;

    var inputContainer = null;
    if (root && root.querySelector) {
      inputContainer =
        root.querySelector(".select__input-container") ||
        root.querySelector("[class*='select__input-container']");
    }
    if (!inputContainer) return null;

    var opts = { bubbles: true, cancelable: true, view: global, button: 0 };
    try {
      if (typeof PointerEvent === "function") {
        inputContainer.dispatchEvent(new PointerEvent("pointerdown", opts));
      }
      inputContainer.dispatchEvent(new MouseEvent("mousedown", opts));
    } catch (_) {}
    try {
      if (typeof input.focus === "function") input.focus();
    } catch (_) {}
    try {
      if (typeof PointerEvent === "function") {
        inputContainer.dispatchEvent(new PointerEvent("pointerup", opts));
      }
      inputContainer.dispatchEvent(new MouseEvent("mouseup", opts));
      inputContainer.dispatchEvent(new MouseEvent("click", opts));
    } catch (_) {}

    return waitForListboxForControl(input, 14, 70);
  }

  function optionLabelText(opt) {
    if (!opt) return "";
    // Use textContent so options below the scroll viewport are still readable.
    return (
      trimText(opt.textContent || "") ||
      trimText(opt.getAttribute && opt.getAttribute("aria-label")) ||
      visibleText(opt)
    );
  }

  function collectListboxOptions(listbox) {
    var options = [];
    if (!listbox) return options;
    Array.prototype.forEach.call(listbox.querySelectorAll("[role='option']"), function (opt) {
      var label = optionLabelText(opt);
      if (!label) return;
      options.push({ el: opt, label: label });
    });
    return options;
  }

  function clickElement(el) {
    if (!el) return false;
    try {
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      var opts = { bubbles: true, cancelable: true, view: global };
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
      }
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerup", opts));
      }
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
      if (typeof el.click === "function") el.click();
      return true;
    } catch (_) {
      try {
        if (typeof el.click === "function") {
          el.click();
          return true;
        }
      } catch (_) {}
      return false;
    }
  }

  function normalizeDialCode(code) {
    var digits = phoneDigitsOnly(code);
    if (!digits) return "";
    return "+" + digits;
  }

  function scorePhoneCountryOption(optionLabel, countryName, countryCode) {
    var optRaw = trimText(optionLabel);
    var optNorm = normalizeOptionText(optRaw);
    var countryNorm = normalizeOptionText(countryName);
    var code = normalizeDialCode(countryCode);
    var codeDigits = phoneDigitsOnly(countryCode);
    if (!optNorm) return 0;

    if (countryNorm && optNorm === countryNorm) return 100;

    var optHasCode = false;
    if (code && (optRaw.indexOf(code) !== -1 || (codeDigits && optRaw.indexOf("+" + codeDigits) !== -1))) {
      optHasCode = true;
    }
    if (countryNorm && optNorm.indexOf(countryNorm) !== -1 && optHasCode) return 90;
    if (countryNorm && optNorm.indexOf(countryNorm) !== -1) return 80;

    // Dialing-code-only match is scored lower and must be unambiguous at call site.
    if (codeDigits) {
      var re = new RegExp("(?:^|[^0-9])\\+?" + codeDigits + "(?:[^0-9]|$)");
      if (re.test(optRaw) || optNorm === normalizeOptionText(code)) return 40;
    }
    return 0;
  }

  function pickPhoneCountryOption(options, countryName, countryCode) {
    var best = null;
    var bestScore = 0;
    var codeOnly = [];
    (options || []).forEach(function (opt) {
      var score = scorePhoneCountryOption(opt.label, countryName, countryCode);
      if (score >= 80 && score > bestScore) {
        best = opt;
        bestScore = score;
      } else if (score === 40) {
        codeOnly.push(opt);
      }
    });
    if (best) return best;
    if (codeOnly.length === 1) return codeOnly[0];
    return null;
  }

  function optionMatchesYesNo(answer, optionLabel) {
    var want = polarityOfYesNo(answer);
    var got = polarityOfYesNo(optionLabel);
    if (want && got) return want === got;
    return optionMatches("work_authorization", answer, optionLabel);
  }

  async function selectCustomDropdownOption(control, matchFn, expectedVisibleHint, selectOptions) {
    if (!control) {
      return { ok: false, status: "failed", reason: "Dropdown control not found." };
    }
    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (typeof matchFn === "function" && matchFn(current)) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var listbox = null;
    if (selectOptions && selectOptions.educationDropdown) {
      listbox = await openEducationDropdown(control);
    } else {
      clickElement(control);
      await sleep(120);
      listbox = await waitForListboxForControl(control, 10, 60);
    }
    if (!listbox) {
      return { ok: false, status: "failed", reason: "Dropdown listbox did not open." };
    }

    var options = collectListboxOptions(listbox);
    var matched = null;
    for (var i = 0; i < options.length; i += 1) {
      if (matchFn(options[i].label, options[i].el)) {
        matched = options[i];
        break;
      }
    }
    if (!matched) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "No matching dropdown option." };
    }

    try {
      if (matched.el && typeof matched.el.scrollIntoView === "function") {
        matched.el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    clickElement(matched.el);
    await sleep(500);

    var selected = "";
    var hintNorm = expectedVisibleHint ? normalizeDegreeText(expectedVisibleHint) || normalizeOptionText(expectedVisibleHint) : "";
    for (var v = 0; v < 8; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && matchFn(selected)) break;
      if (
        selected &&
        hintNorm &&
        (normalizeDegreeText(selected) === hintNorm ||
          normalizeOptionText(selected) === normalizeOptionText(expectedVisibleHint) ||
          valuesMatch(expectedVisibleHint, selected))
      ) {
        break;
      }
      await sleep(50);
    }

    var selectedMatches =
      Boolean(selected) &&
      (matchFn(selected) ||
        (expectedVisibleHint &&
          (normalizeDegreeText(selected) === hintNorm ||
            normalizeOptionText(selected) === normalizeOptionText(expectedVisibleHint) ||
            valuesMatch(expectedVisibleHint, selected))));

    if (!selectedMatches) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "Verification failed; selected option did not persist." };
    }

    var root = comboboxRoot(control) || control;
    var hiddenInput = root.querySelector("input[type='hidden'], input.select__input, input[role='combobox']");
    if (hiddenInput) {
      try {
        hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }

    return { ok: true, status: "filled", reason: "", value: selected };
  }

  function findPhoneInput(root) {
    var doc = root || document;
    var nodes = doc.querySelectorAll(
      "input[type='tel'], input[name*='phone'], input[id*='phone'], input[autocomplete='tel'], input[autocomplete='tel-national']"
    );
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (!el || el.disabled) continue;
      var label = findLabelText(el);
      var cue = normalizeText([label, el.name, el.id, el.getAttribute("aria-label"), el.placeholder].join(" "));
      if (/\bcountry\b/.test(cue) && !/\bphone\b/.test(cue)) continue;
      if (/\bphone\b/.test(cue) || /\bmobile\b/.test(cue) || normalizeText(el.type || "") === "tel") {
        return el;
      }
    }
    return null;
  }

  function isAddressOrCitizenshipCountryCue(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bcitizen/.test(text) || /\bnationality\b/.test(text) || /\bcitizenship\b/.test(text)) return true;
    if (/\bmailing\s+address\b/.test(text) || /\bhome\s+address\b/.test(text)) return true;
    if (/\baddress\b/.test(text) && !/\bphone\b/.test(text)) return true;
    if (/\bcountry\s+of\s+residence\b/.test(text)) return true;
    return false;
  }

  function isPhoneCountryCue(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (isAddressOrCitizenshipCountryCue(text)) return false;
    return (
      /\bphone\s+country\b/.test(text) ||
      /\bcountry\s+code\b/.test(text) ||
      /\bdialing\s+code\b/.test(text) ||
      (/\bcountry\b/.test(text) && /\bphone\b/.test(text)) ||
      text === "country" ||
      text === "country *" ||
      /^country\b/.test(text)
    );
  }

  function findPhoneCountryControl(root) {
    var phoneInput = findPhoneInput(root);
    if (!phoneInput) return null;
    var container = fieldContainer(phoneInput) || phoneInput.parentElement;
    var searchRoots = [];
    if (container) searchRoots.push(container);
    if (container && container.parentElement) searchRoots.push(container.parentElement);
    searchRoots.push(root || document);

    for (var r = 0; r < searchRoots.length; r += 1) {
      var scope = searchRoots[r];
      if (!scope || !scope.querySelectorAll) continue;
      var candidates = scope.querySelectorAll(
        "[role='combobox'], button[aria-haspopup='listbox'], [class*='select__control'], [class*='Select-control']"
      );
      for (var i = 0; i < candidates.length; i += 1) {
        var control = findComboboxControl(candidates[i]);
        if (!control) continue;
        var label = labelForCombobox(control);
        var cue = normalizeText(label + " " + (control.getAttribute("aria-label") || ""));
        if (!isPhoneCountryCue(cue) && !(container && container.contains(control) && /\bcountry\b/.test(cue))) {
          continue;
        }
        if (isAddressOrCitizenshipCountryCue(cue)) continue;
        // Prefer controls near the phone input.
        if (container && container.contains(control)) return control;
        if (phoneInput.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return control;
        }
        if (phoneInput.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING) {
          return control;
        }
      }
    }
    return null;
  }

  function collectCustomComboboxControls(root) {
    var doc = root || document;
    var nodes = doc.querySelectorAll(
      "[role='combobox'], button[aria-haspopup='listbox'], [class*='select__control'], [class*='Select-control']"
    );
    var seen = [];
    var out = [];
    Array.prototype.forEach.call(nodes, function (node) {
      var control = findComboboxControl(node);
      if (!control || seen.indexOf(control) !== -1) return;
      seen.push(control);
      out.push(control);
    });
    return out;
  }

  function refreshLiveComboboxControl(control) {
    if (!control) return null;
    if (control.id) {
      var live = document.getElementById(control.id);
      if (live) return findComboboxControl(live) || live;
    }
    if (document.documentElement && document.documentElement.contains(control)) {
      return control;
    }
    return null;
  }

  function findLiveComboboxByCategory(root, wantedCategory, handledElements) {
    var comboboxes = collectCustomComboboxControls(root);
    var i;
    for (i = 0; i < comboboxes.length; i += 1) {
      var control = refreshLiveComboboxControl(comboboxes[i]);
      if (!control) continue;
      if (wasHandled(handledElements, control)) continue;
      var classified = classifyCombobox(control);
      if (classified && classified.category === wantedCategory) return control;
    }
    return null;
  }

  function classifyCombobox(control) {
    var label = labelForCombobox(control);
    var meta = {
      tagName: "div",
      inputType: "select",
      type: "select",
      label: label,
      ariaLabel: trimText(control.getAttribute && control.getAttribute("aria-label")),
      name: "",
      id: trimText(control.id || ""),
      nearby: "",
      autocomplete: "",
      placeholder: "",
      optionLabels: []
    };
    if (isPhoneCountryCue(normalizeText(label + " " + meta.ariaLabel))) {
      return { category: "phone_country", confidence: 0.95, label: label };
    }
    var detected = detectCategoryFromMeta(meta);
    return {
      category: (detected && detected.category) || "unknown",
      confidence: (detected && detected.confidence) || 0,
      label: label
    };
  }

  async function fillPhoneCountryDropdown(root, inventory, handledElements) {
    var control = findPhoneCountryControl(root);
    if (!control) return null;
    if (handledElements.indexOf(control) !== -1) return null;
    handledElements.push(control);

    var country = trimText((inventory && inventory.phone_country) || "");
    var code = trimText((inventory && inventory.phone_country_code) || "");
    var label = labelForCombobox(control) || "Phone country";
    if (!country && !code) {
      return {
        category: "phone_country",
        label: label,
        status: "skipped",
        reason: "No saved answer.",
        ok: false,
        value: ""
      };
    }

    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (scorePhoneCountryOption(current, country, code) >= 40) {
        return {
          category: "phone_country",
          label: label,
          status: "filled",
          reason: "",
          ok: true,
          value: current
        };
      }
      return {
        category: "phone_country",
        label: label,
        status: "skipped",
        reason: "Field is already completed.",
        ok: false,
        value: ""
      };
    }

    clickElement(control);
    await sleep(120);
    var listbox = null;
    for (var attempt = 0; attempt < 8; attempt += 1) {
      listbox = findVisibleListbox();
      if (listbox) break;
      await sleep(60);
    }
    if (!listbox) {
      return {
        category: "phone_country",
        label: label,
        status: "failed",
        reason: "Dropdown listbox did not open.",
        ok: false,
        value: ""
      };
    }

    var options = collectListboxOptions(listbox);
    var picked = pickPhoneCountryOption(options, country, code);
    if (!picked) {
      try {
        control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } catch (_) {}
      return {
        category: "phone_country",
        label: label,
        status: "failed",
        reason: "No matching dropdown option.",
        ok: false,
        value: ""
      };
    }

    clickElement(picked.el);
    await sleep(500);

    var selected = "";
    for (var v = 0; v < 8; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && scorePhoneCountryOption(selected, country, code) >= 40) break;
      await sleep(50);
    }

    if (!selected || scorePhoneCountryOption(selected, country, code) < 40) {
      return {
        category: "phone_country",
        label: label,
        status: "failed",
        reason: "Verification failed; selected option did not persist.",
        ok: false,
        value: ""
      };
    }

    var rootNode = comboboxRoot(control) || control;
    var wiredInput = rootNode.querySelector("input[type='hidden'], input.select__input, input[role='combobox']");
    if (wiredInput) {
      try {
        wiredInput.dispatchEvent(new Event("input", { bubbles: true }));
        wiredInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }

    return {
      category: "phone_country",
      label: label,
      status: "filled",
      reason: "",
      ok: true,
      value: selected
    };
  }

  async function fillLabeledYesNoDropdown(control, category, answer, handledElements) {
    if (!control || handledElements.indexOf(control) !== -1) return null;
    handledElements.push(control);
    var label = labelForCombobox(control) || category;
    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (optionMatchesYesNo(answer, current)) {
        return {
          category: category,
          label: label,
          status: "filled",
          reason: "",
          ok: true,
          value: current
        };
      }
      return {
        category: category,
        label: label,
        status: "skipped",
        reason: "Field is already completed.",
        ok: false,
        value: ""
      };
    }
    if (!trimText(answer)) {
      return {
        category: category,
        label: label,
        status: "skipped",
        reason: "No saved answer.",
        ok: false,
        value: ""
      };
    }

    var result = await selectCustomDropdownOption(
      control,
      function (optionLabel) {
        return optionMatchesYesNo(answer, optionLabel);
      },
      polarityOfYesNo(answer) === "yes" ? "Yes" : "No"
    );

    return {
      category: category,
      label: label,
      status: result.status,
      reason: result.reason || "",
      ok: Boolean(result.ok),
      value: result.ok ? result.value || answer : ""
    };
  }

  function fillSelect(el, category, answer) {
    if (!el || (el.tagName || "").toLowerCase() !== "select") {
      return { ok: false, status: "skipped", reason: "Not a select field." };
    }
    if (isFilledValue(readValue(el)) && el.selectedIndex > 0) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }
    if (!trimText(answer)) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    var matched = null;
    Array.prototype.forEach.call(el.options || [], function (opt) {
      if (matched || opt.disabled) return;
      var label = trimText(opt.text || opt.label || opt.value || "");
      if (!label) return;
      if (optionMatches(category, answer, label) || valuesMatch(answer, label)) {
        matched = opt;
      }
    });
    if (!matched) {
      return { ok: false, status: "failed", reason: "No matching select option." };
    }
    try {
      el.value = matched.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {
      return { ok: false, status: "failed", reason: "Could not set select value." };
    }
    if (!verifyField(el, matched.text || matched.label || answer)) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "", value: trimText(matched.text || matched.label || "") };
  }

  function fillRadioGroup(el, category, answer) {
    if (!el || normalizeText(el.type || "") !== "radio") {
      return { ok: false, status: "skipped", reason: "Not a radio field." };
    }
    var name = trimText(el.name || "");
    var root = el.form || el.closest("fieldset") || el.closest(".field") || document;
    var radios = [];
    Array.prototype.forEach.call(root.querySelectorAll('input[type="radio"]'), function (radio) {
      if (name && trimText(radio.name || "") !== name) return;
      radios.push(radio);
    });
    if (!radios.length) radios = [el];

    var already = radios.some(function (r) {
      return r.checked;
    });
    if (already) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }
    if (!trimText(answer)) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }

    var matched = null;
    var matchedLabel = "";
    for (var i = 0; i < radios.length; i += 1) {
      var label = getOptionLabelForInput(radios[i]);
      if (optionMatches(category, answer, label) || valuesMatch(answer, label)) {
        matched = radios[i];
        matchedLabel = label;
        break;
      }
    }
    if (!matched) {
      return { ok: false, status: "failed", reason: "No matching radio option." };
    }

    try {
      matched.checked = true;
      matched.dispatchEvent(new Event("input", { bubbles: true }));
      matched.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof matched.click === "function" && !matched.checked) matched.click();
    } catch (_) {}

    var checkedCount = 0;
    radios.forEach(function (r) {
      if (r.checked) checkedCount += 1;
    });
    if (!matched.checked || (name && checkedCount !== 1)) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "", value: matchedLabel };
  }

  function looksLikeStateSuffix(value) {
    var text = trimText(value).replace(/\./g, "");
    return /^[A-Za-z]{2}$/.test(text);
  }

  function splitPreferredLocations(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text) return [];
    var chunks;
    if (/[;\n|]/.test(text)) {
      chunks = text.split(/[;\n|]+/);
    } else {
      var parts = text.split(",").map(function (part) {
        return trimText(part);
      }).filter(Boolean);
      chunks = [];
      var i;
      for (i = 0; i < parts.length; i += 1) {
        if (i + 1 < parts.length && looksLikeStateSuffix(parts[i + 1])) {
          chunks.push(parts[i] + ", " + parts[i + 1]);
          i += 1;
        } else {
          chunks.push(parts[i]);
        }
      }
      return chunks;
    }
    return chunks.map(function (part) {
      return trimText(part);
    }).filter(Boolean);
  }

  function parsePreferredLocation(value) {
    var raw = trimText(value);
    if (!raw) return null;
    var match = raw.match(/^(.*),\s*([^,]+)$/);
    if (match) {
      return {
        city: normalizeText(match[1]),
        region: normalizeText(match[2]),
        full: normalizeText(raw)
      };
    }
    return {
      city: normalizeText(raw),
      region: "",
      full: normalizeText(raw)
    };
  }

  function preferredLocationMatches(saved, optionLabel) {
    var want = parsePreferredLocation(saved);
    var got = parsePreferredLocation(optionLabel);
    if (!want || !got || !want.city || !got.city) return false;
    if (want.full === got.full) return true;
    if (want.city !== got.city) return false;
    if (!want.region || !got.region) return true;
    return want.region === got.region;
  }

  function checkboxGroupQuestionLabel(el) {
    if (!el || !el.closest) return "";
    var fieldset = el.closest("fieldset");
    if (fieldset) {
      var legend = fieldset.querySelector("legend");
      var legendText = trimText(legend && (legend.innerText || legend.textContent));
      if (legendText) return legendText;
      var labelledBy = trimText(fieldset.getAttribute("aria-labelledby") || "");
      if (labelledBy) {
        var texts = labelledBy.split(/\s+/).map(function (id) {
          var node = document.getElementById(id);
          return node ? trimText(node.innerText || node.textContent || "") : "";
        });
        var joined = trimText(texts.join(" "));
        if (joined) return joined;
      }
      var aria = trimText(fieldset.getAttribute("aria-label") || "");
      if (aria) return aria;
    }
    var container = fieldContainer(el);
    if (container) {
      var labels = container.querySelectorAll("label");
      var i;
      for (i = 0; i < labels.length; i += 1) {
        if (labels[i].querySelector('input[type="checkbox"]')) continue;
        var text = trimText(labels[i].innerText || labels[i].textContent || "");
        if (text) return text;
      }
    }
    return "";
  }

  function collectPreferredLocationCheckboxes(el) {
    var name = trimText(el && el.name);
    var root =
      (el && el.closest && el.closest("fieldset")) ||
      (el && el.closest && el.closest(".field")) ||
      (el && el.form) ||
      document;
    var boxes = [];
    Array.prototype.forEach.call(root.querySelectorAll('input[type="checkbox"]'), function (box) {
      if (!box || box.disabled) return;
      if (name) {
        if (trimText(box.name || "") !== name) return;
      } else if (box !== el) {
        return;
      }
      boxes.push(box);
    });
    if (!boxes.length && el && normalizeText(el.type || "") === "checkbox") boxes = [el];
    return boxes;
  }

  function fillPreferredLocationsCheckboxGroup(el, answer, handledElements) {
    if (!el || normalizeText(el.type || "") !== "checkbox") {
      return { ok: false, status: "skipped", reason: "Not a checkbox field." };
    }
    var boxes = collectPreferredLocationCheckboxes(el);
    var i;
    for (i = 0; i < boxes.length; i += 1) {
      markHandled(handledElements, boxes[i]);
    }
    var saved = trimText(answer);
    if (!saved) {
      return { ok: false, status: "skipped", reason: "No saved preferred locations." };
    }
    var wanted = splitPreferredLocations(saved);
    if (!wanted.length) {
      return { ok: false, status: "skipped", reason: "No saved preferred locations." };
    }
    var matched = [];
    for (i = 0; i < boxes.length; i += 1) {
      var box = boxes[i];
      var optionLabel = trimText(findLabelText(box) || getOptionLabelForInput(box) || "");
      var hit = false;
      var w;
      for (w = 0; w < wanted.length; w += 1) {
        if (preferredLocationMatches(wanted[w], optionLabel)) {
          hit = true;
          break;
        }
      }
      if (hit) matched.push({ el: box, label: optionLabel });
    }
    if (!matched.length) {
      return { ok: false, status: "skipped", reason: "No preferred location options matched." };
    }
    var selected = [];
    for (i = 0; i < matched.length; i += 1) {
      var item = matched[i];
      if (!item.el.checked && typeof item.el.click === "function") {
        item.el.click();
      }
      if (item.el.checked) selected.push(item.label);
    }
    if (!selected.length) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return {
      ok: true,
      status: "filled",
      reason: "",
      value: selected.join(", ")
    };
  }

  function fillCheckboxGroup(el, category, answer) {
    if (!el || normalizeText(el.type || "") !== "checkbox") {
      return { ok: false, status: "skipped", reason: "Not a checkbox field." };
    }
    if (!trimText(answer)) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    var name = trimText(el.name || "");
    var root = el.form || el.closest("fieldset") || el.closest(".field") || el.closest(".demographic_question") || document;
    var boxes = [];
    Array.prototype.forEach.call(root.querySelectorAll('input[type="checkbox"]'), function (box) {
      if (name && trimText(box.name || "") !== name) return;
      boxes.push(box);
    });
    if (!boxes.length) boxes = [el];

    var matched = null;
    var matchedLabel = "";
    for (var i = 0; i < boxes.length; i += 1) {
      var label = getOptionLabelForInput(boxes[i]);
      if (optionMatches(category, answer, label) || valuesMatch(answer, label)) {
        matched = boxes[i];
        matchedLabel = label;
        break;
      }
    }
    if (!matched) {
      return { ok: false, status: "failed", reason: "No matching checkbox option." };
    }
    if (matched.checked) {
      return { ok: true, status: "filled", reason: "", value: matchedLabel };
    }
    try {
      matched.checked = true;
      matched.dispatchEvent(new Event("input", { bubbles: true }));
      matched.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof matched.click === "function" && !matched.checked) matched.click();
    } catch (_) {}
    if (!matched.checked) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "", value: matchedLabel };
  }

  function uploadToFileInput(fileInput, resume) {
    if (!fileInput || !resume || !resume.resumeBase64 || !resume.resumeName) {
      return { ok: false, status: "skipped", reason: "No resume file available." };
    }
    if (fileInput.files && fileInput.files.length > 0) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }
    try {
      var arr = String(resume.resumeBase64).split(",");
      var mimeMatch = arr[0] && arr[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : "application/pdf";
      var bstr = atob(arr[1] || "");
      var n = bstr.length;
      var u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      var file = new File([u8arr], resume.resumeName, { type: mime });
      var dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      if (!verifyField(fileInput)) {
        return { ok: false, status: "failed", reason: "Resume upload verification failed." };
      }
      return { ok: true, status: "filled", reason: "", value: resume.resumeName };
    } catch (_) {
      return { ok: false, status: "failed", reason: "Resume upload failed." };
    }
  }

  function isCoverLetterFile(identity) {
    var blob = normalizeText(identity);
    return /\bcover\b/.test(blob) && /\bletter\b/.test(blob);
  }

  function isResumeFile(identity) {
    var blob = normalizeText(identity);
    return (/\bresume\b/.test(blob) || /\bcv\b/.test(blob)) && !isCoverLetterFile(blob);
  }

  function supportedCategories() {
    return {
      first_name: true,
      last_name: true,
      preferred_name: true,
      full_name: true,
      email: true,
      phone: true,
      phone_country: true,
      address: true,
      linkedin: true,
      github: true,
      portfolio: true,
      url: true,
      cover_letter: true,
      resume_upload: true,
      work_authorization: true,
      sponsorship_now: true,
      sponsorship_later: true,
      gender: true,
      race_ethnicity: true,
      veteran_status: true,
      disability_status: true,
      referral_source: true,
      project_highlight: true,
      additional_information: true,
      availability: true,
      preferred_locations: true
    };
  }

  function markHandled(handledElements, el) {
    if (!el || !handledElements) return;
    if (handledElements.indexOf(el) === -1) handledElements.push(el);
  }

  function wasHandled(handledElements, el) {
    return Boolean(el && handledElements && handledElements.indexOf(el) !== -1);
  }

  function collectFields(root) {
    var doc = root || document;
    var nodes = [];
    try {
      Array.prototype.forEach.call(
        doc.querySelectorAll("input, select, textarea"),
        function (el) {
          if (!el || el.disabled) return;
          var type = normalizeText(el.type || "");
          if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "reset") {
            return;
          }
          nodes.push(el);
        }
      );
    } catch (_) {}
    return nodes;
  }

  function fillOneField(el, inventory, options, resume, seenRadioNames, handledElements) {
    if (wasHandled(handledElements, el)) return null;

    var meta = fieldMeta(el);
    var detected = classifyField(el);
    var category = detected.category || "unknown";
    var label = meta.label || meta.name || meta.id || "Field";
    var type = normalizeText(el.type || "");
    var tag = (el.tagName || "").toLowerCase();
    var cats = supportedCategories();
    var labelCue = normalizeText([label, meta.name, meta.id, meta.ariaLabel, meta.placeholder].join(" "));

    if (looksLikeEducationDateField(labelCue) || category === "education" || category === "education_start_month" || category === "education_end_month") {
      markHandled(handledElements, el);
      return null;
    }

    if (
      looksLikeLocationCityField(labelCue) ||
      category === "city" ||
      category === "location"
    ) {
      markHandled(handledElements, el);
      return null;
    }

    if (type === "file") {
      var identity = normalizeText([label, meta.name, meta.id, meta.ariaLabel].join(" "));
      if (isResumeFile(identity)) {
        markHandled(handledElements, el);
        var resumeResult = uploadToFileInput(el, resume);
        return {
          category: "resume_upload",
          label: label,
          status: resumeResult.status,
          reason: resumeResult.reason || "",
          ok: Boolean(resumeResult.ok),
          value: resumeResult.ok ? resumeResult.value || "" : ""
        };
      }
      if (isCoverLetterFile(identity)) {
        markHandled(handledElements, el);
        return {
          category: "cover_letter",
          label: label,
          status: "skipped",
          reason: "Cover letter file upload requires a saved file; text cover letter is handled separately.",
          ok: false,
          value: ""
        };
      }
      return null;
    }

    if (type === "checkbox") {
      var groupQuestion = checkboxGroupQuestionLabel(el);
      if (groupQuestion) {
        var groupDetected = detectCategoryFromMeta({
          tagName: "input",
          inputType: "checkbox",
          type: "checkbox",
          label: groupQuestion,
          ariaLabel: meta.ariaLabel || "",
          name: meta.name || "",
          id: meta.id || "",
          nearby: "",
          autocomplete: "",
          optionLabels: []
        });
        if (groupDetected.category === "preferred_locations") {
          category = "preferred_locations";
          label = groupQuestion;
        }
      }
    }

    if (!cats[category]) return null;

    if (isSensitive(category) && options.fillDemographics === false) {
      markHandled(handledElements, el);
      return {
        category: category,
        label: label,
        status: "skipped",
        reason: "Demographic autofill disabled.",
        ok: false,
        value: ""
      };
    }

    var answer = getInventoryAnswer(category, inventory, options);
    if (category === "phone") {
      answer = nationalPhoneForGreenhouse(
        answer,
        (inventory && inventory.phone_country_code) || ""
      );
    }
    if (category === "phone_country") {
      // Native <select> path: match using saved country name / dialing code.
      var countryName = trimText((inventory && inventory.phone_country) || "");
      var countryCode = trimText((inventory && inventory.phone_country_code) || "");
      if (!countryName && !countryCode) {
        markHandled(handledElements, el);
        return {
          category: category,
          label: label,
          status: "skipped",
          reason: "No saved answer.",
          ok: false,
          value: ""
        };
      }
      if (tag === "select") {
        markHandled(handledElements, el);
        var matchedOpt = null;
        var bestScore = 0;
        Array.prototype.forEach.call(el.options || [], function (opt) {
          if (!opt || opt.disabled) return;
          var optLabel = trimText(opt.text || opt.label || opt.value || "");
          var score = scorePhoneCountryOption(optLabel, countryName, countryCode);
          if (score > bestScore) {
            bestScore = score;
            matchedOpt = opt;
          }
        });
        if (!matchedOpt || bestScore < 40) {
          return {
            category: category,
            label: label,
            status: "failed",
            reason: "No matching select option.",
            ok: false,
            value: ""
          };
        }
        try {
          el.value = matchedOpt.value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (_) {
          return {
            category: category,
            label: label,
            status: "failed",
            reason: "Could not set select value.",
            ok: false,
            value: ""
          };
        }
        var selectedLabel = trimText(matchedOpt.text || matchedOpt.label || "");
        if (scorePhoneCountryOption(selectedLabel || readValue(el), countryName, countryCode) < 40) {
          return {
            category: category,
            label: label,
            status: "failed",
            reason: "Verification failed.",
            ok: false,
            value: ""
          };
        }
        return {
          category: category,
          label: label,
          status: "filled",
          reason: "",
          ok: true,
          value: selectedLabel
        };
      }
      answer = countryName || countryCode;
    }
    if (
      !(type === "checkbox" && category === "preferred_locations") &&
      !trimText(answer)
    ) {
      markHandled(handledElements, el);
      return {
        category: category,
        label: label,
        status: "skipped",
        reason: "No saved answer.",
        ok: false,
        value: ""
      };
    }

    if (type === "radio") {
      var radioKey = trimText(el.name || el.id || "");
      if (radioKey && seenRadioNames[radioKey]) return null;
      if (radioKey) seenRadioNames[radioKey] = true;
      markHandled(handledElements, el);
      var radioResult = fillRadioGroup(el, category, answer);
      return {
        category: category,
        label: label,
        status: radioResult.status,
        reason: radioResult.reason || "",
        ok: Boolean(radioResult.ok),
        value: radioResult.ok ? radioResult.value || answer : ""
      };
    }

    if (type === "checkbox") {
      if (category === "preferred_locations") {
        var prefLocKey = "cbgroup:" + trimText(el.name || label);
        if (seenRadioNames[prefLocKey]) return null;
        seenRadioNames[prefLocKey] = true;
        var prefLocResult = fillPreferredLocationsCheckboxGroup(
          el,
          trimText((inventory && inventory.preferred_locations) || ""),
          handledElements
        );
        return {
          category: "preferred_locations",
          label: label,
          status: prefLocResult.status,
          reason: prefLocResult.reason || "",
          ok: Boolean(prefLocResult.ok),
          value: prefLocResult.ok ? prefLocResult.value || "" : ""
        };
      }
      var boxKey = trimText(el.name || "") + "::" + normalizeOptionText(getOptionLabelForInput(el));
      if (seenRadioNames[boxKey]) return null;
      seenRadioNames[boxKey] = true;
      var boxLabel = getOptionLabelForInput(el);
      if (!optionMatches(category, answer, boxLabel) && !valuesMatch(answer, boxLabel)) {
        var groupKey = "cbgroup:" + trimText(el.name || label);
        if (seenRadioNames[groupKey]) return null;
        seenRadioNames[groupKey] = true;
        markHandled(handledElements, el);
        var groupResult = fillCheckboxGroup(el, category, answer);
        return {
          category: category,
          label: label,
          status: groupResult.status,
          reason: groupResult.reason || "",
          ok: Boolean(groupResult.ok),
          value: groupResult.ok ? groupResult.value || answer : ""
        };
      }
      markHandled(handledElements, el);
      var checkResult = fillCheckboxGroup(el, category, answer);
      return {
        category: category,
        label: label,
        status: checkResult.status,
        reason: checkResult.reason || "",
        ok: Boolean(checkResult.ok),
        value: checkResult.ok ? checkResult.value || answer : ""
      };
    }

    if (tag === "select") {
      markHandled(handledElements, el);
      var selectResult = fillSelect(el, category, answer);
      return {
        category: category,
        label: label,
        status: selectResult.status,
        reason: selectResult.reason || "",
        ok: Boolean(selectResult.ok),
        value: selectResult.ok ? selectResult.value || answer : ""
      };
    }

    if (tag === "textarea" || tag === "input") {
      markHandled(handledElements, el);
      if (category === "availability" && af() && typeof af().fillAvailabilityDateElement === "function") {
        var dateResult = af().fillAvailabilityDateElement(el, answer);
        return {
          category: category,
          label: label,
          status: dateResult.status,
          reason: dateResult.reason || "",
          ok: Boolean(dateResult.ok),
          value: dateResult.ok ? dateResult.value || answer : ""
        };
      }
      var textResult = fillTextLike(el, answer, category);
      return {
        category: category,
        label: label,
        status: textResult.status,
        reason: textResult.reason || "",
        ok: Boolean(textResult.ok),
        value: textResult.ok ? answer : ""
      };
    }

    return null;
  }

  function resolveEducationRecords(inventory, profile) {
    var engine = af();
    var raw =
      (inventory && inventory.education_records) ||
      (profile && profile.education) ||
      [];
    if (engine && typeof engine.listValidEducationRecords === "function") {
      return engine.listValidEducationRecords(raw);
    }
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (item) {
      var row =
        engine && typeof engine.normalizeEducationRecord === "function"
          ? engine.normalizeEducationRecord(item)
          : item;
      if (!row) return;
      if (row.institution || row.degree || row.field || row.startDate || row.endDate) out.push(row);
    });
    return out;
  }

  function resolvePrimaryEducation(inventory, profile) {
    var engine = af();
    var records = resolveEducationRecords(inventory, profile);
    if (engine && typeof engine.selectPrimaryEducation === "function") {
      return engine.selectPrimaryEducation(records);
    }
    if (inventory && inventory.primary_education) return inventory.primary_education;
    return records.length ? records[0] : null;
  }

  function educationYearFrom(value) {
    var engine = af();
    if (engine && typeof engine.extractYearFromEducationDate === "function") {
      return engine.extractYearFromEducationDate(value);
    }
    var match = String(value == null ? "" : value).match(/\b((?:19|20)\d{2})\b/);
    return match ? match[1] : "";
  }

  function educationMonthFrom(value) {
    var engine = af();
    if (engine && typeof engine.extractMonthFromEducationDate === "function") {
      return engine.extractMonthFromEducationDate(value);
    }
    return "";
  }

  function isExcludedEducationQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bgpa\b/.test(text) || /\bgrade\s+point\b/.test(text)) return true;
    if (/\btutor/.test(text)) return true;
    if (/\bquantitative\s+finance\b/.test(text) || /\bquant\s+finance\b/.test(text)) return true;
    if (/\btime\s+constraints?\b/.test(text)) return true;
    return false;
  }

  function classifyEducationField(labelBlob) {
    var text = normalizeText(labelBlob);
    if (!text || isExcludedEducationQuestion(text)) return "";
    if (/\banticipated\s+graduation\b/.test(text)) return "education_anticipated_graduation";
    if (/\bstart\s+date\s+month\b/.test(text) || /\beducation\s+start\s+month\b/.test(text)) {
      return "education_start_month";
    }
    if (/\bend\s+date\s+month\b/.test(text) || /\beducation\s+end\s+month\b/.test(text)) {
      return "education_end_month";
    }
    if (/\bstart\s+date\s+year\b/.test(text) || /\beducation\s+start\s+year\b/.test(text)) {
      return "education_start_year";
    }
    if (/\bend\s+date\s+year\b/.test(text) || /\beducation\s+end\s+year\b/.test(text)) {
      return "education_end_year";
    }
    if (text === "school" || /\bschool\b/.test(text) || /\buniversity\b/.test(text) || /\bcollege\b/.test(text)) {
      if (/\bdegree\b/.test(text) || /\bdiscipline\b/.test(text) || /\bmajor\b/.test(text)) return "";
      return "education_school";
    }
    if (text === "degree" || /\bdegree\b/.test(text)) {
      if (/\bdiscipline\b/.test(text) || /\bmajor\b/.test(text)) return "";
      return "education_degree";
    }
    if (
      text === "discipline" ||
      /\bdiscipline\b/.test(text) ||
      /\bfield\s+of\s+study\b/.test(text) ||
      (/\bmajor\b/.test(text) && !/\bmajority\b/.test(text))
    ) {
      return "education_discipline";
    }
    return "";
  }

  function normalizeDegreeText(value) {
    var text = trimText(value);
    if (!text) return "";
    text = text.toLowerCase();
    // Normalize curly/straight apostrophes out so Master's == Masters.
    text = text.replace(/[\u2019']/g, "");
    text = text.replace(/\./g, "");
    text = text.replace(/[^\w\s]/g, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function mapDegreeToGreenhouseTarget(savedDegree) {
    var norm = normalizeDegreeText(savedDegree);
    if (!norm) return "";
    var compact = norm.replace(/\s+/g, "");

    // Exact safe mappings only — never guess a different degree level.
    if (norm === "master of science" || compact === "ms") {
      return "Master's Degree";
    }
    if (norm === "master of engineering" || compact === "meng") {
      return "Master's Degree";
    }
    if (
      norm === "bachelor of science" ||
      compact === "bs" ||
      norm === "bachelor of engineering" ||
      compact === "be" ||
      norm === "bachelor of technology" ||
      compact === "btech"
    ) {
      return "Bachelor's Degree";
    }
    return "";
  }

  function isRejectedDegreeOption(label) {
    var norm = normalizeDegreeText(label);
    if (!norm) return true;
    if (norm === "other") return true;
    if (
      norm.indexOf("master of business administration") !== -1 ||
      norm === "mba" ||
      /\bmba\b/.test(norm)
    ) {
      return true;
    }
    if (norm === "engineers degree" || norm.indexOf("engineers degree") !== -1) {
      return true;
    }
    return false;
  }

  function degreesMatchNormalized(a, b) {
    var left = normalizeDegreeText(a);
    var right = normalizeDegreeText(b);
    return Boolean(left && right && left === right);
  }

  function degreeTargetLabel(savedDegree) {
    return mapDegreeToGreenhouseTarget(savedDegree) || trimText(savedDegree);
  }

  function degreeOptionMatches(savedDegree, optionLabel) {
    var label = trimText(optionLabel);
    if (!label || isRejectedDegreeOption(label)) return false;
    var target = degreeTargetLabel(savedDegree);
    if (!target) return false;
    return degreesMatchNormalized(label, target);
  }

  function pickDegreeOption(options, savedDegree) {
    var saved = trimText(savedDegree);
    if (!saved) return null;
    for (var j = 0; j < (options || []).length; j += 1) {
      var opt = options[j];
      if (degreeOptionMatches(saved, opt && opt.label)) return opt;
    }
    return null;
  }

  function isComputerRelatedDiscipline(value) {
    var text = normalizeOptionText(value) || normalizeDegreeText(value);
    if (!text) return false;
    if (
      /\b(electrical|mechanical|civil|chemical|aerospace|industrial|biomedical)\b/.test(text) &&
      text !== "computer engineering"
    ) {
      return false;
    }
    if (/\b(biology|chemistry|physics|mathematics|business|data science)\b/.test(text)) {
      return false;
    }
    if (
      text === "computer science" ||
      text === "computer sciences" ||
      text === "computer engineering" ||
      text === "software engineering" ||
      text === "information technology" ||
      text === "information systems" ||
      text === "computer and information science" ||
      text === "computer and information sciences" ||
      text === "computer science and information systems"
    ) {
      return true;
    }
    if (/\bcomputer sciences?\b/.test(text) && /\binformation\s+(science|sciences|systems|technology)\b/.test(text)) {
      return true;
    }
    if (/\bcomputer sciences?\b/.test(text) && !/\b(biology|business|chemistry|physics|electrical|mechanical)\b/.test(text)) {
      return true;
    }
    if (text === "software engineering" || /\bsoftware engineering\b/.test(text)) return true;
    if (text === "information technology" || text === "information systems") return true;
    return false;
  }

  function isUnsafeDisciplineFallback(optionLabel) {
    var b = normalizeOptionText(optionLabel);
    if (!b) return true;
    return (
      b === "other" ||
      b === "engineering" ||
      b === "electrical engineering" ||
      b === "mathematics" ||
      b === "data science" ||
      b === "business"
    );
  }

  function computerDisciplineFallbackLabels() {
    return [
      "computer engineering",
      "computer science",
      "computer and information sciences",
      "computer and information science",
      "computer science and information systems",
      "software engineering",
      "information technology",
      "information systems"
    ];
  }

  function isSafeComputerDisciplineFallback(optionLabel) {
    var b = normalizeOptionText(optionLabel);
    if (!b || b === "computer" || isUnsafeDisciplineFallback(optionLabel)) return false;
    var list = computerDisciplineFallbackLabels();
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (b === list[i]) return true;
    }
    return false;
  }

  function disciplineOptionsEquivalent(saved, optionLabel) {
    var a = normalizeOptionText(saved);
    var b = normalizeOptionText(optionLabel);
    if (!a || !b) return false;
    if (a === b) return true;
    if (b === "computer" || a === "computer") return false;
    if (isUnsafeDisciplineFallback(optionLabel) || isUnsafeDisciplineFallback(saved)) return false;
    var cs = "computer science";
    var cis = "computer and information sciences";
    var cis2 = "computer and information science";
    var csis = "computer science and information systems";
    if ((a === cs || a.indexOf(cs) !== -1) && (b === cis || b === cis2 || b.indexOf(cis) !== -1 || b.indexOf(cs) !== -1)) {
      if (b.indexOf("computer") === -1) return false;
      if (/\b(engineering|biology|business|chemistry|physics|math)\b/.test(b) && b.indexOf("computer") === -1) {
        return false;
      }
      return (
        b === cs ||
        b === cis ||
        b === cis2 ||
        b === csis ||
        b === "computer sciences" ||
        b === "computer engineering" ||
        b.indexOf("computer and information") !== -1
      );
    }
    if ((b === cs || b.indexOf(cs) !== -1) && (a === cis || a === cis2 || a.indexOf(cis) !== -1)) {
      return true;
    }
    if (isComputerRelatedDiscipline(saved)) {
      return isSafeComputerDisciplineFallback(optionLabel);
    }
    return false;
  }

  function disciplineOptionMatches(savedDiscipline, optionLabel) {
    var saved = trimText(savedDiscipline);
    var label = trimText(optionLabel);
    if (!saved || !label) return false;
    if (normalizeText(label) === "computer") return false;
    if (normalizeOptionText(label) === "other" || normalizeDegreeText(label) === "other") return false;
    // Prefer exact normalized match (Computer Science -> Computer Science).
    if (normalizeDegreeText(saved) === normalizeDegreeText(label)) return true;
    if (normalizeOptionText(saved) === normalizeOptionText(label)) return true;
    return disciplineOptionsEquivalent(saved, label);
  }

  function pickDisciplineOption(options, savedDiscipline) {
    var saved = trimText(savedDiscipline);
    if (!saved) return null;
    var exact = null;
    var ranked = {};
    var equiv = null;
    var rankList = computerDisciplineFallbackLabels();
    (options || []).forEach(function (opt) {
      var label = trimText(opt && opt.label);
      if (!label || isUnsafeDisciplineFallback(label)) return;
      if (
        normalizeDegreeText(saved) === normalizeDegreeText(label) ||
        normalizeOptionText(saved) === normalizeOptionText(label)
      ) {
        if (!exact) exact = opt;
        return;
      }
      if (isComputerRelatedDiscipline(saved)) {
        var norm = normalizeOptionText(label);
        var r;
        for (r = 0; r < rankList.length; r += 1) {
          if (norm === rankList[r]) {
            if (!ranked[norm]) ranked[norm] = opt;
            break;
          }
        }
        return;
      }
      if (!equiv && disciplineOptionsEquivalent(saved, label)) equiv = opt;
    });
    if (exact) return exact;
    if (isComputerRelatedDiscipline(saved)) {
      var i;
      for (i = 0; i < rankList.length; i += 1) {
        if (ranked[rankList[i]]) return ranked[rankList[i]];
      }
      return null;
    }
    return equiv || null;
  }

  function normalizeSchoolName(value) {
    var text = trimText(value);
    if (!text) return "";
    // Keep campus names: convert punctuation separators to spaces (do not drop the tail).
    text = text.replace(/[,\u2013\u2014\-]/g, " ");
    text = text.replace(/\./g, "");
    text = text.toLowerCase();
    text = text.replace(/[^\w\s]/g, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function schoolNameTokens(value) {
    var normalized = normalizeSchoolName(value);
    if (!normalized) return [];
    return normalized.split(" ").filter(function (tok) {
      return tok && tok.length > 1;
    });
  }

  function schoolSearchQueries(savedSchool) {
    var saved = trimText(savedSchool);
    if (!saved) return [];
    var queries = [];
    function add(q) {
      var t = trimText(q);
      if (!t) return;
      for (var i = 0; i < queries.length; i += 1) {
        if (normalizeText(queries[i]) === normalizeText(t)) return;
      }
      queries.push(t);
    }

    add(saved);
    add(normalizeSchoolName(saved));

    // Comma / dash campus form: "California State University - Long Beach"
    var hyphenated = saved
      .replace(/\s*[,]\s*/g, " - ")
      .replace(/\s*[\u2013\u2014]\s*/g, " - ")
      .replace(/\s*-\s*/g, " - ")
      .replace(/\s+/g, " ")
      .trim();
    add(hyphenated);

    // Campus / location tail after comma or dash.
    var parts = saved.split(/\s*[,]\s*|\s*[-–—]\s*/);
    if (parts.length > 1) {
      add(parts[parts.length - 1]);
    }

    return queries;
  }

  function scoreSchoolOption(optionLabel, savedSchool) {
    var want = normalizeSchoolName(savedSchool);
    var got = normalizeSchoolName(optionLabel);
    if (!want || !got) return 0;
    if (want === got) return 1000;

    var wantTokens = schoolNameTokens(savedSchool);
    var gotTokens = schoolNameTokens(optionLabel);
    if (!wantTokens.length || !gotTokens.length) return 0;

    // Require every important saved token to appear in the option.
    for (var i = 0; i < wantTokens.length; i += 1) {
      if (gotTokens.indexOf(wantTokens[i]) === -1) return 0;
    }

    var extra = 0;
    for (var j = 0; j < gotTokens.length; j += 1) {
      if (wantTokens.indexOf(gotTokens[j]) === -1) extra += 1;
    }
    // Prefer options that don't add unrelated campus/location tokens.
    return 500 + wantTokens.length * 10 - extra * 20;
  }

  function pickSchoolOption(options, savedSchool) {
    var saved = trimText(savedSchool);
    if (!saved) return null;

    var exact = [];
    var ranked = [];
    (options || []).forEach(function (opt) {
      var label = trimText(opt && opt.label);
      if (!label) return;
      var score = scoreSchoolOption(label, saved);
      if (!score) return;
      if (score >= 1000) exact.push(opt);
      else ranked.push({ opt: opt, score: score });
    });

    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      // Ambiguous exact-normalized collision — do not guess.
      return null;
    }

    ranked.sort(function (a, b) {
      return b.score - a.score;
    });
    if (!ranked.length) return null;
    if (ranked.length === 1) return ranked[0].opt;
    if (ranked[0].score > ranked[1].score) return ranked[0].opt;
    // Tied best scores are ambiguous.
    return null;
  }

  function schoolsMatchNormalized(a, b) {
    var left = normalizeSchoolName(a);
    var right = normalizeSchoolName(b);
    return Boolean(left && right && left === right);
  }

  function pickYearOption(options, year) {
    var want = trimText(year);
    if (!want) return null;
    var matches = [];
    (options || []).forEach(function (opt) {
      var got = educationYearFrom(opt.label) || normalizeOptionText(opt.label);
      if (got === want) matches.push(opt);
    });
    return matches.length === 1 || matches.length > 1 ? matches[0] : null;
  }

  function monthIndexFromLabel(value) {
    var raw = trimText(value);
    if (!raw) return -1;
    var norm = normalizeText(raw).replace(/[.]/g, "").replace(/\s+/g, " ").trim();
    var names = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ];
    var abbrs = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    var i;
    for (i = 0; i < names.length; i += 1) {
      if (norm === names[i]) return i;
    }
    if (norm === "sept") return 8;
    for (i = 0; i < abbrs.length; i += 1) {
      if (norm === abbrs[i]) return i;
    }
    if (/^\d{1,2}$/.test(norm)) {
      var num = parseInt(norm, 10);
      if (num >= 1 && num <= 12) return num - 1;
    }
    return -1;
  }

  function pickMonthOption(options, savedMonth) {
    var want = monthIndexFromLabel(savedMonth);
    if (want < 0) return null;
    var matches = [];
    (options || []).forEach(function (opt) {
      var got = monthIndexFromLabel(opt && opt.label);
      if (got === want) matches.push(opt);
    });
    if (matches.length === 1) return matches[0];
    return null;
  }

  function findEducationMonthListbox(control, savedMonth) {
    if (control) {
      var owned =
        trimText(control.getAttribute && control.getAttribute("aria-controls")) ||
        trimText(control.getAttribute && control.getAttribute("aria-owns")) ||
        "";
      if (owned) {
        var ids = owned.split(/\s+/);
        var i;
        for (i = 0; i < ids.length; i += 1) {
          var byId = document.getElementById(ids[i]);
          if (isListboxOpen(byId)) return byId;
          if (byId) {
            var nested =
              byId.getAttribute && byId.getAttribute("role") === "listbox"
                ? byId
                : byId.querySelector("[role='listbox']");
            if (isListboxOpen(nested)) return nested;
          }
        }
      }
      var root = comboboxRoot(control);
      if (root) {
        var local = root.querySelector("[role='listbox']");
        if (isListboxOpen(local)) return local;
      }
    }
    var boxes = document.querySelectorAll("[role='listbox']");
    var b;
    for (b = 0; b < boxes.length; b += 1) {
      if (!isListboxOpen(boxes[b])) continue;
      var options = collectListboxOptions(boxes[b]);
      var seen = {};
      var monthCount = 0;
      var o;
      for (o = 0; o < options.length; o += 1) {
        var idx = monthIndexFromLabel(options[o] && options[o].label);
        if (idx < 0 || seen[idx]) continue;
        seen[idx] = true;
        monthCount += 1;
      }
      if (monthCount >= 6) return boxes[b];
    }
    return null;
  }

  async function fillEducationMonthDropdown(control, savedMonth) {
    var saved = trimText(savedMonth);
    var want = monthIndexFromLabel(saved);
    if (!saved || want < 0) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    var current = readComboboxSelectedText(control);
    if (current && monthIndexFromLabel(current) === want) {
      return { ok: true, status: "filled", reason: "", value: current };
    }

    var listbox = await openEducationDropdown(control);
    if (!listbox) {
      return { ok: false, status: "failed", reason: "Dropdown listbox did not open." };
    }

    var options = collectListboxOptions(listbox);
    var matched = null;
    var i;
    for (i = 0; i < options.length; i += 1) {
      if (monthIndexFromLabel(options[i] && options[i].label) === want) {
        matched = options[i];
        break;
      }
    }
    if (!matched) {
      closeReactSelectMenu(control);
      return { ok: false, status: "skipped", reason: "No compatible education option." };
    }

    if (matched.el && typeof matched.el.click === "function") {
      matched.el.click();
    }
    await sleep(500);

    var selected = "";
    for (var v = 0; v < 10; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && monthIndexFromLabel(selected) === want) break;
      await sleep(60);
    }
    if (!selected || monthIndexFromLabel(selected) !== want) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "", value: selected };
  }

  function findSearchInputNear(control, listbox) {
    var roots = [];
    if (listbox) roots.push(listbox);
    var menu =
      (listbox && listbox.closest && (listbox.closest("[class*='menu']") || listbox.closest("[class*='Menu']"))) ||
      null;
    if (menu) roots.push(menu);
    var root = comboboxRoot(control);
    if (root) roots.push(root);
    if (control && control.parentElement) roots.push(control.parentElement);
    roots.push(document);

    for (var r = 0; r < roots.length; r += 1) {
      var scope = roots[r];
      if (!scope || !scope.querySelectorAll) continue;
      var inputs = scope.querySelectorAll(
        "input[type='text'], input[type='search'], input.select__input, input[role='combobox'], [role='combobox']"
      );
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        if (!input || input.disabled) continue;
        var type = normalizeText(input.type || "");
        if (type === "hidden") continue;
        try {
          var style = global.getComputedStyle ? global.getComputedStyle(input) : null;
          if (style && (style.display === "none" || style.visibility === "hidden")) continue;
        } catch (_) {}
        return input;
      }
    }
    return null;
  }

  function typeIntoSearchInput(input, value) {
    if (!input) return false;
    var next = value == null ? "" : String(value);
    try {
      input.focus();
    } catch (_) {}
    if (!setNativeValue(input, next)) {
      try {
        input.value = next;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  async function selectEducationDropdownOption(control, pickerFn, expectedHint) {
    if (!control) {
      return { ok: false, status: "skipped", reason: "Dropdown control not found." };
    }
    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (current && pickerFn([{ label: current, el: null }])) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var listbox = await openEducationDropdown(control);
    if (!listbox) {
      return { ok: false, status: "failed", reason: "Dropdown listbox did not open." };
    }

    var options = collectListboxOptions(listbox);
    var matched = pickerFn(options);
    if (!matched) {
      closeReactSelectMenu(control);
      return { ok: false, status: "skipped", reason: "No compatible education option." };
    }

    clickElement(matched.el);
    await sleep(500);

    var selected = "";
    for (var v = 0; v < 8; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && pickerFn([{ label: selected, el: null }])) break;
      if (selected && expectedHint && normalizeOptionText(selected).indexOf(normalizeOptionText(expectedHint)) !== -1) {
        break;
      }
      await sleep(50);
    }

    if (!selected || !pickerFn([{ label: selected, el: null }])) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "Verification failed; selected option did not persist." };
    }
    return { ok: true, status: "filled", reason: "", value: selected };
  }

  async function fillSchoolTypeahead(control, schoolName) {
    var saved = trimText(schoolName);
    if (!saved) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (current && (schoolsMatchNormalized(current, saved) || pickSchoolOption([{ label: current }], saved))) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var listbox = await openEducationDropdown(control);
    var searchInput =
      canonicalReactSelectComboboxInput(control) || findSearchInputNear(control, listbox);

    var queries = schoolSearchQueries(saved);
    var matched = null;
    var options = [];

    for (var q = 0; q < queries.length; q += 1) {
      searchInput =
        canonicalReactSelectComboboxInput(control) || findSearchInputNear(control, listbox) || searchInput;
      if (searchInput) {
        typeIntoSearchInput(searchInput, queries[q]);
        await sleep(350);
      }

      listbox = await waitForListboxForControl(control, 12, 80);
      if (!listbox) continue;

      options = collectListboxOptions(listbox);
      matched = pickSchoolOption(options, saved);
      if (matched) break;
    }

    if (!listbox) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "School dropdown listbox did not open." };
    }
    if (!matched) {
      closeReactSelectMenu(control);
      return { ok: false, status: "skipped", reason: "No compatible school option." };
    }

    clickElement(matched.el);
    await sleep(500);

    var selected = "";
    for (var v = 0; v < 8; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && (schoolsMatchNormalized(selected, saved) || pickSchoolOption([{ label: selected }], saved))) {
        break;
      }
      await sleep(50);
    }
    if (!selected || !(schoolsMatchNormalized(selected, saved) || pickSchoolOption([{ label: selected }], saved))) {
      closeReactSelectMenu(control);
      return { ok: false, status: "failed", reason: "Verification failed; selected school did not persist." };
    }
    return { ok: true, status: "filled", reason: "", value: selected };
  }

  async function fillDisciplineTypeahead(control, savedDiscipline) {
    var saved = trimText(savedDiscipline);
    if (!saved) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    if (isComboboxAlreadyFilled(control)) {
      var current = readComboboxSelectedText(control);
      if (current && normalizeText(current) !== "computer" && disciplineOptionMatches(saved, current)) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      if (current && normalizeText(current) !== "computer") {
        return { ok: false, status: "skipped", reason: "Field is already completed." };
      }
    }

    var listbox = await openEducationDropdown(control);
    var searchInput =
      canonicalReactSelectComboboxInput(control) || findSearchInputNear(control, listbox);

    var options = listbox ? collectListboxOptions(listbox) : [];
    var matched = pickDisciplineOption(options, saved);

    if (!matched) {
      searchInput =
        canonicalReactSelectComboboxInput(control) || findSearchInputNear(control, listbox) || searchInput;
      if (searchInput) {
        typeIntoSearchInput(searchInput, saved);
        await sleep(350);
        listbox = await waitForListboxForControl(control, 12, 80);
        if (listbox) {
          options = collectListboxOptions(listbox);
          matched = pickDisciplineOption(options, saved);
        }
      }
    }

    if (!matched && isComputerRelatedDiscipline(saved)) {
      searchInput =
        canonicalReactSelectComboboxInput(control) || findSearchInputNear(control, listbox) || searchInput;
      if (searchInput) {
        typeIntoSearchInput(searchInput, "computer");
        await sleep(350);
        listbox = await waitForListboxForControl(control, 12, 80);
        if (listbox) {
          options = collectListboxOptions(listbox);
          matched = pickDisciplineOption(options, saved);
        }
      }
    }

    function clearDisciplineSearch() {
      if (searchInput) {
        try {
          setNativeValue(searchInput, "");
        } catch (_) {}
      }
      closeReactSelectMenu(control);
    }

    if (
      !matched ||
      !matched.label ||
      normalizeText(matched.label) === "computer" ||
      !disciplineOptionMatches(saved, matched.label)
    ) {
      clearDisciplineSearch();
      return { ok: false, status: "skipped", reason: "No compatible education option." };
    }

    if (matched.el && typeof matched.el.click === "function") {
      matched.el.click();
    }
    await sleep(500);

    var selected = "";
    for (var v = 0; v < 10; v += 1) {
      selected = readComboboxSelectedText(control);
      if (selected && normalizeText(selected) === "computer") {
        await sleep(60);
        continue;
      }
      if (selected && disciplineOptionMatches(saved, selected)) break;
      await sleep(60);
    }
    if (
      !selected ||
      normalizeText(selected) === "computer" ||
      !disciplineOptionMatches(saved, selected)
    ) {
      clearDisciplineSearch();
      return { ok: false, status: "failed", reason: "Verification failed; selected discipline did not persist." };
    }
    return { ok: true, status: "filled", reason: "", value: selected };
  }

  function fillEducationYearInput(el, year) {
    var answer = trimText(year);
    if (!answer) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    if (isFilledValue(readValue(el))) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }
    if (!setNativeValue(el, answer)) {
      return { ok: false, status: "failed", reason: "Could not set field value." };
    }
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    } catch (_) {
      try {
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      } catch (_) {}
    }
    var after = readValue(el);
    if (educationYearFrom(after) !== answer && normalizeText(after) !== normalizeText(answer)) {
      return { ok: false, status: "failed", reason: "Verification failed." };
    }
    return { ok: true, status: "filled", reason: "", value: answer };
  }

  function parseGraduationParts(value) {
    var text = trimText(value);
    var year = educationYearFrom(text);
    var monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ];
    var seasons = {
      spring: ["march", "april", "may"],
      summer: ["june", "july", "august"],
      fall: ["september", "october", "november"],
      autumn: ["september", "october", "november"],
      winter: ["december", "january", "february"]
    };
    var lower = normalizeText(text);
    var month = "";
    var season = "";
    var mi;
    for (mi = 0; mi < monthNames.length; mi += 1) {
      if (lower.indexOf(monthNames[mi]) !== -1) {
        month = monthNames[mi];
        break;
      }
    }
    if (!month) {
      var parsed = af() && typeof af().parseStoredDate === "function" ? af().parseStoredDate(text) : null;
      if (parsed && parsed.m) {
        var idx = parseInt(parsed.m, 10) - 1;
        if (idx >= 0 && idx < 12) month = monthNames[idx];
      }
    }
    Object.keys(seasons).forEach(function (key) {
      if (lower.indexOf(key) !== -1) season = key === "autumn" ? "fall" : key;
    });
    if (!season && month) {
      Object.keys(seasons).forEach(function (key) {
        if (key === "autumn") return;
        if (seasons[key].indexOf(month) !== -1) season = key;
      });
    }
    return { year: year, month: month, season: season, raw: text };
  }

  function expandGraduationMonths(text) {
    var out = normalizeText(text);
    out = out.replace(/\bsept\b/g, "september");
    out = out.replace(/\bsep\b/g, "september");
    out = out.replace(/\bjan\b/g, "january");
    out = out.replace(/\bfeb\b/g, "february");
    out = out.replace(/\bmar\b/g, "march");
    out = out.replace(/\bapr\b/g, "april");
    out = out.replace(/\bjun\b/g, "june");
    out = out.replace(/\bjul\b/g, "july");
    out = out.replace(/\baug\b/g, "august");
    out = out.replace(/\boct\b/g, "october");
    out = out.replace(/\bnov\b/g, "november");
    out = out.replace(/\bdec\b/g, "december");
    return out;
  }

  function graduationMonthNumber(monthName) {
    var names = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ];
    var idx = names.indexOf(normalizeText(monthName));
    return idx >= 0 ? idx + 1 : 0;
  }

  function graduationDateValue(year, month) {
    var y = parseInt(year, 10);
    if (!y) return null;
    var m = parseInt(month, 10);
    if (!m) m = 0;
    return y * 12 + m;
  }

  function parseGraduationYearMonth(text) {
    var expanded = expandGraduationMonths(text);
    var parts = parseGraduationParts(expanded);
    if (!parts.year) return null;
    var month = parts.month ? graduationMonthNumber(parts.month) : 0;
    return {
      year: parseInt(parts.year, 10),
      month: month,
      season: parts.season || "",
      value: graduationDateValue(parts.year, month)
    };
  }

  function optionHasExplicitMonth(text) {
    return /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      expandGraduationMonths(text)
    );
  }

  function optionHasExplicitSeason(text) {
    return /\b(spring|summer|fall|autumn|winter)\b/.test(normalizeText(text));
  }

  function isOpenEndedGraduationLabel(text) {
    var blob = normalizeText(text);
    return (
      /\b(or|and)\s+later\b/.test(blob) ||
      /\bor\s+after\b/.test(blob) ||
      /\bafter\b/.test(blob) ||
      /\bbefore\b/.test(blob) ||
      /\bearlier\s+than\b/.test(blob) ||
      /\b(or|and)\s+earlier\b/.test(blob)
    );
  }

  function parseClosedGraduationRange(label) {
    var text = expandGraduationMonths(label);
    if (isOpenEndedGraduationLabel(text)) return null;
    var bits = text.split(/\s*(?:[-–—]|through|thru|until|\bto\b)\s*/);
    if (bits.length !== 2) return null;
    var start = parseGraduationYearMonth(bits[0]);
    var end = parseGraduationYearMonth(bits[1]);
    if (!start || !end || !start.year || !end.year) return null;
    var startVal = graduationDateValue(start.year, start.month || 1);
    var endVal = graduationDateValue(end.year, end.month || 12);
    if (startVal == null || endVal == null) return null;
    return { start: startVal, end: endVal };
  }

  function openEndedGraduationMatches(label, savedVal) {
    if (savedVal == null) return false;
    var text = expandGraduationMonths(label);
    var bound;
    var boundText;
    if (/\b(or|and)\s+later\b/.test(text) || /\bor\s+after\b/.test(text)) {
      boundText = text.replace(/\b(or|and)\s+later\b[\s\S]*$/, "").replace(/\bor\s+after\b[\s\S]*$/, "");
      bound = parseGraduationYearMonth(boundText);
      if (!bound || !bound.month || bound.value == null) return false;
      return savedVal >= bound.value;
    }
    if (/\bearlier\s+than\b/.test(text)) {
      boundText = text.replace(/^[\s\S]*\bearlier\s+than\b/, "");
      bound = parseGraduationYearMonth(boundText);
      if (!bound || !bound.month || bound.value == null) return false;
      return savedVal < bound.value;
    }
    if (/\bbefore\b/.test(text)) {
      boundText = text.replace(/^[\s\S]*\bbefore\b/, "");
      bound = parseGraduationYearMonth(boundText);
      if (!bound || !bound.month || bound.value == null) return false;
      return savedVal < bound.value;
    }
    if (/\bafter\b/.test(text)) {
      boundText = text.replace(/^[\s\S]*\bafter\b/, "");
      bound = parseGraduationYearMonth(boundText);
      if (!bound || !bound.month || bound.value == null) return false;
      return savedVal > bound.value;
    }
    if (/\b(or|and)\s+earlier\b/.test(text)) {
      boundText = text.replace(/\b(or|and)\s+earlier\b[\s\S]*$/, "");
      bound = parseGraduationYearMonth(boundText);
      if (!bound || !bound.month || bound.value == null) return false;
      return savedVal <= bound.value;
    }
    return false;
  }

  function classifyGraduationOptionMatch(label, saved) {
    var text = trimText(label);
    if (!text || !saved || !saved.year) return "";
    var savedVal = saved.month ? saved.value : null;

    if (isOpenEndedGraduationLabel(text)) {
      if (!saved.month) return "";
      return openEndedGraduationMatches(text, savedVal) ? "open" : "";
    }

    var range = parseClosedGraduationRange(text);
    if (range) {
      if (!saved.month) return "";
      return savedVal >= range.start && savedVal <= range.end ? "closed" : "";
    }

    var opt = parseGraduationYearMonth(text);
    if (!opt || opt.year !== saved.year) return "";

    if (optionHasExplicitMonth(text) && saved.month && opt.month === saved.month) {
      return "exact";
    }
    if (optionHasExplicitSeason(text) && saved.season && opt.season && saved.season === opt.season) {
      return "season";
    }
    if (!optionHasExplicitMonth(text) && !optionHasExplicitSeason(text) && !opt.month && !opt.season) {
      return "year";
    }
    return "";
  }

  function pickAnticipatedGraduationOption(options, savedGraduation) {
    var saved = parseGraduationYearMonth(savedGraduation);
    if (!saved || !saved.year) return null;

    var buckets = {
      exact: [],
      closed: [],
      season: [],
      year: [],
      open: []
    };
    (options || []).forEach(function (opt) {
      var kind = classifyGraduationOptionMatch(opt && opt.label, saved);
      if (kind && buckets[kind]) buckets[kind].push(opt);
    });

    var order = ["exact", "closed", "season", "year", "open"];
    var i;
    for (i = 0; i < order.length; i += 1) {
      var list = buckets[order[i]];
      if (list.length === 1) return list[0];
      if (list.length > 1) return null;
    }
    return null;
  }

  async function fillStandaloneGraduationDropdown(root, inventory, profile, handledElements) {
    var results = [];
    var education = resolvePrimaryEducation(inventory, profile);
    var saved = educationAnswerFor("education_anticipated_graduation", education, inventory);
    if (!trimText(saved)) return results;

    var comboboxes = collectCustomComboboxControls(root);
    var i;
    for (i = 0; i < comboboxes.length; i += 1) {
      var control = comboboxes[i];
      if (wasHandled(handledElements, control)) continue;
      var label = labelForCombobox(control);
      var blob = normalizeText(label);
      if (!/\bgraduation\s+date\b/.test(blob) && !/\banticipated\s+graduation\b/.test(blob)) {
        continue;
      }
      handledElements.push(control);
      var result = await selectEducationDropdownOption(
        control,
        function (opts) {
          return pickAnticipatedGraduationOption(opts, saved);
        },
        saved
      );
      results.push({
        category: "education_anticipated_graduation",
        label: label || "Graduation date",
        status: result.status,
        reason: result.reason || "",
        ok: Boolean(result.ok),
        value: result.ok ? result.value || saved : ""
      });
    }
    return results;
  }

  function parseSavedGpa(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text) return null;
    var match = text.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    var value = Number(match[1]);
    if (!isFinite(value)) return null;
    return value;
  }

  function allGpaNumbers(text) {
    var matches = String(text || "").match(/\d+(?:\.\d+)?/g) || [];
    var values = [];
    var i;
    for (i = 0; i < matches.length; i += 1) {
      var value = Number(matches[i]);
      if (isFinite(value)) values.push(value);
    }
    return values;
  }

  function interpretGpaOption(text) {
    var label = String(text || "").trim();
    if (!label) return null;
    var lower = label.toLowerCase();
    var numbers = allGpaNumbers(label);
    if (!numbers.length) return null;

    var closedMatch = lower.match(
      /(\d+(?:\.\d+)?)\s*(?:-|–|—|to|through)\s*(\d+(?:\.\d+)?)/i
    );
    if (closedMatch) {
      var low = Number(closedMatch[1]);
      var high = Number(closedMatch[2]);
      if (!isFinite(low) || !isFinite(high)) return null;
      return { kind: "closed", min: Math.min(low, high), max: Math.max(low, high) };
    }

    if (
      /(\d+(?:\.\d+)?)\s*\+/.test(label) ||
      /\bor higher\b/.test(lower) ||
      /\band above\b/.test(lower) ||
      /\bor greater\b/.test(lower) ||
      /\bat least\b/.test(lower)
    ) {
      return { kind: "lower", min: numbers[0], inclusive: true };
    }

    if (
      /\bor below\b/.test(lower) ||
      /\band under\b/.test(lower) ||
      /\bor under\b/.test(lower) ||
      /\band below\b/.test(lower)
    ) {
      return { kind: "upper", max: numbers[0], inclusive: true };
    }

    if (
      /\bbelow\b/.test(lower) ||
      /\bunder\b/.test(lower) ||
      /\bless than\b/.test(lower)
    ) {
      return { kind: "upper", max: numbers[0], inclusive: false };
    }

    var outOfFour = lower.match(/^(\d+(?:\.\d+)?)\s+out\s+of\s+4(?:\.0+)?$/);
    if (outOfFour) {
      var exactValue = Number(outOfFour[1]);
      if (!isFinite(exactValue)) return null;
      return { kind: "exact_scale", value: exactValue, scale: 4 };
    }

    if (numbers.length !== 1) return null;
    return { kind: "exact", value: numbers[0] };
  }

  function gpaOptionContains(interpreted, gpa) {
    if (!interpreted || !isFinite(gpa)) return false;
    if (interpreted.kind === "exact") return gpa === interpreted.value;
    if (interpreted.kind === "exact_scale") return gpa === interpreted.value;
    if (interpreted.kind === "closed") {
      return gpa >= interpreted.min && gpa <= interpreted.max;
    }
    if (interpreted.kind === "lower") {
      return interpreted.inclusive ? gpa >= interpreted.min : gpa > interpreted.min;
    }
    if (interpreted.kind === "upper") {
      return interpreted.inclusive ? gpa <= interpreted.max : gpa < interpreted.max;
    }
    return false;
  }

  function pickGpaDropdownOption(options, savedGpa) {
    var gpa = parseSavedGpa(savedGpa);
    if (gpa == null) return null;
    var exact = [];
    var closed = [];
    var bound = [];
    (options || []).forEach(function (opt) {
      var label = trimText(opt && opt.label);
      if (!label) return;
      var interpreted = interpretGpaOption(label);
      if (!interpreted) return;
      if (!gpaOptionContains(interpreted, gpa)) return;
      if (interpreted.kind === "exact" || interpreted.kind === "exact_scale") exact.push(opt);
      else if (interpreted.kind === "closed") closed.push(opt);
      else bound.push(opt);
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    if (closed.length === 1) return closed[0];
    if (closed.length > 1) return null;
    if (bound.length === 1) return bound[0];
    return pickRoundedTenthGpaOption(options, gpa);
  }

  function isOneDecimal(value) {
    if (!isFinite(value)) return false;
    return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
  }

  function pickRoundedTenthGpaOption(options, gpa) {
    if (!isFinite(gpa)) return null;
    var distinct = [];
    var scaleOpts = [];
    (options || []).forEach(function (opt) {
      var label = trimText(opt && opt.label);
      if (!label) return;
      var interpreted = interpretGpaOption(label);
      if (!interpreted || interpreted.kind !== "exact_scale") return;
      if (interpreted.scale !== 4) return;
      if (!isOneDecimal(interpreted.value)) return;
      scaleOpts.push({ opt: opt, value: interpreted.value });
      if (distinct.indexOf(interpreted.value) === -1) distinct.push(interpreted.value);
    });
    if (distinct.length < 5) return null;
    var rounded = Number((Math.round(gpa * 10) / 10).toFixed(1));
    var matches = [];
    var i;
    for (i = 0; i < scaleOpts.length; i += 1) {
      if (Math.abs(scaleOpts[i].value - rounded) < 1e-9) matches.push(scaleOpts[i].opt);
    }
    if (matches.length === 1) return matches[0];
    return null;
  }

  function gpaCategoryForLabel(label) {
    var text = normalizeText(label);
    if (
      /\bundergraduate\b/.test(text) ||
      /\bundergrad\b/.test(text) ||
      /\bbachelor/.test(text)
    ) {
      return "education_gpa_undergraduate";
    }
    if (
      /\bdoctorate\b/.test(text) ||
      /\bdoctoral\b/.test(text) ||
      /\bphd\b/.test(text) ||
      /\bph\.d/.test(text)
    ) {
      return "education_gpa_doctorate";
    }
    if (/\bgraduate\b/.test(text) || /\bmaster/.test(text)) {
      return "education_gpa_graduate";
    }
    return "education_gpa";
  }

  function gpaAnswerForLabel(label, inventory, profile) {
    var category = gpaCategoryForLabel(label);
    var inv = inventory || {};
    if (category === "education_gpa_undergraduate") {
      return trimText(inv.education_gpa_undergraduate || "");
    }
    if (category === "education_gpa_graduate") {
      return trimText(inv.education_gpa_graduate || "");
    }
    if (category === "education_gpa_doctorate") {
      return trimText(inv.education_gpa_doctorate || "");
    }
    var education = resolvePrimaryEducation(inv, profile);
    if (education && education.gpa) return String(education.gpa).trim();
    return trimText(inv.education_gpa || "");
  }

  function looksLikeGpaQuestion(label) {
    var blob = normalizeText(label);
    return /\bgpa\b/.test(blob) || blob.indexOf("grade point average") !== -1;
  }

  function isGpaCategory(category) {
    return (
      category === "education_gpa" ||
      category === "education_gpa_undergraduate" ||
      category === "education_gpa_graduate" ||
      category === "education_gpa_doctorate"
    );
  }

  function gpaSelectRoot(node) {
    if (!node) return null;
    if (node.closest) {
      var scoped =
        node.closest(".select__container") ||
        node.closest("[class*='select__container']") ||
        node.closest("[class*='select-container']");
      if (scoped) return scoped;
    }
    return comboboxRoot(node) || node;
  }

  function canonicalGpaComboboxInput(node) {
    if (!node) return null;
    var root = gpaSelectRoot(node) || node;
    var input = null;
    if (root && root.querySelector) {
      input =
        root.querySelector("input[role='combobox'].select__input") ||
        root.querySelector("input.select__input[role='combobox']") ||
        root.querySelector("input[role='combobox']");
    }
    if (input) return input;
    if (node.matches && node.matches("input[role='combobox']")) return node;
    if (node.getAttribute && node.getAttribute("role") === "combobox") return node;
    return node;
  }

  function findGpaDropdownIndicatorSvg(root) {
    if (!root || !root.querySelector) return null;
    var svg =
      root.querySelector("[class*='dropdown-indicator'] svg") ||
      root.querySelector("[class*='DropdownIndicator'] svg");
    if (svg) return svg;
    var control =
      root.querySelector("[class*='select__control']") ||
      root.querySelector("[class*='Select-control']");
    if (!control || !control.querySelector) return null;
    svg =
      control.querySelector("[class*='dropdown-indicator'] svg") ||
      control.querySelector("[class*='DropdownIndicator'] svg");
    if (svg) return svg;
    var indicators =
      control.querySelector("[class*='select__indicators']") ||
      control.querySelector("[class*='IndicatorsContainer']") ||
      control.querySelector("[class*='indicatorContainer']");
    if (indicators && indicators.querySelector) {
      svg = indicators.querySelector("svg");
      if (svg) return svg;
    }
    return null;
  }

  function dispatchGpaIndicatorMouseSequence(svg) {
    if (!svg) return false;
    var opts = { bubbles: true, cancelable: true, view: global, button: 0 };
    try {
      svg.dispatchEvent(new MouseEvent("mousedown", opts));
      svg.dispatchEvent(new MouseEvent("mouseup", opts));
      svg.dispatchEvent(new MouseEvent("click", opts));
      return true;
    } catch (_) {
      return false;
    }
  }

  function findReactSelectGpaListbox(comboInput) {
    var id = trimText(comboInput && comboInput.id);
    if (!id) return null;
    var box = document.getElementById("react-select-" + id + "-listbox");
    if (!box) return null;
    if (!isListboxOpen(box)) return null;
    if (!(box.querySelectorAll("[role='option']") || []).length) return null;
    return box;
  }

  async function pollGpaListbox(control) {
    return waitForListboxForControl(control, 10, 60);
  }

  async function selectGpaDropdownOption(control, savedGpa) {
    if (!control) {
      return { ok: false, status: "skipped", reason: "Dropdown control not found." };
    }
    var saved = String(savedGpa == null ? "" : savedGpa).trim();
    if (!saved || parseSavedGpa(saved) == null) {
      return { ok: false, status: "skipped", reason: "No saved GPA for this education level." };
    }

    var comboInput = canonicalGpaComboboxInput(control) || control;
    var selectRoot = gpaSelectRoot(comboInput) || gpaSelectRoot(control) || comboInput;

    function liveControl() {
      var id = trimText((comboInput && comboInput.id) || (control && control.id));
      if (id) {
        var byId = document.getElementById(id);
        if (byId) return byId;
      }
      return comboInput || control;
    }

    var currentControl = liveControl();
    if (isComboboxAlreadyFilled(currentControl)) {
      var current = readComboboxSelectedText(currentControl);
      if (current && pickGpaDropdownOption([{ label: current }], saved)) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var indicatorSvg = findGpaDropdownIndicatorSvg(selectRoot);
    var listbox = null;

    if (indicatorSvg) {
      try {
        if (comboInput && typeof comboInput.focus === "function") comboInput.focus();
      } catch (_) {}
      dispatchGpaIndicatorMouseSequence(indicatorSvg);
      await sleep(80);
      listbox = await pollGpaListbox(liveControl());
    }

    if (!listbox) {
      var clickTarget =
        (selectRoot &&
          selectRoot.querySelector &&
          (selectRoot.querySelector("[class*='select__control']") ||
            selectRoot.querySelector("[class*='Select-control']"))) ||
        currentControl;
      try {
        if (comboInput && typeof comboInput.focus === "function") comboInput.focus();
      } catch (_) {}
      try {
        clickTarget.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            view: global,
            button: 0
          })
        );
      } catch (_) {}
      await sleep(80);
      listbox = await pollGpaListbox(liveControl());
    }

    if (!listbox) {
      try {
        if (comboInput) {
          comboInput.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "ArrowDown",
              code: "ArrowDown",
              keyCode: 40,
              which: 40,
              bubbles: true,
              cancelable: true
            })
          );
        }
      } catch (_) {}
      await sleep(80);
      listbox = await pollGpaListbox(liveControl());
    }

    if (!listbox) {
      try {
        if (typeof currentControl.click === "function") currentControl.click();
      } catch (_) {}
      await sleep(80);
      listbox = await pollGpaListbox(liveControl());
    }

    if (!listbox) {
      return { ok: false, status: "failed", reason: "Dropdown listbox did not open." };
    }

    var options = collectListboxOptions(listbox);
    var matched = pickGpaDropdownOption(options, saved);
    if (!matched) {
      try {
        if (comboInput) {
          comboInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
      } catch (_) {}
      return { ok: false, status: "skipped", reason: "No compatible GPA option." };
    }

    if (matched.el && typeof matched.el.click === "function") {
      matched.el.click();
    }
    await sleep(500);

    var selected = "";
    var v;
    for (v = 0; v < 10; v += 1) {
      currentControl = liveControl();
      selected = readComboboxSelectedText(currentControl);
      if (selected && pickGpaDropdownOption([{ label: selected }], saved)) break;
      if (selected && matched && normalizeText(selected) === normalizeText(matched.label)) break;
      await sleep(60);
    }

    if (
      !selected ||
      !(
        pickGpaDropdownOption([{ label: selected }], saved) ||
        (matched && normalizeText(selected) === normalizeText(matched.label))
      )
    ) {
      closeReactSelectMenu(currentControl || comboInput || control);
      return { ok: false, status: "failed", reason: "Verification failed; selected option did not persist." };
    }
    return { ok: true, status: "filled", reason: "", value: selected };
  }

  async function fillStandaloneGpaDropdown(root, inventory, profile, handledElements) {
    var results = [];
    var comboboxes = collectCustomComboboxControls(root);
    var seenInputs = [];
    var seenIds = {};
    var i;
    for (i = 0; i < comboboxes.length; i += 1) {
      var control = comboboxes[i];
      var comboInput = canonicalGpaComboboxInput(control) || control;
      if (wasHandled(handledElements, control) || wasHandled(handledElements, comboInput)) continue;
      if (seenInputs.indexOf(comboInput) !== -1) continue;
      var inputId = trimText(comboInput && comboInput.id);
      if (inputId && seenIds[inputId]) continue;
      var label = labelForCombobox(comboInput) || labelForCombobox(control);
      if (!looksLikeGpaQuestion(label)) continue;
      seenInputs.push(comboInput);
      if (inputId) seenIds[inputId] = true;
      markHandled(handledElements, control);
      markHandled(handledElements, comboInput);
      var category = gpaCategoryForLabel(label);
      var saved = gpaAnswerForLabel(label, inventory, profile);
      if (!saved || parseSavedGpa(saved) == null) {
        results.push({
          category: category,
          label: label || "GPA",
          status: "skipped",
          reason: "No saved GPA for this education level.",
          ok: false,
          value: ""
        });
        continue;
      }
      var result = await selectGpaDropdownOption(comboInput, saved);
      results.push({
        category: category,
        label: label || "GPA",
        status: result.status,
        reason: result.reason || "",
        ok: Boolean(result.ok),
        value: result.ok ? result.value || saved : ""
      });
    }
    return results;
  }

  function isStandaloneGpaTextControl(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag !== "input" && tag !== "textarea") return false;
    var type = normalizeText(el.type || "");
    if (
      type === "hidden" ||
      type === "file" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "button" ||
      type === "submit" ||
      type === "image" ||
      type === "reset"
    ) {
      return false;
    }
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    if (role === "combobox" || role === "listbox") return false;
    var cls = String((el.className && el.className.baseVal) || el.className || "").toLowerCase();
    if (cls.indexOf("select__") !== -1 || cls.indexOf("select-") !== -1) return false;
    if (el.closest) {
      if (el.closest("[role='combobox']")) return false;
      if (el.closest("[class*='select__control']") || el.closest("[class*='Select-control']")) return false;
      if (el.closest("[class*='select__container']") || el.closest("[class*='select-container']")) return false;
    }
    return true;
  }

  function fillStandaloneGpaTextFields(root, inventory, profile, handledElements) {
    var results = [];
    var doc = root || document;
    var nodes = [];
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("input, textarea"), function (el) {
        nodes.push(el);
      });
    } catch (_) {}
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (wasHandled(handledElements, el)) continue;
      if (!isStandaloneGpaTextControl(el)) continue;
      var meta = fieldMeta(el);
      var own = normalizeText([meta.label, meta.ariaLabel].join(" "));
      var detected = classifyField(el);
      var label = meta.label || meta.ariaLabel || "GPA";
      if (
        !looksLikeGpaQuestion(own) &&
        !looksLikeGpaQuestion(label) &&
        !isGpaCategory(detected && detected.category)
      ) {
        continue;
      }
      var category = gpaCategoryForLabel(label);
      var saved = gpaAnswerForLabel(label, inventory, profile);
      markHandled(handledElements, el);
      if (!saved || parseSavedGpa(saved) == null) {
        results.push({
          category: category,
          label: label,
          status: "skipped",
          reason: "No saved GPA for this education level.",
          ok: false,
          value: ""
        });
        continue;
      }
      var parsedGpa = parseSavedGpa(saved);
      var written = String(parsedGpa);
      var current = readValue(el);
      if (isFilledValue(current)) {
        var currentParsed = parseSavedGpa(current);
        if (currentParsed != null && currentParsed === parsedGpa) {
          results.push({
            category: category,
            label: label,
            status: "filled",
            reason: "",
            ok: true,
            value: current
          });
        } else {
          results.push({
            category: category,
            label: label,
            status: "skipped",
            reason: "Field is already completed.",
            ok: false,
            value: ""
          });
        }
        continue;
      }
      if (!setNativeValue(el, written)) {
        results.push({
          category: category,
          label: label,
          status: "failed",
          reason: "Could not set field value.",
          ok: false,
          value: ""
        });
        continue;
      }
      var after = parseSavedGpa(readValue(el));
      if (after == null || after !== parsedGpa) {
        results.push({
          category: category,
          label: label,
          status: "failed",
          reason: "Verification failed.",
          ok: false,
          value: ""
        });
        continue;
      }
      results.push({
        category: category,
        label: label,
        status: "filled",
        reason: "",
        ok: true,
        value: written
      });
    }
    return results;
  }

  function educationAnswerFor(kind, education, inventory) {
    if (!education && inventory) {
      if (kind === "education_school") return trimText(inventory.education_school || "");
      if (kind === "education_degree") return trimText(inventory.education_degree || "");
      if (kind === "education_discipline") return trimText(inventory.education_discipline || "");
      if (kind === "education_start_year") return trimText(inventory.education_start_year || "");
      if (kind === "education_end_year") return trimText(inventory.education_end_year || "");
      if (kind === "education_start_month") return trimText(inventory.education_start_month || "");
      if (kind === "education_end_month") return trimText(inventory.education_end_month || "");
      if (kind === "education_anticipated_graduation") {
        return trimText(inventory.education_anticipated_graduation || "");
      }
    }
    var row = education || {};
    if (kind === "education_school") return trimText(row.institution || "");
    if (kind === "education_degree") return trimText(row.degree || "");
    if (kind === "education_discipline") return trimText(row.field || "");
    if (kind === "education_start_year") return educationYearFrom(row.startDate);
    if (kind === "education_end_year") return educationYearFrom(row.endDate);
    if (kind === "education_start_month") return educationMonthFrom(row.startDate);
    if (kind === "education_end_month") return educationMonthFrom(row.endDate);
    if (kind === "education_anticipated_graduation") return trimText(row.endDate || "");
    return "";
  }

  function findEducationControls(root) {
    var doc = root || document;
    var found = [];
    var seen = [];

    function remember(kind, node, label) {
      if (!node || !kind || seen.indexOf(node) !== -1) return;
      seen.push(node);
      found.push({ kind: kind, node: node, label: label || kind });
    }

    collectCustomComboboxControls(doc).forEach(function (control) {
      var label = labelForCombobox(control);
      var kind = classifyEducationField(label + " " + (control.getAttribute("aria-label") || ""));
      if (kind) remember(kind, control, label || kind);
    });

    collectFields(doc).forEach(function (el) {
      var meta = fieldMeta(el);
      var label = meta.label || meta.name || meta.id || "";
      var cue = [label, meta.ariaLabel, meta.name, meta.id, meta.placeholder].join(" ");
      if (isExcludedEducationQuestion(cue)) return;
      var kind = classifyEducationField(cue);
      if (!kind && looksLikeEducationDateField(cue)) {
        var cueText = normalizeText(cue);
        if (/\bmonth\b/.test(cueText)) {
          if (/\bstart\b/.test(cueText)) kind = "education_start_month";
          else if (/\bend\b/.test(cueText)) kind = "education_end_month";
        } else if (/\bstart\b/.test(cueText)) kind = "education_start_year";
        else if (/\bend\b/.test(cueText)) kind = "education_end_year";
        else if (/\banticipated\b/.test(cueText)) kind = "education_anticipated_graduation";
      }
      if (!kind) return;
      // Prefer combobox already captured for the same kind near this field.
      var nearbyControl = findComboboxControl(fieldContainer(el) || el);
      if (
        nearbyControl &&
        (kind === "education_school" ||
          kind === "education_degree" ||
          kind === "education_discipline" ||
          kind === "education_anticipated_graduation" ||
          kind === "education_start_month" ||
          kind === "education_end_month")
      ) {
        remember(kind, nearbyControl, label || kind);
        if (seen.indexOf(el) === -1) seen.push(el);
        return;
      }
      remember(kind, el, label || kind);
    });

    return found;
  }

  function compareDocumentOrder(a, b) {
    if (!a || !b || a === b) return 0;
    var pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function isBetweenDocumentNodes(start, node, end) {
    if (!start || !node) return false;
    if (compareDocumentOrder(start, node) > 0) return false;
    if (end && compareDocumentOrder(node, end) >= 0) return false;
    return true;
  }

  function countEducationKindsIn(container) {
    if (!container) return 0;
    var kinds = {};
    findEducationControls(container).forEach(function (item) {
      if (item && item.kind) kinds[item.kind] = true;
    });
    return Object.keys(kinds).length;
  }

  function findEducationBlockContainer(schoolNode, nextSchoolNode) {
    if (!schoolNode) return null;
    var el = schoolNode;
    for (var depth = 0; depth < 10 && el; depth += 1) {
      var cls = String((el.className && el.className.baseVal) || el.className || "").toLowerCase();
      var testid = normalizeText((el.getAttribute && el.getAttribute("data-testid")) || "");
      var role = normalizeText((el.getAttribute && el.getAttribute("role")) || "");
      var hint = cls + " " + testid + " " + role;
      if (
        (/\beducation\b/.test(hint) ||
          /\brepeat/.test(hint) ||
          /\bfieldset\b/.test(hint) ||
          (el.tagName || "").toLowerCase() === "fieldset") &&
        countEducationKindsIn(el) >= 2
      ) {
        if (!nextSchoolNode || !el.contains(nextSchoolNode)) return el;
      }
      el = el.parentElement;
    }
    return (
      schoolNode.closest("fieldset") ||
      schoolNode.closest("[class*='education']") ||
      fieldContainer(schoolNode) ||
      schoolNode.parentElement
    );
  }

  function indexEducationFields(items) {
    var fields = {};
    (items || []).forEach(function (item) {
      if (!item || !item.kind || !item.node) return;
      if (!fields[item.kind]) fields[item.kind] = item;
    });
    return fields;
  }

  function getEducationBlocks(root) {
    var doc = root || document;
    var pageControls = findEducationControls(doc);
    var schools = pageControls.filter(function (item) {
      return item.kind === "education_school";
    });

    if (!schools.length) {
      if (!pageControls.length) return [];
      return [
        {
          index: 0,
          root: fieldContainer(pageControls[0].node) || doc,
          fields: indexEducationFields(pageControls)
        }
      ];
    }

    var blocks = [];
    for (var i = 0; i < schools.length; i += 1) {
      var school = schools[i];
      var nextSchool = schools[i + 1] || null;
      var container = findEducationBlockContainer(school.node, nextSchool && nextSchool.node);
      var inContainer = pageControls.filter(function (item) {
        if (!item || !item.node) return false;
        if (item.node === school.node) return true;
        if (container && container.contains(item.node)) {
          // Keep fields for this school only — exclude the next school's controls.
          if (nextSchool && nextSchool.node && container.contains(nextSchool.node)) {
            return isBetweenDocumentNodes(school.node, item.node, nextSchool.node);
          }
          return true;
        }
        return isBetweenDocumentNodes(school.node, item.node, nextSchool && nextSchool.node);
      });
      var fields = indexEducationFields(inContainer);
      fields.education_school = school;
      blocks.push({
        index: i,
        root: container || school.node,
        fields: fields
      });
    }
    return blocks;
  }

  function getNearbySectionContext(node) {
    if (!node) return "";
    var parts = [];
    var el = node;
    for (var depth = 0; depth < 6 && el; depth += 1) {
      var heading = el.querySelector && el.querySelector("h1, h2, h3, h4, legend, [class*='heading'], label");
      if (heading) parts.push(visibleText(heading) || trimText(heading.textContent || ""));
      var aria = trimText(el.getAttribute && el.getAttribute("aria-label"));
      if (aria) parts.push(aria);
      el = el.parentElement;
    }
    var prev = node.previousElementSibling;
    for (var p = 0; p < 3 && prev; p += 1) {
      parts.push(visibleText(prev) || trimText(prev.textContent || ""));
      prev = prev.previousElementSibling;
    }
    return parts.join(" ");
  }

  function climbToEducationSection(fromNode, root) {
    var el = fromNode;
    var scope = root || document;
    while (el && el !== scope) {
      var context = normalizeText(getNearbySectionContext(el) + " " + (el.innerText || "").slice(0, 240));
      if (/\beducation\b/.test(context)) {
        var addBtn = el.querySelector && el.querySelector("button, a, [role='button']");
        if (addBtn || countEducationKindsIn(el) >= 2) return el;
      }
      el = el.parentElement;
    }
    return scope;
  }

  function findEducationAddAnotherButton(root) {
    var blocks = getEducationBlocks(root);
    var section =
      blocks.length && blocks[0].root ? climbToEducationSection(blocks[0].root, root || document) : root || document;
    var educationContainer =
      blocks.length &&
      blocks[0].root &&
      blocks[0].root.closest
        ? blocks[0].root.closest(".education--container")
        : null;
    if (educationContainer) {
      section = educationContainer;
    }
    var buttons = section.querySelectorAll("button, a, [role='button']");
    var best = null;
    var bestScore = 0;

    Array.prototype.forEach.call(buttons, function (btn) {
      if (!btn || btn.disabled) return;
      var text = normalizeText(
        (btn.innerText || btn.textContent || btn.getAttribute("aria-label") || btn.getAttribute("title") || "")
          .replace(/\s+/g, " ")
          .trim()
      );
      if (!text) return;
      var isAddAnother = /\badd\s+another\b/.test(text);
      var isAddEducation = /\badd\s+education\b/.test(text) || /\badd\s+another\s+education\b/.test(text);
      if (!isAddAnother && !isAddEducation && text !== "add") return;

      var context = normalizeText(getNearbySectionContext(btn));
      var otherSection =
        /\b(experience|employment|work\s+history|work\s+experience|project|certification|website|social|link)\b/.test(
          context
        ) && !/\beducation\b/.test(context);
      if (otherSection) return;

      var score = 0;
      if (isAddEducation) score += 70;
      if (isAddAnother) score += 50;
      if (text === "add") score += 10;
      if (/\beducation\b/.test(context)) score += 40;
      if (blocks.length) {
        var lastRoot = blocks[blocks.length - 1].root;
        if (lastRoot) {
          if (lastRoot.contains(btn)) score += 25;
          else if (compareDocumentOrder(lastRoot, btn) < 0) score += 20;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = btn;
      }
    });

    // Require education association (or explicit add education) so we never click unrelated Add another.
    return bestScore >= 40 ? best : null;
  }

  function waitForDomCondition(checkFn, timeoutMs) {
    var timeout = typeof timeoutMs === "number" ? timeoutMs : 4000;
    return new Promise(function (resolve) {
      if (checkFn()) {
        resolve(true);
        return;
      }
      var settled = false;
      var observer = null;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        resolve(Boolean(checkFn()));
      }, timeout);
      try {
        observer = new MutationObserver(function () {
          if (settled) return;
          if (checkFn()) {
            settled = true;
            clearTimeout(timer);
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true
        });
      } catch (_) {
        // Fall back to polling below.
      }
      var poll = setInterval(function () {
        if (settled) {
          clearInterval(poll);
          return;
        }
        if (checkFn()) {
          settled = true;
          clearTimeout(timer);
          clearInterval(poll);
          if (observer) observer.disconnect();
          resolve(true);
        }
      }, 120);
    });
  }

  async function ensureEducationBlockCount(root, needed) {
    var want = Math.max(0, needed || 0);
    if (!want) return getEducationBlocks(root);

    var clicks = 0;
    var maxClicks = want;
    var blocks = getEducationBlocks(root);

    while (blocks.length < want && clicks < maxClicks) {
      var before = blocks.length;
      var addBtn = findEducationAddAnotherButton(root);
      if (!addBtn) break;
      clickElement(addBtn);
      clicks += 1;
      await waitForDomCondition(function () {
        return getEducationBlocks(root).length > before;
      }, 4500);
      blocks = getEducationBlocks(root);
      if (blocks.length <= before) break;
    }

    return getEducationBlocks(root);
  }

  function readEducationBlockValues(block) {
    var fields = (block && block.fields) || {};
    function readField(kind) {
      var item = fields[kind];
      if (!item || !item.node) return "";
      var control = findComboboxControl(item.node) || item.node;
      return (
        trimText(readComboboxSelectedText(control) || "") ||
        trimText(readValue(control) || "") ||
        trimText(readValue(item.node) || "")
      );
    }
    return {
      school: readField("education_school"),
      degree: readField("education_degree"),
      discipline: readField("education_discipline"),
      startYear: readField("education_start_year"),
      endYear: readField("education_end_year")
    };
  }

  function educationBlockMatchesRecord(block, record) {
    if (!block || !record) return false;
    var values = readEducationBlockValues(block);
    var school = trimText(values.school);
    var degree = trimText(values.degree);
    var discipline = trimText(values.discipline);
    if (!school && !degree && !discipline) return false;

    var schoolOk =
      !school ||
      !record.institution ||
      schoolsMatchNormalized(school, record.institution) ||
      Boolean(pickSchoolOption([{ label: school }], record.institution));
    var degreeOk =
      !degree ||
      !record.degree ||
      degreeOptionMatches(record.degree, degree) ||
      degreesMatchNormalized(degree, degreeTargetLabel(record.degree));
    var disciplineOk =
      !discipline || !record.field || disciplineOptionMatches(record.field, discipline);

    if (school && record.institution && schoolOk) {
      // School match is enough to treat the block as this record (avoid duplicate Add another).
      if ((!degree || degreeOk) && (!discipline || disciplineOk)) return true;
    }
    if (degree && discipline && degreeOk && disciplineOk && (!school || schoolOk)) return true;
    return false;
  }

  function educationBlockLooksFilled(block) {
    var values = readEducationBlockValues(block);
    return Boolean(values.school || values.degree || values.discipline);
  }

  function assignEducationBlocks(blocks, records) {
    var assignments = [];
    var usedBlocks = {};
    var usedRecords = {};

    // Preserve already-filled blocks that match a saved record.
    for (var b = 0; b < blocks.length; b += 1) {
      for (var r = 0; r < records.length; r += 1) {
        if (usedRecords[r]) continue;
        if (!educationBlockMatchesRecord(blocks[b], records[r])) continue;
        usedBlocks[b] = true;
        usedRecords[r] = true;
        assignments.push({
          blockIndex: b,
          recordIndex: r,
          block: blocks[b],
          record: records[r],
          alreadyMatched: true
        });
        break;
      }
    }

    // Assign remaining records to remaining blocks in stored order.
    for (var ri = 0; ri < records.length; ri += 1) {
      if (usedRecords[ri]) continue;
      var blockIndex = -1;
      for (var bi = 0; bi < blocks.length; bi += 1) {
        if (usedBlocks[bi]) continue;
        blockIndex = bi;
        break;
      }
      if (blockIndex === -1) break;
      usedBlocks[blockIndex] = true;
      usedRecords[ri] = true;
      assignments.push({
        blockIndex: blockIndex,
        recordIndex: ri,
        block: blocks[blockIndex],
        record: records[ri],
        alreadyMatched: false
      });
    }

    return {
      assignments: assignments,
      unmatchedRecordIndexes: records
        .map(function (_, idx) {
          return idx;
        })
        .filter(function (idx) {
          return !usedRecords[idx];
        })
    };
  }

  async function fillSingleEducationField(kind, node, record, inventory, handledElements) {
    if (!node || !kind) {
      return { ok: false, status: "skipped", reason: "Field not found.", value: "" };
    }
    if (wasHandled(handledElements, node)) {
      return { ok: false, status: "skipped", reason: "Field already handled.", value: "" };
    }

    var answer = educationAnswerFor(kind, record, inventory || {});
    markHandled(handledElements, node);
    var control = findComboboxControl(node) || node;
    markHandled(handledElements, control);

    if (!trimText(answer)) {
      // Missing dates/values: leave unchanged, do not fail.
      return { ok: false, status: "skipped", reason: "No saved answer.", value: "" };
    }

    // Skip re-fill when the visible value already matches this record.
    var current =
      trimText(readComboboxSelectedText(control) || "") || trimText(readValue(control) || "");
    if (current) {
      if (kind === "education_school" && (schoolsMatchNormalized(current, answer) || pickSchoolOption([{ label: current }], answer))) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      if (kind === "education_degree" && degreeOptionMatches(answer, current)) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      if (kind === "education_discipline" && disciplineOptionMatches(answer, current)) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      if (
        (kind === "education_start_year" || kind === "education_end_year") &&
        educationYearFrom(current) === educationYearFrom(answer)
      ) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
      if (
        (kind === "education_start_month" || kind === "education_end_month") &&
        pickMonthOption([{ label: current }], answer)
      ) {
        return { ok: true, status: "filled", reason: "", value: current };
      }
    }

    var tag = (node.tagName || "").toLowerCase();
    var result = null;

    if (kind === "education_start_year" || kind === "education_end_year") {
      if (tag === "input" || tag === "textarea") {
        result = fillEducationYearInput(node, answer);
      } else {
        result = await selectEducationDropdownOption(
          control,
          function (options) {
            return pickYearOption(options, answer);
          },
          answer
        );
      }
    } else if (kind === "education_start_month" || kind === "education_end_month") {
      result = await fillEducationMonthDropdown(control, answer);
    } else if (kind === "education_school") {
      result = await fillSchoolTypeahead(control, answer);
    } else if (kind === "education_degree") {
      var degreeTarget = degreeTargetLabel(answer);
      result = await selectCustomDropdownOption(
        control,
        function (optionLabel) {
          return degreeOptionMatches(answer, optionLabel);
        },
        degreeTarget,
        { educationDropdown: true }
      );
      if (result && result.ok) {
        var visibleDegree = trimText(result.value || "");
        if (!degreesMatchNormalized(visibleDegree, degreeTarget)) {
          result = {
            ok: false,
            status: "failed",
            reason: "Verification failed; selected degree did not persist.",
            value: ""
          };
        }
      } else if (result && /no matching dropdown option/i.test(result.reason || "")) {
        result = { ok: false, status: "skipped", reason: "No compatible education option.", value: "" };
      }
    } else if (kind === "education_discipline") {
      result = await fillDisciplineTypeahead(control, answer);
    } else if (kind === "education_anticipated_graduation") {
      result = await selectEducationDropdownOption(
        control,
        function (options) {
          return pickAnticipatedGraduationOption(options, answer);
        },
        answer
      );
      if (result && result.status === "failed" && /no compatible/i.test(result.reason || "")) {
        result = { ok: false, status: "skipped", reason: "No compatible education option.", value: "" };
      }
    }

    if (!result) {
      return { ok: false, status: "skipped", reason: "Unsupported education control.", value: "" };
    }

    if (
      !result.ok &&
      result.status === "failed" &&
      (/no compatible/i.test(result.reason || "") || /no saved/i.test(result.reason || ""))
    ) {
      return {
        ok: false,
        status: "skipped",
        reason: result.reason || "No compatible education option.",
        value: ""
      };
    }

    // Blur and confirm school/degree/discipline still persist.
    if (result.ok && (kind === "education_school" || kind === "education_degree" || kind === "education_discipline")) {
      try {
        control.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      } catch (_) {
        try {
          control.dispatchEvent(new Event("blur", { bubbles: true }));
        } catch (_) {}
      }
      await sleep(80);
      var after =
        trimText(readComboboxSelectedText(control) || "") || trimText(readValue(control) || "");
      if (!after) {
        return {
          ok: false,
          status: "failed",
          reason: "Verification failed; selected value did not persist after blur.",
          value: ""
        };
      }
      result.value = after;
    }

    return {
      ok: Boolean(result.ok),
      status: result.status,
      reason: result.reason || "",
      value: result.ok ? result.value || answer : ""
    };
  }

  async function fillOneEducationBlock(block, record, educationIndex, inventory, handledElements) {
    var kinds = [
      "education_school",
      "education_degree",
      "education_discipline",
      "education_start_month",
      "education_start_year",
      "education_end_month",
      "education_end_year"
    ];
    var filledFields = [];
    var skippedFields = [];
    var failedFields = [];
    var fieldResults = [];
    var fields = (block && block.fields) || {};

    for (var i = 0; i < kinds.length; i += 1) {
      var kind = kinds[i];
      var liveBlocks = getEducationBlocks(document);
      var liveIndex = block && typeof block.index === "number" ? block.index : educationIndex;
      var liveBlock = (liveBlocks && liveBlocks[liveIndex]) || block;
      var liveFields = (liveBlock && liveBlock.fields) || {};
      var item = liveFields[kind] || fields[kind];
      if (!item || !item.node) {
        skippedFields.push(kind);
        continue;
      }
      var result = await fillSingleEducationField(kind, item.node, record, inventory, handledElements);
      fieldResults.push({
        category: kind,
        label: item.label || kind,
        status: result.status,
        reason: result.reason || "",
        ok: Boolean(result.ok),
        value: result.ok ? result.value || "" : "",
        educationIndex: educationIndex
      });
      if (result.ok && result.status === "filled") filledFields.push(kind);
      else if (result.status === "failed") failedFields.push(kind);
      else skippedFields.push(kind);
    }

    var values = readEducationBlockValues(
      (getEducationBlocks(document)[(block && typeof block.index === "number" ? block.index : educationIndex)] || block)
    );
    var schoolOk =
      !record.institution ||
      (values.school &&
        (schoolsMatchNormalized(values.school, record.institution) ||
          Boolean(pickSchoolOption([{ label: values.school }], record.institution))));
    var degreeOk =
      !record.degree ||
      (values.degree && degreeOptionMatches(record.degree, values.degree));
    var disciplineOk =
      !record.field ||
      (values.discipline && disciplineOptionMatches(record.field, values.discipline));
    var success = Boolean(schoolOk && degreeOk && disciplineOk && failedFields.length === 0);
    var reason = "";
    if (!success) {
      if (failedFields.length) reason = "One or more education fields failed verification.";
      else if (!schoolOk) reason = "School did not match the saved education record.";
      else if (!degreeOk) reason = "Degree did not match the saved education record.";
      else if (!disciplineOk) reason = "Discipline did not match the saved education record.";
      else reason = "Education block incomplete.";
    }

    return {
      entry: {
        educationIndex: educationIndex,
        school: record.institution || values.school || "",
        success: success,
        filledFields: filledFields,
        skippedFields: skippedFields,
        failedFields: failedFields,
        reason: reason
      },
      fieldResults: fieldResults
    };
  }

  async function fillEducationFields(root, inventory, profile, handledElements) {
    var records = resolveEducationRecords(inventory, profile);
    var results = [];

    if (!records.length) {
      // Preserve prior single-entry path when only inventory primary answers exist.
      var primary = resolvePrimaryEducation(inventory, profile);
      if (!primary) return results;
      records = [primary];
    }

    var blocks = await ensureEducationBlockCount(root, records.length);
    if (blocks.length < records.length) {
      // Try one more ensure pass after a short wait (late-rendered Add another).
      await sleep(250);
      blocks = await ensureEducationBlockCount(root, records.length);
    }

    var assignment = assignEducationBlocks(blocks, records);
    var entryResults = [];

    for (var a = 0; a < assignment.assignments.length; a += 1) {
      var map = assignment.assignments[a];
      // Refresh block fields in case Add another re-rendered the DOM.
      var liveBlocks = getEducationBlocks(root);
      var liveBlock = liveBlocks[map.blockIndex] || map.block;
      var filled = await fillOneEducationBlock(
        liveBlock,
        map.record,
        map.recordIndex,
        inventory,
        handledElements
      );
      entryResults.push(filled.entry);
      for (var fr = 0; fr < filled.fieldResults.length; fr += 1) {
        results.push(filled.fieldResults[fr]);
      }
    }

    for (var u = 0; u < assignment.unmatchedRecordIndexes.length; u += 1) {
      var idx = assignment.unmatchedRecordIndexes[u];
      var unmatched = records[idx];
      entryResults.push({
        educationIndex: idx,
        school: (unmatched && unmatched.institution) || "",
        success: false,
        filledFields: [],
        skippedFields: [
          "education_school",
          "education_degree",
          "education_discipline",
          "education_start_month",
          "education_start_year",
          "education_end_month",
          "education_end_year"
        ],
        failedFields: [],
        reason: "No Education block available for this saved record."
      });
    }

    var finalBlocks = getEducationBlocks(root);
    var allMatched =
      entryResults.length === records.length &&
      entryResults.every(function (entry) {
        return entry && entry.success;
      }) &&
      finalBlocks.length >= records.length;

    results.push({
      category: "education_entries",
      label: "Education",
      status: allMatched ? "filled" : entryResults.some(function (e) { return e.success; }) ? "skipped" : "failed",
      ok: allMatched,
      reason: allMatched
        ? ""
        : "Not all saved education records have their own correctly matched Education blocks.",
      value: String(finalBlocks.length),
      educationEntries: entryResults,
      educationBlockCount: finalBlocks.length,
      educationRecordCount: records.length
    });

    // Mark any leftover education controls handled so the generic path does not double-fill.
    findEducationControls(root).forEach(function (item) {
      if (item && item.node) markHandled(handledElements, item.node);
    });

    return results;
  }

  function looksLikeLocationCityField(blob) {
    var engine = af();
    if (engine && typeof engine.looksLikeLocationCityField === "function") {
      return engine.looksLikeLocationCityField(blob);
    }
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bjob\s+location\b/.test(text)) return false;
    if (/\bpreferred\s+(work\s+)?location\b/.test(text)) return false;
    if (/\breloc/.test(text)) return false;
    if (/\bphone\b/.test(text) && /\bcountry\b/.test(text)) return false;
    if (/\bcitizen/.test(text) || /\bcitizenship\b/.test(text) || /\bnationality\b/.test(text)) return false;
    return (
      /\blocation\s*\(?\s*city\s*\)?/.test(text) ||
      /\bcurrent\s+location\b/.test(text) ||
      text === "city" ||
      text === "city *" ||
      /^city\b/.test(text) ||
      /\bwhere\s+are\s+you\s+located\b/.test(text)
    );
  }

  function getSavedLocation(inventory, profile) {
    var inv = inventory || {};
    var personal = (profile && profile.personal) || {};
    return trimText(
      inv.location ||
        inv.current_location ||
        inv.city ||
        inv.address ||
        personal.location ||
        ""
    );
  }

  function normalizeLocationText(value) {
    var text = trimText(value);
    if (!text) return "";
    text = text.replace(/[,\u2013\u2014\-]/g, " ");
    text = text.toLowerCase();
    text = text.replace(/[^\w\s]/g, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function locationParts(saved) {
    return trimText(saved)
      .split(/\s*,\s*/)
      .map(function (part) {
        return trimText(part);
      })
      .filter(Boolean);
  }

  function locationCityName(saved) {
    var parts = locationParts(saved);
    return parts[0] || "";
  }

  function pickLocationSuggestion(options, saved) {
    var parts = locationParts(saved);
    var city = parts[0] || "";
    var cityState = parts.length >= 2 ? parts[0] + ", " + parts[1] : "";
    var fullNorm = normalizeLocationText(saved);
    var cityStateNorm = normalizeLocationText(cityState);
    var cityNorm = normalizeLocationText(city);
    if (!fullNorm && !cityNorm) return null;

    var exactFull = [];
    var cityStateHits = [];
    var cityOnly = [];

    (options || []).forEach(function (opt) {
      var label = trimText(opt && opt.label);
      if (!label) return;
      var got = normalizeLocationText(label);
      if (!got) return;
      if (fullNorm && (got === fullNorm || got.indexOf(fullNorm) !== -1 || fullNorm.indexOf(got) !== -1)) {
        exactFull.push(opt);
        return;
      }
      if (cityStateNorm && (got === cityStateNorm || got.indexOf(cityStateNorm) !== -1)) {
        cityStateHits.push(opt);
        return;
      }
      if (cityNorm && (got === cityNorm || got.indexOf(cityNorm + " ") === 0 || got.indexOf(" " + cityNorm + " ") !== -1)) {
        cityOnly.push(opt);
      }
    });

    if (exactFull.length === 1) return exactFull[0];
    if (exactFull.length > 1) {
      // Prefer the suggestion that still contains the saved city.
      for (var i = 0; i < exactFull.length; i += 1) {
        if (cityNorm && normalizeLocationText(exactFull[i].label).indexOf(cityNorm) !== -1) {
          return exactFull[i];
        }
      }
      return null;
    }
    if (cityStateHits.length === 1) return cityStateHits[0];
    if (cityStateHits.length > 1) {
      for (var j = 0; j < cityStateHits.length; j += 1) {
        if (cityNorm && normalizeLocationText(cityStateHits[j].label).indexOf(cityNorm) !== -1) {
          return cityStateHits[j];
        }
      }
      return null;
    }
    // City-only fallback only when unambiguous.
    if (cityOnly.length === 1) return cityOnly[0];
    return null;
  }

  function collectLocationSuggestions(control) {
    var listbox = findListboxForControl(control) || findVisibleListbox();
    if (listbox) {
      var fromList = collectListboxOptions(listbox);
      if (fromList.length) return fromList;
    }

    var options = [];
    var roots = [];
    if (listbox) roots.push(listbox);
    var menu =
      document.querySelector("[class*='select__menu']") ||
      document.querySelector("[class*='MenuList']") ||
      document.querySelector("[class*='autocomplete']") ||
      document.querySelector("[class*='typeahead']") ||
      document.querySelector("[class*='suggestions']");
    if (menu) roots.push(menu);
    roots.push(document);

    var seen = [];
    for (var r = 0; r < roots.length; r += 1) {
      var scope = roots[r];
      if (!scope || !scope.querySelectorAll) continue;
      Array.prototype.forEach.call(
        scope.querySelectorAll(
          "[role='option'], [class*='option'], [class*='suggestion'], li[id*='option'], li[data-option]"
        ),
        function (node) {
          if (!node || seen.indexOf(node) !== -1) return;
          var label = optionLabelText(node) || visibleText(node);
          if (!label || normalizeText(label) === "no options" || normalizeText(label).indexOf("no results") !== -1) {
            return;
          }
          seen.push(node);
          options.push({ el: node, label: label });
        }
      );
      if (options.length) break;
    }
    return options;
  }

  function findLocationCityControl(root) {
    var doc = root || document;
    var best = null;

    collectCustomComboboxControls(doc).forEach(function (control) {
      if (best) return;
      var label = labelForCombobox(control);
      var cue = normalizeText(label + " " + (control.getAttribute("aria-label") || ""));
      if (looksLikeLocationCityField(cue)) best = control;
    });
    if (best) return best;

    var fields = collectFields(doc);
    for (var i = 0; i < fields.length; i += 1) {
      var el = fields[i];
      var meta = fieldMeta(el);
      var cue = normalizeText(
        [meta.label, meta.ariaLabel, meta.name, meta.id, meta.placeholder, meta.autocomplete].join(" ")
      );
      if (!looksLikeLocationCityField(cue)) continue;
      var nearby = findComboboxControl(fieldContainer(el) || el);
      return nearby || el;
    }
    return null;
  }

  function resolveLocationInput(control) {
    if (!control) return null;
    var tag = (control.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return control;
    var root = comboboxRoot(control) || control;
    return (
      root.querySelector("input[type='text']") ||
      root.querySelector("input[type='search']") ||
      root.querySelector("input:not([type='hidden'])") ||
      (control.matches && control.matches("input") ? control : null) ||
      control
    );
  }

  function locationValueContainsCity(displayed, saved) {
    var city = normalizeLocationText(locationCityName(saved));
    var got = normalizeLocationText(displayed);
    if (!got) return false;
    if (!city) return true;
    return got.indexOf(city) !== -1;
  }

  async function fillLocationCityAutocomplete(root, inventory, profile, handledElements) {
    var control = findLocationCityControl(root);
    if (!control) return null;
    if (wasHandled(handledElements, control)) return null;

    var input = resolveLocationInput(control) || control;
    markHandled(handledElements, control);
    markHandled(handledElements, input);

    var label = labelForCombobox(control) || findLabelText(input) || "Location (City)";
    var saved = getSavedLocation(inventory, profile);
    if (!saved) {
      return {
        category: "location",
        label: label,
        status: "skipped",
        reason: "No saved answer.",
        ok: false,
        value: ""
      };
    }

    var current = trimText(readValue(input) || readComboboxSelectedText(control) || "");
    if (current && locationValueContainsCity(current, saved)) {
      return {
        category: "location",
        label: label,
        status: "filled",
        reason: "",
        ok: true,
        value: current
      };
    }

    try {
      if (typeof input.focus === "function") input.focus();
    } catch (_) {}
    clickElement(control);
    clickElement(input);
    await sleep(80);

    if (!setNativeValue(input, saved)) {
      return {
        category: "location",
        label: label,
        status: "failed",
        reason: "Could not set location field value.",
        ok: false,
        value: ""
      };
    }

    try {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", bubbles: true }));
    } catch (_) {}

    var matched = null;
    var suggestions = [];
    for (var wait = 0; wait < 14; wait += 1) {
      await sleep(80);
      suggestions = collectLocationSuggestions(control);
      matched = pickLocationSuggestion(suggestions, saved);
      if (matched) break;
    }

    if (!matched) {
      // Do not leave typed text without a required autocomplete selection.
      try {
        setNativeValue(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
      try {
        control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } catch (_) {}
      return {
        category: "location",
        label: label,
        status: "skipped",
        reason: "No matching location suggestion.",
        ok: false,
        value: ""
      };
    }

    try {
      if (matched.el && typeof matched.el.scrollIntoView === "function") {
        matched.el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    clickElement(matched.el);
    await sleep(500);

    try {
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    } catch (_) {
      try {
        input.dispatchEvent(new Event("blur", { bubbles: true }));
      } catch (_) {}
    }
    await sleep(120);

    var selected =
      trimText(readComboboxSelectedText(control) || "") ||
      trimText(readValue(input) || "");

    if (!selected) {
      return {
        category: "location",
        label: label,
        status: "failed",
        reason: "Verification failed; Greenhouse cleared the location field.",
        ok: false,
        value: ""
      };
    }
    if (!locationValueContainsCity(selected, saved)) {
      return {
        category: "location",
        label: label,
        status: "failed",
        reason: "Verification failed; selected location does not contain the saved city.",
        ok: false,
        value: ""
      };
    }

    return {
      category: "location",
      label: label,
      status: "filled",
      reason: "",
      ok: true,
      value: selected
    };
  }

  async function fillSupportedFields(context) {
    var ctx = context || {};
    if (!isSupportedPage()) return emptyReport();

    var root = ctx.root || document;
    var inventory = ctx.inventory || {};
    var options = {
      fillDemographics: ctx.fillDemographics !== false,
      demographics: ctx.demographics || null,
      profile: ctx.profile || null,
      workAuthorization: ctx.workAuthorization || null
    };
    var resume = ctx.resume || null;
    var handledElements = ctx.handledElements || [];
    var results = [];
    var seenRadioNames = {};

    var phoneCountryRow = await fillPhoneCountryDropdown(root, inventory, handledElements);
    if (phoneCountryRow) results.push(phoneCountryRow);

    var locationRow = await fillLocationCityAutocomplete(
      root,
      inventory,
      options.profile,
      handledElements
    );
    if (locationRow) results.push(locationRow);

    var graduationRows = await fillStandaloneGraduationDropdown(
      root,
      inventory,
      options.profile,
      handledElements
    );
    for (var g = 0; g < graduationRows.length; g += 1) {
      results.push(graduationRows[g]);
    }

    var gpaRows = await fillStandaloneGpaDropdown(
      root,
      inventory,
      options.profile,
      handledElements
    );
    for (var gp = 0; gp < gpaRows.length; gp += 1) {
      results.push(gpaRows[gp]);
    }

    var gpaTextRows = fillStandaloneGpaTextFields(
      root,
      inventory,
      options.profile,
      handledElements
    );
    for (var gpt = 0; gpt < gpaTextRows.length; gpt += 1) {
      results.push(gpaTextRows[gpt]);
    }

    var dropdownCategories = [
      "work_authorization",
      "sponsorship_now",
      "sponsorship_later",
      "hispanic_latino",
      "transgender",
      "gender",
      "race_ethnicity",
      "veteran_status",
      "disability_status"
    ];
    var d;
    for (d = 0; d < dropdownCategories.length; d += 1) {
      var category = dropdownCategories[d];
      var control = findLiveComboboxByCategory(root, category, handledElements);
      if (!control) continue;
      var classified = classifyCombobox(control);
      var answer = getInventoryAnswer(category, inventory, options);
      if (category === "gender") {
        handledElements.push(control);
        var genderLabel = (classified && classified.label) || labelForCombobox(control) || category;
        var genderResult = await selectCustomDropdownOption(
          control,
          function (optionLabel) {
            return optionMatches("gender", answer, optionLabel);
          },
          answer
        );
        results.push({
          category: category,
          label: genderLabel,
          status: genderResult.status,
          reason: genderResult.reason || "",
          ok: Boolean(genderResult.ok),
          value: genderResult.ok ? genderResult.value || answer : ""
        });
        if (genderResult.ok) await sleep(120);
        continue;
      }
      if (category === "transgender") {
        handledElements.push(control);
        var transgenderLabel = (classified && classified.label) || labelForCombobox(control) || category;
        var transgenderResult = await selectCustomDropdownOption(
          control,
          function (optionLabel) {
            return optionMatches("transgender", answer, optionLabel);
          },
          answer
        );
        results.push({
          category: category,
          label: transgenderLabel,
          status: transgenderResult.status,
          reason: transgenderResult.reason || "",
          ok: Boolean(transgenderResult.ok),
          value: transgenderResult.ok ? transgenderResult.value || answer : ""
        });
        if (transgenderResult.ok) await sleep(120);
        continue;
      }
      if (category === "race_ethnicity") {
        handledElements.push(control);
        var raceLabel = (classified && classified.label) || labelForCombobox(control) || category;
        var raceResult = await selectCustomDropdownOption(
          control,
          function (optionLabel) {
            return optionMatches("race_ethnicity", answer, optionLabel);
          },
          answer
        );
        results.push({
          category: category,
          label: raceLabel,
          status: raceResult.status,
          reason: raceResult.reason || "",
          ok: Boolean(raceResult.ok),
          value: raceResult.ok ? raceResult.value || answer : ""
        });
        if (raceResult.ok) await sleep(120);
        continue;
      }
      if (category === "veteran_status") {
        handledElements.push(control);
        var veteranLabel = (classified && classified.label) || labelForCombobox(control) || category;
        var veteranResult = await selectCustomDropdownOption(
          control,
          function (optionLabel) {
            return optionMatches("veteran_status", answer, optionLabel);
          },
          answer
        );
        results.push({
          category: category,
          label: veteranLabel,
          status: veteranResult.status,
          reason: veteranResult.reason || "",
          ok: Boolean(veteranResult.ok),
          value: veteranResult.ok ? veteranResult.value || answer : ""
        });
        if (veteranResult.ok) await sleep(120);
        continue;
      }
      if (category === "disability_status") {
        handledElements.push(control);
        var disabilityLabel = (classified && classified.label) || labelForCombobox(control) || category;
        var disabilityResult = await selectCustomDropdownOption(
          control,
          function (optionLabel) {
            return optionMatches("disability_status", answer, optionLabel);
          },
          answer
        );
        results.push({
          category: category,
          label: disabilityLabel,
          status: disabilityResult.status,
          reason: disabilityResult.reason || "",
          ok: Boolean(disabilityResult.ok),
          value: disabilityResult.ok ? disabilityResult.value || answer : ""
        });
        if (disabilityResult.ok) await sleep(120);
        continue;
      }
      var row = await fillLabeledYesNoDropdown(control, category, answer, handledElements);
      if (row) results.push(row);
      if (row && row.ok && category === "hispanic_latino") await sleep(120);
    }

    var educationRows = await fillEducationFields(root, inventory, options.profile, handledElements);
    for (var e = 0; e < educationRows.length; e += 1) {
      results.push(educationRows[e]);
    }

    var fields = collectFields(root);
    for (var i = 0; i < fields.length; i += 1) {
      var el = fields[i];
      if (wasHandled(handledElements, el)) continue;
      var meta = fieldMeta(el);
      var labelCue = normalizeText(
        [meta.label, meta.name, meta.id, meta.ariaLabel, meta.placeholder].join(" ")
      );
      var detected = classifyField(el);
      // Education is handled above; keep generic Greenhouse text path away from these fields.
      if (
        looksLikeEducationDateField(labelCue) ||
        (detected && detected.category === "education") ||
        (detected && detected.category === "education_start_month") ||
        (detected && detected.category === "education_end_month") ||
        classifyEducationField(labelCue)
      ) {
        markHandled(handledElements, el);
        continue;
      }
      if (isExcludedEducationQuestion(labelCue)) {
        markHandled(handledElements, el);
        continue;
      }
      // Location (City) autocomplete is handled above — never plain-text fill it here.
      if (
        looksLikeLocationCityField(labelCue) ||
        (detected && (detected.category === "city" || detected.category === "location"))
      ) {
        markHandled(handledElements, el);
        continue;
      }
      var filled = fillOneField(el, inventory, options, resume, seenRadioNames, handledElements);
      if (filled) results.push(filled);
    }

    return summarize(results, handledElements);
  }

  global.ImpulsoGreenhouseAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields,
    verifyField: verifyField,
    normalizeOptionText: normalizeOptionText
  };
})(typeof window !== "undefined" ? window : self);
