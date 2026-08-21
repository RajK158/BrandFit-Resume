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

  function looksLikeCoverLetterUpload(blob) {
    var t = normalizeText(blob);
    return /\bcover(ing)?\s*letter\b/.test(t) && !/\bresume\b/.test(t) && !/\bcv\b/.test(t);
  }

  function looksLikeUploadedFilename(text) {
    return /\S+\.(pdf|docx?|rtf|txt|odt)\b/i.test(String(text || ""));
  }

  function resumeCvSectionScore(node) {
    if (!node) return 0;
    var text = trimText(node.innerText || node.textContent || "");
    if (text.length > 8000) return 0;
    var snippet = text.length > 800 ? text.slice(0, 800) : text;
    var auto = automationBlob(node);
    var blob = normalizeText(snippet + " " + auto);
    if (!blob) return 0;
    if (looksLikeCoverLetterUpload(blob)) return -100;
    var score = 0;
    if (/\bresume\s*\/\s*cv\b/.test(blob) || /\bresume\/cv\b/.test(blob)) score += 12;
    if (/\bresume\b/.test(blob)) score += 6;
    if (/\bcv\b/.test(blob) || /\bcurriculum\s+vitae\b/.test(blob)) score += 6;
    if (/\bdrop\s+files\s+here\b/.test(blob)) score += 3;
    if (/\bselect\s+files\b/.test(blob)) score += 3;
    if (/\b5\s*mb\b/.test(blob) || /\b5mb\b/.test(blob)) score += 2;
    if (/\bfile-upload\b/.test(auto) || /\bfileupload\b/.test(auto)) score += 4;
    if (text.length > 2500) score -= 8;
    return score;
  }

  function expandResumeSection(node) {
    if (!node) return null;
    if (node.querySelector && node.querySelector('input[type="file"]')) return node;
    var parent = node.parentElement;
    if (parent && parent.querySelector && parent.querySelector('input[type="file"]')) return parent;
    return node;
  }

  function findResumeCvSection(root) {
    var doc = root || document;
    if (!doc || !doc.querySelectorAll) return null;
    var selectors =
      '[data-automation-id^="formField-"], [data-automation-id*="fileUpload"], [data-automation-id*="FileUpload"], [data-automation-id*="file-upload"], [data-automation-id*="FileAttachment"], section, [role="group"], h2, h3, h4, legend, label';
    var nodes;
    try {
      nodes = doc.querySelectorAll(selectors);
    } catch (_) {
      nodes = [];
    }
    var best = null;
    var bestScore = 0;
    Array.prototype.forEach.call(nodes, function (node) {
      var score = resumeCvSectionScore(node);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    });
    if (bestScore < 6) return null;
    return expandResumeSection(best);
  }

  function findResumeCvFileInput(root) {
    var doc = root || document;
    var section = findResumeCvSection(doc);
    var input = null;
    if (section && section.querySelector) {
      input = section.querySelector('input[type="file"]');
      if (input) return { input: input, section: section };
    }
    if (!doc.querySelectorAll) return null;
    var inputs = doc.querySelectorAll('input[type="file"]');
    var best = null;
    var bestScore = 0;
    var container;
    var score;
    Array.prototype.forEach.call(inputs, function (el) {
      container = fieldContainer(el) || el.parentElement;
      score = resumeCvSectionScore(container);
      var engine = af();
      if (engine && typeof engine.getFieldIdentity === "function" && typeof engine.classifyLabel === "function") {
        var identity = engine.getFieldIdentity(el);
        var classified = engine.classifyLabel(identity.blob || identity.label || "", "file");
        if (classified && classified.category === "resume_upload") score += 8;
      }
      if (looksLikeCoverLetterUpload((container && (container.innerText || "")) || "")) score = -100;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    if (!best || bestScore < 6) return null;
    return { input: best, section: fieldContainer(best) || best.parentElement || section };
  }

  function resumeAlreadyUploaded(section, input) {
    if (input && input.files && input.files.length > 0) return true;
    if (!section) return false;
    var item = section.querySelector &&
      section.querySelector(
        '[data-automation-id*="file-upload-item"], [data-automation-id*="uploadedFile"], [data-automation-id*="attachmentItem"], [data-automation-id*="Attachment"]'
      );
    if (item && looksLikeUploadedFilename(item.textContent || item.innerText || "")) return true;
    var text = section.innerText || section.textContent || "";
    if (looksLikeUploadedFilename(text)) return true;
    return false;
  }

  function fileMatchesAccept(input, file) {
    if (!input || !file) return true;
    var accept = trimText(input.getAttribute && input.getAttribute("accept"));
    if (!accept) return true;
    var name = normalizeText(file.name);
    var type = normalizeText(file.type);
    var tokens = accept.split(",").map(function (part) {
      return normalizeText(part);
    });
    var i;
    var token;
    for (i = 0; i < tokens.length; i += 1) {
      token = tokens[i];
      if (!token) continue;
      if (token === "*/*") return true;
      if (token.charAt(0) === "." && name.slice(-token.length) === token) return true;
      if (token.indexOf("/") !== -1 && (type === token || (token.slice(-2) === "/*" && type.indexOf(token.slice(0, token.indexOf("/"))) === 0))) {
        return true;
      }
    }
    return false;
  }

  function fileFromResumePayload(resume) {
    if (!resume || !resume.resumeBase64 || !resume.resumeName) return null;
    var raw = String(resume.resumeBase64);
    var arr = raw.split(",");
    var mime = "application/pdf";
    var b64 = raw;
    if (arr.length > 1) {
      var mimeMatch = arr[0] && arr[0].match(/:(.*?);/);
      if (mimeMatch) mime = mimeMatch[1];
      b64 = arr[1];
    }
    var bstr = atob(b64);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], String(resume.resumeName), { type: mime });
  }

  function resumeSectionScope(section) {
    if (!section) return null;
    var parent = section.parentElement;
    if (
      parent &&
      resumeCvSectionScore(parent) >= 6 &&
      trimText(parent.innerText || parent.textContent || "").length < 4000
    ) {
      return parent;
    }
    return section;
  }

  function scopedResumeText(scope) {
    if (!scope) return "";
    return trimText(scope.innerText || scope.textContent || "");
  }

  function filenameKey(name) {
    return normalizeText(String(name || "").replace(/^.*[\\/]/, ""));
  }

  function scopedTextHasFilename(scopeText, fileName) {
    var want = filenameKey(fileName);
    if (!want) return false;
    return normalizeText(scopeText).indexOf(want) !== -1;
  }

  function scopedTextHasUploadSuccessPhrase(scopeText) {
    var t = normalizeText(scopeText);
    if (!t) return false;
    return (
      /\bsuccessfully\s+uploaded\b/.test(t) ||
      /\buploaded\s+successfully\b/.test(t) ||
      /\bupload\s+complete\b/.test(t)
    );
  }

  function scopedHasUploadedFileRow(scope, fileName) {
    if (!scope || !scope.querySelectorAll) return false;
    var nodes;
    try {
      nodes = scope.querySelectorAll(
        '[data-automation-id*="file-upload-item"], [data-automation-id*="uploadedFile"], [data-automation-id*="attachmentItem"], [data-automation-id*="Attachment"], [data-automation-id*="fileUploadItem"], [role="listitem"]'
      );
    } catch (_) {
      nodes = [];
    }
    var i;
    var text;
    for (i = 0; i < nodes.length; i += 1) {
      text = trimText(nodes[i].innerText || nodes[i].textContent || "");
      if (fileName && scopedTextHasFilename(text, fileName)) return true;
      if (!fileName && looksLikeUploadedFilename(text) && scopedTextHasUploadSuccessPhrase(text)) return true;
    }
    return false;
  }

  function inputHasExpectedFile(input, fileName) {
    if (!input || !input.files || !input.files.length || !input.files[0]) return false;
    return filenameKey(input.files[0].name) === filenameKey(fileName);
  }

  function workdayResumeUploadSucceeded(section, input, fileName) {
    var scope = resumeSectionScope(section);
    var text = scopedResumeText(scope);
    if (inputHasExpectedFile(input, fileName)) return true;
    if (fileName && scopedTextHasFilename(text, fileName)) return true;
    if (scopedTextHasUploadSuccessPhrase(text)) return true;
    if (scopedHasUploadedFileRow(scope, fileName)) return true;
    return false;
  }

  async function waitForResumeUploadSuccess(section, input, fileName) {
    var i;
    for (i = 0; i < 16; i += 1) {
      if (workdayResumeUploadSucceeded(section, input, fileName)) return true;
      var errorText = workdayUploadErrorText(resumeSectionScope(section));
      if (errorText) return false;
      await sleep(120);
    }
    return workdayResumeUploadSucceeded(section, input, fileName);
  }

  function assignResumeFile(input, file) {
    if (!input || !file) return false;
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    try {
      input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    return true;
  }

  function workdayUploadErrorText(section) {
    if (!section) return "";
    var t = normalizeText(section.innerText || section.textContent || "");
    if (
      /\btoo\s+large\b/.test(t) ||
      /\bfile\s+is\s+too\s+big\b/.test(t) ||
      /\bexceeds?\s+(the\s+)?(size\s+)?(limit|maximum)\b/.test(t)
    ) {
      return "Workday rejected the file because of size.";
    }
    if (
      /\binvalid\s+file\s*type\b/.test(t) ||
      /\bfile\s*type\s+is\s+not\s+supported\b/.test(t) ||
      /\bnot\s+an\s+accepted\s+file\b/.test(t)
    ) {
      return "Workday rejected the file because of type.";
    }
    return "";
  }

  async function fillResumeCvUpload(context, handledElements) {
    var ctx = context || {};
    var found = findResumeCvFileInput(ctx.root || document);
    if (!found || !found.input) return [];
    var input = found.input;
    var section = found.section;
    markHandled(handledElements, input);
    if (resumeAlreadyUploaded(section, input)) {
      return [resultRow("resume_upload", "Resume/CV", "skipped", "Field is already completed.", false, "")];
    }
    var resume = ctx.resume || null;
    if (!resume || !resume.resumeBase64 || !resume.resumeName) {
      return [resultRow("resume_upload", "Resume/CV", "skipped", "No resume file available.", false, "")];
    }
    var file;
    try {
      file = fileFromResumePayload(resume);
    } catch (_) {
      return [resultRow("resume_upload", "Resume/CV", "failed", "Resume file could not be read.", false, "")];
    }
    if (!file) {
      return [resultRow("resume_upload", "Resume/CV", "skipped", "No resume file available.", false, "")];
    }
    if (file.size > 5 * 1024 * 1024) {
      return [
        resultRow("resume_upload", "Resume/CV", "failed", "Workday rejected the file because of size (5MB max).", false, "")
      ];
    }
    if (!fileMatchesAccept(input, file)) {
      return [resultRow("resume_upload", "Resume/CV", "failed", "Workday rejected the file because of type.", false, "")];
    }
    try {
      assignResumeFile(input, file);
    } catch (_) {
      return [resultRow("resume_upload", "Resume/CV", "failed", "Resume upload failed.", false, "")];
    }
    var recognized = await waitForResumeUploadSuccess(section, input, file.name);
    var errorText = workdayUploadErrorText(resumeSectionScope(section));
    if (recognized) {
      return [resultRow("resume_upload", "Resume/CV", "filled", "", true, file.name)];
    }
    if (errorText) {
      return [resultRow("resume_upload", "Resume/CV", "failed", errorText, false, "")];
    }
    return [
      resultRow(
        "resume_upload",
        "Resume/CV",
        "failed",
        "Verification failed; Workday did not recognize the uploaded file.",
        false,
        ""
      )
    ];
  }

  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  function padMonth(value) {
    var num = parseInt(value, 10);
    if (!num || num < 1 || num > 12) return "";
    return num < 10 ? "0" + num : String(num);
  }

  function monthNameFromNumber(value) {
    var num = parseInt(value, 10);
    if (!num || num < 1 || num > 12) return "";
    return MONTH_NAMES[num - 1];
  }

  function monthNumberFromText(value) {
    var text = trimText(value);
    if (!text) return "";
    var padded = padMonth(text);
    if (padded) return padded;
    var engine = af();
    if (engine && typeof engine.extractMonthFromEducationDate === "function") {
      var named = engine.extractMonthFromEducationDate(text);
      if (named) {
        var i;
        for (i = 0; i < MONTH_NAMES.length; i += 1) {
          if (MONTH_NAMES[i] === named) return padMonth(i + 1);
        }
      }
    }
    return "";
  }

  function isPresentDateValue(value) {
    return /^(present|current|now|ongoing)$/i.test(trimText(value));
  }

  function parseExperienceMonthYear(value) {
    var text = trimText(value);
    var empty = { month: "", year: "", present: false, yearOnly: false };
    if (!text) return empty;
    if (isPresentDateValue(text)) return { month: "", year: "", present: true, yearOnly: false };
    var engine = af();
    if (engine && typeof engine.parseStoredDate === "function") {
      var parsed = engine.parseStoredDate(text);
      if (parsed && parsed.y && parsed.m) {
        return { month: padMonth(parsed.m), year: String(parsed.y), present: false, yearOnly: false };
      }
    }
    var yearMonth = text.match(/^(\d{4})-(\d{1,2})$/);
    if (yearMonth) {
      return { month: padMonth(yearMonth[2]), year: yearMonth[1], present: false, yearOnly: false };
    }
    var monthYear = text.match(/^(\d{1,2})\/(\d{4})$/);
    if (monthYear) {
      return { month: padMonth(monthYear[1]), year: monthYear[2], present: false, yearOnly: false };
    }
    var year = "";
    var month = monthNumberFromText(text);
    if (engine && typeof engine.extractYearFromEducationDate === "function") {
      year = engine.extractYearFromEducationDate(text) || "";
    } else {
      var yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
      year = yearMatch ? yearMatch[1] : "";
    }
    if (year && month) return { month: month, year: year, present: false, yearOnly: false };
    if (year && !month) return { month: "", year: year, present: false, yearOnly: true };
    return empty;
  }

  function monthValuesMatch(actual, expectedMonth) {
    var want = padMonth(expectedMonth) || monthNumberFromText(expectedMonth);
    var got = padMonth(actual) || monthNumberFromText(actual);
    if (want && got && want === got) return true;
    return normalizeText(actual) === normalizeText(expectedMonth);
  }

  function yearValuesMatch(actual, expectedYear) {
    return trimText(actual) === trimText(expectedYear);
  }

  function mapSavedExperience(item) {
    var row = item && typeof item === "object" ? item : {};
    var current =
      row.current === true ||
      row.current === "true" ||
      row.isCurrent === true ||
      row.isCurrent === "true" ||
      row.currentRole === true ||
      row.currentRole === "true";
    var endDate = trimText(row.endDate || row.end_date || "");
    if (isPresentDateValue(endDate)) current = true;
    var bullets = Array.isArray(row.bullets)
      ? row.bullets
          .map(function (item) {
            return trimText(item);
          })
          .filter(Boolean)
      : [];
    var description = trimText(row.description || "");
    if (!description && bullets.length) description = bullets.join("\n");
    return {
      title: trimText(row.title || row.job_title || row.role || row.position || ""),
      company: trimText(row.company || row.company_name || row.employer || row.companyName || ""),
      location: trimText(row.location || ""),
      startDate: trimText(row.startDate || row.start_date || ""),
      endDate: endDate,
      current: current,
      description: description
    };
  }

  function savedExperienceRecords(profile, inventory) {
    var fromProfile = profile && Array.isArray(profile.experience) ? profile.experience : [];
    var fromInv = inventory && Array.isArray(inventory.experience_records) ? inventory.experience_records : [];
    var raw = fromProfile.length >= fromInv.length ? fromProfile : fromInv;
    return raw
      .map(mapSavedExperience)
      .filter(function (row) {
        return Boolean(row.title || row.company);
      });
  }

  function experienceNamesMatch(a, b) {
    return normalizeText(a) === normalizeText(b);
  }

  function closestExperienceRow(titleInput) {
    var node = titleInput;
    while (node && node !== document.documentElement) {
      if (node.querySelectorAll) {
        var titles = node.querySelectorAll('input[name="jobTitle"]');
        if (titles.length === 1 && titles[0] === titleInput && node.querySelector('input[name="companyName"]')) {
          return node;
        }
      }
      node = node.parentElement;
    }
    return titleInput && titleInput.parentElement;
  }

  function collectExperienceRows(root) {
    var doc = root || document;
    var rows = [];
    if (!doc.querySelectorAll) return rows;
    Array.prototype.forEach.call(doc.querySelectorAll('input[name="jobTitle"]'), function (titleInput) {
      var row = closestExperienceRow(titleInput);
      if (row && rows.indexOf(row) === -1) rows.push(row);
    });
    return rows;
  }

  function findRowDateInput(row, which, part) {
    if (!row || !row.querySelectorAll) return null;
    var token = which === "start" ? "--startdate-" : "--enddate-";
    var autoName = part === "month" ? "dateSectionMonth-input" : "dateSectionYear-input";
    var nodes = row.querySelectorAll('input, [role="combobox"], [aria-haspopup="listbox"]');
    var i;
    var el;
    var id;
    var auto;
    var blob;
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      id = normalizeText(el.id || "");
      auto = automationId(el);
      if (auto === autoName && id.indexOf(token) !== -1) return el;
    }
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      id = normalizeText(el.id || "");
      auto = automationId(el);
      blob = id + " " + normalizeText(el.name || "") + " " + automationBlob(el);
      if (auto === autoName) {
        if (which === "start" && blob.indexOf("startdate") !== -1) return el;
        if (which === "end" && blob.indexOf("enddate") !== -1) return el;
      }
    }
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      id = normalizeText(el.id || "");
      if (id.indexOf(token) === -1) continue;
      if (part === "month" && /month/.test(id)) return el;
      if (part === "year" && /year/.test(id)) return el;
    }
    return null;
  }

  function findRoleDescription(row) {
    if (!row || !row.querySelectorAll) return null;
    var areas = row.querySelectorAll("textarea");
    var i;
    var el;
    for (i = 0; i < areas.length; i += 1) {
      el = areas[i];
      if (normalizeText(el.id || "").indexOf("--roledescription") !== -1) return el;
      if (normalizeText(el.name || "") === "roledescription") return el;
    }
    var container = row.querySelector('[data-automation-id="formField-roleDescription"]');
    if (container && container.querySelector) {
      el = container.querySelector("textarea");
      if (el) return el;
    }
    return areas.length === 1 ? areas[0] : null;
  }

  function experienceRowFields(row) {
    return {
      title: row.querySelector('input[name="jobTitle"]'),
      company: row.querySelector('input[name="companyName"]'),
      location: row.querySelector('input[name="location"]'),
      current: row.querySelector('input[type="checkbox"][name="currentlyWorkHere"]'),
      startMonth: findRowDateInput(row, "start", "month"),
      startYear: findRowDateInput(row, "start", "year"),
      endMonth: findRowDateInput(row, "end", "month"),
      endYear: findRowDateInput(row, "end", "year"),
      description: findRoleDescription(row)
    };
  }

  function isBlankExperienceRow(row) {
    var fields = experienceRowFields(row);
    return !readInputValue(fields.title) && !readInputValue(fields.company) && !readInputValue(fields.location);
  }

  function rowMatchesExperience(row, saved) {
    var fields = experienceRowFields(row);
    if (!trimText(saved.title) || !trimText(saved.company)) return false;
    return (
      experienceNamesMatch(readInputValue(fields.title), saved.title) &&
      experienceNamesMatch(readInputValue(fields.company), saved.company)
    );
  }

  function findMatchingExperienceRow(rows, saved, used) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (used && used.indexOf(rows[i]) !== -1) continue;
      if (rowMatchesExperience(rows[i], saved)) return rows[i];
    }
    return null;
  }

  function findBlankExperienceRow(rows, used) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (used && used.indexOf(rows[i]) !== -1) continue;
      if (isBlankExperienceRow(rows[i])) return rows[i];
    }
    return null;
  }

  function headingVisibleText(node) {
    if (!node) return "";
    return trimText(node.innerText || node.textContent || "");
  }

  function myExperienceHeadingKind(text) {
    var t = normalizeText(text).replace(/\s*\(.*\)\s*$/, "").replace(/\s*\*+\s*$/, "").trim();
    if (!t || t.length > 40) return "";
    if (t === "work experience" || t === "experience") return "experience";
    if (t === "education") return "education";
    if (t === "certification" || t === "certifications") return "certification";
    if (t === "language" || t === "languages") return "language";
    if (t === "website" || t === "websites" || t === "web site" || t === "web sites") return "website";
    if (t === "skill" || t === "skills") return "skill";
    if (t === "resume/cv" || t === "resume" || t === "cv") return "resume";
    return "";
  }

  function workExperienceSectionKind(node) {
    if (!node) return "";
    var auto = normalizeText(automationId(node));
    if (/\bworkexperience\b/.test(auto) || /\bwork-experience\b/.test(auto) || /\bwork_experience\b/.test(auto)) {
      return "experience";
    }
    if (/\beducation\b/.test(auto)) return "education";
    if (/\bcertif/.test(auto)) return "certification";
    if (/\blanguage/.test(auto)) return "language";
    if (/\bwebsite\b/.test(auto) || /\bwebaddress\b/.test(auto)) return "website";
    if (/\bskill/.test(auto)) return "skill";
    var heading = "";
    if (node.matches && node.matches("h1, h2, h3, h4, h5, legend, [role='heading']")) {
      heading = node.innerText || node.textContent || "";
    } else if (node.querySelector) {
      var h = null;
      try {
        h = node.querySelector(":scope > h2, :scope > h3, :scope > h4, :scope > legend");
      } catch (_) {
        h = node.querySelector("h2, h3, h4, legend");
      }
      if (h) heading = h.innerText || h.textContent || "";
    }
    return myExperienceHeadingKind(heading);
  }

  function collectMyExperienceHeadings(root) {
    var doc = root || document;
    var out = [];
    if (!doc.querySelectorAll) return out;
    var nodes = doc.querySelectorAll('h1, h2, h3, h4, h5, legend, [role="heading"], span, p, label, div');
    Array.prototype.forEach.call(nodes, function (node) {
      var text = headingVisibleText(node);
      var kind = myExperienceHeadingKind(text);
      if (!kind) return;
      if (node.querySelector && node.querySelector("input, textarea, [data-automation-id='add-button']")) return;
      if ((node.tagName || "").toLowerCase() === "div" && node.children && node.children.length) return;
      out.push({ node: node, kind: kind, text: text });
    });
    var filtered = [];
    var i;
    var j;
    var containsOther;
    for (i = 0; i < out.length; i += 1) {
      containsOther = false;
      for (j = 0; j < out.length; j += 1) {
        if (i === j) continue;
        if (out[i].node.contains && out[i].node.contains(out[j].node)) {
          containsOther = true;
          break;
        }
      }
      if (!containsOther) filtered.push(out[i]);
    }
    return filtered;
  }

  function findWorkExperienceHeadingNode(root) {
    var headings = collectMyExperienceHeadings(root);
    var i;
    var fallback = null;
    for (i = 0; i < headings.length; i += 1) {
      if (headings[i].kind !== "experience") continue;
      if (normalizeText(headings[i].text) === "work experience" || /^work experience\b/.test(normalizeText(headings[i].text))) {
        return headings[i].node;
      }
      fallback = fallback || headings[i].node;
    }
    return fallback;
  }

  function nextMyExperienceHeadingNode(root, heading) {
    var headings = collectMyExperienceHeadings(root);
    var i;
    var seen = false;
    for (i = 0; i < headings.length; i += 1) {
      if (headings[i].node === heading) {
        seen = true;
        continue;
      }
      if (seen) return headings[i].node;
    }
    return null;
  }

  function nodeIsAfter(start, target) {
    return Boolean(start && target && start.compareDocumentPosition && (start.compareDocumentPosition(target) & 4));
  }

  function nodeIsBefore(end, target) {
    return Boolean(end && target && end.compareDocumentPosition && (end.compareDocumentPosition(target) & 2));
  }

  function isInWorkExperienceBounds(target, heading, nextHeading) {
    if (!target || !heading) return false;
    if (!nodeIsAfter(heading, target) && target !== heading && !(heading.contains && heading.contains(target))) {
      return false;
    }
    if (nextHeading && !nodeIsBefore(nextHeading, target)) return false;
    return true;
  }

  function addButtonVisible(btn) {
    if (!btn || btn.disabled) return false;
    if (btn.getAttribute && btn.getAttribute("aria-hidden") === "true") return false;
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(btn) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch (_) {}
    if (btn.getClientRects && btn.getClientRects().length === 0) return false;
    return true;
  }

  function visibleAddButtonText(btn) {
    return trimText((btn && (btn.innerText || btn.textContent)) || "");
  }

  function isExactAddLabel(text) {
    return text === "Add";
  }

  function isAddAnotherLabel(text) {
    return text === "Add Another" || normalizeText(text) === "add another";
  }

  function addButtonSectionKind(btn) {
    var label = normalizeText(visibleAddButtonText(btn) || (btn && btn.getAttribute && btn.getAttribute("aria-label")) || "");
    if (/\beducation\b/.test(label)) return "education";
    if (/\bcertif/.test(label)) return "certification";
    if (/\blanguage/.test(label)) return "language";
    if (/\bwebsite\b/.test(label) || /\bweb\s*site\b/.test(label)) return "website";
    if (/\bskill/.test(label)) return "skill";
    if (/\bwork\s+experience\b/.test(label)) return "experience";
    var node = btn;
    var hops = 0;
    while (node && hops < 14) {
      var kind = workExperienceSectionKind(node);
      if (kind) return kind;
      node = node.parentElement;
      hops += 1;
    }
    return "";
  }

  function findWorkExperienceSection(root, rows) {
    var doc = root || document;
    var heading = findWorkExperienceHeadingNode(doc);
    var nextHeading = heading ? nextMyExperienceHeadingNode(doc, heading) : null;
    var list = rows && rows.length ? rows : collectExperienceRows(doc);
    var start = heading || (list.length ? list[0] : null);
    if (!start) return null;
    var node = start;
    var best = null;
    var i;
    var containsAll;
    while (node && node !== document.body && node !== document.documentElement) {
      if (nextHeading && node.contains && node.contains(nextHeading) && node !== nextHeading) break;
      if (list.length) {
        containsAll = true;
        for (i = 0; i < list.length; i += 1) {
          if (!node.contains(list[i])) {
            containsAll = false;
            break;
          }
        }
        if (!containsAll) {
          node = node.parentElement;
          continue;
        }
      }
      best = node;
      if (node.querySelector && scopedWorkExperienceAddButtons(node, heading, nextHeading, list).length) {
        return node;
      }
      node = node.parentElement;
    }
    return best;
  }

  function scopedWorkExperienceAddButtons(scope, heading, nextHeading, rows) {
    var list = [];
    if (!scope || !scope.querySelectorAll) return list;
    var buttons = scope.querySelectorAll('[data-automation-id="add-button"]');
    var i;
    var j;
    var btn;
    var kind;
    var insideRow;
    for (i = 0; i < buttons.length; i += 1) {
      btn = buttons[i];
      if (!addButtonVisible(btn)) continue;
      kind = addButtonSectionKind(btn);
      if (kind && kind !== "experience") continue;
      if (heading && !isInWorkExperienceBounds(btn, heading, nextHeading)) continue;
      insideRow = false;
      for (j = 0; j < (rows || []).length; j += 1) {
        if (rows[j] && rows[j] !== btn && rows[j].contains(btn)) {
          insideRow = true;
          break;
        }
      }
      if (insideRow) continue;
      list.push(btn);
    }
    return list;
  }

  function workExperienceAddCandidates(root, rows) {
    var doc = root || document;
    var heading = findWorkExperienceHeadingNode(doc);
    if (!heading) return [];
    var nextHeading = nextMyExperienceHeadingNode(doc, heading);
    var section = findWorkExperienceSection(doc, rows);
    var scoped = scopedWorkExperienceAddButtons(section || heading.parentElement || doc, heading, nextHeading, rows || []);
    if (scoped.length) return scoped;
    return scopedWorkExperienceAddButtons(doc, heading, nextHeading, rows || []);
  }

  function findInitialWorkExperienceAddButton(root) {
    var buttons = workExperienceAddCandidates(root, []);
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      if (isExactAddLabel(visibleAddButtonText(buttons[i]))) return buttons[i];
    }
    return null;
  }

  function findWorkExperienceAddAnotherButton(root, rows) {
    var list = rows || [];
    var buttons = workExperienceAddCandidates(root, list);
    var lastRow = list.length ? list[list.length - 1] : null;
    var i;
    var btn;
    for (i = 0; i < buttons.length; i += 1) {
      btn = buttons[i];
      if (!isAddAnotherLabel(visibleAddButtonText(btn))) continue;
      if (lastRow && lastRow.compareDocumentPosition && !(lastRow.compareDocumentPosition(btn) & 4)) continue;
      return btn;
    }
    return null;
  }

  async function waitForNewExperienceRow(root, previousCount) {
    var i;
    var rows;
    for (i = 0; i < 16; i += 1) {
      rows = collectExperienceRows(root);
      if (rows.length > previousCount) return rows;
      await sleep(120);
    }
    return collectExperienceRows(root);
  }

  async function createWorkExperienceRow(root, handledElements) {
    var rows = collectExperienceRows(root);
    var before = rows.length;
    var btn = before === 0
      ? findInitialWorkExperienceAddButton(root)
      : findWorkExperienceAddAnotherButton(root, rows);
    if (!btn) {
      return {
        ok: false,
        rows: rows,
        reason: before === 0 ? "Work Experience Add was not found." : "Work Experience Add Another was not found."
      };
    }
    markHandled(handledElements, btn);
    clickElement(btn);
    rows = await waitForNewExperienceRow(root, before);
    if (rows.length <= before) {
      return {
        ok: false,
        rows: rows,
        reason: "Workday did not create another Work Experience row."
      };
    }
    return { ok: true, rows: rows };
  }

  async function fillExperienceTextField(el, value, handledElements, overwrite) {
    if (!el) return "missing";
    markHandled(handledElements, el);
    var current = readInputValue(el);
    if (!value) return "skip";
    if (current && normalizeText(current) === normalizeText(value)) return "already";
    if (current && !overwrite) return "skip-existing";
    if (!setInputValue(el, value)) return "fail";
    var after = readInputValue(el);
    return normalizeText(after) === normalizeText(value) ? "ok" : "fail";
  }

  function monthInputValues(expectedMonth) {
    var padded = padMonth(expectedMonth) || monthNumberFromText(expectedMonth);
    var values = [];
    if (padded) values.push(padded);
    if (padded && String(parseInt(padded, 10)) !== padded) values.push(String(parseInt(padded, 10)));
    var named = monthNameFromNumber(padded);
    if (named) values.push(named);
    return values;
  }

  function monthOptionMatches(label, expectedMonth) {
    var padded = padMonth(expectedMonth) || monthNumberFromText(expectedMonth);
    if (!padded) return false;
    if (monthValuesMatch(label, padded)) return true;
    return normalizeText(label) === normalizeText(monthNameFromNumber(padded));
  }

  async function fillExperienceDatePart(el, value, handledElements, overwrite, kind) {
    if (!el) return "missing";
    if (!value) return "skip";
    markHandled(handledElements, el);
    var control = isComboboxControl(el) ? el : comboboxControlIn(fieldContainer(el));
    var matcher = kind === "month"
      ? function (label) {
          return monthOptionMatches(label, value);
        }
      : function (label) {
          return yearValuesMatch(label, value);
        };
    if (control && (isComboboxControl(control) || control !== el)) {
      var currentCombo = readComboboxText(control);
      if (currentCombo && !isPlaceholderValue(currentCombo) && matcher(currentCombo)) return "already";
      if (currentCombo && !isPlaceholderValue(currentCombo) && !overwrite) return "skip-existing";
      var selected = await selectComboboxOption(control, matcher);
      return selected.ok ? "ok" : "skip";
    }
    var current = readInputValue(el);
    if (kind === "month") {
      if (current && monthValuesMatch(current, value)) return "already";
    } else if (current && yearValuesMatch(current, value)) {
      return "already";
    }
    if (current && !overwrite) return "skip-existing";
    var candidates = kind === "month" ? monthInputValues(value) : [String(value)];
    var i;
    for (i = 0; i < candidates.length; i += 1) {
      if (!setInputValue(el, candidates[i])) continue;
      var after = readInputValue(el);
      if (kind === "month" ? monthValuesMatch(after, value) : yearValuesMatch(after, value)) return "ok";
    }
    return "skip";
  }

  function setCurrentlyWorkHere(el, shouldCheck, handledElements) {
    if (!el) return "missing";
    markHandled(handledElements, el);
    var isOn = Boolean(el.checked);
    if (isOn === Boolean(shouldCheck)) return "already";
    clickElement(el);
    try {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    return Boolean(el.checked) === Boolean(shouldCheck) ? "ok" : "fail";
  }

  function datePartVisible(el) {
    return Boolean(el) && isVisibleEnough(el);
  }

  async function fillOneExperienceRow(row, saved, handledElements) {
    var fields = experienceRowFields(row);
    var overwrite = isBlankExperienceRow(row);
    var filledAny = false;
    var failedRequired = false;

    var titleStatus = await fillExperienceTextField(fields.title, saved.title, handledElements, overwrite);
    var companyStatus = await fillExperienceTextField(fields.company, saved.company, handledElements, overwrite);
    if (titleStatus === "ok" || companyStatus === "ok") filledAny = true;
    if ((saved.title && titleStatus === "fail") || (saved.company && companyStatus === "fail")) failedRequired = true;

    var locationStatus = await fillExperienceTextField(fields.location, saved.location, handledElements, overwrite);
    if (locationStatus === "ok") filledAny = true;

    if (fields.current) {
      var currentStatus = setCurrentlyWorkHere(fields.current, Boolean(saved.current), handledElements);
      if (currentStatus === "ok" && saved.current) filledAny = true;
      if (saved.current) await sleep(180);
    }

    var start = parseExperienceMonthYear(saved.startDate);
    if (start.yearOnly || (start.year && !start.month)) {
      markHandled(handledElements, fields.startMonth);
      markHandled(handledElements, fields.startYear);
    } else if (start.month && start.year) {
      if (datePartVisible(fields.startMonth)) {
        var sm = await fillExperienceDatePart(fields.startMonth, start.month, handledElements, overwrite, "month");
        if (sm === "ok") filledAny = true;
      }
      if (datePartVisible(fields.startYear)) {
        var sy = await fillExperienceDatePart(fields.startYear, start.year, handledElements, overwrite, "year");
        if (sy === "ok") filledAny = true;
      }
    }

    if (!saved.current) {
      var end = parseExperienceMonthYear(saved.endDate);
      if (end.present) {
        markHandled(handledElements, fields.endMonth);
        markHandled(handledElements, fields.endYear);
      } else if (end.yearOnly || (end.year && !end.month)) {
        markHandled(handledElements, fields.endMonth);
        markHandled(handledElements, fields.endYear);
      } else if (end.month && end.year) {
        if (datePartVisible(fields.endMonth)) {
          var em = await fillExperienceDatePart(fields.endMonth, end.month, handledElements, overwrite, "month");
          if (em === "ok") filledAny = true;
        }
        if (datePartVisible(fields.endYear)) {
          var ey = await fillExperienceDatePart(fields.endYear, end.year, handledElements, overwrite, "year");
          if (ey === "ok") filledAny = true;
        }
      }
    }

    var descriptionStatus = await fillExperienceTextField(
      fields.description,
      saved.description,
      handledElements,
      overwrite
    );
    if (descriptionStatus === "ok") filledAny = true;

    if (failedRequired) return "failed";
    if (filledAny) return "filled";
    return "skipped";
  }

  async function fillWorkExperience(context, handledElements) {
    var ctx = context || {};
    var root = ctx.root || document;
    var saved = savedExperienceRecords(ctx.profile, ctx.inventory);
    if (!saved.length) return [];
    var results = [];
    var used = [];
    var i;
    var rows;
    var target;
    var status;
    var label;

    for (i = 0; i < saved.length; i += 1) {
      label = "Work Experience " + (i + 1);
      rows = collectExperienceRows(root);
      target = findMatchingExperienceRow(rows, saved[i], used);
      if (target) {
        used.push(target);
        status = await fillOneExperienceRow(target, saved[i], handledElements);
        if (status === "filled") {
          results.push(resultRow("experience", label, "filled", "", true, saved[i].title || saved[i].company));
        } else if (status === "failed") {
          results.push(resultRow("experience", label, "failed", "Could not persist job title or company.", false, ""));
        } else {
          results.push(resultRow("experience", label, "skipped", "Experience is already present.", false, ""));
        }
        continue;
      }

      target = findBlankExperienceRow(rows, used);
      if (!target) {
        var created = await createWorkExperienceRow(root, handledElements);
        if (!created.ok) {
          results.push(resultRow("experience", label, "failed", created.reason, false, ""));
          break;
        }
        rows = created.rows;
        target = findBlankExperienceRow(rows, used) || rows[rows.length - 1];
      }

      if (!target) {
        results.push(resultRow("experience", label, "failed", "Could not create a Work Experience row.", false, ""));
        break;
      }

      used.push(target);
      status = await fillOneExperienceRow(target, saved[i], handledElements);
      if (status === "filled") {
        results.push(resultRow("experience", label, "filled", "", true, saved[i].title || saved[i].company));
      } else if (status === "failed") {
        results.push(resultRow("experience", label, "failed", "Could not persist job title or company.", false, ""));
        break;
      } else {
        results.push(resultRow("experience", label, "skipped", "Experience is already present.", false, ""));
      }
    }

    return results;
  }

  async function fillSupportedFields(context) {
    if (!isSupportedPage()) {
      var handled = (context && context.handledElements) || [];
      return summarize([], handled);
    }
    var info = await fillMyInformation(context);
    var handledElements = (info && info.handledElements) || (context && context.handledElements) || [];
    var resumeRows = await fillResumeCvUpload(context, handledElements);
    var experienceRows = await fillWorkExperience(context, handledElements);
    return summarize(((info && info.results) || []).concat(resumeRows, experienceRows), handledElements);
  }

  global.ImpulsoWorkdayAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
