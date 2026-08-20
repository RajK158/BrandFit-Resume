(function (global) {
  "use strict";

  var WORKDAY_HOST_RE = /(?:^|\.)myworkdayjobs\.com$/i;
  var MY_INFO_CATEGORIES = {
    country: true,
    first_name: true,
    last_name: true,
    preferred_name: true,
    address_line1: true,
    address_line2: true,
    city: true,
    state: true,
    postal_code: true,
    email: true,
    phone_type: true,
    phone_country: true,
    phone: true
  };

  var US_STATE_NAMES_BY_ABBR = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    DC: "District of Columbia",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming"
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

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
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

  function isSupportedPage() {
    try {
      var host = String((global.location && global.location.hostname) || "");
      return WORKDAY_HOST_RE.test(host);
    } catch (_) {
      return false;
    }
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

  function clickElement(el) {
    if (!el) return;
    try {
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    try {
      el.focus();
    } catch (_) {}
    try {
      el.click();
    } catch (_) {
      try {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
  }

  function dispatchWorkdayInputEvents(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    } catch (_) {
      try {
        el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
  }

  function setInputValue(el, value) {
    if (!el) return false;
    var engine = af();
    if (engine && typeof engine.setNativeValue === "function") {
      var ok = engine.setNativeValue(el, value);
      dispatchWorkdayInputEvents(el);
      return ok;
    }
    try {
      var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
      var desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (_) {
      try {
        el.value = value;
      } catch (__) {
        return false;
      }
    }
    dispatchWorkdayInputEvents(el);
    return true;
  }

  function automationId(el) {
    if (!el || !el.getAttribute) return "";
    return trimText(el.getAttribute("data-automation-id") || "");
  }

  function automationBlob(el) {
    var parts = [];
    var node = el;
    var hops = 0;
    while (node && hops < 8) {
      var id = automationId(node);
      if (id) parts.push(id);
      node = node.parentElement;
      hops += 1;
    }
    return normalizeText(parts.join(" "));
  }

  function fieldContainer(el) {
    if (!el || !el.closest) return el;
    return (
      el.closest('[data-automation-id^="formField-"]') ||
      el.closest('[data-automation-id*="FormField"]') ||
      el.closest('[data-automation-id*="Section"]') ||
      el.closest("fieldset") ||
      el.closest("label") ||
      el.parentElement ||
      el
    );
  }

  function containerLabel(container) {
    if (!container) return "";
    var label = "";
    if (container.matches && container.matches("label")) {
      label = trimText(container.innerText || container.textContent || "");
    }
    if (!label) {
      var labeled =
        container.querySelector &&
        container.querySelector(
          "label, legend, [data-automation-id='label'], [data-automation-id='formLabel']"
        );
      if (labeled) label = trimText(labeled.innerText || labeled.textContent || "");
    }
    if (!label) {
      label = trimText(container.getAttribute && container.getAttribute("aria-label"));
    }
    return label;
  }

  function widgetLabel(el) {
    if (!el) return "";
    var aria = trimText(el.getAttribute && el.getAttribute("aria-label"));
    if (aria) return aria;
    var labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledBy) {
      var parts = labelledBy.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? trimText(node.innerText || node.textContent || "") : "";
      });
      var joined = trimText(parts.join(" "));
      if (joined) return joined;
    }
    return containerLabel(fieldContainer(el));
  }

  function isPlaceholderValue(text) {
    var t = normalizeText(text);
    if (!t) return true;
    if (t === "select" || t === "select one" || t === "select..." || t === "choose one") return true;
    if (t.indexOf("select ") === 0) return true;
    return false;
  }

  function isVisibleEnough(el) {
    if (!el || el.disabled) return false;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
    var type = normalizeText(el.type || "");
    if (type === "hidden") return false;
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch (_) {}
    return true;
  }

  function looksLikeSaveOrContinue(text) {
    var t = normalizeText(text);
    return (
      /\bsave\s+and\s+continue\b/.test(t) ||
      /\bcontinue\b/.test(t) && /\bsave\b/.test(t) ||
      t === "submit" ||
      t === "next"
    );
  }

  function isManualSkipQuestion(text) {
    var t = normalizeText(text);
    if (!t) return false;
    var engine = af();
    if (engine && typeof engine.looksLikeReferralSource === "function" && engine.looksLikeReferralSource(t)) {
      return true;
    }
    if (/\bhow\s+did\s+you\s+hear\b/.test(t)) return true;
    if (/\bpreviously\s+worked\b/.test(t) || /\bworked\s+(for\s+us|here)\b/.test(t)) return true;
    if (/\bformer\s+employee\b/.test(t) || /\bprevious\s+employee\b/.test(t)) return true;
    return false;
  }

  function classifyMyInfoField(label, autoBlob, sectionCue) {
    var labelNorm = normalizeText(label);
    var blob = normalizeText([label, autoBlob, sectionCue].join(" "));
    if (!blob) return "";
    if (isManualSkipQuestion(blob) || isManualSkipQuestion(labelNorm)) return "skip_manual";
    if (looksLikeSaveOrContinue(labelNorm)) return "skip_manual";

    if (
      /\bphone\s*type\b/.test(blob) ||
      /\bdevice\s*type\b/.test(blob) ||
      /\bphone-device-type\b/.test(blob) ||
      (labelNorm === "type" && /\bphone\b/.test(autoBlob + " " + sectionCue))
    ) {
      return "phone_type";
    }
    if (
      /\bcountry\s*phone\s*code\b/.test(blob) ||
      /\bphone\s*country\s*code\b/.test(blob) ||
      /\bphone\s*country\b/.test(blob) ||
      /\bcountryphonecode\b/.test(blob) ||
      (/\bcountry\s*code\b/.test(labelNorm) && /\bphone\b/.test(autoBlob + " " + sectionCue))
    ) {
      return "phone_country";
    }
    if (
      (/\bphone\s*number\b/.test(blob) || labelNorm === "phone" || /\bphone-number\b/.test(blob)) &&
      !/\bphone\s*type\b/.test(blob) &&
      !/\bcountry\b/.test(labelNorm)
    ) {
      return "phone";
    }

    if (/\bpreferred\b/.test(blob) && /\b(first\s*name|name)\b/.test(blob)) return "preferred_name";
    if (/\b(legal\s+)?first\s*name\b/.test(labelNorm) || /\bfirstname\b/.test(autoBlob)) return "first_name";
    if (/\b(legal\s+)?last\s*name\b/.test(labelNorm) || /\blastname\b/.test(autoBlob)) return "last_name";
    if (/\bemail\b/.test(labelNorm) && !/\bhear\b/.test(blob)) return "email";
    if (
      /\bpostal\b/.test(labelNorm) ||
      /\bzip\b/.test(labelNorm) ||
      /\bpost\s*code\b/.test(labelNorm) ||
      /\bpostalcode\b/.test(autoBlob) ||
      /\bzipcode\b/.test(autoBlob)
    ) {
      return "postal_code";
    }
    if (/\bcity\b/.test(labelNorm) || /(?:^|\s)(?:formfield-)?city(?:\s|$)/.test(autoBlob)) return "city";
    if (
      /\bstate\b/.test(labelNorm) ||
      /\bprovince\b/.test(labelNorm) ||
      /\bregion\b/.test(labelNorm) ||
      /\bcountryregion\b/.test(autoBlob) ||
      /\baddressstate\b/.test(autoBlob)
    ) {
      return "state";
    }
    if (
      (/\baddress\s*line\s*2\b/.test(blob) ||
        /\baddressline2\b/.test(autoBlob) ||
        /\baddress\s*2\b/.test(labelNorm) ||
        (/\bline\s*2\b/.test(labelNorm) && /\baddress\b/.test(blob))) &&
      !/\bemail\b/.test(blob)
    ) {
      return "address_line2";
    }
    if (
      (/\baddress\s*line\s*1\b/.test(blob) ||
        /\baddressline1\b/.test(autoBlob) ||
        /\baddress\s*1\b/.test(labelNorm) ||
        /\baddress\s*line\b/.test(blob) ||
        labelNorm === "address" ||
        /\bstreet\b/.test(labelNorm)) &&
      !/\bemail\b/.test(blob) &&
      !/\bline\s*2\b/.test(labelNorm) &&
      !/\baddressline2\b/.test(autoBlob)
    ) {
      return "address_line1";
    }
    if (labelNorm === "country" || (/\bcountry\b/.test(labelNorm) && !/\bphone\b/.test(blob))) {
      return "country";
    }
    return "";
  }

  function isComboboxControl(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute("aria-haspopup") === "listbox") return true;
    if (el.getAttribute && el.getAttribute("role") === "combobox") return true;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "select") return true;
    if (tag === "button" && /select|combobox|dropdown/i.test(automationId(el) + " " + (el.className || ""))) {
      return true;
    }
    return false;
  }

  function comboboxControlIn(container) {
    if (!container || !container.querySelector) return null;
    var direct = container.querySelector(
      'button[aria-haspopup="listbox"], [aria-haspopup="listbox"], [role="combobox"], select, [data-automation-id="selectWidget"] button'
    );
    return direct && isVisibleEnough(direct) ? direct : null;
  }

  function readComboboxText(control) {
    if (!control) return "";
    if ((control.tagName || "").toLowerCase() === "select") {
      var opt = control.options && control.selectedIndex >= 0 ? control.options[control.selectedIndex] : null;
      return trimText((opt && (opt.text || opt.label)) || control.value || "");
    }
    var aria = trimText(control.getAttribute && control.getAttribute("aria-valuetext"));
    if (aria && !isPlaceholderValue(aria)) return aria;
    var labelled = trimText(control.innerText || control.textContent || "");
    if (labelled && !isPlaceholderValue(labelled) && labelled.length < 120) return labelled;
    if (control.value && !isPlaceholderValue(control.value)) return trimText(control.value);
    return "";
  }

  function collectOpenOptions() {
    var options = [];
    var nodes = document.querySelectorAll('[data-automation-id="promptOption"], [role="option"]');
    Array.prototype.forEach.call(nodes, function (node) {
      if (!isVisibleEnough(node)) return;
      var label =
        trimText(node.getAttribute("data-automation-label")) ||
        trimText(node.innerText || node.textContent || "");
      if (!label) return;
      options.push({ el: node, label: label });
    });
    return options;
  }

  async function selectComboboxOption(control, matcher) {
    if (!control) return { ok: false, value: "" };
    var current = readComboboxText(control);
    if (current && matcher(current)) return { ok: true, value: current, already: true };

    if ((control.tagName || "").toLowerCase() === "select") {
      var matched = null;
      Array.prototype.forEach.call(control.options || [], function (opt) {
        if (!opt || opt.disabled) return;
        var label = trimText(opt.text || opt.label || opt.value || "");
        if (matcher(label)) matched = opt;
      });
      if (!matched) return { ok: false, value: current };
      try {
        control.value = matched.value;
        matched.selected = true;
      } catch (_) {
        return { ok: false, value: current };
      }
      dispatchWorkdayInputEvents(control);
      return { ok: matcher(readComboboxText(control)), value: readComboboxText(control) };
    }

    clickElement(control);
    await sleep(180);
    var options = [];
    var i;
    for (i = 0; i < 10; i += 1) {
      options = collectOpenOptions();
      if (options.length) break;
      await sleep(70);
    }
    var picked = null;
    for (i = 0; i < options.length; i += 1) {
      if (matcher(options[i].label)) {
        picked = options[i];
        break;
      }
    }
    if (!picked) {
      try {
        control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } catch (_) {}
      return { ok: false, value: current };
    }
    clickElement(picked.el);
    await sleep(220);
    var selected = "";
    for (i = 0; i < 8; i += 1) {
      selected = readComboboxText(control);
      if (selected && matcher(selected)) break;
      await sleep(50);
    }
    return { ok: Boolean(selected && matcher(selected)), value: selected || picked.label };
  }

  function isUsCountryToken(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (t === "us" || t === "usa" || t === "u.s." || t === "u.s.a." || t === "+1" || t === "1") return true;
    if (/\bunited states\b/.test(t)) return true;
    return false;
  }

  function matchesPhoneCountryOption(optionLabel, savedCountry, savedCode) {
    var opt = normalizeText(optionLabel);
    if (!opt) return false;
    var country = normalizeText(savedCountry);
    var code = trimText(savedCode);
    var codeDigits = phoneDigitsOnly(code || savedCountry);
    if (country && (opt === country || opt.indexOf(country) !== -1)) {
      if (isUsCountryToken(country) && /\bcanada\b/.test(opt) && !/\bunited states\b/.test(opt)) return false;
      return true;
    }
    if (isUsCountryToken(savedCountry) || isUsCountryToken(savedCode) || codeDigits === "1") {
      return /\bunited states\b/.test(opt);
    }
    if (codeDigits && opt.indexOf("+" + codeDigits) !== -1) {
      if (codeDigits === "1") return /\bunited states\b/.test(opt);
      return true;
    }
    return false;
  }

  function matchesCountryOption(optionLabel, savedCountry) {
    var opt = normalizeText(optionLabel);
    var saved = normalizeText(savedCountry);
    if (!opt || !saved) return false;
    if (opt === saved) return true;
    if (isUsCountryToken(saved)) return /\bunited states\b/.test(opt) && !/\bcanada\b/.test(opt);
    return opt.indexOf(saved) !== -1 || saved.indexOf(opt) !== -1;
  }

  function stateAbbrFromValue(text) {
    var n = normalizeText(text);
    if (!n) return "";
    n = n.replace(/[.]/g, "").replace(/\s+/g, " ").trim();
    if (/^[a-z]{2}$/.test(n)) {
      var abbr = n.toUpperCase();
      return US_STATE_NAMES_BY_ABBR[abbr] ? abbr : "";
    }

    var paren = n.match(/^(.+?)\s*\(\s*([a-z]{2})\s*\)$/);
    if (paren) {
      var parenAbbr = paren[2].toUpperCase();
      if (US_STATE_NAMES_BY_ABBR[parenAbbr]) return parenAbbr;
    }

    var abbr;
    var name;
    for (abbr in US_STATE_NAMES_BY_ABBR) {
      if (!Object.prototype.hasOwnProperty.call(US_STATE_NAMES_BY_ABBR, abbr)) continue;
      name = normalizeText(US_STATE_NAMES_BY_ABBR[abbr]);
      if (n === name) return abbr;
    }
    return "";
  }

  function matchesStateOption(optionLabel, savedState) {
    var saved = trimText(savedState);
    var opt = trimText(optionLabel);
    if (!saved || !opt) return false;
    if (normalizeText(opt) === normalizeText(saved)) return true;
    var savedAbbr = stateAbbrFromValue(saved);
    var optAbbr = stateAbbrFromValue(opt);
    return Boolean(savedAbbr && optAbbr && savedAbbr === optAbbr);
  }

  function isMobileTypeOption(label) {
    var t = normalizeText(label);
    return t === "mobile" || t === "cell" || t === "cellular" || t === "mobile phone";
  }

  function savedPhoneType(inventory, profile) {
    var inv = inventory || {};
    var personal = (profile && profile.personal) || {};
    return trimText(
      inv.phone_type ||
        inv.phoneType ||
        personal.phoneType ||
        personal.phone_type ||
        ""
    );
  }

  function matchesPhoneTypeOption(optionLabel, savedType) {
    var opt = normalizeText(optionLabel);
    var saved = normalizeText(savedType);
    if (!opt) return false;
    if (saved && (opt === saved || opt.indexOf(saved) !== -1 || saved.indexOf(opt) !== -1)) return true;
    return false;
  }

  function readInputValue(el) {
    if (!el) return "";
    return trimText(el.value || "");
  }

  function inventoryAnswer(category, inventory, profile) {
    var inv = inventory || {};
    var personal = (profile && profile.personal) || {};
    if (category === "first_name") return trimText(inv.first_name || personal.firstName || "");
    if (category === "last_name") return trimText(inv.last_name || personal.lastName || "");
    if (category === "preferred_name") {
      return trimText(inv.preferred_name || personal.preferredName || personal.preferredFirstName || "");
    }
    if (category === "email") return trimText(inv.email || personal.email || "");
    if (category === "phone") return trimText(inv.phone || personal.phone || "");
    if (category === "phone_country") {
      return trimText(inv.phone_country || personal.phoneCountry || "");
    }
    if (category === "phone_country_code") {
      return trimText(inv.phone_country_code || personal.phoneCountryCode || "");
    }
    if (category === "address_line1") {
      return trimText(personal.addressLine1 || inv.address_line_1 || inv.address_line1 || "");
    }
    if (category === "address_line2") {
      return trimText(personal.addressLine2 || inv.address_line_2 || inv.address_line2 || "");
    }
    if (category === "city") return trimText(personal.city || "");
    if (category === "state") return trimText(personal.state || inv.state || "");
    if (category === "postal_code") {
      return trimText(personal.postalCode || inv.postal_code || "");
    }
    if (category === "country") {
      return trimText(inv.country || inv.phone_country || personal.phoneCountry || "");
    }
    return trimText(inv[category] || "");
  }

  function findFormField(root, automationIdValue) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    try {
      return doc.querySelector('[data-automation-id="' + automationIdValue + '"]');
    } catch (_) {
      return null;
    }
  }

  function isAddressDropdownInternalInput(el) {
    if (!el || (el.tagName || "").toLowerCase() !== "input") return false;
    var name = normalizeText(el.getAttribute && el.getAttribute("name"));
    if (
      name === "addressline1" ||
      name === "addressline2" ||
      name === "city" ||
      name === "municipality" ||
      name === "postalcode"
    ) {
      return false;
    }
    var container =
      (el.closest && el.closest('[data-automation-id="formField-countryRegion"]')) ||
      (el.closest && el.closest('[data-automation-id$="countryRegion"]'));
    return Boolean(container);
  }

  function firstAnswerTextInput(container) {
    if (!container || !container.querySelectorAll) return null;
    var nodes = container.querySelectorAll(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]), textarea'
    );
    var i;
    var el;
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (isAddressDropdownInternalInput(el)) continue;
      var ph = normalizeText(el.getAttribute && el.getAttribute("placeholder"));
      if (ph === "search" || ph.indexOf("search ") === 0) continue;
      return el;
    }
    return null;
  }

  function findNamedAnswerInput(root, name) {
    var doc = root || document;
    if (!doc || !doc.querySelectorAll) return null;
    var nodes = doc.querySelectorAll('input[name="' + name + '"]');
    var i;
    var el;
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || normalizeText(el.type) === "hidden") continue;
      if (isAddressDropdownInternalInput(el)) continue;
      return el;
    }
    return null;
  }

  function findAnswerTextInput(root, name, formFieldId) {
    var named = findNamedAnswerInput(root, name);
    if (named) return named;
    var container = findFormField(root, formFieldId);
    return firstAnswerTextInput(container);
  }

  function findFormFieldByLabel(root, testFn) {
    var doc = root || document;
    if (!doc || !doc.querySelectorAll) return null;
    var fields = doc.querySelectorAll('[data-automation-id^="formField-"]');
    var i;
    var field;
    for (i = 0; i < fields.length; i += 1) {
      field = fields[i];
      if (testFn(containerLabel(field), automationId(field))) return field;
    }
    return null;
  }

  function findCityInput(root) {
    var el = findAnswerTextInput(root, "city", "formField-city");
    if (el) return el;
    el = findAnswerTextInput(root, "municipality", "formField-municipality");
    if (el) return el;
    var container = findFormFieldByLabel(root, function (label, id) {
      var t = normalizeText(String(label || "").replace(/\*/g, " "));
      var auto = normalizeText(id);
      if (auto === "formfield-city" || auto === "formfield-municipality") return true;
      return t === "city" || t.indexOf("city ") === 0;
    });
    return firstAnswerTextInput(container);
  }

  function findDropdownButton(container) {
    if (!container || !container.querySelectorAll) return null;
    var selectors = [
      'button[aria-haspopup="listbox"]',
      '[aria-haspopup="listbox"]',
      'button[aria-haspopup="true"]',
      '[role="combobox"]:not(input):not(textarea)',
      'button[data-automation-id="selectWidget"]',
      '[data-automation-id="selectWidget"] button',
      '[data-automation-id="selectWidget"]'
    ];
    var s;
    var nodes;
    var i;
    var el;
    var tag;
    for (s = 0; s < selectors.length; s += 1) {
      try {
        nodes = container.querySelectorAll(selectors[s]);
      } catch (_) {
        nodes = [];
      }
      for (i = 0; i < nodes.length; i += 1) {
        el = nodes[i];
        tag = (el.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") continue;
        if (tag === "button" && normalizeText(el.type) === "submit") continue;
        if (!isVisibleEnough(el) && el.disabled) continue;
        if (el.getClientRects && el.getClientRects().length === 0) continue;
        return el;
      }
    }
    nodes = container.querySelectorAll("button");
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (normalizeText(el.type) === "submit") continue;
      return el;
    }
    return null;
  }

  function isEmptyDropdownDisplay(text) {
    var t = normalizeText(text);
    if (!t) return true;
    if (isPlaceholderValue(t)) return true;
    if (/\bselect\s+one\b/.test(t)) return true;
    if (/\bselect\s+an?\s+(option|item|state|province)\b/.test(t)) return true;
    return false;
  }

  function displayedDropdownValue(container, control) {
    var raw = control ? readComboboxText(control) : "";
    if (!raw && container) {
      var widget = container.querySelector(
        '[data-automation-id="selectWidget"], [aria-haspopup="listbox"], [role="combobox"]'
      );
      if (widget && (widget.tagName || "").toLowerCase() !== "input") {
        raw = trimText(widget.innerText || widget.textContent || "");
      }
    }
    var label = containerLabel(container);
    var stripped = trimText(raw);
    var labelNorm = normalizeText(String(label || "").replace(/\*/g, " "));
    if (labelNorm && normalizeText(stripped).indexOf(labelNorm) === 0) {
      stripped = trimText(stripped.slice(label.length)).replace(/^\*+\s*/, "");
    }
    if (isEmptyDropdownDisplay(stripped) || isEmptyDropdownDisplay(raw)) return "";
    return stripped || "";
  }

  async function waitUntilFillable(el) {
    var i;
    for (i = 0; i < 15; i += 1) {
      if (el && !el.disabled) return true;
      await sleep(80);
    }
    return Boolean(el && !el.disabled);
  }

  async function fillNamedAddressInput(el, category, label, value, handledElements) {
    if (el) markHandled(handledElements, el);
    if (!el) {
      return resultRow(category, label, "skipped", "Field was not found.", false, "");
    }
    if (category === "address_line2" && !value) {
      return resultRow(category, label, "skipped", "Optional field is blank.", false, "");
    }
    await waitUntilFillable(el);
    return fillTextWidget({ el: el, category: category, label: label }, value, handledElements);
  }

  async function fillStateDropdown(root, value, handledElements) {
    var container =
      findFormField(root, "formField-countryRegion") ||
      findFormFieldByLabel(root, function (label, id) {
        var t = normalizeText(String(label || "").replace(/\*/g, " "));
        var auto = normalizeText(id);
        if (auto === "formfield-countryregion" || auto.indexOf("countryregion") !== -1) return true;
        return t === "state" || /\bstate\b/.test(t) || /\bprovince\b/.test(t);
      });
    if (!container) {
      return resultRow("state", "State", "skipped", "Field was not found.", false, "");
    }
    var internals = container.querySelectorAll("input, textarea, button, [aria-haspopup='listbox']");
    Array.prototype.forEach.call(internals, function (node) {
      markHandled(handledElements, node);
    });
    var control = findDropdownButton(container);
    if (!control) {
      return resultRow("state", "State", "skipped", "State dropdown control was not found.", false, "");
    }
    var current = displayedDropdownValue(container, control);
    if (current && matchesStateOption(current, value)) {
      return resultRow("state", "State", "filled", "", true, current);
    }
    if (current) {
      return resultRow("state", "State", "skipped", "Field is already completed.", false, "");
    }
    if (!value) {
      return resultRow("state", "State", "skipped", "No saved answer.", false, "");
    }
    var selected = await selectComboboxOption(control, function (label) {
      return matchesStateOption(label, value);
    });
    var after = displayedDropdownValue(container, control) || selected.value || "";
    if (!selected.ok && !matchesStateOption(after, value)) {
      return resultRow("state", "State", "skipped", "No matching dropdown option.", false, "");
    }
    if (!matchesStateOption(after, value)) {
      return resultRow("state", "State", "failed", "Verification failed; state did not persist.", false, "");
    }
    return resultRow("state", "State", "filled", "", true, after);
  }

  async function fillAddressSection(root, inventory, profile, handledElements, results) {
    await sleep(200);
    var line1 = findAnswerTextInput(root, "addressLine1", "formField-addressLine1");
    var line2 = findAnswerTextInput(root, "addressLine2", "formField-addressLine2");
    var city = findCityInput(root);
    var postal = findAnswerTextInput(root, "postalCode", "formField-postalCode");

    results.push(
      await fillNamedAddressInput(
        line1,
        "address_line1",
        "Address Line 1",
        inventoryAnswer("address_line1", inventory, profile),
        handledElements
      )
    );
    results.push(
      await fillNamedAddressInput(
        line2,
        "address_line2",
        "Address Line 2",
        inventoryAnswer("address_line2", inventory, profile),
        handledElements
      )
    );
    results.push(
      await fillNamedAddressInput(
        city,
        "city",
        "City",
        inventoryAnswer("city", inventory, profile),
        handledElements
      )
    );
    results.push(
      await fillStateDropdown(root, inventoryAnswer("state", inventory, profile), handledElements)
    );
    results.push(
      await fillNamedAddressInput(
        postal,
        "postal_code",
        "Postal Code",
        inventoryAnswer("postal_code", inventory, profile),
        handledElements
      )
    );
  }

  function collectWidgets(root) {
    var widgets = [];
    var seen = [];
    var nodes = (root || document).querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, button[aria-haspopup="listbox"], [aria-haspopup="listbox"], [role="combobox"], select'
    );
    Array.prototype.forEach.call(nodes, function (el) {
      if (!el || seen.indexOf(el) !== -1) return;
      if (isAddressDropdownInternalInput(el)) return;
      if (isExcludedPhoneInput(el)) return;
      if (!isVisibleEnough(el)) return;
      seen.push(el);
      var label = widgetLabel(el);
      var auto = automationBlob(el);
      var container = fieldContainer(el);
      var sectionCue = automationBlob(container) + " " + containerLabel(container);
      var category = classifyMyInfoField(label, auto, sectionCue);
      if (!category || !MY_INFO_CATEGORIES[category] && category !== "skip_manual") return;
      widgets.push({
        el: el,
        label: label,
        category: category,
        container: container,
        combobox: isComboboxControl(el) ? el : comboboxControlIn(container)
      });
    });
    return widgets;
  }

  function isSmsOptIn(el) {
    if (!el || !el.getAttribute) return false;
    if (el.getAttribute("data-automation-id") === "phone-sms-opt-in") return true;
    if (el.closest && el.closest('[data-automation-id="phone-sms-opt-in"]')) return true;
    return false;
  }

  function isCountryPhoneCodeSearchInput(el) {
    if (!el || (el.tagName || "").toLowerCase() !== "input") return false;
    if (el.id === "phoneNumber--countryPhoneCode") return true;
    return Boolean(el.closest && el.closest('[data-automation-id="formField-countryPhoneCode"]'));
  }

  function isPhoneExtensionInput(el) {
    if (!el || (el.tagName || "").toLowerCase() !== "input") return false;
    if (el.id === "phoneNumber--extension") return true;
    if (normalizeText(el.getAttribute("name")) === "extension") return true;
    return Boolean(el.closest && el.closest('[data-automation-id="formField-extension"]'));
  }

  function isExcludedPhoneInput(el) {
    return isSmsOptIn(el) || isCountryPhoneCodeSearchInput(el) || isPhoneExtensionInput(el);
  }

  function savedPhoneExtension(inventory, profile) {
    var inv = inventory || {};
    var personal = (profile && profile.personal) || {};
    return trimText(
      personal.phoneExtension ||
        personal.extension ||
        inv.phone_extension ||
        inv.phoneExtension ||
        ""
    );
  }

  function findPhoneNumberInput(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    var el = doc.querySelector('input[name="phoneNumber"]');
    if (el && !isExcludedPhoneInput(el)) return el;
    el = doc.querySelector("#phoneNumber--phoneNumber");
    if (el && !isExcludedPhoneInput(el)) return el;
    var container = findFormField(doc, "formField-phoneNumber");
    if (!container || !container.querySelector) return null;
    el = container.querySelector('input[name="phoneNumber"]') || container.querySelector("#phoneNumber--phoneNumber");
    if (el && !isExcludedPhoneInput(el)) return el;
    return null;
  }

  function findPhoneTypeControl(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    var named = doc.querySelector('button[name="phoneType"]');
    if (named) return named;
    var container = findFormField(doc, "formField-phoneType");
    if (!container) return null;
    return findDropdownButton(container) || container.querySelector("button[name='phoneType']") || container.querySelector("button");
  }

  function findCountryPhoneCodeSearch(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    var el = doc.querySelector("#phoneNumber--countryPhoneCode");
    if (el) return el;
    var container = findFormField(doc, "formField-countryPhoneCode");
    if (!container || !container.querySelector) return null;
    return container.querySelector("#phoneNumber--countryPhoneCode") || null;
  }

  function findPhoneExtensionInput(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    return (
      doc.querySelector('input[name="extension"]') ||
      doc.querySelector("#phoneNumber--extension") ||
      null
    );
  }

  function looksLikePhoneNumberText(value, savedPhone) {
    var digits = phoneDigitsOnly(value);
    if (!digits) return false;
    if (savedPhone && phoneValuesMatch(savedPhone, value)) return true;
    return digits.length >= 7;
  }

  function clearInputIfPhoneNumber(el, savedPhone) {
    if (!el) return;
    var current = readInputValue(el);
    if (!current || !looksLikePhoneNumberText(current, savedPhone)) return;
    setInputValue(el, "");
  }

  function findPhoneGroup(widgets) {
    var group = { type: null, country: null, number: null };
    widgets.forEach(function (widget) {
      if (widget.category === "phone_type" && !group.type) group.type = widget;
      if (widget.category === "phone_country" && !group.country) group.country = widget;
      if (widget.category === "phone" && !group.number) group.number = widget;
    });
    return group;
  }

  async function fillTextWidget(widget, value, handledElements) {
    var el = widget.el;
    markHandled(handledElements, el);
    if (!value) {
      return resultRow(widget.category, widget.label, "skipped", "No saved answer.", false, "");
    }
    var current = readInputValue(el);
    if (widget.category === "phone") {
      if (current && phoneValuesMatch(value, current)) {
        return resultRow(widget.category, widget.label, "filled", "", true, current);
      }
    } else if (current && normalizeText(current) === normalizeText(value)) {
      return resultRow(widget.category, widget.label, "filled", "", true, current);
    } else if (current) {
      return resultRow(widget.category, widget.label, "skipped", "Field is already completed.", false, "");
    }
    if (!setInputValue(el, value)) {
      return resultRow(widget.category, widget.label, "failed", "Could not set field value.", false, "");
    }
    var after = readInputValue(el);
    if (widget.category === "phone") {
      if (!phoneValuesMatch(value, after)) {
        return resultRow(
          widget.category,
          widget.label,
          "failed",
          "Verification failed; phone digits did not persist.",
          false,
          ""
        );
      }
      return resultRow(widget.category, widget.label, "filled", "", true, after);
    }
    if (!after || normalizeText(after) !== normalizeText(value)) {
      return resultRow(
        widget.category,
        widget.label,
        "failed",
        "Verification failed; value did not persist.",
        false,
        ""
      );
    }
    return resultRow(widget.category, widget.label, "filled", "", true, after);
  }

  async function fillPhoneType(widget, inventory, profile, handledElements, root) {
    var control = findPhoneTypeControl(root) || (widget && (widget.combobox || widget.el));
    var label = (widget && widget.label) || "Phone Type";
    if (!control) {
      return resultRow("phone_type", label, "skipped", "Field was not found.", false, "");
    }
    markHandled(handledElements, control);
    var current = readComboboxText(control);
    var savedType = savedPhoneType(inventory, profile);
    var phone = inventoryAnswer("phone", inventory, profile);
    if (current && !isPlaceholderValue(current) && !isEmptyDropdownDisplay(current)) {
      if ((savedType && matchesPhoneTypeOption(current, savedType)) || (!savedType && isMobileTypeOption(current))) {
        return resultRow("phone_type", label, "filled", "", true, current);
      }
      return resultRow("phone_type", label, "skipped", "Field is already completed.", false, "");
    }
    if (!savedType && !phone) {
      return resultRow("phone_type", label, "skipped", "No saved phone type.", false, "");
    }
    var result = await selectComboboxOption(control, function (optionLabel) {
      if (savedType) return matchesPhoneTypeOption(optionLabel, savedType);
      return isMobileTypeOption(optionLabel);
    });
    if (!savedType && phone && !result.ok) {
      return resultRow("phone_type", label, "skipped", "Mobile phone type is not available.", false, "");
    }
    if (!result.ok) {
      return resultRow("phone_type", label, "failed", "No safe matching phone type.", false, "");
    }
    return resultRow("phone_type", label, "filled", "", true, result.value);
  }

  async function fillPhoneCountry(widget, inventory, profile, handledElements, root, savedPhone) {
    var container = findFormField(root, "formField-countryPhoneCode");
    var search = findCountryPhoneCodeSearch(root);
    var control =
      findDropdownButton(container) ||
      (widget && (widget.combobox || (!isCountryPhoneCodeSearchInput(widget.el) ? widget.el : null)));
    if (search) markHandled(handledElements, search);
    if (control) markHandled(handledElements, control);
    if (container) {
      Array.prototype.forEach.call(container.querySelectorAll("input, button, [aria-haspopup='listbox']"), function (node) {
        if (isSmsOptIn(node) || (node && node.getAttribute && node.getAttribute("name") === "phoneNumber")) return;
        markHandled(handledElements, node);
      });
    }

    var country = inventoryAnswer("phone_country", inventory, profile);
    var code = inventoryAnswer("phone_country_code", inventory, profile);
    var current = displayedDropdownValue(container, control);
    if (
      search &&
      looksLikePhoneNumberText(current, savedPhone) &&
      !matchesPhoneCountryOption(current, country, code)
    ) {
      current = "";
    }
    if (current && !isEmptyDropdownDisplay(current) && matchesPhoneCountryOption(current, country, code)) {
      clearInputIfPhoneNumber(search, savedPhone);
      return resultRow("phone_country", "Country Phone Code", "filled", "", true, current);
    }
    if (current && !isEmptyDropdownDisplay(current) && !looksLikePhoneNumberText(current, savedPhone)) {
      clearInputIfPhoneNumber(search, savedPhone);
      return resultRow("phone_country", "Country Phone Code", "skipped", "Field is already completed.", false, "");
    }
    if (!country && !code) {
      clearInputIfPhoneNumber(search, savedPhone);
      return resultRow("phone_country", "Country Phone Code", "skipped", "No saved phone country.", false, "");
    }
    if (!control) {
      clearInputIfPhoneNumber(search, savedPhone);
      return resultRow("phone_country", "Country Phone Code", "skipped", "Country phone code control was not found.", false, "");
    }

    clearInputIfPhoneNumber(search, savedPhone);
    var matcher = function (optionLabel) {
      return matchesPhoneCountryOption(optionLabel, country, code);
    };
    var result = await selectComboboxOption(control, matcher);
    if (!result.ok && search) {
      var query = trimText(country || code || "");
      if (query && !looksLikePhoneNumberText(query, savedPhone)) {
        clickElement(control);
        await sleep(180);
        setInputValue(search, query);
        await sleep(220);
        var options = collectOpenOptions();
        var picked = null;
        var i;
        for (i = 0; i < options.length; i += 1) {
          if (matcher(options[i].label)) {
            picked = options[i];
            break;
          }
        }
        if (picked) {
          clickElement(picked.el);
          await sleep(220);
          result = { ok: true, value: picked.label };
        }
      }
    }
    var after = displayedDropdownValue(container, control) || result.value || "";
    clearInputIfPhoneNumber(search, savedPhone);
    if (!result.ok && !matchesPhoneCountryOption(after, country, code)) {
      return resultRow("phone_country", "Country Phone Code", "failed", "No matching phone country option.", false, "");
    }
    return resultRow("phone_country", "Country Phone Code", "filled", "", true, after || result.value);
  }

  async function fillPhoneNumberInput(el, savedPhone, handledElements) {
    if (el) markHandled(handledElements, el);
    if (!el) {
      return resultRow("phone", "Phone Number", "skipped", "Field was not found.", false, "");
    }
    if (!savedPhone) {
      return resultRow("phone", "Phone Number", "skipped", "No saved answer.", false, "");
    }
    var current = readInputValue(el);
    if (current && phoneValuesMatch(savedPhone, current)) {
      return resultRow("phone", "Phone Number", "filled", "", true, current);
    }
    if (!setInputValue(el, savedPhone)) {
      return resultRow("phone", "Phone Number", "failed", "Could not set field value.", false, "");
    }
    var after = readInputValue(el);
    if (!phoneValuesMatch(savedPhone, after)) {
      return resultRow("phone", "Phone Number", "failed", "Verification failed; phone digits did not persist.", false, "");
    }
    return resultRow("phone", "Phone Number", "filled", "", true, after);
  }

  function phoneComponentOk(row, present) {
    if (!present) return true;
    if (!row) return false;
    if (row.status === "filled") return true;
    if (row.status === "skipped" && /already completed|not found|No saved/i.test(row.reason || "")) return true;
    return false;
  }

  function phoneNumberSatisfied(numberEl, savedPhone, numberRow) {
    if (!numberEl) return true;
    if (numberRow && numberRow.status === "filled") return true;
    var current = readInputValue(numberEl);
    return Boolean(savedPhone && current && phoneValuesMatch(savedPhone, current));
  }

  async function fillPhoneGroup(group, inventory, profile, handledElements, results, root) {
    var savedPhone = inventoryAnswer("phone", inventory, profile);
    var typeRow = null;
    var countryRow = null;
    var numberRow = null;
    var numberEl = findPhoneNumberInput(root);
    var extensionEl = findPhoneExtensionInput(root);
    var search = findCountryPhoneCodeSearch(root);
    var typeWidget = (group && group.type) || { label: "Phone Type" };

    clearInputIfPhoneNumber(search, savedPhone);
    if (extensionEl && !savedPhoneExtension(inventory, profile)) {
      clearInputIfPhoneNumber(extensionEl, savedPhone);
      markHandled(handledElements, extensionEl);
    }

    typeRow = await fillPhoneType(typeWidget, inventory, profile, handledElements, root);
    results.push(typeRow);

    countryRow = await fillPhoneCountry(group && group.country, inventory, profile, handledElements, root, savedPhone);
    results.push(countryRow);

    numberRow = await fillPhoneNumberInput(numberEl, savedPhone, handledElements);

    var extensionValue = savedPhoneExtension(inventory, profile);
    if (extensionEl && extensionValue) {
      results.push(await fillTextWidget({ el: extensionEl, category: "phone_extension", label: "Phone Extension" }, extensionValue, handledElements));
    } else if (extensionEl) {
      if (looksLikePhoneNumberText(readInputValue(extensionEl), savedPhone)) {
        setInputValue(extensionEl, "");
      }
      markHandled(handledElements, extensionEl);
      results.push(resultRow("phone_extension", "Phone Extension", "skipped", "Optional field is blank.", false, ""));
    }

    clearInputIfPhoneNumber(findCountryPhoneCodeSearch(root), savedPhone);

    var requiredOk =
      phoneComponentOk(typeRow, Boolean(findPhoneTypeControl(root))) &&
      phoneComponentOk(countryRow, Boolean(findFormField(root, "formField-countryPhoneCode") || findCountryPhoneCodeSearch(root))) &&
      phoneNumberSatisfied(numberEl, savedPhone, numberRow);

    if (numberRow) {
      if (!requiredOk) {
        results.push(
          resultRow(
            "phone",
            "Phone",
            numberRow.status === "failed" ? "failed" : "skipped",
            "Required phone components are not complete.",
            false,
            ""
          )
        );
      } else {
        results.push(numberRow);
      }
    }

    var sms = (root || document).querySelector && (root || document).querySelector('[data-automation-id="phone-sms-opt-in"]');
    if (sms) markHandled(handledElements, sms);
  }

  async function fillSimpleWidget(widget, inventory, profile, handledElements) {
    var value = inventoryAnswer(widget.category, inventory, profile);
    var control = widget.combobox || widget.el;
    if (widget.category === "country" || isComboboxControl(control)) {
      markHandled(handledElements, control);
      var current = readComboboxText(control);
      var matcher;
      if (widget.category === "country" || widget.category === "phone_country") {
        matcher = function (label) {
          return matchesCountryOption(label, value);
        };
      } else if (widget.category === "state") {
        matcher = function (label) {
          return matchesStateOption(label, value);
        };
      } else {
        matcher = function (label) {
          return normalizeText(label) === normalizeText(value);
        };
      }
      if (current && !isPlaceholderValue(current)) {
        if (value && matcher(current)) {
          return resultRow(widget.category, widget.label, "filled", "", true, current);
        }
        return resultRow(widget.category, widget.label, "skipped", "Field is already completed.", false, "");
      }
      if (!value) {
        return resultRow(widget.category, widget.label, "skipped", "No saved answer.", false, "");
      }
      var selected = await selectComboboxOption(control, matcher);
      if (!selected.ok) {
        return resultRow(widget.category, widget.label, "skipped", "No matching dropdown option.", false, "");
      }
      return resultRow(widget.category, widget.label, "filled", "", true, selected.value);
    }
    return fillTextWidget(widget, value, handledElements);
  }

  async function fillMyInformation(context) {
    var ctx = context || {};
    var handledElements = ctx.handledElements || [];
    var results = [];
    var inventory = ctx.inventory || {};
    var profile = ctx.profile || null;
    var widgets = collectWidgets(ctx.root || document);
    var phoneGroup = findPhoneGroup(widgets);
    var phoneEls = {};
    if (phoneGroup.type) phoneEls[phoneGroup.type.el] = true;
    if (phoneGroup.country) phoneEls[phoneGroup.country.el] = true;
    if (phoneGroup.number) phoneEls[phoneGroup.number.el] = true;

    var i;
    for (i = 0; i < widgets.length; i += 1) {
      var widget = widgets[i];
      if (widget.category === "skip_manual") {
        markHandled(handledElements, widget.el);
        results.push(
          resultRow("unknown", widget.label, "skipped", "Field is left manual.", false, "")
        );
        continue;
      }
      if (phoneEls[widget.el]) continue;
      if (!MY_INFO_CATEGORIES[widget.category]) continue;
      if (widget.category === "phone_type" || widget.category === "phone_country" || widget.category === "phone") {
        continue;
      }
      if (
        widget.category === "address_line1" ||
        widget.category === "address_line2" ||
        widget.category === "city" ||
        widget.category === "state" ||
        widget.category === "postal_code"
      ) {
        continue;
      }
      results.push(await fillSimpleWidget(widget, inventory, profile, handledElements));
    }

    await fillAddressSection(ctx.root || document, inventory, profile, handledElements, results);

    await fillPhoneGroup(phoneGroup, inventory, profile, handledElements, results, ctx.root || document);

    return summarize(results, handledElements);
  }

  function fillSupportedFields(context) {
    if (!isSupportedPage()) {
      var handled = (context && context.handledElements) || [];
      return Promise.resolve(summarize([], handled));
    }
    return fillMyInformation(context);
  }

  global.ImpulsoWorkdayAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
