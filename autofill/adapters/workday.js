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

  function mapSavedEducation(item) {
    var engine = af();
    var row = item && typeof item === "object" ? item : {};
    var normalized = {};
    if (engine && typeof engine.normalizeEducationRecord === "function") {
      normalized = engine.normalizeEducationRecord(item) || {};
    }
    return {
      institution: trimText(
        normalized.institution || row.institution || row.school_name || row.school || row.university || ""
      ),
      degree: trimText(normalized.degree || row.degree || row.degree_type || ""),
      field: trimText(
        normalized.field || row.field || row.major || row.discipline || row.fieldOfStudy || row.field_of_study || ""
      ),
      location: trimText(normalized.location || row.location || ""),
      startDate: trimText(normalized.startDate || row.startDate || row.start_date || ""),
      endDate: trimText(normalized.endDate || row.endDate || row.end_date || row.graduation_year || ""),
      gpa: trimText(normalized.gpa || row.gpa || ""),
      isCurrent: Boolean(normalized.isCurrent || row.isCurrent || row.currentlyEnrolled || row.inProgress)
    };
  }

  function savedEducationRecords(profile, inventory) {
    var fromProfile = profile && Array.isArray(profile.education) ? profile.education : [];
    var fromInv = inventory && Array.isArray(inventory.education_records) ? inventory.education_records : [];
    var raw = fromProfile.length >= fromInv.length ? fromProfile : fromInv;
    return raw
      .map(mapSavedEducation)
      .filter(function (row) {
        return Boolean(row.institution || row.degree || row.field || row.startDate || row.endDate);
      });
  }

  function educationYearFromDate(value) {
    var engine = af();
    if (engine && typeof engine.extractYearFromEducationDate === "function") {
      return trimText(engine.extractYearFromEducationDate(value) || "");
    }
    var text = trimText(value);
    if (!text) return "";
    if (/^(present|current|now|ongoing|in\s*progress|expected|n\/?a)$/i.test(text)) return "";
    var match = text.match(/\b((?:19|20)\d{2})\b/);
    return match ? match[1] : "";
  }

  function compactDegreeText(value) {
    return normalizeText(value)
      .replace(/['’`]/g, "")
      .replace(/\./g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function workdayDegreeCode(value) {
    var text = compactDegreeText(value);
    var compact = text.replace(/\s+/g, "");
    if (!text) return "";
    if (compact === "mba" || /\bmba\b/.test(text) || /\bmaster of business administration\b/.test(text)) return "MBA";
    if (
      compact === "phd" ||
      /\bphd\b/.test(text) ||
      /\bdoctor of philosophy\b/.test(text) ||
      /\bdoctorate\b/.test(text) ||
      /\bdoctoral\b/.test(text)
    ) {
      return "PhD";
    }
    if (compact === "jd" || /\bjd\b/.test(text) || /\bjuris doctor\b/.test(text)) return "JD";
    if (compact === "ma" || /\bmaster of arts\b/.test(text) || /(^|\s)m a($|\s)/.test(text)) return "MA";
    if (
      compact === "ms" ||
      compact === "msc" ||
      compact === "me" ||
      compact === "meng" ||
      /\bmaster of science\b/.test(text) ||
      /\bmaster of engineering\b/.test(text) ||
      /(^|\s)m s($|\s)/.test(text) ||
      /(^|\s)m e($|\s)/.test(text)
    ) {
      return "MS";
    }
    if (compact === "ba" || /\bbachelor of arts\b/.test(text) || /(^|\s)b a($|\s)/.test(text)) return "BA";
    if (
      compact === "bs" ||
      compact === "bsc" ||
      compact === "be" ||
      compact === "beng" ||
      compact === "btech" ||
      /\bbachelor of science\b/.test(text) ||
      /\bbachelor of engineering\b/.test(text) ||
      /\bbachelor of technology\b/.test(text) ||
      /(^|\s)b s($|\s)/.test(text) ||
      /(^|\s)b e($|\s)/.test(text) ||
      /(^|\s)b tech($|\s)/.test(text)
    ) {
      return "BS";
    }
    return "";
  }

  function isAbbreviatedDegreeOption(optionLabel) {
    var t = trimText(optionLabel);
    return /^(AA|AS|AAS|BA|BS|BSc|BE|BEng|MA|MS|MSc|MBA|MEng|PhD|JD|MD)$/i.test(t);
  }

  function degreesEqualNormalized(a, b) {
    var left = compactDegreeText(a);
    var right = compactDegreeText(b);
    return Boolean(left && right && left === right);
  }

  function degreeExactMatch(savedDegree, optionLabel) {
    var saved = trimText(savedDegree);
    var option = trimText(optionLabel);
    if (!saved || !option || isPlaceholderValue(option)) return false;
    if (normalizeText(saved) === normalizeText(option)) return true;
    return degreesEqualNormalized(saved, option);
  }

  function degreeAliasMatch(savedDegree, optionLabel) {
    var option = trimText(optionLabel);
    if (!option || isPlaceholderValue(option) || !isAbbreviatedDegreeOption(option)) return false;
    var savedCode = workdayDegreeCode(savedDegree);
    if (!savedCode) return false;
    return normalizeText(option) === normalizeText(savedCode) || workdayDegreeCode(option) === savedCode;
  }

  function degreeOptionMatches(savedDegree, optionLabel) {
    return degreeExactMatch(savedDegree, optionLabel) || degreeAliasMatch(savedDegree, optionLabel);
  }

  function pickDegreeOption(options, savedDegree) {
    var code = workdayDegreeCode(savedDegree);
    if (!code) return null;
    var i;
    var opt;
    for (i = 0; i < (options || []).length; i += 1) {
      opt = options[i];
      if (opt && normalizeText(opt.label) === normalizeText(code)) return opt;
    }
    return null;
  }

  function degreeAlreadyFilled(current, savedDegree) {
    var code = workdayDegreeCode(savedDegree);
    var currentText = trimText(current);
    if (!code || !currentText || isPlaceholderValue(currentText)) return false;
    return normalizeText(currentText) === normalizeText(code);
  }

  function canonicalFieldOfStudy(value) {
    var t = normalizeText(value).replace(/\s*\(.*\)\s*$/, "").trim();
    if (t === "cs" || t === "c s" || t === "comp sci" || t === "compsci") return "computer science";
    return t;
  }

  function normalizePickerLabel(value) {
    return canonicalFieldOfStudy(value)
      .replace(/[’']/g, "")
      .replace(/[.,]/g, " ")
      .replace(/\s+&\s+/g, " and ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function workdayFieldOfStudyAlias(saved) {
    var key = normalizePickerLabel(saved);
    if (!key) return "";
    if (key === "computer science" || key === "cs" || key === "comp sci" || key === "compsci") {
      return "Computer and Information Science";
    }
    if (key === "computer engineering") return "Computer Engineering";
    return "";
  }

  function fieldOfStudyMatches(saved, optionLabel) {
    var a = normalizePickerLabel(saved);
    var b = normalizePickerLabel(optionLabel);
    return Boolean(a && b && a === b);
  }

  function pickFieldOfStudyOption(options, targetLabel) {
    var want = normalizePickerLabel(targetLabel);
    if (!want) return null;
    var i;
    var opt;
    var label;
    var best = null;
    var bestLen = Infinity;
    for (i = 0; i < (options || []).length; i += 1) {
      opt = options[i];
      if (!opt) continue;
      label = trimText(opt.label);
      if (normalizePickerLabel(label) !== want) continue;
      if (label.length > trimText(targetLabel).length + 12) continue;
      if (label.length < bestLen) {
        best = opt;
        bestLen = label.length;
      }
    }
    return best;
  }

  function fieldOfStudySatisfied(current, saved) {
    if (promptContainsField(current, saved)) return true;
    var alias = workdayFieldOfStudyAlias(saved);
    return Boolean(alias && promptContainsField(current, alias));
  }

  function promptContainsField(current, want) {
    var text = trimText(current);
    if (!text || !trimText(want)) return false;
    if (fieldOfStudyMatches(want, text)) return true;
    var chunks = text.split(/\s*[;,\n]\s*/);
    var i;
    for (i = 0; i < chunks.length; i += 1) {
      if (fieldOfStudyMatches(want, chunks[i])) return true;
    }
    return false;
  }

  function savedFieldsOfStudy(saved) {
    var raw = trimText(saved && saved.field);
    if (!raw) return [];
    var parts = raw.split(/\s*[;|\n]\s*/).map(trimText).filter(Boolean);
    return parts.length ? parts : [raw];
  }

  function closestEducationRow(schoolInput) {
    var node = schoolInput;
    while (node && node !== document.documentElement) {
      if (node.querySelectorAll) {
        var schools = node.querySelectorAll('input[name="schoolName"]');
        if (schools.length === 1 && schools[0] === schoolInput) {
          if (node.querySelector('button[name="degree"], [name="degree"]')) return node;
        }
      }
      node = node.parentElement;
    }
    return schoolInput && schoolInput.parentElement;
  }

  function collectEducationRows(root) {
    var doc = root || document;
    var rows = [];
    if (!doc.querySelectorAll) return rows;
    Array.prototype.forEach.call(doc.querySelectorAll('input[name="schoolName"]'), function (schoolInput) {
      var row = closestEducationRow(schoolInput);
      if (row && rows.indexOf(row) === -1) rows.push(row);
    });
    return rows;
  }

  function findEducationYearInput(row, which) {
    if (!row || !row.querySelectorAll) return null;
    var token = which === "first" ? "--firstyearattended-" : "--lastyearattended-";
    var alt = which === "first" ? "firstyearattended" : "lastyearattended";
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
      if (auto === "dateSectionYear-input" && id.indexOf(token) !== -1) return el;
    }
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      blob = normalizeText(el.id || "") + " " + normalizeText(el.name || "") + " " + automationBlob(el);
      if (blob.indexOf(alt) !== -1 && (automationId(el) === "dateSectionYear-input" || /year/.test(blob))) {
        return el;
      }
    }
    return null;
  }

  function findEducationGpaInput(row) {
    if (!row || !row.querySelector) return null;
    var named = row.querySelector(
      'input[name="gpa"], input[name="overallResult"], input[name="overallGPA"], input[name="gradeAverage"]'
    );
    if (named) return named;
    var exact = row.querySelector(
      '[data-automation-id="formField-gpa"], [data-automation-id="formField-overallResult"], [data-automation-id="formField-gradeAverage"]'
    );
    if (exact && exact.querySelector) {
      named = exact.querySelector('input:not([type="hidden"])');
      if (named) return named;
    }
    var containers = row.querySelectorAll('[data-automation-id^="formField-"]');
    var i;
    var container;
    var blob;
    for (i = 0; i < containers.length; i += 1) {
      container = containers[i];
      blob = normalizeText(containerLabel(container) + " " + automationId(container));
      if (!/\bgpa\b/.test(blob) && !/\boverall\s+result\b/.test(blob)) continue;
      named = container.querySelector('input:not([type="hidden"])');
      if (named) return named;
    }
    return null;
  }

  function findFieldOfStudyContainer(row) {
    if (!row || !row.querySelector) return null;
    var exact = row.querySelector(
      '[data-automation-id="formField-fieldOfStudy"], [data-automation-id="formField-fieldsOfStudy"], [data-automation-id="formField-major"], [data-automation-id*="fieldOfStudy"], [data-automation-id*="FieldOfStudy"], [data-automation-id*="fieldsOfStudy"]'
    );
    if (exact && row.contains(exact)) return fieldContainer(exact) || exact;
    var containers = row.querySelectorAll('[data-automation-id^="formField-"]');
    var i;
    var container;
    var blob;
    for (i = 0; i < containers.length; i += 1) {
      container = containers[i];
      blob = normalizeText(containerLabel(container) + " " + widgetLabel(container) + " " + automationId(container));
      if (/\bfield\s+of\s+study\b/.test(blob) || /\bfieldofstudy\b/.test(blob)) return container;
    }
    return null;
  }

  function fieldOfStudyControl(container) {
    if (!container || !container.querySelector) return null;
    var named = container.querySelector(
      '[data-automation-id="multiSelectContainer"], [data-automation-id="multiselectInputContainer"], [data-automation-id="promptSearchButton"], [data-automation-id="searchBox"]'
    );
    if (named && isVisibleEnough(named)) return named;
    var combo = comboboxControlIn(container);
    if (combo) return combo;
    var button = container.querySelector('button[aria-haspopup="listbox"], [role="combobox"], button');
    if (button && isVisibleEnough(button) && automationId(button) !== "add-button") return button;
    var input = container.querySelector('input:not([type="hidden"]):not([name="schoolName"]):not([name="gpa"])');
    if (input && isVisibleEnough(input) && automationId(input) !== "dateSectionYear-input") return input;
    return null;
  }

  function findDegreeControl(row) {
    if (!row || !row.querySelector) return null;
    var btn = row.querySelector('button[name="degree"]');
    if (btn && row.contains(btn)) return btn;
    var container = row.querySelector('[data-automation-id="formField-degree"]');
    if (container && row.contains(container)) {
      return (
        comboboxControlIn(container) ||
        container.querySelector('button[name="degree"], button[aria-haspopup="listbox"], [role="combobox"]') ||
        container.querySelector("button")
      );
    }
    return null;
  }

  function isSearchInput(el) {
    if (!isTextLikeInput(el)) return false;
    var auto = automationId(el);
    if (auto === "searchBox" || auto === "promptSearchField" || auto === "searchField" || auto === "textInputBox") {
      return true;
    }
    var placeholder = normalizeText((el.getAttribute && el.getAttribute("placeholder")) || "");
    if (/\bsearch\b/.test(placeholder)) return true;
    if (/\btype to add skills\b/.test(placeholder) || /\badd skills\b/.test(placeholder)) return true;
    return false;
  }

  function readPromptSelectedText(container) {
    if (!container) return "";
    var chips = container.querySelectorAll(
      '[data-automation-id="promptSelectedItem"], [data-automation-id="selectedItem"], [data-automation-id="pill"], [data-automation-id="promptOption"][aria-checked="true"], [aria-selected="true"]'
    );
    var labels = [];
    Array.prototype.forEach.call(chips, function (chip) {
      if (isSearchInput(chip)) return;
      var text =
        trimText((chip.getAttribute && chip.getAttribute("data-automation-label")) || "") ||
        trimText(chip.innerText || chip.textContent || "");
      if (text && !isPlaceholderValue(text) && !isSearchInput(chip) && labels.indexOf(text) === -1) {
        labels.push(text);
      }
    });
    if (labels.length) return labels.join("; ");
    var control = fieldOfStudyControl(container);
    if (control && !isSearchInput(control) && !isTextLikeInput(control)) {
      var shown = readComboboxText(control);
      if (shown && !isPlaceholderValue(shown)) return shown;
    }
    return "";
  }

  function educationRowFields(row) {
    return {
      school: row.querySelector('input[name="schoolName"]'),
      degree: findDegreeControl(row),
      fieldContainer: findFieldOfStudyContainer(row),
      gpa: findEducationGpaInput(row),
      firstYear: findEducationYearInput(row, "first"),
      lastYear: findEducationYearInput(row, "last")
    };
  }

  function isBlankEducationRow(row) {
    var fields = educationRowFields(row);
    var degreeText = readComboboxText(fields.degree);
    return !readInputValue(fields.school) && (!degreeText || isPlaceholderValue(degreeText));
  }

  function rowMatchesEducation(row, saved) {
    var fields = educationRowFields(row);
    var school = readInputValue(fields.school);
    var degree = readComboboxText(fields.degree);
    if (!trimText(saved.institution) || !experienceNamesMatch(school, saved.institution)) return false;
    if (trimText(saved.degree) && degree && !isPlaceholderValue(degree)) {
      var savedCode = workdayDegreeCode(saved.degree);
      var currentCode = workdayDegreeCode(degree);
      if (savedCode && currentCode) return savedCode === currentCode;
      if (degreeExactMatch(saved.degree, degree) || degreeOptionMatches(saved.degree, degree)) return true;
      return false;
    }
    return true;
  }

  function findMatchingEducationRow(rows, saved, used) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (used && used.indexOf(rows[i]) !== -1) continue;
      if (rowMatchesEducation(rows[i], saved)) return rows[i];
    }
    return null;
  }

  function findBlankEducationRow(rows, used) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (used && used.indexOf(rows[i]) !== -1) continue;
      if (isBlankEducationRow(rows[i])) return rows[i];
    }
    return null;
  }

  function findEducationHeadingNode(root) {
    var headings = collectMyExperienceHeadings(root);
    var i;
    for (i = 0; i < headings.length; i += 1) {
      if (headings[i].kind === "education") return headings[i].node;
    }
    return null;
  }

  function scopedEducationAddButtons(scope, heading, nextHeading, rows) {
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
      if (kind && kind !== "education") continue;
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

  function findEducationSection(root, rows) {
    var doc = root || document;
    var heading = findEducationHeadingNode(doc);
    var nextHeading = heading ? nextMyExperienceHeadingNode(doc, heading) : null;
    var list = rows && rows.length ? rows : collectEducationRows(doc);
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
      if (node.querySelector && scopedEducationAddButtons(node, heading, nextHeading, list).length) {
        return node;
      }
      node = node.parentElement;
    }
    return best;
  }

  function educationAddCandidates(root, rows) {
    var doc = root || document;
    var heading = findEducationHeadingNode(doc);
    if (!heading) return [];
    var nextHeading = nextMyExperienceHeadingNode(doc, heading);
    var section = findEducationSection(doc, rows);
    var scoped = scopedEducationAddButtons(section || heading.parentElement || doc, heading, nextHeading, rows || []);
    if (scoped.length) return scoped;
    return scopedEducationAddButtons(doc, heading, nextHeading, rows || []);
  }

  function findInitialEducationAddButton(root) {
    var buttons = educationAddCandidates(root, []);
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      if (isExactAddLabel(visibleAddButtonText(buttons[i]))) return buttons[i];
    }
    return null;
  }

  function findEducationAddAnotherButton(root, rows) {
    var list = rows || [];
    var buttons = educationAddCandidates(root, list);
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

  async function waitForNewEducationRow(root, previousCount) {
    var i;
    var rows;
    for (i = 0; i < 16; i += 1) {
      rows = collectEducationRows(root);
      if (rows.length > previousCount) return rows;
      await sleep(120);
    }
    return collectEducationRows(root);
  }

  async function createEducationRow(root, handledElements) {
    var rows = collectEducationRows(root);
    var before = rows.length;
    var btn = before === 0 ? findInitialEducationAddButton(root) : findEducationAddAnotherButton(root, rows);
    if (!btn) {
      return {
        ok: false,
        rows: rows,
        reason: before === 0 ? "Education Add was not found." : "Education Add Another was not found."
      };
    }
    markHandled(handledElements, btn);
    clickElement(btn);
    rows = await waitForNewEducationRow(root, before);
    if (rows.length <= before) {
      return {
        ok: false,
        rows: rows,
        reason: "Workday did not create another Education row."
      };
    }
    return { ok: true, rows: rows };
  }

  function closeOpenList() {
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } catch (_) {}
  }

  function isTextLikeInput(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag !== "input") return false;
    var type = normalizeText(el.type || "text");
    return !type || type === "text" || type === "search";
  }

  function isEducationAuxiliaryInput(el) {
    if (!el) return false;
    var name = normalizeText(el.name || "");
    var id = normalizeText(el.id || "");
    var auto = automationId(el);
    if (name === "schoolname" || name === "gpa" || name === "overallresult") return true;
    if (id.indexOf("firstyearattended") !== -1 || id.indexOf("lastyearattended") !== -1) return true;
    if (auto === "dateSectionYear-input" || auto === "dateSectionMonth-input") return true;
    return false;
  }

  function pickerOptionLabel(node) {
    if (!node) return "";
    return (
      trimText(node.getAttribute && node.getAttribute("data-automation-label")) ||
      trimText(node.getAttribute && node.getAttribute("aria-label")) ||
      trimText(node.innerText || node.textContent || "")
    );
  }

  function isPickerOptionContainer(node) {
    if (!node || !node.querySelector) return false;
    var auto = automationId(node);
    var role = (node.getAttribute && node.getAttribute("role")) || "";
    if (auto === "promptOption" || role === "option" || role === "radio") return false;
    return Boolean(node.querySelector('[data-automation-id="promptOption"], [role="option"]'));
  }

  function collectPickerOptions() {
    var options = [];
    var seen = [];
    var nodes = document.querySelectorAll(
      '[data-automation-id="promptOption"], [role="option"], [role="radio"], [data-automation-id="menuItem"], [data-automation-id="promptLeafNode"], input[type="radio"], label, li'
    );
    Array.prototype.forEach.call(nodes, function (node) {
      if (seen.indexOf(node) !== -1) return;
      if (!isVisibleEnough(node)) return;
      if (isPickerOptionContainer(node)) return;
      var label = pickerOptionLabel(node);
      if (!label || isPlaceholderValue(label) || looksLikeSaveOrContinue(label)) return;
      if (isExactAddLabel(label) || isAddAnotherLabel(label)) return;
      if (label.indexOf("\n") !== -1 && label.split("\n").length > 2) return;
      options.push({ el: node, label: label });
      seen.push(node);
    });
    return options;
  }

  function findExactVisibleOption(targetLabel) {
    var want = normalizePickerLabel(targetLabel);
    if (!want) return null;
    var options = collectPickerOptions();
    var i;
    var opt;
    var best = null;
    var bestLen = Infinity;
    for (i = 0; i < options.length; i += 1) {
      opt = options[i];
      if (!opt) continue;
      if (normalizePickerLabel(opt.label) !== want && normalizeText(opt.label) !== normalizeText(targetLabel)) continue;
      if (trimText(opt.label).length < bestLen) {
        best = opt;
        bestLen = trimText(opt.label).length;
      }
    }
    return best;
  }

  async function waitForMatchingPickerOption(targetLabel, pickFn) {
    var i;
    var options;
    var picked;
    for (i = 0; i < 20; i += 1) {
      options = collectPickerOptions();
      picked = pickFn ? pickFn(options) : null;
      if (!picked) picked = findExactVisibleOption(targetLabel);
      if (picked) return picked;
      await sleep(120);
    }
    return (pickFn && pickFn(collectPickerOptions())) || findExactVisibleOption(targetLabel);
  }

  function clickPickerOption(picked) {
    if (!picked || !picked.el) return;
    var el = picked.el;
    var radio =
      (el.matches && el.matches('input[type="radio"], [role="radio"]') && el) ||
      (el.querySelector && el.querySelector('input[type="radio"], [role="radio"]'));
    if (radio) clickElement(radio);
    clickElement(el);
    var optionRoot = el.closest
      ? el.closest('[data-automation-id="promptOption"]') || el.closest('[role="option"]')
      : null;
    if (optionRoot && optionRoot !== el && optionRoot !== radio) clickElement(optionRoot);
  }

  function findActiveWorkdaySearchInput(control) {
    var active = document.activeElement;
    if (isTextLikeInput(active) && isVisibleEnough(active) && !isEducationAuxiliaryInput(active)) return active;
    var selectors =
      '[data-automation-id="searchBox"], [data-automation-id="promptSearchField"], [data-automation-id="searchField"], [data-automation-id="textInputBox"], input[type="search"]';
    var popups = document.querySelectorAll(
      '[data-automation-id="promptBox"], [data-automation-id="activeListContainer"], [data-automation-id="wd-popup"], [data-automation-widget="wd-popup"]'
    );
    var i;
    var popup;
    var input;
    for (i = 0; i < popups.length; i += 1) {
      popup = popups[i];
      if (!popup.querySelector) continue;
      input = popup.querySelector(selectors) || popup.querySelector('input:not([type="hidden"])');
      if (isTextLikeInput(input) && isVisibleEnough(input) && !isEducationAuxiliaryInput(input)) return input;
    }
    var container = fieldContainer(control);
    if (container && container.querySelector) {
      input = container.querySelector(selectors) || container.querySelector('input:not([type="hidden"]):not([name="schoolName"])');
      if (isTextLikeInput(input) && isVisibleEnough(input) && !isEducationAuxiliaryInput(input)) return input;
    }
    if (isTextLikeInput(control) && isVisibleEnough(control) && !isEducationAuxiliaryInput(control)) return control;
    return null;
  }

  async function typeIntoWorkdaySearch(input, query) {
    if (!input || !trimText(query)) return false;
    try {
      input.focus();
    } catch (_) {}
    setInputValue(input, "");
    await sleep(40);
    setInputValue(input, query);
    try {
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
    } catch (_) {}
    return true;
  }

  async function selectEducationPickerOption(control, queries, pickFn, isSelectedFn) {
    if (!control) return { ok: false, value: "" };
    clickElement(control);
    await sleep(200);
    var picked = pickFn(collectPickerOptions());
    var i;
    var search;
    var query;
    var verified = false;
    for (i = 0; i < (queries || []).length && !picked; i += 1) {
      query = trimText(queries[i]);
      if (!query) continue;
      search = findActiveWorkdaySearchInput(control);
      if (!search) {
        clickElement(control);
        await sleep(160);
        search = findActiveWorkdaySearchInput(control);
      }
      if (!search) continue;
      await typeIntoWorkdaySearch(search, query);
      picked = await waitForMatchingPickerOption(query, pickFn);
    }
    if (!picked && queries && queries[0]) picked = findExactVisibleOption(queries[0]);
    if (!picked) {
      closeOpenList();
      return { ok: false, value: "" };
    }
    clickPickerOption(picked);
    for (i = 0; i < 16; i += 1) {
      if (typeof isSelectedFn === "function" && isSelectedFn(picked.label)) {
        verified = true;
        break;
      }
      if (i === 5) clickPickerOption(picked);
      await sleep(120);
    }
    closeOpenList();
    if (typeof isSelectedFn === "function") {
      await sleep(80);
      if (!verified) verified = isSelectedFn(picked.label);
      return { ok: verified, value: picked.label };
    }
    return { ok: true, value: picked.label };
  }

  async function fillEducationDegree(control, savedDegree, handledElements, overwrite) {
    if (!control) return "missing";
    markHandled(handledElements, control);
    if (!trimText(savedDegree)) return "skip";
    var code = workdayDegreeCode(savedDegree);
    if (!code) return "skip";
    var current = readComboboxText(control);
    if (degreeAlreadyFilled(current, savedDegree)) return "already";
    var longSameLevel = Boolean(
      current &&
        !isPlaceholderValue(current) &&
        workdayDegreeCode(current) === code &&
        !isAbbreviatedDegreeOption(current)
    );
    if (current && !isPlaceholderValue(current) && !overwrite && !longSameLevel) return "skip-existing";
    var selected = await selectEducationPickerOption(
      control,
      [code],
      function (options) {
        return pickDegreeOption(options, savedDegree) || findExactVisibleOption(code);
      },
      function () {
        return degreeAlreadyFilled(readComboboxText(control), savedDegree);
      }
    );
    if (!selected.ok) {
      closeOpenList();
      return "skip";
    }
    return "ok";
  }

  function isFieldOfStudySelectable(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    var tag = (el.tagName || "").toLowerCase();
    var role = normalizeText((el.getAttribute && el.getAttribute("role")) || "");
    var auto = automationId(el);
    if (role === "option" || role === "radio" || role === "listitem" || role === "menuitem") return true;
    if (auto === "promptOption" || auto === "menuItem" || auto === "promptLeafNode") return true;
    if (tag === "button" || tag === "label" || tag === "li" || tag === "a") return true;
    if (tag === "input" && /^(radio|checkbox)$/.test(normalizeText(el.type || ""))) return true;
    if (el.getAttribute && el.getAttribute("tabindex") != null && el.getAttribute("tabindex") !== "") return true;
    return false;
  }

  function isEntireFieldOfStudyResultList(el) {
    if (!el || !el.querySelectorAll) return false;
    var rows = el.querySelectorAll(
      'input[type="radio"], [role="radio"], [role="option"], [data-automation-id="promptOption"], [data-automation-id="promptLeafNode"]'
    );
    return rows.length > 1;
  }

  function isFieldOfStudySearchChrome(el, searchInput) {
    if (!el || !searchInput) return false;
    if (el === searchInput) return true;
    if (isSearchInput(el) || isTextLikeInput(el) || isEducationAuxiliaryInput(el)) return true;
    if (searchInput.contains && searchInput.contains(el)) return true;
    if (el.contains && el.contains(searchInput) && !isEntireFieldOfStudyResultList(el)) {
      var resultHits = el.querySelectorAll
        ? el.querySelectorAll(
            'input[type="radio"], [role="radio"], [role="option"], [data-automation-id="promptOption"], [data-automation-id="promptLeafNode"]'
          )
        : [];
      if (!resultHits.length) return true;
    }
    return false;
  }

  function fieldOfStudyResultRowSelector() {
    return 'input[type="radio"], [role="radio"], [role="option"], [data-automation-id="promptOption"], [data-automation-id="promptLeafNode"]';
  }

  function collectOpenFieldOfStudyResultLists(searchInput) {
    var lists = [];
    var seen = [];
    function add(node) {
      if (!node || seen.indexOf(node) !== -1) return;
      if (node === document.body || node === document.documentElement) return;
      if (!isVisibleEnough(node)) return;
      if (isFieldOfStudySearchChrome(node, searchInput)) return;
      var hits = node.querySelectorAll ? node.querySelectorAll(fieldOfStudyResultRowSelector()) : [];
      if (!hits.length) return;
      seen.push(node);
      lists.push(node);
    }
    var nodes = document.querySelectorAll(
      '[data-automation-id="promptBox"], [data-automation-id="activeListContainer"], [data-automation-id="wd-Popup"], [data-automation-id="wd-popup"], [data-automation-widget="wd-popup"], [role="listbox"], [role="radiogroup"]'
    );
    Array.prototype.forEach.call(nodes, add);
    var optionNodes = document.querySelectorAll(fieldOfStudyResultRowSelector());
    Array.prototype.forEach.call(optionNodes, function (opt) {
      if (isFieldOfStudySearchChrome(opt, searchInput)) return;
      if (!isVisibleEnough(opt) && !(opt.parentElement && isVisibleEnough(opt.parentElement))) return;
      var parent = opt.parentElement;
      var hops = 0;
      while (parent && hops < 6 && parent !== document.body) {
        if (isEntireFieldOfStudyResultList(parent)) {
          add(parent);
          break;
        }
        parent = parent.parentElement;
        hops += 1;
      }
      if (opt.parentElement) add(opt.parentElement);
    });
    var node = searchInput;
    var hops = 0;
    while (node && hops < 12 && node !== document.body) {
      add(node);
      node = node.parentElement;
      hops += 1;
    }
    lists.sort(function (a, b) {
      return (a.querySelectorAll("*").length || 0) - (b.querySelectorAll("*").length || 0);
    });
    return lists;
  }

  function fieldOfStudyRowLabel(row) {
    if (!row) return "";
    var autoLabel = trimText(row.getAttribute && row.getAttribute("data-automation-label"));
    if (autoLabel) return autoLabel;
    var aria = trimText(row.getAttribute && row.getAttribute("aria-label"));
    if (aria && aria.length < 120) return aria;
    return trimText(row.innerText || row.textContent || "");
  }

  function fieldOfStudyLabelEqualsTarget(text, target) {
    var raw = trimText(text);
    var want = normalizePickerLabel(target);
    if (!raw || !want) return false;
    if (raw.indexOf("\n") !== -1 && raw.split("\n").length > 2) return false;
    if (raw.length > trimText(target).length + 8) return false;
    return normalizePickerLabel(raw) === want || normalizeText(raw) === normalizeText(target);
  }

  function associatedRadioForLabel(labelEl) {
    if (!labelEl) return null;
    var nested = labelEl.querySelector && labelEl.querySelector('input[type="radio"], [role="radio"]');
    if (nested) return nested;
    var id = labelEl.getAttribute && labelEl.getAttribute("for");
    if (id) {
      var byId = document.getElementById(id);
      if (byId && /radio/i.test((byId.type || "") + " " + ((byId.getAttribute && byId.getAttribute("role")) || ""))) {
        return byId;
      }
    }
    return null;
  }

  function fieldOfStudyRowFromText(start, list) {
    if (!start) return start;
    var hop = start;
    var n = 0;
    var row = start;
    while (hop && n < 8 && hop !== list && hop !== document.body) {
      if (isEntireFieldOfStudyResultList(hop)) break;
      if (isFieldOfStudySelectable(hop)) row = hop;
      hop = hop.parentElement;
      n += 1;
    }
    return row;
  }

  function radioInsideRow(row) {
    if (!row) return null;
    if (row.matches && row.matches('input[type="radio"], [role="radio"]')) return row;
    return (row.querySelector && row.querySelector('input[type="radio"], [role="radio"]')) || null;
  }

  function findFieldOfStudyRadioRowInList(list, target, searchInput) {
    if (!list || !list.querySelectorAll) return null;
    var radios = list.querySelectorAll('input[type="radio"], [role="radio"]');
    var i;
    var radio;
    var row;
    var label;
    for (i = 0; i < radios.length; i += 1) {
      radio = radios[i];
      if (isFieldOfStudySearchChrome(radio, searchInput)) continue;
      if (!isVisibleEnough(radio) && !(radio.parentElement && isVisibleEnough(radio.parentElement))) continue;
      row =
        (radio.closest &&
          (radio.closest("label") ||
            radio.closest('[data-automation-id="promptOption"]') ||
            radio.closest('[data-automation-id="promptLeafNode"]') ||
            radio.closest('[role="option"]') ||
            radio.closest('[role="radio"]') ||
            radio.closest("li"))) ||
        radio.parentElement;
      if (isEntireFieldOfStudyResultList(row)) continue;
      label = fieldOfStudyRowLabel(row);
      if (fieldOfStudyLabelEqualsTarget(label, target)) {
        return { radio: radio, row: row || radio, label: label };
      }
    }
    var labels = list.querySelectorAll("label");
    for (i = 0; i < labels.length; i += 1) {
      if (!isVisibleEnough(labels[i])) continue;
      if (isFieldOfStudySearchChrome(labels[i], searchInput)) continue;
      if (isEntireFieldOfStudyResultList(labels[i])) continue;
      label = fieldOfStudyRowLabel(labels[i]);
      if (!fieldOfStudyLabelEqualsTarget(label, target)) continue;
      radio = associatedRadioForLabel(labels[i]);
      return { radio: radio, row: labels[i], label: label };
    }
    var options = list.querySelectorAll(
      '[data-automation-id="promptOption"], [data-automation-id="promptLeafNode"], [role="option"], [role="listitem"], li'
    );
    for (i = 0; i < options.length; i += 1) {
      if (!isVisibleEnough(options[i])) continue;
      if (isFieldOfStudySearchChrome(options[i], searchInput)) continue;
      if (isEntireFieldOfStudyResultList(options[i])) continue;
      label = fieldOfStudyRowLabel(options[i]);
      if (!fieldOfStudyLabelEqualsTarget(label, target)) continue;
      return { radio: radioInsideRow(options[i]), row: options[i], label: label };
    }
    var textNodes = list.querySelectorAll("div, span, p, td, button, [data-automation-id], [role]");
    var candidates = [];
    Array.prototype.forEach.call(textNodes, function (node) {
      if (!isVisibleEnough(node)) return;
      if (isFieldOfStudySearchChrome(node, searchInput)) return;
      if (isEntireFieldOfStudyResultList(node)) return;
      if (!fieldOfStudyLabelEqualsTarget(fieldOfStudyRowLabel(node), target)) return;
      candidates.push(node);
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      var aLen = trimText(a.innerText || a.textContent || "").length;
      var bLen = trimText(b.innerText || b.textContent || "").length;
      if (aLen !== bLen) return aLen - bLen;
      var aDepth = 0;
      var bDepth = 0;
      var n;
      for (n = a; n; n = n.parentElement) aDepth += 1;
      for (n = b; n; n = n.parentElement) bDepth += 1;
      return bDepth - aDepth;
    });
    row = fieldOfStudyRowFromText(candidates[0], list);
    if (isEntireFieldOfStudyResultList(row)) return null;
    label = fieldOfStudyRowLabel(row);
    if (!fieldOfStudyLabelEqualsTarget(label, target)) label = fieldOfStudyRowLabel(candidates[0]);
    return { radio: radioInsideRow(row), row: row, label: label };
  }

  function findExactFieldOfStudyResultRow(target, searchInput) {
    var lists = collectOpenFieldOfStudyResultLists(searchInput);
    var i;
    var found;
    for (i = 0; i < lists.length; i += 1) {
      found = findFieldOfStudyRadioRowInList(lists[i], target, searchInput);
      if (found && found.row && !isFieldOfStudySearchChrome(found.row, searchInput) && !isEntireFieldOfStudyResultList(found.row)) {
        return found;
      }
    }
    var options = collectPickerOptions();
    var opt;
    for (i = 0; i < options.length; i += 1) {
      opt = options[i];
      if (!opt || !opt.el) continue;
      if (isFieldOfStudySearchChrome(opt.el, searchInput)) continue;
      if (isEntireFieldOfStudyResultList(opt.el)) continue;
      if (!fieldOfStudyLabelEqualsTarget(opt.label, target)) continue;
      return {
        radio: radioInsideRow(opt.el) || associatedRadioForLabel(opt.el),
        row: opt.el,
        label: opt.label
      };
    }
    return null;
  }

  function fieldOfStudyResultIsChecked(picked) {
    if (!picked) return false;
    var radio = picked.radio;
    if (radio) {
      if (radio.checked) return true;
      if (radio.getAttribute && radio.getAttribute("aria-checked") === "true") return true;
      if (radio.getAttribute && radio.getAttribute("aria-selected") === "true") return true;
    }
    var row = picked.row;
    if (row && row.getAttribute) {
      if (row.getAttribute("aria-checked") === "true" || row.getAttribute("aria-selected") === "true") return true;
    }
    return false;
  }

  function fieldOfStudyPickerHasResults(searchInput) {
    return collectOpenFieldOfStudyResultLists(searchInput).length > 0;
  }

  function setSearchInputValueNoBlur(el, value) {
    if (!el) return false;
    var engine = af();
    if (engine && typeof engine.setNativeValue === "function") {
      engine.setNativeValue(el, value);
    } else {
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
    }
    try {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    return true;
  }

  async function typeFieldOfStudySearch(input, query) {
    if (!input || !trimText(query)) return false;
    try {
      input.focus();
    } catch (_) {}
    clickElement(input);
    await sleep(40);
    setSearchInputValueNoBlur(input, "");
    await sleep(40);
    setSearchInputValueNoBlur(input, query);
    try {
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, cancelable: true, data: query, inputType: "insertFromPaste" })
      );
    } catch (_) {}
    try {
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true, cancelable: true }));
    } catch (_) {}
    return true;
  }

  function dispatchSearchKey(el, key) {
    if (!el) return;
    var keyCode = key === "ArrowDown" ? 40 : key === "Enter" ? 13 : 0;
    var init = {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    };
    try {
      el.dispatchEvent(new KeyboardEvent("keydown", init));
    } catch (_) {}
    try {
      el.dispatchEvent(new KeyboardEvent("keypress", init));
    } catch (_) {}
    try {
      el.dispatchEvent(new KeyboardEvent("keyup", init));
    } catch (_) {}
  }

  function readCommittedFieldOfStudy(container, target) {
    var shown = readPromptSelectedText(container);
    if (shown) return shown;
    if (!container || !container.querySelectorAll || !trimText(target)) return "";
    var nodes = container.querySelectorAll("[data-automation-id], span, div, button, li, label");
    var i;
    var el;
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (isSearchInput(el) || isTextLikeInput(el) || isEducationAuxiliaryInput(el)) continue;
      if (el.querySelector && el.querySelector("input")) continue;
      if (fieldOfStudyLabelEqualsTarget(fieldOfStudyRowLabel(el), target)) {
        return fieldOfStudyRowLabel(el);
      }
    }
    return "";
  }

  function fieldOfStudyValueCommitted(container, saved, target, searchInput, picked) {
    var live = findExactFieldOfStudyResultRow(target, searchInput);
    if (fieldOfStudyResultIsChecked(live) || fieldOfStudyResultIsChecked(picked)) return true;
    var chips = readPromptSelectedText(container);
    if (chips && !isPlaceholderValue(chips)) {
      if (fieldOfStudySatisfied(chips, saved) || fieldOfStudyMatches(target, chips) || fieldOfStudyLabelEqualsTarget(chips, target)) {
        return true;
      }
    }
    var shown = readCommittedFieldOfStudy(container, target);
    if (!shown || isPlaceholderValue(shown)) return false;
    if (searchInput && isTextLikeInput(searchInput)) {
      var typed = normalizeText(searchInput.value || "");
      if (typed && typed === normalizeText(shown) && !chips) return false;
    }
    if (fieldOfStudySatisfied(shown, saved)) return true;
    if (fieldOfStudyMatches(target, shown) || fieldOfStudyLabelEqualsTarget(shown, target)) return true;
    return false;
  }

  async function waitForFieldOfStudyPickerClosed(searchInput) {
    var i;
    for (i = 0; i < 10; i += 1) {
      if (!fieldOfStudyPickerHasResults(searchInput)) return;
      closeOpenList();
      await sleep(80);
    }
  }

  function clickFieldOfStudyResult(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window, button: 0 }));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window, button: 0 }));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true, view: window, button: 0 }));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window, button: 0 }));
    } catch (_) {}
    clickElement(el);
  }

  function clickFieldOfStudyRadioRow(picked) {
    if (!picked) return;
    var radio = picked.radio;
    var row = picked.row;
    if (row && isEntireFieldOfStudyResultList(row)) return;
    if (radio && (isSearchInput(radio) || isTextLikeInput(radio))) return;
    if (row && (isSearchInput(row) || isTextLikeInput(row))) return;
    if (radio) {
      var labelEl = radio.closest && radio.closest("label");
      if (!labelEl && radio.id) {
        try {
          labelEl = document.querySelector('label[for="' + radio.id + '"]');
        } catch (_) {
          labelEl = null;
        }
      }
      clickFieldOfStudyResult(radio);
      try {
        radio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      } catch (_) {}
      try {
        radio.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      } catch (_) {}
      if (labelEl && labelEl !== radio && !isEntireFieldOfStudyResultList(labelEl)) {
        clickFieldOfStudyResult(labelEl);
      }
    }
    if (row && row !== radio) clickFieldOfStudyResult(row);
  }

  async function selectFieldOfStudyValue(container, control, target, saved, handledElements) {
    if (!control || !trimText(target)) return { ok: false };
    clickElement(control);
    await sleep(200);
    var search = findActiveWorkdaySearchInput(control);
    if (!search) {
      clickElement(control);
      await sleep(160);
      search = findActiveWorkdaySearchInput(control);
    }
    if (!search) return { ok: false };
    markHandled(handledElements, search);
    await typeFieldOfStudySearch(search, target);

    var picked = null;
    var i;
    for (i = 0; i < 18; i += 1) {
      picked = findExactFieldOfStudyResultRow(target, search);
      if (picked) break;
      await sleep(120);
    }

    if (picked) {
      clickFieldOfStudyRadioRow(picked);
    } else if (fieldOfStudyPickerHasResults(search)) {
      try {
        search.focus();
      } catch (_) {}
      dispatchSearchKey(search, "ArrowDown");
      await sleep(90);
      dispatchSearchKey(search, "Enter");
    } else {
      return { ok: false };
    }

    var stable = 0;
    for (i = 0; i < 16; i += 1) {
      if (!picked) picked = findExactFieldOfStudyResultRow(target, search);
      if (fieldOfStudyValueCommitted(container, saved, target, search, picked)) {
        stable += 1;
        if (stable >= 2) {
          await waitForFieldOfStudyPickerClosed(search);
          return { ok: fieldOfStudyValueCommitted(container, saved, target, search, picked) };
        }
      } else {
        stable = 0;
      }
      if (i === 4 && picked) clickFieldOfStudyRadioRow(picked);
      if (i === 8 && fieldOfStudyPickerHasResults(search)) {
        try {
          search.focus();
        } catch (_) {}
        dispatchSearchKey(search, "ArrowDown");
        await sleep(80);
        dispatchSearchKey(search, "Enter");
      }
      await sleep(120);
    }

    var ok = fieldOfStudyValueCommitted(container, saved, target, search, picked);
    if (ok) await waitForFieldOfStudyPickerClosed(search);
    return { ok: ok };
  }

  async function fillEducationFieldOfStudy(container, saved, handledElements, overwrite) {
    try {
      if (!container) return "missing";
      var values = savedFieldsOfStudy(saved);
      if (!values.length) return "skip";
      var control = fieldOfStudyControl(container);
      if (!control) return "missing";
      markHandled(handledElements, control);
      var current = readCommittedFieldOfStudy(container, workdayFieldOfStudyAlias(values[0]) || values[0]);
      var i;
      var allPresent = values.length > 0;
      for (i = 0; i < values.length; i += 1) {
        if (!fieldOfStudySatisfied(current, values[i]) && !fieldOfStudyValueCommitted(container, saved, workdayFieldOfStudyAlias(values[i]) || values[i])) {
          allPresent = false;
        }
      }
      if (allPresent) return "already";
      if (current && !isPlaceholderValue(current) && !overwrite) return "skip-existing";
      var filledAny = false;
      for (i = 0; i < values.length; i += 1) {
        var want = values[i];
        current = readCommittedFieldOfStudy(container, workdayFieldOfStudyAlias(want) || want);
        if (fieldOfStudySatisfied(current, want) || fieldOfStudyValueCommitted(container, saved, workdayFieldOfStudyAlias(want) || want)) continue;
        var target = workdayFieldOfStudyAlias(want) || want;
        var selected = await selectFieldOfStudyValue(container, control, target, want, handledElements);
        if (selected.ok) filledAny = true;
        await waitForFieldOfStudyPickerClosed();
      }
      await waitForFieldOfStudyPickerClosed();
      return filledAny ? "ok" : "skip";
    } catch (_) {
      closeOpenList();
      return "skip";
    }
  }

  async function fillOneEducationRow(row, saved, handledElements) {
    var fields = educationRowFields(row);
    var overwrite = isBlankEducationRow(row);
    var filledAny = false;
    var failedRequired = false;

    var schoolStatus = await fillExperienceTextField(fields.school, saved.institution, handledElements, overwrite);
    if (schoolStatus === "ok") filledAny = true;
    if (saved.institution && schoolStatus === "fail") failedRequired = true;

    try {
      var degreeStatus = await fillEducationDegree(fields.degree, saved.degree, handledElements, overwrite);
      if (degreeStatus === "ok") filledAny = true;
    } catch (_) {
      closeOpenList();
    }

    try {
      var fieldStatus = await fillEducationFieldOfStudy(fields.fieldContainer, saved, handledElements, overwrite);
      if (fieldStatus === "ok") filledAny = true;
    } catch (_) {
      closeOpenList();
    }

    try {
      if (saved.gpa && fields.gpa) {
        var gpaStatus = await fillExperienceTextField(fields.gpa, saved.gpa, handledElements, overwrite);
        if (gpaStatus === "ok") filledAny = true;
      } else if (fields.gpa) {
        markHandled(handledElements, fields.gpa);
      }
    } catch (_) {}

    try {
      var firstYear = educationYearFromDate(saved.startDate);
      if (firstYear && fields.firstYear) {
        var fy = await fillExperienceDatePart(fields.firstYear, firstYear, handledElements, overwrite, "year");
        if (fy === "ok") filledAny = true;
      }
    } catch (_) {}

    try {
      var lastYear = educationYearFromDate(saved.endDate);
      if (lastYear && fields.lastYear) {
        var ly = await fillExperienceDatePart(fields.lastYear, lastYear, handledElements, overwrite, "year");
        if (ly === "ok") filledAny = true;
      }
    } catch (_) {}

    if (failedRequired) return "failed";
    if (filledAny) return "filled";
    return "skipped";
  }

  async function fillEducation(context, handledElements) {
    var ctx = context || {};
    var root = ctx.root || document;
    var saved = savedEducationRecords(ctx.profile, ctx.inventory);
    if (!saved.length) return [];
    var results = [];
    var used = [];
    var i;
    var rows;
    var target;
    var status;
    var label;

    for (i = 0; i < saved.length; i += 1) {
      label = "Education " + (i + 1);
      rows = collectEducationRows(root);
      target = findMatchingEducationRow(rows, saved[i], used);
      if (target) {
        used.push(target);
        try {
          status = await fillOneEducationRow(target, saved[i], handledElements);
        } catch (_) {
          status = "failed";
        }
        if (status === "filled") {
          results.push(resultRow("education", label, "filled", "", true, saved[i].institution || saved[i].degree));
        } else if (status === "failed") {
          results.push(resultRow("education", label, "failed", "Could not persist school name.", false, ""));
        } else {
          results.push(resultRow("education", label, "skipped", "Education is already present.", false, ""));
        }
        continue;
      }

      target = findBlankEducationRow(rows, used);
      if (!target) {
        var created = await createEducationRow(root, handledElements);
        if (!created.ok) {
          results.push(resultRow("education", label, "failed", created.reason, false, ""));
          break;
        }
        rows = created.rows;
        target = findBlankEducationRow(rows, used) || rows[rows.length - 1];
      }

      if (!target) {
        results.push(resultRow("education", label, "failed", "Could not create an Education row.", false, ""));
        break;
      }

      used.push(target);
      try {
        status = await fillOneEducationRow(target, saved[i], handledElements);
      } catch (_) {
        status = "failed";
      }
      if (status === "filled") {
        results.push(resultRow("education", label, "filled", "", true, saved[i].institution || saved[i].degree));
      } else if (status === "failed") {
        results.push(resultRow("education", label, "failed", "Could not persist school name.", false, ""));
      } else {
        results.push(resultRow("education", label, "skipped", "Education is already present.", false, ""));
      }
    }

    return results;
  }

  function normalizeSkillLabel(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  var WORKDAY_SKILL_DESCRIPTORS = {
    "programming language": true,
    software: true,
    database: true,
    "operating system": true,
    framework: true,
    library: true,
    platform: true,
    tool: true,
    technology: true
  };

  var WORKDAY_SKILL_ALIASES = {
    aws: "amazon web services",
    "amazon web services (aws)": "amazon web services",
    "amazon web services": "amazon web services",
    gcp: "google cloud platform",
    "google cloud": "google cloud platform",
    "google cloud platform": "google cloud platform",
    azure: "microsoft azure",
    "microsoft azure": "microsoft azure",
    postgres: "postgresql",
    postgresql: "postgresql",
    "react.js": "react",
    reactjs: "react",
    react: "react",
    nextjs: "next.js",
    "next.js": "next.js",
    nodejs: "node.js",
    "node.js": "node.js",
    js: "javascript",
    javascript: "javascript",
    ts: "typescript",
    typescript: "typescript"
  };

  function skillLabelsEqual(a, b) {
    var left = normalizeSkillLabel(a);
    var right = normalizeSkillLabel(b);
    return Boolean(left && right && left === right);
  }

  function stripApprovedTrailingDescriptor(text) {
    var phrase;
    var suffix;
    var base;
    var i;
    var phrases = Object.keys(WORKDAY_SKILL_DESCRIPTORS);
    if (!text) return "";
    for (i = 0; i < phrases.length; i += 1) {
      phrase = phrases[i];
      suffix = " " + phrase;
      if (text.length > suffix.length && text.slice(text.length - suffix.length) === suffix) {
        base = trimText(text.slice(0, text.length - suffix.length));
        if (base) return base;
      }
    }
    return text;
  }

  function canonicalWorkdaySkillLabel(value) {
    var text = normalizeSkillLabel(value);
    var match;
    var base;
    var descriptor;
    if (!text) return "";
    match = text.match(/^(.*)\s+\(([^)]+)\)\s*$/);
    if (match) {
      base = trimText(match[1]);
      descriptor = trimText(match[2]);
      if (base && descriptor && WORKDAY_SKILL_DESCRIPTORS[descriptor]) text = base;
    }
    return stripApprovedTrailingDescriptor(text);
  }

  function workdaySkillAliasTarget(value) {
    var normalized = normalizeSkillLabel(value);
    var canonical = canonicalWorkdaySkillLabel(value);
    if (WORKDAY_SKILL_ALIASES[normalized]) return WORKDAY_SKILL_ALIASES[normalized];
    if (canonical && WORKDAY_SKILL_ALIASES[canonical]) return WORKDAY_SKILL_ALIASES[canonical];
    return "";
  }

  function skillMatchRank(optionLabel, saved) {
    var savedCanon;
    var optionCanon;
    var savedAlias;
    var optionAlias;
    if (!trimText(optionLabel) || !trimText(saved)) return 0;
    if (skillLabelsEqual(optionLabel, saved)) return 3;
    savedCanon = canonicalWorkdaySkillLabel(saved);
    optionCanon = canonicalWorkdaySkillLabel(optionLabel);
    if (savedCanon && optionCanon && savedCanon === optionCanon) return 2;
    savedAlias = workdaySkillAliasTarget(saved);
    optionAlias = workdaySkillAliasTarget(optionLabel);
    if (
      savedAlias &&
      (savedAlias === optionCanon ||
        savedAlias === normalizeSkillLabel(optionLabel) ||
        (optionAlias && savedAlias === optionAlias))
    ) {
      return 1;
    }
    return 0;
  }

  function skillResultMatchKind(optionLabel, saved) {
    var rank = skillMatchRank(optionLabel, saved);
    if (rank === 3) return "exact";
    if (rank === 2) return "canonical";
    if (rank === 1) return "alias";
    return "";
  }

  function skillChipMatchesSaved(chipLabel, saved) {
    return skillMatchRank(chipLabel, saved) > 0;
  }

  var WORKDAY_SKILL_SKIPS = {
    shell: true,
    "tailwind css": true,
    tailwindcss: true,
    newman: true
  };

  function workdaySkillPlan(query, targets) {
    return {
      query: query,
      targets: targets && targets.length ? targets : null
    };
  }

  var WORKDAY_SKILL_PLANS = {
    "c++": [workdaySkillPlan("C++", ["C++ Programming Language"])],
    "javascript/typescript": [
      workdaySkillPlan("JavaScript", ["JavaScript"]),
      workdaySkillPlan("TypeScript", ["TypeScript"])
    ],
    "javascript / typescript": [
      workdaySkillPlan("JavaScript", ["JavaScript"]),
      workdaySkillPlan("TypeScript", ["TypeScript"])
    ],
    vue: [workdaySkillPlan("Vue", ["Vue.js", "Vuejs"])],
    "vue.js": [workdaySkillPlan("Vue", ["Vue.js", "Vuejs"])],
    vuejs: [workdaySkillPlan("Vue", ["Vue.js", "Vuejs"])],
    junit: [workdaySkillPlan("JUnit", ["JUnit Testing Framework"])],
    "ci/cd pipelines": [workdaySkillPlan("CI/CD Pipelines", ["CI/CD"])],
    jira: [workdaySkillPlan("Jira", ["Atlassian JIRA"])],
    confluence: [workdaySkillPlan("Confluence", ["Atlassian Confluence"])],
    "google cloud platform": [workdaySkillPlan("Google Cloud Platform", ["Google Cloud Platform (GCP)"])],
    gcp: [workdaySkillPlan("Google Cloud Platform", ["Google Cloud Platform (GCP)"])],
    "application programming": [workdaySkillPlan("Application programming", ["Applications Programming"])],
    "android development": [workdaySkillPlan("Android Development", ["Android Software Development"])],
    "operating systems": [workdaySkillPlan("Operating Systems", ["Operating Systems (OS)"])],
    ai: [workdaySkillPlan("Artificial Intelligence", ["Artificial Intelligence (AI)"])],
    "artificial intelligence": [workdaySkillPlan("Artificial Intelligence", ["Artificial Intelligence (AI)"])],
    agile: [workdaySkillPlan("Agile", ["Agile Methodology"])],
    "waterfall development": [workdaySkillPlan("Waterfall development", ["Waterfall Model"])]
  };

  function getWorkdaySkillPlans(savedSkill) {
    var saved = trimText(savedSkill);
    var key = normalizeSkillLabel(saved);
    if (!saved || !key) return [];
    if (WORKDAY_SKILL_SKIPS[key]) return [];
    if (WORKDAY_SKILL_PLANS[key]) return WORKDAY_SKILL_PLANS[key];
    return [workdaySkillPlan(saved, null)];
  }

  function labelMatchesApprovedTarget(optionLabel, target) {
    return skillLabelsEqual(optionLabel, target);
  }

  function skillPlanMatchesLabel(optionLabel, saved, targets) {
    var i;
    if (targets && targets.length) {
      for (i = 0; i < targets.length; i += 1) {
        if (labelMatchesApprovedTarget(optionLabel, targets[i])) return true;
      }
      return false;
    }
    return skillMatchRank(optionLabel, saved) > 0;
  }

  function readSkillArray(source) {
    if (!source) return [];
    if (!Array.isArray(source.skills)) return [];
    return source.skills
      .map(function (item) {
        return trimText(typeof item === "string" ? item : "");
      })
      .filter(Boolean);
  }

  function dedupeSavedSkills(list) {
    var out = [];
    var seen = {};
    var i;
    var skill;
    var key;
    for (i = 0; i < (list || []).length; i += 1) {
      skill = trimText(list[i]);
      key = normalizeSkillLabel(skill);
      if (!skill || !key || seen[key]) continue;
      seen[key] = true;
      out.push(skill);
    }
    return out;
  }

  function savedSkillNames(profile, inventory) {
    var fromProfile = readSkillArray(profile);
    if (fromProfile.length) return dedupeSavedSkills(fromProfile);
    var fromInv = readSkillArray(inventory);
    if (fromInv.length) return dedupeSavedSkills(fromInv);
    var joined = inventory && typeof inventory.skills === "string" ? trimText(inventory.skills) : "";
    if (joined && joined.indexOf(",") !== -1) {
      return dedupeSavedSkills(joined.split(/\s*,\s*/));
    }
    if (joined) return dedupeSavedSkills([joined]);
    return [];
  }

  function loadMasterProfileSkills() {
    return new Promise(function (resolve) {
      try {
        if (!global.chrome || !chrome.storage || !chrome.storage.local) {
          resolve([]);
          return;
        }
        chrome.storage.local.get(["masterProfile"], function (data) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve([]);
            return;
          }
          resolve(dedupeSavedSkills(readSkillArray(data && data.masterProfile)));
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  async function resolveSavedSkills(profile, inventory) {
    var list = savedSkillNames(profile, inventory);
    if (list.length) return list;
    return loadMasterProfileSkills();
  }

  function findSkillsSection(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    return (
      doc.querySelector('[role="group"][aria-labelledby="Skills-section"]') ||
      doc.querySelector('[aria-labelledby="Skills-section"]')
    );
  }

  function findSkillsFormField(root) {
    var section = findSkillsSection(root);
    var field = section && section.querySelector
      ? section.querySelector('[data-automation-id="formField-skills"]')
      : null;
    if (field) return field;
    var doc = root || document;
    return doc && doc.querySelector ? doc.querySelector('[data-automation-id="formField-skills"]') : null;
  }

  function findSkillsMultiSelect(root) {
    var field = findSkillsFormField(root);
    var scope = field || findSkillsSection(root) || root || document;
    if (!scope || !scope.querySelector) return null;
    return (
      scope.querySelector('[data-automation-id="multiSelectContainer"][data-uxi-widget-type="multiselect"]') ||
      scope.querySelector('[data-automation-id="multiSelectContainer"]')
    );
  }

  function findSkillsInputContainer(root) {
    var field = findSkillsFormField(root);
    var section = findSkillsSection(root);
    var scope = field || section || root || document;
    if (!scope || !scope.querySelector) return null;
    return (
      scope.querySelector(
        '[data-automation-id="multiSelectContainer"] [data-automation-id="multiselectInputContainer"]'
      ) || scope.querySelector('[data-automation-id="multiselectInputContainer"]')
    );
  }

  function findSkillsSearchInput(root) {
    var doc = root || document;
    if (!doc || !doc.querySelector) return null;
    var section = findSkillsSection(doc);
    var field = findSkillsFormField(doc);
    var scoped =
      (section && field && section.contains(field) && field) ||
      field ||
      section;
    var input = null;
    if (scoped && scoped.querySelector) {
      input =
        scoped.querySelector('input#skills--skills[data-automation-id="searchBox"]') ||
        scoped.querySelector('[data-automation-id="formField-skills"] input[data-automation-id="searchBox"]') ||
        scoped.querySelector('input[data-automation-id="searchBox"][data-uxi-widget-type="selectinput"]') ||
        scoped.querySelector('input[data-automation-id="searchBox"]');
    }
    if (!input && doc.querySelector) {
      input =
        doc.querySelector('input#skills--skills[data-automation-id="searchBox"]') ||
        doc.querySelector(
          '[aria-labelledby="Skills-section"] [data-automation-id="formField-skills"] input[data-automation-id="searchBox"]'
        ) ||
        doc.querySelector('[data-automation-id="formField-skills"] input[data-automation-id="searchBox"]');
    }
    if (input && isTextLikeInput(input)) return input;
    return null;
  }

  function scrollSkillsIntoView(el) {
    if (!el || typeof el.scrollIntoView !== "function") return;
    try {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (_) {
      try {
        el.scrollIntoView(true);
      } catch (__) {}
    }
  }

  function skillsPickerInstructionText(root) {
    var scope =
      findSkillsFormField(root) ||
      findSkillsSection(root) ||
      findSkillsInputContainer(root) ||
      root ||
      document;
    if (!scope || !scope.querySelector) return "";
    var el = scope.querySelector('[data-automation-id="promptAriaInstruction"]');
    if (!el) return "";
    return trimText(
      (el.innerText || el.textContent || (el.getAttribute && el.getAttribute("aria-label")) || "")
    );
  }

  function isSkillsPickerExpanded(root) {
    return /\bexpanded\b/.test(normalizeText(skillsPickerInstructionText(root)));
  }

  async function ensureSkillsPickerOpen(root) {
    var section = findSkillsSection(root);
    var field = findSkillsFormField(root);
    var container = findSkillsInputContainer(root);
    var search;
    var i;
    if (isSkillsPickerExpanded(root)) {
      search = findSkillsSearchInput(root);
      if (search) {
        try {
          search.focus();
        } catch (_) {}
        return search;
      }
    }
    scrollSkillsIntoView(section || field || container);
    await sleep(100);
    container = findSkillsInputContainer(root) || container;
    if (container) {
      scrollSkillsIntoView(container);
      clickElement(container);
    }
    for (i = 0; i < 12; i += 1) {
      if (isSkillsPickerExpanded(root)) {
        search = findSkillsSearchInput(root);
        if (search) {
          try {
            search.focus();
          } catch (_) {}
          return search;
        }
      }
      if (i === 4 || i === 8) {
        container = findSkillsInputContainer(root) || container;
        if (container && !isSkillsPickerExpanded(root)) clickElement(container);
      }
      await sleep(150);
    }
    return findSkillsSearchInput(root);
  }

  async function resetSkillsPickerForNextSkill(root, searchInput) {
    var search = findSkillsSearchInput(root) || searchInput;
    try {
      await clearSkillsSearch(search);
    } catch (_) {}
    await sleep(130);
    try {
      search = (await ensureSkillsPickerOpen(root)) || findSkillsSearchInput(root) || search;
    } catch (_) {
      search = findSkillsSearchInput(root) || search;
    }
    if (search) {
      try {
        search.focus();
      } catch (_) {}
    }
    return search;
  }

  function isInsideSelectedItemList(el) {
    return Boolean(el && el.closest && el.closest('[data-automation-id="selectedItemList"]'));
  }

  function promptAutomationLabel(el) {
    if (!el || !el.getAttribute) return "";
    return trimText(el.getAttribute("data-automation-label") || "");
  }

  function findSkillsSelectedItemList(root) {
    var field = findSkillsFormField(root);
    var multi = findSkillsMultiSelect(root);
    var scope = field || multi || findSkillsSection(root);
    if (scope && scope.querySelector) {
      var list = scope.querySelector('[data-automation-id="selectedItemList"]');
      if (list) return list;
    }
    var doc = root || document;
    return doc && doc.querySelector
      ? doc.querySelector('[data-automation-id="formField-skills"] [data-automation-id="selectedItemList"]')
      : null;
  }

  function readCommittedSkillLabels(root) {
    var labels = [];
    var seen = {};
    var list = findSkillsSelectedItemList(root);
    if (!list || !list.querySelectorAll) return labels;
    var prompts = list.querySelectorAll(
      '[data-automation-id="selectedItem"] [data-automation-id="promptOption"][data-automation-label], [data-automation-id="promptOption"][data-automation-label]'
    );
    Array.prototype.forEach.call(prompts, function (prompt) {
      var label = promptAutomationLabel(prompt);
      var key = normalizeSkillLabel(label);
      if (!label || !key || seen[key]) return;
      seen[key] = true;
      labels.push(label);
    });
    return labels;
  }

  function skillAlreadySelected(root, saved, targets) {
    var labels = readCommittedSkillLabels(root);
    var i;
    for (i = 0; i < labels.length; i += 1) {
      if (skillPlanMatchesLabel(labels[i], saved, targets)) return true;
    }
    return false;
  }

  function readSkillResultRowLabel(row) {
    var prompt;
    if (!row || !row.querySelector) return "";
    prompt = row.querySelector('[data-automation-id="promptOption"][data-automation-label]');
    if (!prompt || !prompt.getAttribute) return "";
    return trimText(prompt.getAttribute("data-automation-label") || "");
  }

  function findSkillRowForApprovedTarget(target) {
    var rows = document.querySelectorAll('[data-automation-id="promptLeafNode"]');
    var match = null;
    var i;
    var row;
    var label;
    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      if (isInsideSelectedItemList(row)) continue;
      label = readSkillResultRowLabel(row);
      if (!label || !labelMatchesApprovedTarget(label, target)) continue;
      if (match) return null;
      match = row;
    }
    return match;
  }

  function findSkillSearchResultRow(saved, targets) {
    var t;
    var row;
    var rows;
    var bestRank;
    var bestRow;
    var tied;
    var i;
    var prompt;
    var label;
    var rank;
    if (targets && targets.length) {
      for (t = 0; t < targets.length; t += 1) {
        row = findSkillRowForApprovedTarget(targets[t]);
        if (row) return row;
      }
      return null;
    }
    rows = document.querySelectorAll('[data-automation-id="promptLeafNode"]');
    bestRank = 0;
    bestRow = null;
    tied = false;
    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      if (isInsideSelectedItemList(row)) continue;
      if (!row.querySelector) continue;
      prompt = row.querySelector('[data-automation-id="promptOption"][data-automation-label]');
      if (!prompt) continue;
      label = trimText(prompt.getAttribute("data-automation-label") || "");
      rank = skillMatchRank(label, saved);
      if (!rank) continue;
      if (rank > bestRank) {
        bestRank = rank;
        bestRow = row;
        tied = false;
      } else if (rank === bestRank) {
        tied = true;
      }
    }
    if (!bestRow || tied) return null;
    return bestRow;
  }

  async function waitForSkillTargetRow(saved, targets) {
    var i;
    var row;
    for (i = 0; i < 32; i += 1) {
      row = findSkillSearchResultRow(saved, targets);
      if (row && row.isConnected) return row;
      await sleep(125);
    }
    return null;
  }

  function skillRowCheckbox(row) {
    if (!row || !row.querySelector) return null;
    return (
      row.querySelector('input[type="checkbox"][data-automation-id="checkboxPanel"]') ||
      row.querySelector('[data-automation-id="checkbox"] input[type="checkbox"]') ||
      null
    );
  }

  function skillRowCheckboxIsUnchecked(row) {
    var checkbox = skillRowCheckbox(row);
    if (!checkbox) return false;
    if (checkbox.checked) return false;
    if (checkbox.getAttribute && checkbox.getAttribute("aria-checked") === "true") return false;
    return true;
  }

  function clickSkillCheckboxPanel(checkbox) {
    if (!checkbox) return;
    var clickFn =
      window.HTMLElement &&
      window.HTMLElement.prototype &&
      window.HTMLElement.prototype.click;
    if (clickFn) {
      clickFn.call(checkbox);
    } else {
      checkbox.click();
    }
  }

  function clickSkillResultRowOnce(row) {
    var checkbox = skillRowCheckbox(row);
    if (!checkbox) return;
    clickSkillCheckboxPanel(checkbox);
  }

  function searchValueContainsSkill(input, query) {
    var value = trimText(input && input.value);
    if (!value || !trimText(query)) return false;
    if (skillLabelsEqual(value, query)) return true;
    return normalizeSkillLabel(value).indexOf(normalizeSkillLabel(query)) !== -1;
  }

  async function typeOneSkillQuery(input, query) {
    if (!input || !trimText(query)) return false;
    try {
      input.focus();
    } catch (_) {}
    setSearchInputValueNoBlur(input, query);
    try {
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, cancelable: true, data: query, inputType: "insertText" })
      );
    } catch (_) {}
    try {
      input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    if (!searchValueContainsSkill(input, query)) {
      setSearchInputValueNoBlur(input, query);
    }
    return true;
  }

  function dispatchSkillsSearchEnter(el) {
    if (!el) return;
    try {
      el.focus();
    } catch (_) {}
    var types = ["keydown", "keypress", "keyup"];
    var i;
    var type;
    var ev;
    for (i = 0; i < types.length; i += 1) {
      type = types[i];
      try {
        ev = new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          view: window
        });
        try {
          Object.defineProperty(ev, "keyCode", { get: function () { return 13; } });
          Object.defineProperty(ev, "which", { get: function () { return 13; } });
        } catch (_) {}
        el.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  async function clearSkillsSearch(searchInput) {
    if (!searchInput || !isTextLikeInput(searchInput)) return;
    try {
      searchInput.focus();
    } catch (_) {}
    setSearchInputValueNoBlur(searchInput, "");
    await sleep(120);
  }

  async function waitForSkillCommitted(root, saved, targets) {
    var i;
    for (i = 0; i < 20; i += 1) {
      if (skillAlreadySelected(root, saved, targets)) return true;
      await sleep(125);
    }
    return skillAlreadySelected(root, saved, targets);
  }

  async function selectOneSavedSkill(root, search, saved, plan) {
    var query = trimText((plan && plan.query) || saved);
    var targets = plan && plan.targets && plan.targets.length ? plan.targets : null;
    try {
      search = (await ensureSkillsPickerOpen(root)) || findSkillsSearchInput(root) || search;
    } catch (_) {
      search = findSkillsSearchInput(root) || search;
    }
    if (!search || !query) return { ok: false, skipped: true, reason: "timeout" };
    if (/\s*,\s*/.test(query) && query.split(/\s*,\s*/).filter(Boolean).length > 1) {
      return { ok: false, skipped: true, reason: "nomatch" };
    }
    try {
      if (skillAlreadySelected(root, saved || query, targets)) return { ok: true, already: true };
      await clearSkillsSearch(search);
      await typeOneSkillQuery(search, query);
      dispatchSkillsSearchEnter(search);
      var row = await waitForSkillTargetRow(saved || query, targets);
      if (!row) {
        await clearSkillsSearch(search);
        return { ok: false, skipped: true, reason: "nomatch" };
      }
      clickSkillResultRowOnce(row);
      var committed = await waitForSkillCommitted(root, saved || query, targets);
      if (!committed) {
        var live = findSkillSearchResultRow(saved || query, targets);
        if (live && live.isConnected && skillRowCheckboxIsUnchecked(live)) {
          clickSkillResultRowOnce(live);
          committed = await waitForSkillCommitted(root, saved || query, targets);
        }
      }
      await clearSkillsSearch(search);
      if (!skillAlreadySelected(root, saved || query, targets)) return { ok: false, skipped: true, reason: "timeout" };
      return { ok: true };
    } catch (_) {
      try {
        await clearSkillsSearch(search);
      } catch (__) {}
      return { ok: false, skipped: true, reason: "timeout" };
    }
  }

  async function fillSkills(context, handledElements) {
    var ctx = context || {};
    var root = ctx.root || document;
    var saved = await resolveSavedSkills(ctx.profile, ctx.inventory);
    if (!saved.length) return [];
    var field = findSkillsFormField(root);
    var multi = findSkillsMultiSelect(root);
    var search = null;
    try {
      search = await ensureSkillsPickerOpen(root);
    } catch (_) {
      search = findSkillsSearchInput(root);
    }
    if (!search) {
      return [resultRow("skill", "Skills", "skipped", "Workday Skills picker was not available.", false, "")];
    }
    markHandled(handledElements, search);
    if (field) markHandled(handledElements, field);
    var inputContainer = findSkillsInputContainer(root);
    if (inputContainer) markHandled(handledElements, inputContainer);
    if (multi) markHandled(handledElements, multi);
    var selectedCount = 0;
    var alreadyCount = 0;
    var unsupportedCount = 0;
    var timeoutCount = 0;
    var i;
    var p;
    var skill;
    var plans;
    var plan;
    var selected;
    for (i = 0; i < saved.length; i += 1) {
      skill = trimText(saved[i]);
      if (!skill) continue;
      plans = getWorkdaySkillPlans(skill);
      if (!plans.length) {
        unsupportedCount += 1;
        continue;
      }
      for (p = 0; p < plans.length; p += 1) {
        plan = plans[p];
        try {
          if (skillAlreadySelected(root, skill, plan && plan.targets)) {
            alreadyCount += 1;
          } else {
            search = findSkillsSearchInput(root) || search;
            if (!search || !isSkillsPickerExpanded(root)) {
              search = (await ensureSkillsPickerOpen(root)) || search;
            }
            if (!search) {
              timeoutCount += 1;
            } else {
              try {
                search.focus();
              } catch (_) {}
              selected = await selectOneSavedSkill(root, search, skill, plan);
              if (selected && selected.already) alreadyCount += 1;
              else if (selected && selected.ok) selectedCount += 1;
              else if (selected && selected.reason === "timeout") timeoutCount += 1;
              else unsupportedCount += 1;
            }
          }
        } catch (_) {
          timeoutCount += 1;
        }
        try {
          search = await resetSkillsPickerForNextSkill(root, search);
        } catch (_) {}
      }
    }
    try {
      closeOpenList();
    } catch (_) {}
    var parts = [
      selectedCount + " selected",
      alreadyCount + " already present",
      unsupportedCount + " unsupported"
    ];
    if (timeoutCount) parts.push(timeoutCount + " timed out");
    var reason = "Workday Skills: " + parts.join(", ") + ".";
    var filledAny = selectedCount > 0;
    return [
      resultRow("skill", "Skills", filledAny ? "filled" : "skipped", reason, filledAny, "")
    ];
  }

  function explicitYesNo(value) {
    var text = normalizeText(value);
    if (text === "yes") return "yes";
    if (text === "no") return "no";
    return "";
  }

  var WORKDAY_WORK_AUTH_ANY_EMPLOYER =
    "I am authorized to work in this country for any employer";
  var WORKDAY_WORK_AUTH_PRESENT_EMPLOYER =
    "I am authorized to work in this country for my present employer only";
  var WORKDAY_WORK_AUTH_SPONSORSHIP =
    "I require sponsorship to work in this country";

  function looksLikeWorkAuthorizationQuestionLabel(label) {
    var text = normalizeText(String(label || "").replace(/[:*]/g, " "));
    if (!text) return false;
    text = text.replace(/\s*\((required|optional)\)\s*$/g, "").trim();
    if (/\bitar\b/.test(text) || /\bear\b/.test(text)) return false;
    if (/\bdocumentation\b/.test(text)) return false;
    if (/\bsecurity\s+clearance\b/.test(text)) return false;
    if (/\bgovernment\b/.test(text)) return false;
    return text === "work authorization";
  }

  function workAuthOptionMatches(label, target) {
    return Boolean(target && normalizeText(label) === normalizeText(target));
  }

  function isKnownWorkdayWorkAuthOption(label) {
    return (
      workAuthOptionMatches(label, WORKDAY_WORK_AUTH_ANY_EMPLOYER) ||
      workAuthOptionMatches(label, WORKDAY_WORK_AUTH_PRESENT_EMPLOYER) ||
      workAuthOptionMatches(label, WORKDAY_WORK_AUTH_SPONSORSHIP)
    );
  }

  function workAuthorizationFromContext(inventory, profile, workAuthorization) {
    var work = (profile && profile.workAuthorization) || workAuthorization || {};
    var inv = inventory || {};
    return {
      legallyAuthorizedToWork: work.legallyAuthorizedToWork || inv.work_authorization || "",
      requireSponsorshipNow: work.requireSponsorshipNow || inv.sponsorship_now || ""
    };
  }

  function resolveWorkdayWorkAuthorizationOption(inventory, profile, workAuthorization) {
    var saved = workAuthorizationFromContext(inventory, profile, workAuthorization);
    var auth = explicitYesNo(saved.legallyAuthorizedToWork);
    var now = explicitYesNo(saved.requireSponsorshipNow);
    if (auth === "yes" && now === "no") return WORKDAY_WORK_AUTH_ANY_EMPLOYER;
    if (auth === "no" && now === "yes") return WORKDAY_WORK_AUTH_SPONSORSHIP;
    return "";
  }

  function questionFieldLabel(field) {
    var label = containerLabel(field);
    var prev;
    var control;
    if (label) return label;
    prev = field && field.previousElementSibling;
    if (prev) {
      label = trimText(prev.innerText || prev.textContent || "");
      if (label && label.length < 120) return label;
    }
    control = comboboxControlIn(field) || findDropdownButton(field);
    if (control) return widgetLabel(control);
    return "";
  }

  function findWorkAuthorizationQuestion(root) {
    var doc = root || document;
    var i;
    var field;
    var label;
    var next;
    var parent;
    var fields;
    var labels;
    if (!doc || !doc.querySelectorAll) return null;
    fields = doc.querySelectorAll('[data-automation-id^="formField-"]');
    for (i = 0; i < fields.length; i += 1) {
      field = fields[i];
      if (looksLikeWorkAuthorizationQuestionLabel(questionFieldLabel(field))) return field;
    }
    labels = doc.querySelectorAll(
      '[data-automation-id="formLabel"], [data-automation-id="label"], label, legend'
    );
    for (i = 0; i < labels.length; i += 1) {
      label = trimText(labels[i].innerText || labels[i].textContent || "");
      if (!looksLikeWorkAuthorizationQuestionLabel(label)) continue;
      field =
        (labels[i].closest && labels[i].closest('[data-automation-id^="formField-"]')) || null;
      if (field) return field;
      next = labels[i].nextElementSibling;
      if (next && (findDropdownButton(next) || comboboxControlIn(next))) return next;
      parent = labels[i].parentElement;
      if (parent && (findDropdownButton(parent) || comboboxControlIn(parent))) return parent;
    }
    return null;
  }

  async function fillWorkAuthorizationQuestion(root, inventory, profile, workAuthorization, handledElements) {
    var field = findWorkAuthorizationQuestion(root);
    var control;
    var target;
    var current;
    var selected;
    var after;
    if (!field) return [];
    control = findDropdownButton(field) || comboboxControlIn(field);
    if (!control) {
      return [
        resultRow(
          "work_authorization",
          "Work Authorization",
          "skipped",
          "Workday Work Authorization dropdown was not found.",
          false,
          ""
        )
      ];
    }
    markHandled(handledElements, control);
    target = resolveWorkdayWorkAuthorizationOption(inventory, profile, workAuthorization);
    current = displayedDropdownValue(field, control) || readComboboxText(control);
    if (current && isKnownWorkdayWorkAuthOption(current)) {
      if (target && workAuthOptionMatches(current, target)) {
        return [resultRow("work_authorization", "Work Authorization", "filled", "", true, current)];
      }
      return [
        resultRow("work_authorization", "Work Authorization", "skipped", "Field is already completed.", false, "")
      ];
    }
    if (!target) {
      return [
        resultRow(
          "work_authorization",
          "Work Authorization",
          "skipped",
          "Saved work-authorization and sponsorship answers are incomplete or contradictory.",
          false,
          ""
        )
      ];
    }
    selected = await selectComboboxOption(control, function (label) {
      return workAuthOptionMatches(label, target);
    });
    after = displayedDropdownValue(field, control) || selected.value || "";
    if (!selected.ok || !workAuthOptionMatches(after, target)) {
      return [
        resultRow(
          "work_authorization",
          "Work Authorization",
          "skipped",
          "No matching Work Authorization option.",
          false,
          ""
        )
      ];
    }
    return [resultRow("work_authorization", "Work Authorization", "filled", "", true, after)];
  }

  async function fillApplicationQuestions(context, handledElements) {
    var ctx = context || {};
    return fillWorkAuthorizationQuestion(
      ctx.root || document,
      ctx.inventory || {},
      ctx.profile || null,
      ctx.workAuthorization || null,
      handledElements
    );
  }

  function disclosureLabelKey(label) {
    var text = normalizeText(String(label || "").replace(/[:*]/g, " "));
    if (!text) return "";
    return text.replace(/\s*\((required|optional)\)\s*$/g, "").trim();
  }

  function isPreferNotToAnswerValue(value) {
    var text = normalizeText(value);
    return (
      text === "prefer not to answer" ||
      text === "prefer not to say" ||
      text === "decline to self-identify" ||
      text === "decline to self identify" ||
      text === "not declared" ||
      text === "i do not want to answer"
    );
  }

  function looksLikeTermsAndConditionsText(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (!/\bterms and conditions\b/.test(t)) return false;
    return (
      /\bwillingly accept\b/.test(t) ||
      /\baccept the terms\b/.test(t) ||
      /\bsubmitting an application\b/.test(t)
    );
  }

  function isGenderDisclosureLabel(label) {
    return disclosureLabelKey(label) === "gender";
  }

  function isHispanicDisclosureLabel(label) {
    var key = disclosureLabelKey(label);
    return key === "ethnicity hispanic or latino" || key === "hispanic or latino";
  }

  function isRaceDisclosureLabel(label) {
    return disclosureLabelKey(label) === "race";
  }

  function isVeteranDisclosureLabel(label) {
    var key = disclosureLabelKey(label);
    return key === "veteran status" || key === "veteran";
  }

  function findDisclosureField(root, testFn) {
    var doc = root || document;
    var i;
    var field;
    var label;
    var next;
    var parent;
    var fields;
    var labels;
    if (!doc || !doc.querySelectorAll) return null;
    fields = doc.querySelectorAll('[data-automation-id^="formField-"]');
    for (i = 0; i < fields.length; i += 1) {
      field = fields[i];
      label = questionFieldLabel(field);
      if (looksLikeTermsAndConditionsText(label)) continue;
      if (testFn(label)) return field;
    }
    labels = doc.querySelectorAll(
      '[data-automation-id="formLabel"], [data-automation-id="label"], label, legend'
    );
    for (i = 0; i < labels.length; i += 1) {
      label = trimText(labels[i].innerText || labels[i].textContent || "");
      if (looksLikeTermsAndConditionsText(label)) continue;
      if (!testFn(label)) continue;
      field =
        (labels[i].closest && labels[i].closest('[data-automation-id^="formField-"]')) || null;
      if (field) return field;
      next = labels[i].nextElementSibling;
      if (next && (findDropdownButton(next) || comboboxControlIn(next))) return next;
      parent = labels[i].parentElement;
      if (parent && (findDropdownButton(parent) || comboboxControlIn(parent))) return parent;
    }
    return null;
  }

  function closeWorkdayDropdown(control) {
    try {
      if (control) {
        control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    } catch (_) {}
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } catch (_) {}
  }

  async function collectWorkdayDropdownOptions(control) {
    var options = [];
    var i;
    if (!control) return options;
    clickElement(control);
    await sleep(180);
    for (i = 0; i < 10; i += 1) {
      options = collectOpenOptions();
      if (options.length) break;
      await sleep(70);
    }
    return options;
  }

  async function selectUniqueWorkdayDropdownOption(control, container, matcher) {
    var current = displayedDropdownValue(container, control) || readComboboxText(control);
    var options;
    var matches;
    var i;
    var selected;
    if (current && matcher(current)) return { ok: true, value: current, already: true };
    options = await collectWorkdayDropdownOptions(control);
    matches = [];
    for (i = 0; i < options.length; i += 1) {
      if (matcher(options[i].label)) matches.push(options[i]);
    }
    if (matches.length !== 1) {
      closeWorkdayDropdown(control);
      return { ok: false, value: current, ambiguous: matches.length > 1 };
    }
    clickElement(matches[0].el);
    await sleep(220);
    selected = "";
    for (i = 0; i < 8; i += 1) {
      selected = displayedDropdownValue(container, control) || readComboboxText(control);
      if (selected && matcher(selected)) break;
      await sleep(50);
    }
    return { ok: Boolean(selected && matcher(selected)), value: selected || matches[0].label };
  }

  async function fillWorkdayDisclosureDropdown(field, category, displayLabel, matcher, handledElements) {
    var control = findDropdownButton(field) || comboboxControlIn(field);
    var current;
    var selected;
    if (!control) {
      return resultRow(category, displayLabel, "skipped", displayLabel + " dropdown was not found.", false, "");
    }
    markHandled(handledElements, control);
    current = displayedDropdownValue(field, control) || readComboboxText(control);
    if (current && matcher(current)) {
      return resultRow(category, displayLabel, "filled", "", true, current);
    }
    if (current) {
      return resultRow(category, displayLabel, "skipped", "Field is already completed.", false, "");
    }
    selected = await selectUniqueWorkdayDropdownOption(control, field, matcher);
    if (selected && selected.ok) {
      return resultRow(category, displayLabel, "filled", "", true, selected.value);
    }
    return resultRow(category, displayLabel, "skipped", "No safe matching " + displayLabel + " option.", false, "");
  }

  function savedDemographicsFromContext(context) {
    var ctx = context || {};
    var demo = ctx.demographics || (ctx.profile && ctx.profile.demographics) || {};
    var inv = ctx.inventory || {};
    return {
      gender: trimText(demo.gender || inv.gender || ""),
      hispanicLatino: trimText(demo.hispanicLatino || demo.hispanic_latino || inv.hispanic_latino || ""),
      raceEthnicity: trimText(demo.raceEthnicity || demo.race_ethnicity || inv.race_ethnicity || ""),
      veteranStatus: trimText(demo.veteranStatus || inv.veteran_status || ""),
      generalVeteranStatus: trimText(demo.generalVeteranStatus || inv.general_veteran_status || "")
    };
  }

  function mapWorkdayGenderOption(saved) {
    var text = normalizeText(saved);
    if (!text) return "";
    if (text === "man" || text === "male") return "Male";
    if (text === "woman" || text === "female") return "Female";
    if (isPreferNotToAnswerValue(saved)) return "Not declared";
    return "";
  }

  function canonicalWorkdayRaceLabel(value) {
    var text = normalizeText(value);
    if (!text) return "";
    return text.replace(/\s*\(\s*united states of america\s*\)\s*$/g, "").trim();
  }

  function mapWorkdayVeteranKind(saved) {
    var general = normalizeText(saved.generalVeteranStatus);
    var prot = normalizeText(saved.veteranStatus);
    var preferGeneral = isPreferNotToAnswerValue(saved.generalVeteranStatus);
    var preferProt = isPreferNotToAnswerValue(saved.veteranStatus);
    if (prot === "i identify as a protected veteran" && general === "i am not a veteran") return "";
    if (prot === "i identify as a protected veteran") return "protected";
    if (general === "i am not a veteran") return "not_veteran";
    if (general === "i am a veteran" && prot === "i am not a protected veteran") return "veteran_not_protected";
    if ((preferGeneral && preferProt) || (preferGeneral && !prot) || (preferProt && !general)) return "decline";
    return "";
  }

  function looksLikeVeteranDeclineOption(label) {
    var t = normalizeText(label);
    if (!t) return false;
    if (/\bdecline\b/.test(t) && (/\bself-identify\b/.test(t) || /\bself identify\b/.test(t))) return true;
    if (/\bdo not wish to self-identify\b/.test(t) || /\bdo not want to self-identify\b/.test(t)) return true;
    if (/\bi do not want to answer\b/.test(t)) return true;
    if (/\bprefer not to (answer|say|self-identify|self identify)\b/.test(t)) return true;
    return false;
  }

  function veteranOptionMatchesKind(label, kind) {
    var t = normalizeText(label);
    if (!kind || !t) return false;
    if (kind === "protected") {
      return t === "i identify as one or more of the classifications of protected veterans listed above";
    }
    if (kind === "veteran_not_protected") {
      return t === "i identify as a veteran, just not a protected veteran";
    }
    if (kind === "not_veteran") {
      return t === "i am not a veteran";
    }
    if (kind === "decline") return looksLikeVeteranDeclineOption(label);
    return false;
  }

  async function fillVoluntaryGender(root, saved, handledElements) {
    var field = findDisclosureField(root, isGenderDisclosureLabel);
    var target;
    if (!field) return [];
    target = mapWorkdayGenderOption(saved.gender);
    if (!target) {
      return [
        resultRow("gender", "Gender", "skipped", saved.gender ? "No safe matching Gender option." : "No saved answer.", false, "")
      ];
    }
    return [
      await fillWorkdayDisclosureDropdown(
        field,
        "gender",
        "Gender",
        function (label) {
          return normalizeText(label) === normalizeText(target);
        },
        handledElements
      )
    ];
  }

  async function fillVoluntaryHispanic(root, saved, handledElements) {
    var field = findDisclosureField(root, isHispanicDisclosureLabel);
    var answer;
    if (!field) return [];
    answer = explicitYesNo(saved.hispanicLatino);
    if (!answer) {
      return [
        resultRow(
          "hispanic_latino",
          "Ethnicity: Hispanic or Latino",
          "skipped",
          saved.hispanicLatino ? "No safe matching Hispanic or Latino option." : "No saved answer.",
          false,
          ""
        )
      ];
    }
    return [
      await fillWorkdayDisclosureDropdown(
        field,
        "hispanic_latino",
        "Ethnicity: Hispanic or Latino",
        function (label) {
          return normalizeText(label) === answer;
        },
        handledElements
      )
    ];
  }

  async function fillVoluntaryRace(root, saved, handledElements) {
    var field = findDisclosureField(root, isRaceDisclosureLabel);
    var savedCanon;
    if (!field) return [];
    savedCanon = canonicalWorkdayRaceLabel(saved.raceEthnicity);
    if (!savedCanon) {
      return [resultRow("race_ethnicity", "Race", "skipped", "No saved answer.", false, "")];
    }
    return [
      await fillWorkdayDisclosureDropdown(
        field,
        "race_ethnicity",
        "Race",
        function (label) {
          return canonicalWorkdayRaceLabel(label) === savedCanon;
        },
        handledElements
      )
    ];
  }

  async function fillVoluntaryVeteran(root, saved, handledElements) {
    var field = findDisclosureField(root, isVeteranDisclosureLabel);
    var kind;
    if (!field) return [];
    kind = mapWorkdayVeteranKind(saved);
    if (!kind) {
      return [
        resultRow(
          "veteran_status",
          "Veteran Status",
          "skipped",
          saved.veteranStatus || saved.generalVeteranStatus
            ? "Saved veteran-status answers are incomplete or contradictory."
            : "No saved answer.",
          false,
          ""
        )
      ];
    }
    return [
      await fillWorkdayDisclosureDropdown(
        field,
        "veteran_status",
        "Veteran Status",
        function (label) {
          return veteranOptionMatchesKind(label, kind);
        },
        handledElements
      )
    ];
  }

  async function fillVoluntaryDisclosures(context, handledElements) {
    var ctx = context || {};
    var root = ctx.root || document;
    var saved = savedDemographicsFromContext(ctx);
    var results = [];
    results = results.concat(await fillVoluntaryGender(root, saved, handledElements));
    results = results.concat(await fillVoluntaryHispanic(root, saved, handledElements));
    results = results.concat(await fillVoluntaryRace(root, saved, handledElements));
    results = results.concat(await fillVoluntaryVeteran(root, saved, handledElements));
    return results;
  }

  var WORKDAY_DISABILITY_YES =
    "Yes, I have a disability, or have had one in the past";
  var WORKDAY_DISABILITY_NO =
    "No, I do not have a disability and have not had one in the past";
  var WORKDAY_DISABILITY_DECLINE = "I do not want to answer";

  function isSelfIdentifyHeadingText(text) {
    var key = disclosureLabelKey(text);
    return key === "self identify" || key === "self-identify";
  }

  function isSelfIdentifyPage(root) {
    var doc = root || document;
    var nodes;
    var i;
    var text;
    if (!doc || !doc.querySelectorAll) return false;
    nodes = doc.querySelectorAll(
      'h1, h2, h3, h4, [role="heading"], [data-automation-id="pageHeaderTitleText"], [data-automation-id="pageHeader"]'
    );
    for (i = 0; i < nodes.length; i += 1) {
      text = trimText(nodes[i].innerText || nodes[i].textContent || "");
      if (isSelfIdentifyHeadingText(text)) return true;
    }
    if (findDisabilityChoiceByLabel(doc, WORKDAY_DISABILITY_YES)) return true;
    if (findDisclosureField(doc, function (label) { return disclosureLabelKey(label) === "name"; }) &&
        findDisclosureField(doc, function (label) { return disclosureLabelKey(label) === "date"; }) &&
        findDisabilityChoiceByLabel(doc, WORKDAY_DISABILITY_DECLINE)) {
      return true;
    }
    return false;
  }

  function savedLegalFullName(inventory, profile) {
    var first = inventoryAnswer("first_name", inventory, profile);
    var last = inventoryAnswer("last_name", inventory, profile);
    if (!first || !last) return "";
    return trimText(first + " " + last);
  }

  function pad2(num) {
    return num < 10 ? "0" + String(num) : String(num);
  }

  function localDateMmDdYyyy() {
    var now = new Date();
    return pad2(now.getMonth() + 1) + "/" + pad2(now.getDate()) + "/" + String(now.getFullYear());
  }

  function isLocalTodayDateText(value) {
    var m = trimText(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var now;
    if (!m) return false;
    now = new Date();
    return (
      parseInt(m[1], 10) === now.getMonth() + 1 &&
      parseInt(m[2], 10) === now.getDate() &&
      parseInt(m[3], 10) === now.getFullYear()
    );
  }

  function savedDisabilityStatus(context) {
    var ctx = context || {};
    var demo = ctx.demographics || (ctx.profile && ctx.profile.demographics) || {};
    var inv = ctx.inventory || {};
    return trimText(
      demo.disabilityStatus ||
        demo.disability_status ||
        inv.disability_status ||
        inv.disabilityStatus ||
        ""
    );
  }

  function mapWorkdayDisabilityKind(saved) {
    var text = normalizeText(saved);
    if (!text) return "";
    if (
      text === "prefer not to answer" ||
      text === "prefer not to say" ||
      text === "decline to self-identify" ||
      text === "decline to self identify" ||
      text === "i do not want to answer"
    ) {
      return "decline";
    }
    if (text === "yes" || text.indexOf("yes, i have a disability") === 0) return "yes";
    if (text === "no" || text.indexOf("no, i do not have a disability") === 0) return "no";
    return "";
  }

  function disabilityKindTargetLabel(kind) {
    if (kind === "yes") return WORKDAY_DISABILITY_YES;
    if (kind === "no") return WORKDAY_DISABILITY_NO;
    if (kind === "decline") return WORKDAY_DISABILITY_DECLINE;
    return "";
  }

  function choiceNodeLabel(el) {
    if (!el) return "";
    return trimText(
      (el.getAttribute && (el.getAttribute("data-automation-label") || el.getAttribute("aria-label"))) ||
        el.innerText ||
        el.textContent ||
        ""
    );
  }

  function isMultiDisabilityChoiceNode(el) {
    var t = normalizeText(choiceNodeLabel(el));
    var hits = 0;
    if (!t) return false;
    if (t.indexOf(normalizeText(WORKDAY_DISABILITY_YES)) !== -1) hits += 1;
    if (t.indexOf(normalizeText(WORKDAY_DISABILITY_NO)) !== -1) hits += 1;
    if (t.indexOf(normalizeText(WORKDAY_DISABILITY_DECLINE)) !== -1) hits += 1;
    return hits >= 2;
  }

  function associatedDisabilityControl(el) {
    var input;
    if (!el) return null;
    if (el.matches && el.matches('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]')) {
      return el;
    }
    input = el.querySelector && el.querySelector('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]');
    if (input) return input;
    if (el.getAttribute && el.getAttribute("for")) {
      input = document.getElementById(el.getAttribute("for"));
      if (input) return input;
    }
    return el;
  }

  function findDisabilityChoiceByLabel(root, targetLabel) {
    var doc = root || document;
    var want = normalizeText(targetLabel);
    var nodes;
    var i;
    var el;
    var label;
    var best = null;
    if (!doc || !doc.querySelectorAll || !want) return null;
    nodes = doc.querySelectorAll(
      'label, [role="checkbox"], [role="radio"], [data-automation-id="promptOption"], [data-automation-id="radioBtn"], [data-automation-id="checkbox"], [data-automation-id="clickable"], li, button, div, span'
    );
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (isMultiDisabilityChoiceNode(el)) continue;
      label = choiceNodeLabel(el);
      if (normalizeText(label) !== want) continue;
      if (!best || (el.querySelectorAll && best.querySelectorAll && el.querySelectorAll("*").length < best.querySelectorAll("*").length)) {
        best = el;
      }
    }
    return best ? associatedDisabilityControl(best) || best : null;
  }

  function isDisabilityChoiceSelected(el) {
    var input;
    var box;
    if (!el) return false;
    if (el.checked) return true;
    if (el.getAttribute && (el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-pressed") === "true")) {
      return true;
    }
    if (el.getAttribute && el.getAttribute("data-automation-checked") === "true") return true;
    input = el.querySelector && el.querySelector("input[type='checkbox'], input[type='radio']");
    if (input && input.checked) return true;
    if (input && input.getAttribute && input.getAttribute("aria-checked") === "true") return true;
    box = el.querySelector && el.querySelector('[data-automation-id="checkbox"]');
    if (box && box.getAttribute && box.getAttribute("data-automationcheckboxchecked") === "true") return true;
    return false;
  }

  function clickWorkdayChoiceOnce(el) {
    var target = el;
    var input;
    var clickFn;
    if (!el) return;
    input = el.querySelector && el.querySelector('input[type="checkbox"], input[type="radio"]');
    if (el.matches && el.matches('input[type="checkbox"], input[type="radio"]')) target = el;
    else if (input) target = input;
    clickFn =
      window.HTMLElement &&
      window.HTMLElement.prototype &&
      window.HTMLElement.prototype.click;
    if (clickFn) clickFn.call(target);
    else target.click();
  }

  async function fillSelfIdentifyName(root, context, handledElements) {
    var field = findDisclosureField(root, function (label) {
      return disclosureLabelKey(label) === "name";
    });
    var input;
    var value;
    var current;
    var after;
    if (!field) return [];
    input = firstAnswerTextInput(field);
    if (!input) {
      return [resultRow("full_name", "Name", "skipped", "Self Identify Name field was not found.", false, "")];
    }
    markHandled(handledElements, input);
    value = savedLegalFullName(context.inventory, context.profile);
    current = readInputValue(input);
    if (current && value && normalizeText(current) === normalizeText(value)) {
      return [resultRow("full_name", "Name", "filled", "", true, current)];
    }
    if (current) {
      return [resultRow("full_name", "Name", "skipped", "Field is already completed.", false, "")];
    }
    if (!value) {
      return [resultRow("full_name", "Name", "skipped", "No saved name.", false, "")];
    }
    if (!setInputValue(input, value)) {
      return [resultRow("full_name", "Name", "failed", "Could not set field value.", false, "")];
    }
    after = readInputValue(input);
    if (!after || normalizeText(after) !== normalizeText(value)) {
      return [resultRow("full_name", "Name", "failed", "Verification failed; value did not persist.", false, "")];
    }
    return [resultRow("full_name", "Name", "filled", "", true, after)];
  }

  async function fillSelfIdentifyDate(root, handledElements) {
    var field = findDisclosureField(root, function (label) {
      return disclosureLabelKey(label) === "date";
    });
    var today = localDateMmDdYyyy();
    var now = new Date();
    var month;
    var day;
    var year;
    var input;
    var current;
    var after;
    var monthStatus;
    var dayStatus;
    var yearStatus;
    if (!field) return [];
    month = field.querySelector && field.querySelector('[data-automation-id="dateSectionMonth-input"]');
    day = field.querySelector && field.querySelector('[data-automation-id="dateSectionDay-input"]');
    year = field.querySelector && field.querySelector('[data-automation-id="dateSectionYear-input"]');
    if (month || day || year) {
      monthStatus = month
        ? await fillExperienceDatePart(month, pad2(now.getMonth() + 1), handledElements, false, "month")
        : "skip";
      if (day) {
        markHandled(handledElements, day);
        current = readInputValue(day);
        if (current && parseInt(current, 10) === now.getDate()) {
          dayStatus = "already";
        } else if (current) {
          dayStatus = "skip-existing";
        } else {
          dayStatus = setInputValue(day, pad2(now.getDate())) && parseInt(readInputValue(day), 10) === now.getDate()
            ? "ok"
            : "fail";
        }
      } else {
        dayStatus = "skip";
      }
      yearStatus = year
        ? await fillExperienceDatePart(year, String(now.getFullYear()), handledElements, false, "year")
        : "skip";
      if (monthStatus === "fail" || dayStatus === "fail" || yearStatus === "fail") {
        return [resultRow("availability", "Date", "failed", "Verification failed; date did not persist.", false, "")];
      }
      if (monthStatus === "ok" || dayStatus === "ok" || yearStatus === "ok" ||
          monthStatus === "already" || dayStatus === "already" || yearStatus === "already") {
        return [resultRow("availability", "Date", "filled", "", true, today)];
      }
      return [resultRow("availability", "Date", "skipped", "Field is already completed.", false, "")];
    }
    input = firstAnswerTextInput(field);
    if (!input) {
      return [resultRow("availability", "Date", "skipped", "Self Identify Date field was not found.", false, "")];
    }
    markHandled(handledElements, input);
    current = readInputValue(input);
    if (current && isLocalTodayDateText(current)) {
      return [resultRow("availability", "Date", "filled", "", true, current)];
    }
    if (current) {
      return [resultRow("availability", "Date", "skipped", "Field is already completed.", false, "")];
    }
    if (!setInputValue(input, today)) {
      return [resultRow("availability", "Date", "failed", "Could not set field value.", false, "")];
    }
    after = readInputValue(input);
    if (!isLocalTodayDateText(after)) {
      return [resultRow("availability", "Date", "failed", "Verification failed; date did not persist.", false, "")];
    }
    return [resultRow("availability", "Date", "filled", "", true, after)];
  }

  async function fillSelfIdentifyDisability(root, context, handledElements) {
    var saved = savedDisabilityStatus(context);
    var kind = mapWorkdayDisabilityKind(saved);
    var target = disabilityKindTargetLabel(kind);
    var yesEl = findDisabilityChoiceByLabel(root, WORKDAY_DISABILITY_YES);
    var noEl = findDisabilityChoiceByLabel(root, WORKDAY_DISABILITY_NO);
    var declineEl = findDisabilityChoiceByLabel(root, WORKDAY_DISABILITY_DECLINE);
    var selectedEl = null;
    var mappedEl = null;
    var i;
    if (!yesEl && !noEl && !declineEl) return [];
    if (isDisabilityChoiceSelected(yesEl)) selectedEl = yesEl;
    else if (isDisabilityChoiceSelected(noEl)) selectedEl = noEl;
    else if (isDisabilityChoiceSelected(declineEl)) selectedEl = declineEl;
    if (kind === "yes") mappedEl = yesEl;
    else if (kind === "no") mappedEl = noEl;
    else if (kind === "decline") mappedEl = declineEl;
    if (selectedEl) {
      if (mappedEl && selectedEl === mappedEl) {
        return [resultRow("disability_status", "Disability", "filled", "", true, target)];
      }
      return [
        resultRow("disability_status", "Disability", "skipped", "Field is already completed.", false, "")
      ];
    }
    if (!kind || !mappedEl) {
      return [
        resultRow(
          "disability_status",
          "Disability",
          "skipped",
          saved ? "No safe matching Disability option." : "No saved answer.",
          false,
          ""
        )
      ];
    }
    markHandled(handledElements, mappedEl);
    clickWorkdayChoiceOnce(mappedEl);
    for (i = 0; i < 8; i += 1) {
      if (isDisabilityChoiceSelected(mappedEl)) break;
      await sleep(50);
    }
    if (!isDisabilityChoiceSelected(mappedEl)) {
      return [
        resultRow("disability_status", "Disability", "skipped", "Disability selection did not persist.", false, "")
      ];
    }
    if (
      (mappedEl !== yesEl && isDisabilityChoiceSelected(yesEl)) ||
      (mappedEl !== noEl && isDisabilityChoiceSelected(noEl)) ||
      (mappedEl !== declineEl && isDisabilityChoiceSelected(declineEl))
    ) {
      return [
        resultRow("disability_status", "Disability", "skipped", "Disability selection was not unique.", false, "")
      ];
    }
    return [resultRow("disability_status", "Disability", "filled", "", true, target)];
  }

  async function fillSelfIdentify(context, handledElements) {
    var ctx = context || {};
    var root = ctx.root || document;
    var results = [];
    results = results.concat(await fillSelfIdentifyName(root, ctx, handledElements));
    results = results.concat(await fillSelfIdentifyDate(root, handledElements));
    results = results.concat(await fillSelfIdentifyDisability(root, ctx, handledElements));
    return results;
  }

  function isMyInformationSectionPresent(root) {
    var doc = root || document;
    if (!doc) return false;
    if (collectWidgets(doc).length) return true;
    if (findAnswerTextInput(doc, "addressLine1", "formField-addressLine1")) return true;
    if (findPhoneNumberInput(doc)) return true;
    return false;
  }

  function isWorkExperienceSectionPresent(root) {
    var doc = root || document;
    if (findWorkExperienceHeadingNode(doc)) return true;
    if (collectExperienceRows(doc).length) return true;
    if (findInitialWorkExperienceAddButton(doc)) return true;
    return false;
  }

  function isEducationSectionPresent(root) {
    var doc = root || document;
    if (findEducationHeadingNode(doc)) return true;
    if (collectEducationRows(doc).length) return true;
    if (findInitialEducationAddButton(doc)) return true;
    return false;
  }

  function isSkillsSectionPresent(root) {
    return Boolean(findSkillsSection(root) || findSkillsFormField(root));
  }

  function isResumeSectionPresent(root) {
    var found = findResumeCvFileInput(root);
    return Boolean(found && found.input);
  }

  async function fillSupportedFields(context) {
    if (!isSupportedPage()) {
      var handled = (context && context.handledElements) || [];
      return summarize([], handled);
    }
    var ctx = context || {};
    var root = ctx.root || document;
    var handledElements = ctx.handledElements || [];
    var selfIdentifyRows;
    if (isSelfIdentifyPage(root)) {
      selfIdentifyRows = await fillSelfIdentify(ctx, handledElements);
      return summarize(selfIdentifyRows, handledElements);
    }
    var info = { results: [], handledElements: handledElements };
    if (isMyInformationSectionPresent(root)) {
      info = await fillMyInformation(ctx);
      handledElements = (info && info.handledElements) || handledElements;
    }
    var resumeRows = isResumeSectionPresent(root)
      ? await fillResumeCvUpload(ctx, handledElements)
      : [];
    var experienceRows = isWorkExperienceSectionPresent(root)
      ? await fillWorkExperience(ctx, handledElements)
      : [];
    var educationRows = isEducationSectionPresent(root)
      ? await fillEducation(ctx, handledElements)
      : [];
    var skillRows = isSkillsSectionPresent(root)
      ? await fillSkills(ctx, handledElements)
      : [];
    var questionRows = findWorkAuthorizationQuestion(root)
      ? await fillApplicationQuestions(ctx, handledElements)
      : [];
    var disclosureRows = await fillVoluntaryDisclosures(ctx, handledElements);
    return summarize(
      ((info && info.results) || []).concat(
        resumeRows,
        experienceRows,
        educationRows,
        skillRows,
        questionRows,
        disclosureRows
      ),
      handledElements
    );
  }

  global.ImpulsoWorkdayAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
