(function (global) {
  var FILLABLE_CATEGORIES = {
    first_name: true,
    last_name: true,
    email: true,
    phone: true,
    linkedin: true,
    github: true,
    portfolio: true,
    additional_information: true,
    city: true,
    location: true,
    resume_upload: true,
    work_authorization: true,
    sponsorship_now: true,
    sponsorship_later: true,
    relocation: true,
    disability_status: true,
    veteran_status: true,
    gender: true,
    race_ethnicity: true,
    referral_source: true,
    privacy_consent: true
  };

  function trimText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return trimText(value).toLowerCase();
  }

  function autofill() {
    return global.ImpulsoAutofill || {};
  }

  function isSmartRecruitersHost(hostname) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    return host === "jobs.smartrecruiters.com";
  }

  function isSmartRecruitersApplicationUrl(href, hostname, pathname) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    var path = String(pathname || "").toLowerCase();
    if (!host || !path) {
      try {
        var parsed = new URL(String(href || ""));
        host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        path = parsed.pathname.toLowerCase();
      } catch (_) {}
    }
    if (!isSmartRecruitersHost(host)) return false;
    return path.indexOf("/oneclick-ui/") !== -1;
  }

  function isSmartRecruitersScreeningPath(pathname) {
    var path = String(pathname || "").toLowerCase();
    return /\/screening(?:\/|$)/.test(path);
  }

  function isSmartRecruitersScreeningUrl(href, hostname, pathname) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    var path = String(pathname || "").toLowerCase();
    if (!host || !path) {
      try {
        var parsed = new URL(String(href || ""));
        host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        path = parsed.pathname.toLowerCase();
      } catch (_) {}
    }
    if (!isSmartRecruitersApplicationUrl(href, host, path)) return false;
    return isSmartRecruitersScreeningPath(path);
  }

  function isSupportedPage() {
    try {
      return isSmartRecruitersApplicationUrl(
        (global.location && global.location.href) || "",
        (global.location && global.location.hostname) || "",
        (global.location && global.location.pathname) || ""
      );
    } catch (_) {
      return false;
    }
  }

  function emptyReport() {
    return { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } };
  }

  function summarizeResults(results, error) {
    var list = results || [];
    return {
      results: list,
      error: error || "",
      summary: {
        attempted: list.length,
        filled: list.filter(function (r) { return r && r.status === "filled"; }).length,
        skipped: list.filter(function (r) { return r && r.status === "skipped"; }).length,
        failed: list.filter(function (r) { return r && r.status === "failed"; }).length
      }
    };
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function queryDeep(root, selector) {
    var AF = autofill();
    if (AF && typeof AF.querySelectorAllDeep === "function") {
      return AF.querySelectorAllDeep(root || document, selector) || [];
    }
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function collectContext(el) {
    var AF = autofill();
    if (AF && typeof AF.collectContext === "function") return AF.collectContext(el);
    return {
      label: "",
      placeholder: trimText(el && el.getAttribute && el.getAttribute("placeholder")),
      ariaLabel: trimText(el && el.getAttribute && el.getAttribute("aria-label")),
      name: trimText(el && (el.name || (el.getAttribute && el.getAttribute("name")))),
      id: trimText(el && el.id),
      blob: ""
    };
  }

  function detectCategory(el, context) {
    var AF = autofill();
    if (AF && typeof AF.detectCategory === "function") {
      return AF.detectCategory(el, context || collectContext(el), []) || { category: "unknown" };
    }
    return { category: "unknown", confidence: 0 };
  }

  function looksLikeCountryChrome(text) {
    var AF = autofill();
    if (AF && typeof AF.looksLikeSmartRecruitersCountryChrome === "function") {
      return AF.looksLikeSmartRecruitersCountryChrome(text);
    }
    var t = normalizeText(text);
    if (!t) return false;
    if (/\bsearch by country\b/.test(t)) return true;
    if (/\bcountry\/region\b/.test(t) || /\bcountry or region\b/.test(t)) return true;
    if (/\bregion or code\b/.test(t)) return true;
    if (/^[a-z][a-z .'-]+ \+\d{1,4}$/.test(t)) return true;
    return false;
  }

  function isScanNoise(el) {
    var AF = autofill();
    if (AF && typeof AF.isSmartRecruitersScanNoise === "function") {
      return AF.isSmartRecruitersScanNoise(el);
    }
    return false;
  }

  function ownDisplayText(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    var parts = [
      el.getAttribute && el.getAttribute("aria-label"),
      el.getAttribute && el.getAttribute("placeholder"),
      el.value,
      tag === "button" || role === "button" || role === "combobox" ? el.innerText || el.textContent : ""
    ];
    return trimText(parts.filter(Boolean).join(" "));
  }

  function isCountryChromeElement(el) {
    if (!el) return false;
    return looksLikeCountryChrome(ownDisplayText(el));
  }

  function isUnitedStatesCountryOption(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (/\bunited states\b/.test(t)) return true;
    if (/\bu\.s\.a\.?\b/.test(t)) return true;
    if (/\busa\b/.test(t) && (/\+?\s*1\b/.test(t) || t === "usa")) return true;
    return false;
  }

  function countryAlreadyUnitedStates(text) {
    return isUnitedStatesCountryOption(text);
  }

  function nationalPhoneNumber(phone, countryCode) {
    var AF = autofill();
    var raw = trimText(phone);
    if (!raw) return "";
    var digits =
      AF && typeof AF.phoneDigitsOnly === "function"
        ? AF.phoneDigitsOnly(raw)
        : raw.replace(/\D/g, "");
    var codeDigits =
      AF && typeof AF.phoneDigitsOnly === "function"
        ? AF.phoneDigitsOnly(countryCode || "1")
        : String(countryCode == null ? "1" : countryCode).replace(/\D/g, "");
    if (!codeDigits) codeDigits = "1";
    if (codeDigits === "1" && digits.length === 11 && digits.charAt(0) === "1") {
      return digits.slice(1);
    }
    if (codeDigits && digits.indexOf(codeDigits) === 0 && digits.length > codeDigits.length + 6) {
      return digits.slice(codeDigits.length) || raw;
    }
    return raw;
  }

  function isFillableCategory(category) {
    return Boolean(FILLABLE_CATEGORIES[category]);
  }

  function describeInputType(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (el.isContentEditable) return "contenteditable";
    return normalizeText(el.type || tag || "");
  }

  function liveFieldIdentity(el) {
    var ctx = collectContext(el);
    return {
      el: el,
      id: trimText(ctx.id || el.id),
      name: trimText(ctx.name || el.name),
      label: normalizeText(ctx.label),
      ariaLabel: normalizeText(ctx.ariaLabel),
      placeholder: normalizeText(ctx.placeholder),
      inputType: describeInputType(el),
      category: (detectCategory(el, ctx).category || "unknown")
    };
  }

  function scoreLiveFieldMatch(scanField, live) {
    var scan = scanField || {};
    var score = 0;
    var scanId = trimText(scan.id);
    var scanName = trimText(scan.name);
    var scanLabel = normalizeText(scan.label);
    var scanAria = normalizeText(scan.ariaLabel);
    var scanPlaceholder = normalizeText(scan.placeholder);
    var scanType = normalizeText(scan.inputType);
    if (scanId && live.id && scanId === live.id) score += 100;
    if (scanName && live.name && scanName === live.name) score += 80;
    if (scanLabel && live.label && scanLabel === live.label) score += 40;
    if (scanAria && live.ariaLabel && scanAria === live.ariaLabel) score += 40;
    if (scanPlaceholder && live.placeholder && scanPlaceholder === live.placeholder) score += 20;
    if (scanType && live.inputType && scanType === live.inputType) score += 10;
    if (scan.category && live.category && scan.category === live.category) score += 15;
    return score;
  }

  function clickEl(el) {
    if (!el) return;
    try {
      if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
    } catch (_) {}
    try {
      if (typeof el.focus === "function") el.focus();
    } catch (_) {}
    try {
      el.click();
    } catch (_) {
      try {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
  }

  function setReactValue(el, value, options) {
    var AF = autofill();
    try {
      if (typeof el.focus === "function") el.focus();
    } catch (_) {}
    if (AF && typeof AF.setNativeValue === "function") {
      return AF.setNativeValue(el, value, options || {});
    }
    try {
      el.value = value == null ? "" : String(value);
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function readValue(el) {
    var AF = autofill();
    if (AF && typeof AF.readElementTextValue === "function") return AF.readElementTextValue(el);
    return trimText(el && (el.value || el.innerText || el.textContent));
  }

  function wasHandled(list, el) {
    return Boolean(el && list && list.indexOf(el) !== -1);
  }

  function markHandled(list, el) {
    if (!el || !list) return;
    if (list.indexOf(el) === -1) list.push(el);
  }

  function collectLiveControls(root) {
    return queryDeep(
      root,
      "input, textarea, select, button, [contenteditable='true'], [contenteditable=''], [role='combobox'], [role='textbox'], [role='searchbox']"
    ).filter(isLiveDocumentNode);
  }

  function resolveLiveElement(scanField, liveIdentities, used) {
    var best = null;
    var bestScore = 0;
    var i;
    for (i = 0; i < liveIdentities.length; i += 1) {
      var live = liveIdentities[i];
      if (!live || !live.el || wasHandled(used, live.el)) continue;
      if (isScanNoise(live.el) && scanField.category !== "phone") continue;
      var score = scoreLiveFieldMatch(scanField, live);
      if (score > bestScore) {
        bestScore = score;
        best = live;
      }
    }
    if (!best || bestScore < 40) return null;
    return best;
  }

  function findCountryTriggerNear(phoneInput, liveControls) {
    var i;
    var trigger = null;
    for (i = 0; i < liveControls.length; i += 1) {
      var el = liveControls[i];
      if (!el || el === phoneInput) continue;
      if (!isCountryChromeElement(el)) continue;
      var role = normalizeText(el.getAttribute && el.getAttribute("role"));
      var tag = (el.tagName || "").toLowerCase();
      var type = normalizeText(el.type || "");
      if (type === "search" || role === "searchbox") continue;
      if (tag === "button" || role === "button" || role === "combobox" || tag === "input") {
        trigger = el;
        break;
      }
    }
    return trigger;
  }

  function collectOpenOptions(root) {
    return queryDeep(root, '[role="option"], [role="listbox"] [role="option"], li[role="option"]').filter(
      function (el) {
        var text = trimText(el.innerText || el.textContent || "");
        return Boolean(text);
      }
    );
  }

  function findCountrySearchInput(root) {
    var nodes = queryDeep(root, "input, [role='searchbox']");
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (isCountryChromeElement(el) || looksLikeCountryChrome(ownDisplayText(el))) {
        var type = normalizeText(el.type || "");
        var role = normalizeText(el.getAttribute && el.getAttribute("role"));
        if (type === "search" || type === "text" || role === "searchbox" || role === "combobox") {
          return el;
        }
      }
    }
    return null;
  }

  async function selectUnitedStatesCountry(root, trigger) {
    if (!trigger) {
      return { ok: false, reason: "Phone country control was not found." };
    }
    var before = ownDisplayText(trigger);
    if (countryAlreadyUnitedStates(before)) {
      return { ok: true, already: true, value: before };
    }
    clickEl(trigger);
    await sleep(120);
    var search = findCountrySearchInput(root);
    if (search) {
      setReactValue(search, "United States", { blur: false });
      try {
        search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        search.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown", bubbles: true }));
      } catch (_) {}
    }
    var matched = null;
    var wait;
    for (wait = 0; wait < 16; wait += 1) {
      await sleep(80);
      var options = collectOpenOptions(root);
      var o;
      for (o = 0; o < options.length; o += 1) {
        if (isUnitedStatesCountryOption(options[o].innerText || options[o].textContent || "")) {
          matched = options[o];
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) {
      return { ok: false, reason: "United States was not found in the phone country list." };
    }
    clickEl(matched);
    await sleep(200);
    var after = ownDisplayText(trigger);
    var afterNorm = normalizeText(after);
    if (countryAlreadyUnitedStates(after)) {
      return { ok: true, value: after };
    }
    if (/\+1\b/.test(afterNorm) && !/\bcanada\b/.test(afterNorm)) {
      return { ok: true, value: after };
    }
    if (after && afterNorm && afterNorm !== normalizeText(before)) {
      return { ok: true, value: after };
    }
    return { ok: false, reason: "Phone country was not accepted as United States / +1." };
  }

  async function fillPhoneCompound(root, phoneInput, inventory, handled) {
    var AF = autofill();
    var liveControls = collectLiveControls(root);
    var trigger = findCountryTriggerNear(phoneInput, liveControls);
    markHandled(handled, trigger);
    var countryResult = await selectUnitedStatesCountry(root, trigger);
    if (trigger && !countryResult.ok) {
      return {
        ok: false,
        status: "failed",
        reason: countryResult.reason || "Could not select United States for phone country.",
        value: ""
      };
    }
    var number = nationalPhoneNumber(
      (inventory && inventory.phone) || "",
      (inventory && inventory.phone_country_code) || "1"
    );
    if (!number) {
      return { ok: false, status: "skipped", reason: "No saved answer.", value: "" };
    }
    var fillResult =
      AF && typeof AF.fillTextElement === "function"
        ? AF.fillTextElement(phoneInput, number)
        : { ok: false, status: "failed", reason: "Autofill engine is not available." };
    if (fillResult && fillResult.ok) {
      return { ok: true, status: "filled", reason: "", value: number };
    }
    return fillResult || { ok: false, status: "failed", reason: "Phone number was not filled." };
  }

  var US_STATE_BY_ABBREV = {
    al: "alabama",
    ak: "alaska",
    az: "arizona",
    ar: "arkansas",
    ca: "california",
    co: "colorado",
    ct: "connecticut",
    de: "delaware",
    dc: "district of columbia",
    fl: "florida",
    ga: "georgia",
    hi: "hawaii",
    id: "idaho",
    il: "illinois",
    in: "indiana",
    ia: "iowa",
    ks: "kansas",
    ky: "kentucky",
    la: "louisiana",
    me: "maine",
    md: "maryland",
    ma: "massachusetts",
    mi: "michigan",
    mn: "minnesota",
    ms: "mississippi",
    mo: "missouri",
    mt: "montana",
    ne: "nebraska",
    nv: "nevada",
    nh: "new hampshire",
    nj: "new jersey",
    nm: "new mexico",
    ny: "new york",
    nc: "north carolina",
    nd: "north dakota",
    oh: "ohio",
    ok: "oklahoma",
    or: "oregon",
    pa: "pennsylvania",
    ri: "rhode island",
    sc: "south carolina",
    sd: "south dakota",
    tn: "tennessee",
    tx: "texas",
    ut: "utah",
    vt: "vermont",
    va: "virginia",
    wa: "washington",
    wv: "west virginia",
    wi: "wisconsin",
    wy: "wyoming"
  };

  function expandRegionToken(token) {
    var t = normalizeText(token).replace(/\./g, "");
    if (!t) return "";
    if (t === "us" || t === "usa" || t === "united states" || t === "united states of america") {
      return "usa";
    }
    if (US_STATE_BY_ABBREV[t]) return US_STATE_BY_ABBREV[t];
    return t;
  }

  function parseCityQuery(text) {
    var parts = trimText(text)
      .split(",")
      .map(function (part) {
        return trimText(part);
      })
      .filter(Boolean);
    var city = normalizeText(parts[0] || text);
    var region = expandRegionToken(parts[1] || "");
    var country = expandRegionToken(parts[2] || "");
    if (region === "usa" && !country) {
      country = "usa";
      region = "";
    }
    return { city: city, region: region, country: country, raw: trimText(text) };
  }

  function cityNamesAlign(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b + " ") === 0 || b.indexOf(a + " ") === 0) return true;
    return false;
  }

  function citySuggestionMatches(optionText, savedCity) {
    var want = parseCityQuery(savedCity);
    var got = parseCityQuery(optionText);
    if (!want.city || !got.city) return false;
    if (!cityNamesAlign(want.city, got.city)) return false;
    if (want.region && got.region && want.region !== got.region) return false;
    if (want.country && got.country && want.country !== got.country) return false;
    return true;
  }

  function optionLabelOf(opt) {
    if (!opt) return "";
    if (typeof opt === "string") return trimText(opt);
    if (opt.label) return trimText(opt.label);
    return trimText(opt.innerText || opt.textContent || "");
  }

  function optionElementOf(opt) {
    if (!opt) return null;
    if (opt.nodeType === 1) return opt;
    return opt.el || null;
  }

  function pickCitySuggestion(options, savedCity) {
    var list = options || [];
    var exact = [];
    var cityRegion = [];
    var cityOnly = [];
    var want = parseCityQuery(savedCity);
    var i;
    var label;
    var got;
    if (!want.city) return null;
    for (i = 0; i < list.length; i += 1) {
      label = optionLabelOf(list[i]);
      if (!label || !citySuggestionMatches(label, savedCity)) continue;
      got = parseCityQuery(label);
      if (normalizeText(label) === normalizeText(savedCity)) {
        exact.push(list[i]);
        continue;
      }
      if (want.region && got.region && want.region === got.region) {
        cityRegion.push(list[i]);
        continue;
      }
      cityOnly.push(list[i]);
    }
    if (exact.length) return exact[0];
    if (cityRegion.length === 1) return cityRegion[0];
    if (cityRegion.length > 1) return cityRegion[0];
    if (cityOnly.length === 1) return cityOnly[0];
    return null;
  }

  function resolveCityInput(el) {
    if (!el) return el;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return el;
    var inner;
    try {
      inner = el.querySelector && el.querySelector("input, textarea, [contenteditable='true']");
    } catch (_) {
      inner = null;
    }
    if (inner) return inner;
    var deep = queryDeep(el, "input, textarea, [contenteditable='true']");
    return (deep && deep[0]) || el;
  }

  function escapeDomId(id) {
    if (global.CSS && typeof global.CSS.escape === "function") return global.CSS.escape(id);
    return String(id || "").replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  function findNodeByIdDeep(root, id) {
    if (!id) return null;
    try {
      var doc = (root && root.nodeType === 9 ? root : null) || (root && root.ownerDocument) || document;
      if (doc && typeof doc.getElementById === "function") {
        var byDoc = doc.getElementById(id);
        if (byDoc) return byDoc;
      }
    } catch (_) {}
    var matches = queryDeep(root || document, "#" + escapeDomId(id));
    return matches && matches[0] ? matches[0] : null;
  }

  function ariaOwnedIds(el) {
    if (!el || !el.getAttribute) return [];
    var raw = trimText(el.getAttribute("aria-controls") || el.getAttribute("aria-owns") || "");
    if (!raw) return [];
    return raw.split(/\s+/).filter(Boolean);
  }

  function isProbablyVisible(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch (_) {}
    try {
      if (el.getBoundingClientRect) {
        var box = el.getBoundingClientRect();
        if (box && box.width === 0 && box.height === 0) return false;
      }
    } catch (_) {}
    return true;
  }

  function parentOrShadowHost(el) {
    if (!el) return null;
    if (el.parentElement) return el.parentElement;
    try {
      var root = el.getRootNode && el.getRootNode();
      return root && root.host ? root.host : null;
    } catch (_) {
      return null;
    }
  }

  function ancestorChain(el) {
    var chain = [];
    var node = el;
    var hops = 0;
    while (node && hops < 16) {
      chain.push(node);
      node = parentOrShadowHost(node);
      hops += 1;
    }
    return chain;
  }

  function isManualCityHelper(text) {
    var t = normalizeText(text);
    return /\bcannot find your city\b/.test(t) || /\bfill in manually\b/.test(t);
  }

  function looksLikeLocationSuggestion(text) {
    var label = trimText(text);
    if (!label || label.length > 90) return false;
    if (isManualCityHelper(label)) return false;
    if (looksLikeCountryChrome(label)) return false;
    if (label.indexOf(",") === -1) return false;
    var parsed = parseCityQuery(label);
    return Boolean(parsed.city && parsed.city.length >= 2);
  }

  function rowMeta(el, label) {
    var className = "";
    try {
      className = String((el.className && el.className.baseVal) || el.className || "");
    } catch (_) {}
    return {
      el: el,
      label: label,
      tag: ((el.tagName || "") + "").toLowerCase(),
      cls: trimText(className).slice(0, 120),
      role: trimText(el.getAttribute && el.getAttribute("role"))
    };
  }

  function findManualCityHelperNode(root) {
    var nodes = queryDeep(root, "*");
    var i;
    var el;
    var text;
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!isProbablyVisible(el)) continue;
      text = trimText(el.innerText || el.textContent || "");
      if (!text || text.length > 140) continue;
      if (isManualCityHelper(text)) return el;
    }
    return null;
  }

  function findCityListbox(root, input) {
    var seeds = [];
    var combo;
    if (input) seeds.push(input);
    try {
      combo = input && input.closest && input.closest("[role='combobox']");
    } catch (_) {
      combo = null;
    }
    if (combo && seeds.indexOf(combo) === -1) seeds.push(combo);
    ancestorChain(input).forEach(function (node) {
      if (seeds.indexOf(node) === -1) seeds.push(node);
    });
    var i;
    var j;
    var ids;
    var node;
    for (i = 0; i < seeds.length; i += 1) {
      ids = ariaOwnedIds(seeds[i]);
      for (j = 0; j < ids.length; j += 1) {
        node = findNodeByIdDeep(root, ids[j]);
        if (!node || !isProbablyVisible(node)) continue;
        if (normalizeText(node.getAttribute && node.getAttribute("role")) === "listbox") return node;
        try {
          var nested = node.querySelector && node.querySelector("[role='listbox']");
          if (nested && isProbablyVisible(nested)) return nested;
        } catch (_) {}
        return node;
      }
    }
    var helper = findManualCityHelperNode(root);
    if (helper) {
      node = helper;
      for (i = 0; i < 10 && node; i += 1) {
        var helperParent = parentOrShadowHost(node);
        if (!helperParent) break;
        var parentText = trimText(helperParent.innerText || helperParent.textContent || "");
        if (parentText && parentText.length < 800 && parentText.length > trimText(helper.innerText || "").length) {
          return helperParent;
        }
        node = helperParent;
      }
      return parentOrShadowHost(helper) || helper;
    }
    for (i = 0; i < seeds.length; i += 1) {
      var sib = seeds[i].nextElementSibling;
      while (sib) {
        if (isProbablyVisible(sib)) {
          var sibText = trimText(sib.innerText || sib.textContent || "");
          if (
            isManualCityHelper(sibText) ||
            looksLikeLocationSuggestion(sibText) ||
            normalizeText(sib.getAttribute && sib.getAttribute("role")) === "listbox"
          ) {
            return sib;
          }
        }
        sib = sib.nextElementSibling;
      }
    }
    var boxes = queryDeep(
      root,
      "[role='listbox'], [role='menu'], .pac-container, [class*='autocomplete'], [class*='suggestion'], [class*='dropdown'], [class*='popover']"
    );
    for (i = 0; i < boxes.length; i += 1) {
      if (!isProbablyVisible(boxes[i])) continue;
      if (looksLikeCountryChrome(ownDisplayText(boxes[i]))) continue;
      var boxText = trimText(boxes[i].innerText || boxes[i].textContent || "");
      if (isManualCityHelper(boxText) || looksLikeLocationSuggestion(boxText)) return boxes[i];
    }
    return null;
  }

  function collectCityOptions(root, input) {
    var seen = [];
    var out = [];
    function addNode(node) {
      if (!node || seen.indexOf(node) !== -1) return;
      if (!isProbablyVisible(node)) return;
      var label = trimText(
        node.innerText ||
          node.textContent ||
          (node.getAttribute && node.getAttribute("aria-label")) ||
          ""
      );
      if (!label || label.length > 90) return;
      if (isManualCityHelper(label)) return;
      if (looksLikeCountryChrome(label)) return;
      if (normalizeText(label).indexOf("no result") !== -1 || normalizeText(label) === "no options") return;
      if (!looksLikeLocationSuggestion(label) && label.indexOf(",") === -1) return;
      seen.push(node);
      out.push(rowMeta(node, label));
    }
    function collectFromScope(scope) {
      if (!scope) return;
      queryDeep(
        scope,
        '[role="option"], [role="menuitem"], li, button, a, .pac-item, [class*="suggestion"], [class*="option"], [class*="item"], [data-testid*="option"], [data-testid*="suggestion"]'
      ).forEach(addNode);
      if (scope.shadowRoot) {
        queryDeep(scope.shadowRoot, "*").forEach(addNode);
      }
      queryDeep(scope, "*").forEach(addNode);
    }
    var dropdown = findCityListbox(root, input);
    if (dropdown) collectFromScope(dropdown);
    if (!out.length) collectFromScope(root);
    return out.filter(function (row) {
      return !out.some(function (other) {
        return other.el !== row.el && other.el.contains && other.el.contains(row.el);
      });
    });
  }

  function cityDropdownIsOpen(root, input) {
    if (input && input.getAttribute && input.getAttribute("aria-expanded") === "true") return true;
    var helper = findManualCityHelperNode(root);
    if (helper && isProbablyVisible(helper)) return true;
    if (input && input.getAttribute && input.getAttribute("aria-expanded") === "false") return false;
    var dropdown = findCityListbox(root, input);
    if (!dropdown || !isProbablyVisible(dropdown)) return false;
    var dropdownText = trimText(dropdown.innerText || dropdown.textContent || "");
    if (isManualCityHelper(dropdownText)) return true;
    return collectCityOptions(root, input).length > 0;
  }

  function associatedLocationStateFilled(input) {
    if (!input) return false;
    var scopes = ancestorChain(input).slice(0, 8);
    var i;
    var j;
    var nodes;
    var el;
    var cue;
    var value;
    for (i = 0; i < scopes.length; i += 1) {
      try {
        nodes = queryDeep(
          scopes[i],
          'input[type="hidden"], input[hidden], [data-place-id], [data-location-id], [data-placeid]'
        );
      } catch (_) {
        nodes = [];
      }
      for (j = 0; j < nodes.length; j += 1) {
        el = nodes[j];
        cue = normalizeText(
          [
            el.name,
            el.id,
            el.getAttribute && el.getAttribute("data-qa"),
            el.getAttribute && el.getAttribute("aria-label")
          ].join(" ")
        );
        if (!/\b(place|location|geocode|locality|lat|lng|city|google)\b/.test(cue) && !(el.getAttribute && (el.getAttribute("data-place-id") || el.getAttribute("data-location-id")))) {
          continue;
        }
        value = trimText(
          el.value ||
            (el.getAttribute && (el.getAttribute("data-place-id") || el.getAttribute("data-location-id") || el.getAttribute("value"))) ||
            ""
        );
        if (value) return true;
      }
    }
    return false;
  }

  function setCityInputValue(el, value, extra) {
    if (!el) return false;
    var next = value == null ? "" : String(value);
    var proto = global.HTMLInputElement && global.HTMLInputElement.prototype;
    var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    try {
      if (descriptor && descriptor.set) descriptor.set.call(el, next);
      else el.value = next;
    } catch (_) {
      try {
        el.value = next;
      } catch (__) {
        return false;
      }
    }
    var init = {
      bubbles: true,
      cancelable: true,
      data: extra && extra.data != null ? extra.data : next,
      inputType: (extra && extra.inputType) || "insertText"
    };
    try {
      el.dispatchEvent(new InputEvent("input", init));
    } catch (_) {
      try {
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
    return true;
  }

  function dispatchCityKey(el, key, extra) {
    if (!el) return;
    var init = {
      key: key,
      code: extra && extra.code ? extra.code : key.length === 1 ? "Key" + key.toUpperCase() : key,
      bubbles: true,
      cancelable: true,
      keyCode: extra && extra.keyCode,
      which: extra && extra.keyCode
    };
    try {
      el.dispatchEvent(new KeyboardEvent("keydown", init));
    } catch (_) {}
    try {
      el.dispatchEvent(new KeyboardEvent("keyup", init));
    } catch (_) {}
  }

  async function typeCityQuery(input, query) {
    try {
      if (typeof input.scrollIntoView === "function") input.scrollIntoView({ block: "nearest" });
    } catch (_) {}
    try {
      if (typeof input.focus === "function") input.focus();
    } catch (_) {}
    try {
      input.click();
    } catch (_) {
      try {
        input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
    await sleep(60);
    if (!setCityInputValue(input, "", { data: "", inputType: "deleteContentBackward" })) return false;
    try {
      input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    await sleep(40);
    if (!setCityInputValue(input, query, { data: query, inputType: "insertFromPaste" })) return false;
    dispatchCityKey(input, query ? query.charAt(query.length - 1) : "Unidentified");
    return true;
  }

  async function typeCityQueryByChar(input, query) {
    if (!setCityInputValue(input, "", { data: "", inputType: "deleteContentBackward" })) return false;
    var acc = "";
    var i;
    var ch;
    for (i = 0; i < query.length; i += 1) {
      ch = query.charAt(i);
      acc += ch;
      setCityInputValue(input, acc, { data: ch, inputType: "insertText" });
      dispatchCityKey(input, ch);
      await sleep(24);
    }
    return true;
  }

  function clickableCityRow(el, dropdown) {
    var node = el;
    var best = el;
    var hops = 0;
    while (node && hops < 8) {
      if (dropdown && node === dropdown) break;
      var tag = ((node.tagName || "") + "").toLowerCase();
      var role = normalizeText(node.getAttribute && node.getAttribute("role"));
      if (
        role === "option" ||
        role === "menuitem" ||
        role === "button" ||
        tag === "button" ||
        tag === "li" ||
        tag === "a"
      ) {
        return node;
      }
      if (node.getAttribute && node.getAttribute("tabindex") != null) best = node;
      best = node;
      var next = parentOrShadowHost(node);
      if (!next || next === dropdown) break;
      node = next;
      hops += 1;
    }
    return best || el;
  }

  function isInComposedTree(node, ancestor) {
    var cur = node;
    var hops = 0;
    while (cur && hops < 32) {
      if (cur === ancestor) return true;
      cur = parentOrShadowHost(cur);
      hops += 1;
    }
    return false;
  }

  function deepestElementFromPoint(x, y, ownerDoc) {
    var doc = ownerDoc || document;
    var current = null;
    try {
      if (doc && typeof doc.elementFromPoint === "function") {
        current = doc.elementFromPoint(x, y);
      }
    } catch (_) {
      current = null;
    }
    var hops = 0;
    while (current && hops < 24) {
      var root = current.shadowRoot;
      if (!root || typeof root.elementFromPoint !== "function") break;
      var inner = null;
      try {
        inner = root.elementFromPoint(x, y);
      } catch (_) {
        break;
      }
      if (!inner || inner === current) break;
      current = inner;
      hops += 1;
    }
    return current;
  }

  function suggestionRowPoints(rect) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return [];
    var insetX = Math.max(2, Math.min(12, rect.width / 4));
    var insetY = Math.max(2, Math.min(8, rect.height / 3));
    return [
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      { x: rect.left + insetX, y: rect.top + rect.height / 2 },
      { x: rect.left + rect.width / 2, y: rect.top + insetY }
    ];
  }

  function deepestVisibleSuggestionTarget(optionEl) {
    if (!optionEl) return null;
    try {
      if (typeof optionEl.scrollIntoView === "function") {
        optionEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } catch (_) {}
    var rect = null;
    try {
      rect = optionEl.getBoundingClientRect();
    } catch (_) {
      rect = null;
    }
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    var doc = optionEl.ownerDocument || document;
    var points = suggestionRowPoints(rect);
    var i;
    for (i = 0; i < points.length; i += 1) {
      var deep = deepestElementFromPoint(points[i].x, points[i].y, doc);
      if (!deep) continue;
      if (!isInComposedTree(deep, optionEl)) continue;
      return deep;
    }
    return null;
  }

  function dispatchCityPointerFallback(el) {
    if (!el) return;
    var view = (el.ownerDocument && el.ownerDocument.defaultView) || global;
    var opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: view,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    try {
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
      } else {
        el.dispatchEvent(new MouseEvent("pointerdown", opts));
      }
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mousedown", opts));
    } catch (_) {}
    try {
      if (typeof PointerEvent === "function") {
        el.dispatchEvent(new PointerEvent("pointerup", opts));
      } else {
        el.dispatchEvent(new MouseEvent("pointerup", opts));
      }
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mouseup", opts));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("click", opts));
    } catch (_) {}
  }

  function selectCityOption(optionEl) {
    var target = deepestVisibleSuggestionTarget(optionEl);
    if (target && typeof target.click === "function") {
      try {
        target.click();
      } catch (_) {}
      return target;
    }
    return optionEl || null;
  }

  function describeCandidateDiagnostics(options) {
    var rows = (options || []).slice(0, 8).map(function (opt) {
      var label = optionLabelOf(opt);
      var tag = opt.tag || ((opt.el && opt.el.tagName) || "").toLowerCase();
      var cls = opt.cls || "";
      var role = opt.role || "";
      return '"' + label + '" <' + tag + (cls ? "." + cls.replace(/\s+/g, ".") : "") + (role ? ' role=' + role : "") + ">";
    });
    return {
      count: (options || []).length,
      text: rows.length ? rows.join("; ") : "none"
    };
  }

  function summarizeElHtml(el) {
    if (!el) return "";
    try {
      var html = String(el.outerHTML || "");
      return html.length > 280 ? html.slice(0, 280) + "…" : html;
    } catch (_) {
      return String((el.tagName || "") + " " + (el.className || ""));
    }
  }

  function cityFailureReason(prefix, query, options, finalValue, extra) {
    var info = extra || {};
    var desc = describeCandidateDiagnostics(options);
    return (
      prefix +
      " Typed: \"" +
      trimText(query) +
      "\"; candidates (" +
      desc.count +
      "): " +
      desc.text +
      "; selected target: " +
      (info.targetHtml ? info.targetHtml : "none") +
      "; final value: \"" +
      trimText(finalValue) +
      "\"; dropdown open: " +
      (info.dropdownOpen ? "yes" : "no") +
      "."
    );
  }

  function cityValueAccepted(actual, savedCity, selectedLabel) {
    var text = trimText(actual);
    if (!text) return false;
    if (selectedLabel && normalizeText(text) === normalizeText(selectedLabel)) return true;
    if (selectedLabel && citySuggestionMatches(text, selectedLabel)) return true;
    if (normalizeText(text) === normalizeText(savedCity)) return false;
    return citySuggestionMatches(text, savedCity);
  }

  function citySelectionVerified(root, input, savedCity, selectedLabel) {
    var actual = readValue(input);
    var dropdownOpen = cityDropdownIsOpen(root, input);
    var hiddenFilled = associatedLocationStateFilled(input);
    if (dropdownOpen) return false;
    if (!actual) return false;
    if (normalizeText(actual) === normalizeText(savedCity)) return hiddenFilled;
    return cityValueAccepted(actual, savedCity, selectedLabel);
  }

  async function waitForCityOptions(root, input, savedCity, tries) {
    var options = [];
    var matched = null;
    var wait;
    for (wait = 0; wait < (tries || 20); wait += 1) {
      await sleep(120);
      options = collectCityOptions(root, input);
      matched = pickCitySuggestion(options, savedCity);
      if (matched) break;
    }
    return { options: options, matched: matched };
  }

  async function fillCityAutocomplete(root, input, savedCity) {
    var cityInput = resolveCityInput(input);
    var query = trimText(savedCity);
    var current = readValue(cityInput);
    if (current && citySelectionVerified(root, cityInput, query, "")) {
      return { ok: true, status: "filled", reason: "", value: current };
    }
    if (!query) {
      return { ok: false, status: "skipped", reason: "No saved answer.", value: current };
    }

    if (!(await typeCityQuery(cityInput, query))) {
      return {
        ok: false,
        status: "failed",
        reason: cityFailureReason("Could not set city field value.", query, [], readValue(cityInput), {
          dropdownOpen: cityDropdownIsOpen(root, cityInput)
        }),
        value: readValue(cityInput)
      };
    }

    var found = await waitForCityOptions(root, cityInput, query, 20);
    if (!found.matched && !found.options.length) {
      await typeCityQueryByChar(cityInput, query);
      found = await waitForCityOptions(root, cityInput, query, 20);
    }

    function failInfo(targetHtml) {
      return {
        targetHtml: targetHtml || "",
        dropdownOpen: cityDropdownIsOpen(root, cityInput)
      };
    }

    if (!found.matched) {
      return {
        ok: false,
        status: "failed",
        reason: cityFailureReason(
          "City suggestion was not selected.",
          query,
          found.options,
          readValue(cityInput),
          failInfo("")
        ),
        value: readValue(cityInput)
      };
    }

    var matchedEl = optionElementOf(found.matched);
    var matchedLabel = optionLabelOf(found.matched);
    var target = selectCityOption(matchedEl);
    await sleep(450);

    if (!citySelectionVerified(root, cityInput, query, matchedLabel)) {
      dispatchCityPointerFallback(target || matchedEl);
      await sleep(420);
    }

    if (!citySelectionVerified(root, cityInput, query, matchedLabel)) {
      try {
        if (typeof cityInput.focus === "function") cityInput.focus();
      } catch (_) {}
      dispatchCityKey(cityInput, "ArrowDown", { code: "ArrowDown", keyCode: 40 });
      await sleep(90);
      dispatchCityKey(cityInput, "Enter", { code: "Enter", keyCode: 13 });
      await sleep(420);
    }

    var after = readValue(cityInput);
    if (citySelectionVerified(root, cityInput, query, matchedLabel)) {
      try {
        cityInput.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
      } catch (_) {
        try {
          cityInput.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
        } catch (__) {}
      }
      await sleep(160);
      after = readValue(cityInput);
      if (citySelectionVerified(root, cityInput, query, matchedLabel)) {
        return { ok: true, status: "filled", reason: "", value: after };
      }
    }

    return {
      ok: false,
      status: "failed",
      reason: cityFailureReason(
        cityDropdownIsOpen(root, cityInput)
          ? "City suggestion was not selected."
          : "Verification failed; city autocomplete was not accepted.",
        query,
        found.options,
        after,
        failInfo(summarizeElHtml(target))
      ),
      value: after
    };
  }

  var TOP_RESUME_DROPZONE_SELECTOR = 'spl-dropzone[data-test="apply-with-resume-container"]';
  var TOP_RESUME_FILE_INPUT_SELECTOR = 'input#file-input[type="file"]';
  var ATTACHED_RESUME_DROPZONE_SELECTOR = "oc-resume-upload spl-dropzone";
  var PARSER_WAIT_MS = 28000;
  var PARSER_QUIET_MS = 500;

  function resumeSessionKey(resume) {
    var name = normalizeText((resume && resume.resumeName) || "");
    var bytes = String((resume && resume.resumeBase64) || "");
    return name + "::" + String(bytes.length);
  }

  function fileFromResumePayload(resume) {
    if (!resume || !trimText(resume.resumeBase64)) {
      return { error: "No resume file is available to upload." };
    }
    var raw = String(resume.resumeBase64);
    var mime = trimText(resume.resumeMime || resume.mimeType || resume.type || "") || "application/pdf";
    var b64 = raw;
    var comma = raw.indexOf(",");
    if (raw.slice(0, 5).toLowerCase() === "data:" && comma !== -1) {
      var header = raw.slice(0, comma);
      var mimeMatch = header.match(/data:([^;,]+)/i);
      if (mimeMatch && mimeMatch[1]) mime = mimeMatch[1];
      b64 = raw.slice(comma + 1);
    }
    var binary;
    try {
      binary = atob(b64);
    } catch (_) {
      return { error: "Resume bytes could not be decoded." };
    }
    var n = binary.length;
    var bytes = new Uint8Array(n);
    while (n--) bytes[n] = binary.charCodeAt(n);
    var name = trimText(resume.resumeName) || "resume.pdf";
    try {
      return { file: new File([bytes], name, { type: mime }), mime: mime, name: name };
    } catch (_) {
      return { error: "Could not create a File from the stored resume." };
    }
  }

  function isLiveDocumentNode(el) {
    if (!el) return false;
    if (el.isConnected === false) return false;
    return true;
  }

  function clearResumeParserControlCache() {
    global.__IMPULSO_SR_PARSER_DROPZONE__ = null;
    global.__IMPULSO_SR_PARSER_FILE_INPUT__ = null;
  }

  function findTopResumeDropzone(root) {
    var doc = arguments.length ? root : document;
    if (!doc || !doc.querySelector) return null;
    var el = null;
    try {
      el = doc.querySelector(TOP_RESUME_DROPZONE_SELECTOR);
    } catch (_) {
      el = null;
    }
    if (el && isLiveDocumentNode(el)) return el;
    return null;
  }

  function findTopResumeFileInput(host) {
    if (!host) return null;
    if (!host.shadowRoot) return null;
    try {
      return host.shadowRoot.querySelector(TOP_RESUME_FILE_INPUT_SELECTOR);
    } catch (_) {
      return null;
    }
  }

  function dispatchComposedFileEvents(fileInput) {
    var init = { bubbles: true, cancelable: true, composed: true };
    try {
      fileInput.dispatchEvent(new Event("input", init));
    } catch (_) {
      try {
        fileInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
    try {
      fileInput.dispatchEvent(new Event("change", init));
    } catch (_) {
      try {
        fileInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      } catch (__) {}
    }
  }

  function nodeLooksBusy(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute("aria-busy") === "true") return true;
    var text = normalizeText((el.innerText || el.textContent || "") + "");
    if (/\b(parsing|uploading|processing|loading|analyzing)\b/.test(text)) return true;
    try {
      if (
        el.querySelector &&
        el.querySelector(
          '[aria-busy="true"], progress, [class*="spinner"], [class*="progress"], [class*="loading"], [class*="busy"]'
        )
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function dropzoneLooksBusy(host) {
    if (!host) return false;
    if (nodeLooksBusy(host)) return true;
    if (host.shadowRoot && nodeLooksBusy(host.shadowRoot)) return true;
    if (host.parentElement && nodeLooksBusy(host.parentElement)) return true;
    return false;
  }

  function resumeBasename(name) {
    var text = trimText(name);
    var slash = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
    if (slash >= 0) text = text.slice(slash + 1);
    return normalizeText(text);
  }

  function filenamesMatch(actual, expected) {
    var a = resumeBasename(actual);
    var b = resumeBasename(expected);
    if (!a || !b) return false;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  function findAttachedResumeDropzone() {
    try {
      return document.querySelector(ATTACHED_RESUME_DROPZONE_SELECTOR);
    } catch (_) {
      return null;
    }
  }

  function collectAttachedResumeFilenames() {
    var host = findAttachedResumeDropzone();
    if (!host || !host.shadowRoot) return [];
    var names = [];
    var nodes = [];
    try {
      nodes = host.shadowRoot.querySelectorAll("ul li span, ul li div, ul li");
    } catch (_) {
      nodes = [];
    }
    Array.prototype.forEach.call(nodes, function (el) {
      var text = trimText(el.innerText || el.textContent || "");
      if (!text || text.length > 180) return;
      if (names.indexOf(text) === -1) names.push(text);
    });
    return names;
  }

  function attachedResumeMatches(resumeName) {
    var names = collectAttachedResumeFilenames();
    var i;
    for (i = 0; i < names.length; i += 1) {
      if (filenamesMatch(names[i], resumeName)) return true;
    }
    return false;
  }

  function sameResumeAlreadyOnInput(fileInput, file) {
    if (!fileInput || !fileInput.files || !fileInput.files.length || !file) return false;
    var current = fileInput.files[0];
    if (!current) return false;
    if (normalizeText(current.name) !== normalizeText(file.name)) return false;
    if (current.size && file.size && current.size !== file.size) return false;
    return true;
  }

  function waitForDomQuiet(target, quietMs, timeoutMs) {
    return new Promise(function (resolve) {
      var node = target || document;
      var last = Date.now();
      var observer = null;
      if (global.MutationObserver) {
        try {
          observer = new MutationObserver(function () {
            last = Date.now();
          });
          observer.observe(node, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        } catch (_) {
          observer = null;
        }
      }
      var started = Date.now();
      var timer = setInterval(function () {
        var now = Date.now();
        if (now - last >= quietMs) {
          cleanup();
          resolve(true);
          return;
        }
        if (now - started >= timeoutMs) {
          cleanup();
          resolve(false);
        }
      }, 100);
      function cleanup() {
        clearInterval(timer);
        if (observer) {
          try {
            observer.disconnect();
          } catch (_) {}
        }
      }
    });
  }

  function resumeAreasLookBusy() {
    var hosts = [findTopResumeDropzone(), findAttachedResumeDropzone()];
    var i;
    var host;
    for (i = 0; i < hosts.length; i += 1) {
      host = hosts[i];
      if (!host) continue;
      if (dropzoneLooksBusy(host)) return true;
    }
    return false;
  }

  async function waitUntilAttachedFilename(resumeName) {
    var deadline = Date.now() + PARSER_WAIT_MS;
    while (Date.now() < deadline) {
      if (attachedResumeMatches(resumeName)) {
        return { ok: true, names: collectAttachedResumeFilenames() };
      }
      await sleep(160);
    }
    return {
      ok: false,
      reason:
        "Timed out waiting for the attached resume filename in oc-resume-upload. Visible: " +
        (collectAttachedResumeFilenames().join(", ") || "none") +
        "."
    };
  }

  async function waitForResumeParseSettle() {
    var deadline = Date.now() + PARSER_WAIT_MS;
    var startedAt = Date.now();
    var seenBusy = false;
    while (Date.now() < deadline) {
      var busy = resumeAreasLookBusy();
      if (busy) seenBusy = true;
      if (!busy) {
        if (!seenBusy && Date.now() - startedAt < 1600) {
          await sleep(160);
          continue;
        }
        var quietRoot = document;
        var attached = findAttachedResumeDropzone();
        if (attached && attached.parentElement) quietRoot = attached.parentElement;
        else if (attached) quietRoot = attached;
        await waitForDomQuiet(quietRoot, PARSER_QUIET_MS, 8000);
        if (resumeAreasLookBusy()) {
          await sleep(120);
          continue;
        }
        return { ok: true, seenBusy: seenBusy };
      }
      await sleep(160);
    }
    return {
      ok: false,
      reason: seenBusy
        ? "Timed out waiting for SmartRecruiters resume parsing to finish."
        : "Timed out waiting for SmartRecruiters resume parsing indicators to settle."
    };
  }

  async function uploadSmartRecruitersParserResume(resume, root) {
    var host = findTopResumeDropzone(root);
    if (!host) {
      return {
        ok: false,
        status: "failed",
        reason: "SmartRecruiters resume dropzone (apply-with-resume-container) was not found.",
        value: ""
      };
    }
    if (!host.shadowRoot) {
      return {
        ok: false,
        status: "failed",
        reason: "Resume dropzone shadow root is not accessible.",
        value: ""
      };
    }
    var fileInput = findTopResumeFileInput(host);
    if (!fileInput || !isLiveDocumentNode(fileInput)) {
      return {
        ok: false,
        status: "failed",
        reason: "Resume file input was not found in the dropzone shadow root.",
        value: ""
      };
    }
    global.__IMPULSO_SR_PARSER_DROPZONE__ = host;
    global.__IMPULSO_SR_PARSER_FILE_INPUT__ = fileInput;
    var built = fileFromResumePayload(resume);
    if (!built.file) {
      return {
        ok: false,
        status: "failed",
        reason: built.error || "No resume file is available to upload.",
        value: ""
      };
    }
    var key = resumeSessionKey(resume);
    if (global.__IMPULSO_SR_PARSER_RESUME_KEY__ === key || attachedResumeMatches(built.name)) {
      global.__IMPULSO_SR_PARSER_RESUME_KEY__ = key;
      return {
        ok: false,
        status: "skipped",
        reason: "Same resume already accepted.",
        value: built.name
      };
    }
    if (sameResumeAlreadyOnInput(fileInput, built.file)) {
      global.__IMPULSO_SR_PARSER_RESUME_KEY__ = key;
      return {
        ok: false,
        status: "skipped",
        reason: "Same resume already accepted.",
        value: built.name
      };
    }

    try {
      var dt = new DataTransfer();
      dt.items.add(built.file);
      fileInput.files = dt.files;
    } catch (_) {
      return {
        ok: false,
        status: "failed",
        reason: "Could not assign the resume file to the SmartRecruiters file input.",
        value: ""
      };
    }
    if (!(fileInput.files && fileInput.files.length)) {
      return {
        ok: false,
        status: "failed",
        reason: "Resume DataTransfer assignment failed; input.files is empty before change.",
        value: ""
      };
    }
    var assignedName = trimText(fileInput.files[0] && fileInput.files[0].name);
    if (assignedName && !filenamesMatch(assignedName, built.name)) {
      return {
        ok: false,
        status: "failed",
        reason: "Resume DataTransfer assignment failed; input.files does not contain " + built.name + ".",
        value: assignedName
      };
    }
    dispatchComposedFileEvents(fileInput);

    var attached = await waitUntilAttachedFilename(built.name);
    if (!attached.ok) {
      return {
        ok: false,
        status: "failed",
        reason: attached.reason || "Attached resume filename was not found in oc-resume-upload.",
        value: built.name
      };
    }
    var settled = await waitForResumeParseSettle();
    if (!settled.ok) {
      return {
        ok: false,
        status: "failed",
        reason: settled.reason || "SmartRecruiters resume parsing did not complete.",
        value: built.name
      };
    }
    if (!attachedResumeMatches(built.name)) {
      return {
        ok: false,
        status: "failed",
        reason: "Attached resume filename disappeared after parsing.",
        value: built.name
      };
    }
    global.__IMPULSO_SR_PARSER_RESUME_KEY__ = key;
    return { ok: true, status: "filled", reason: "", value: built.name };
  }

  function answerForCategory(category, inventory) {
    var AF = autofill();
    if (category === "city" || category === "location") {
      return trimText((inventory && (inventory.city || inventory.location || inventory.current_location)) || "");
    }
    if (category === "resume_upload") {
      return trimText((inventory && (inventory.resume_filename || inventory.resume_upload)) || "");
    }
    if (
      category === "work_authorization" ||
      category === "sponsorship_now" ||
      category === "sponsorship_later" ||
      category === "relocation" ||
      category === "disability_status" ||
      category === "veteran_status" ||
      category === "gender" ||
      category === "race_ethnicity"
    ) {
      return trimText((inventory && inventory[category]) || "");
    }
    if (AF && typeof AF.getTextAnswerForCategory === "function") {
      return AF.getTextAnswerForCategory(category, inventory || {});
    }
    return trimText((inventory && inventory[category]) || "");
  }

  function isCityField(scanField, el) {
    var AF = autofill();
    if (scanField.category === "city" || scanField.category === "location") return true;
    var blob = [
      scanField.label,
      scanField.ariaLabel,
      scanField.placeholder,
      el && el.getAttribute && el.getAttribute("aria-label")
    ].join(" ");
    return AF && typeof AF.looksLikeLocationCityField === "function"
      ? AF.looksLikeLocationCityField(blob)
      : false;
  }

  function looksLikeScreeningRadioField(field) {
    return Boolean(field && field.screeningQuestionId && field.inputType === "radio");
  }

  function looksLikeScreeningDemographicAutocomplete(field) {
    return Boolean(field && (field.category === "gender" || field.category === "race_ethnicity"));
  }

  function screeningDemographicKindFromCategory(category) {
    if (category === "gender") return "gender";
    if (category === "race_ethnicity") return "ethnicity";
    return "";
  }

  function screeningDemographicIdKind(el) {
    var id = trimText(el && (el.id || (el.getAttribute && el.getAttribute("id"))));
    if (/_gender$/i.test(id)) return "gender";
    if (/_ethnicity$/i.test(id)) return "ethnicity";
    return "";
  }

  function screeningDemographicSemanticKind(el) {
    var blob = normalizeText(
      [
        el && el.getAttribute && el.getAttribute("placeholder"),
        el && el.getAttribute && el.getAttribute("aria-label"),
        el && el.getAttribute && el.getAttribute("label")
      ].join(" ")
    );
    if (!blob) return "";
    if (/\brace\/ethnicity\b/.test(blob) || /\bethnicity\b/.test(blob)) return "ethnicity";
    if (/\brace\b/.test(blob) && !/\bgender\b/.test(blob)) return "ethnicity";
    if (/\bgender\b/.test(blob)) return "gender";
    return "";
  }

  function queryDeepInclusive(root, selector) {
    var out = [];
    var seen = [];
    function add(list) {
      var i;
      var el;
      for (i = 0; i < (list || []).length; i += 1) {
        el = list[i];
        if (!el || seen.indexOf(el) !== -1) continue;
        seen.push(el);
        out.push(el);
      }
    }
    if (root && root.shadowRoot) add(queryDeep(root.shadowRoot, selector));
    add(queryDeep(root || document, selector));
    return out;
  }

  function closestComposedTag(el, tagName) {
    var want = normalizeText(tagName);
    var node = el;
    var hops = 0;
    var root;
    while (node && hops < 24) {
      if (normalizeText(node.tagName) === want) return node;
      if (node.parentElement) {
        node = node.parentElement;
      } else {
        root = node.getRootNode && node.getRootNode();
        node = root && root.host ? root.host : node.parentNode;
      }
      hops += 1;
    }
    return null;
  }

  function findNodeByIdDeep(root, id) {
    var want = trimText(id);
    var nodes;
    var i;
    var el;
    if (!want) return null;
    if (root && (root.id === want || (root.getAttribute && root.getAttribute("id") === want))) return root;
    nodes = queryDeepInclusive(root, "*");
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el) continue;
      if (el.id === want || (el.getAttribute && el.getAttribute("id") === want)) return el;
    }
    return null;
  }

  var SCREENING_GENDER_HOST_SELECTOR = '[data-test="question-eeo-gender-select"]';
  var SCREENING_ETHNICITY_HOST_SELECTOR = '[data-test="question-eeo-ethnicity-select"]';

  function screeningDemographicHostSelector(kind) {
    if (kind === "gender") return SCREENING_GENDER_HOST_SELECTOR;
    if (kind === "ethnicity") return SCREENING_ETHNICITY_HOST_SELECTOR;
    return "";
  }

  function findScreeningDemographicHost(root, kind) {
    var screening = findSmartRecruitersScreeningHost(root);
    var selector = screeningDemographicHostSelector(kind);
    var scopes = [];
    var s;
    var nodes;
    var i;
    var el;
    var dataTest;
    if (screening && screening.shadowRoot) scopes.push(screening.shadowRoot);
    if (screening) scopes.push(screening);
    scopes.push(root || document);
    for (s = 0; s < scopes.length; s += 1) {
      nodes = queryDeepInclusive(
        scopes[s],
        "spl-autocomplete" + selector + ", spl-autocomplete, " + selector
      );
      for (i = 0; i < nodes.length; i += 1) {
        el = nodes[i];
        if (!isLiveDocumentNode(el)) continue;
        dataTest = trimText(el.getAttribute && el.getAttribute("data-test"));
        if (kind === "gender" && dataTest === "question-eeo-gender-select") return el;
        if (kind === "ethnicity" && dataTest === "question-eeo-ethnicity-select") return el;
      }
    }
    return null;
  }

  function findComboboxInDemographicHost(host) {
    var shadow;
    var splInput;
    var inputRoot;
    var input;
    if (!host) return null;
    shadow = host.shadowRoot || host;
    try {
      splInput = shadow.querySelector ? shadow.querySelector("spl-input") : null;
    } catch (_) {
      splInput = null;
    }
    if (!splInput) splInput = queryDeepInclusive(host, "spl-input")[0] || null;
    inputRoot = splInput && splInput.shadowRoot ? splInput.shadowRoot : splInput;
    if (inputRoot && inputRoot.querySelector) {
      try {
        input =
          inputRoot.querySelector("input[role='combobox']") ||
          inputRoot.querySelector("[role='combobox']") ||
          inputRoot.querySelector("input");
      } catch (_) {
        input = null;
      }
    }
    if (!input) {
      input = queryDeepInclusive(host, "input[role='combobox'], [role='combobox']")[0] || null;
    }
    return isLiveDocumentNode(input) ? input : null;
  }

  function findScreeningDemographicInput(root, kind) {
    var host = findScreeningDemographicHost(root, kind);
    var input = findComboboxInDemographicHost(host);
    var scopes;
    var nodes;
    var i;
    var s;
    var el;
    var idKind;
    var semantic;
    if (input) return input;
    scopes = [];
    host = findSmartRecruitersScreeningHost(root);
    if (host && host.shadowRoot) scopes.push(host.shadowRoot);
    if (host) scopes.push(host);
    scopes.push(root || document);
    for (s = 0; s < scopes.length; s += 1) {
      nodes = queryDeepInclusive(scopes[s], "input[role='combobox'], [role='combobox']");
      for (i = 0; i < nodes.length; i += 1) {
        el = nodes[i];
        if (!isLiveDocumentNode(el)) continue;
        idKind = screeningDemographicIdKind(el);
        semantic = screeningDemographicSemanticKind(el);
        if (idKind === kind || (!idKind && semantic === kind)) return el;
      }
    }
    return null;
  }

  function parseScreeningDefinitionData(host) {
    var raw = host && host.getAttribute && host.getAttribute("definition");
    var AF = autofill();
    var text;
    if (!raw) return null;
    text = String(raw);
    if (AF && typeof AF.parseSmartRecruitersScreeningDefinition === "function") {
      try {
        return JSON.parse(text);
      } catch (_) {
        return null;
      }
    }
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function isScreeningDefinitionRadioType(node) {
    var type = normalizeText(
      (node && (node.type || node.questionType || node.inputType || node.component)) || ""
    );
    return type === "radio" || type === "radiogroup" || type === "radio-group" || type === "radiobutton";
  }

  function mapScreeningDefinitionOptions(node) {
    var fields =
      (node && (node.questionsFields || node.questionFields || node.fields || node.options || node.availableValues)) ||
      [];
    if (!Array.isArray(fields)) return [];
    return fields
      .map(function (field) {
        if (field == null) return null;
        if (typeof field !== "object") {
          return { label: trimText(field), value: trimText(field) };
        }
        return {
          label: trimText(field.label || field.name || field.text || field.displayValue || ""),
          value: trimText(field.fieldValue != null ? field.fieldValue : field.value != null ? field.value : "")
        };
      })
      .filter(function (opt) {
        return opt && (opt.label || opt.value);
      });
  }

  function screeningDefinitionQuestionKind(node) {
    var blob = normalizeText(
      [(node && (node.label || node.question || node.title || node.text)) || "", (node && node.id) || ""].join(" ")
    );
    if (!blob) return "";
    if (/\brace\/ethnicity\b/.test(blob) || /\bethnicity\b/.test(blob)) return "ethnicity";
    if (/\brace\b/.test(blob) && !/\bgender\b/.test(blob)) return "ethnicity";
    if (/\bgender\b/.test(blob)) return "gender";
    return "";
  }

  function collectScreeningAutocompleteQuestions(data) {
    var out = [];
    function walk(node) {
      var options;
      var kind;
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!isScreeningDefinitionRadioType(node)) {
        options = mapScreeningDefinitionOptions(node);
        kind = screeningDefinitionQuestionKind(node);
        if (kind && options.length) {
          out.push({
            id: trimText((node.id || node.questionId || node.uuid) || ""),
            kind: kind,
            label: trimText(node.label || node.question || node.title || node.text || ""),
            options: options
          });
        }
      }
      Object.keys(node).forEach(function (key) {
        if (
          key === "questionsFields" ||
          key === "questionFields" ||
          key === "availableValues" ||
          key === "options" ||
          key === "fields"
        ) {
          return;
        }
        walk(node[key]);
      });
    }
    walk(data);
    return out;
  }

  function readOptionsDictionary(host) {
    var dict = host && host.optionsDictionary;
    var out = [];
    var keys;
    var i;
    var entry;
    var label;
    var value;
    var id;
    if (!dict || typeof dict !== "object") return out;
    keys = Object.keys(dict);
    for (i = 0; i < keys.length; i += 1) {
      entry = dict[keys[i]];
      if (entry == null) continue;
      if (typeof entry !== "object") {
        label = trimText(entry);
        if (label) out.push({ id: keys[i], value: keys[i], label: label });
        continue;
      }
      label = trimText(entry.label || entry.text || entry.displayValue || "");
      value = trimText(entry.value != null ? entry.value : "");
      id = trimText(entry.id != null ? entry.id : keys[i]);
      if (label) out.push({ id: id, value: value, label: label });
    }
    return out;
  }

  function allowedOptionsForDemographicKind(root, kind) {
    var host = findScreeningDemographicHost(root, kind);
    var fromDict = readOptionsDictionary(host);
    var input;
    var live;
    if (fromDict.length) return fromDict;
    input = findScreeningDemographicInput(root, kind);
    live = collectScreeningAutocompleteOptions(input, root).map(function (el) {
      var label = screeningOptionElementText(el);
      return { id: "", value: label, label: label };
    });
    return live.filter(function (opt) {
      return opt && opt.label;
    });
  }

  function genderMatchCandidates(saved) {
    var want = normalizeText(saved);
    if (want === "man" || want === "male") return ["male"];
    if (want === "woman" || want === "female") return ["female"];
    return want ? [want] : [];
  }

  function mapGenderToPlatformLabel(saved) {
    var want = normalizeText(saved);
    if (want === "man" || want === "male") return "Male";
    if (want === "woman" || want === "female") return "Female";
    if (want === "prefer not to answer") return "Prefer not to answer";
    return trimText(saved);
  }

  function matchScreeningDemographicOption(saved, options, kind) {
    var mapped = kind === "gender" ? mapGenderToPlatformLabel(saved) : trimText(saved);
    var want = normalizeSensitiveOptionLabel(mapped);
    var i;
    var opt;
    var label;
    if (!want) return null;
    for (i = 0; i < (options || []).length; i += 1) {
      opt = options[i];
      label = trimText(opt && (opt.label || opt.text || ""));
      if (label && normalizeSensitiveOptionLabel(label) === want) {
        return { label: label, value: trimText(opt && (opt.value != null ? opt.value : "")) || label, id: trimText(opt && opt.id) };
      }
    }
    return null;
  }

  function normalizeSensitiveOptionLabel(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/[^\w\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splSelectOptionLabel(option) {
    return String((option && option.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function splSelectOptionLabelMatches(option, targetLabel) {
    var got = splSelectOptionLabel(option).toLowerCase();
    var want = String(targetLabel || "").replace(/\s+/g, " ").trim().toLowerCase();
    return Boolean(got && want && got === want);
  }

  function isSplSelectOption(el) {
    return Boolean(el && (el.tagName || "").toLowerCase() === "spl-select-option");
  }

  function querySplSelectOptions(host) {
    var root = host && host.shadowRoot;
    var list;
    if (!root || typeof root.querySelectorAll !== "function") return [];
    try {
      list = root.querySelectorAll("spl-select-option");
    } catch (_) {
      return [];
    }
    return Array.prototype.slice.call(list || []).filter(isLiveDocumentNode);
  }

  function collectComposedDescendants(root) {
    var out = [];
    var seen = [];
    function walk(ctx) {
      var kids;
      var i;
      if (!ctx || seen.indexOf(ctx) !== -1) return;
      seen.push(ctx);
      if (ctx !== root && ctx.nodeType !== 9 && ctx.nodeType !== 11) out.push(ctx);
      if (ctx.shadowRoot) walk(ctx.shadowRoot);
      kids = ctx.children ? Array.prototype.slice.call(ctx.children) : [];
      for (i = 0; i < kids.length; i += 1) walk(kids[i]);
    }
    walk(root);
    return out;
  }

  function nodeClassName(el) {
    return String((el && el.className && el.className.baseVal) || (el && el.className) || "");
  }

  function isScreeningOptionRow(el) {
    return isSplSelectOption(el);
  }

  function nodeIsAriaHidden(el) {
    var node = el;
    var hops = 0;
    while (node && hops < 24) {
      if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return true;
      if (node.hidden === true) return true;
      node = parentOrShadowHost(node);
      hops += 1;
    }
    return false;
  }

  function nodeHasVisibleBox(el) {
    var box;
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    try {
      box = el.getBoundingClientRect();
    } catch (_) {
      return false;
    }
    return Boolean(box && box.width > 0 && box.height > 0);
  }

  function visibleOptionLabel(el) {
    if (!el) return "";
    return trimText(
      el.innerText ||
        el.textContent ||
        (el.getAttribute && (el.getAttribute("label") || el.getAttribute("aria-label") || el.getAttribute("title"))) ||
        el.value ||
        ""
    );
  }

  function nearestScreeningOptionRow(el, host) {
    var node = el;
    var hops = 0;
    while (node && hops < 24) {
      if (host && node === host) break;
      if (isScreeningOptionRow(node)) return node;
      node = parentOrShadowHost(node);
      hops += 1;
    }
    return isScreeningOptionRow(el) ? el : null;
  }

  function collectVisibleScreeningOptionRows(host) {
    return querySplSelectOptions(host)
      .map(function (el) {
        return {
          el: el,
          label: splSelectOptionLabel(el),
          active: isActiveScreeningOptionRow(el)
        };
      })
      .filter(function (row) {
        return row.label;
      });
  }

  function isActiveScreeningOptionRow(el) {
    var cls = nodeClassName(el);
    if (/\bactive\b/.test(cls)) return true;
    if (normalizeText(el.getAttribute && el.getAttribute("aria-selected")) === "true") return true;
    if (normalizeText(el.getAttribute && el.getAttribute("aria-current")) === "true") return true;
    return false;
  }

  function findExactVisibleScreeningOptions(host, targetLabel) {
    var want = String(targetLabel || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!want || !host) return [];
    return collectVisibleScreeningOptionRows(host).filter(function (row) {
      return row.label.toLowerCase() === want;
    });
  }

  function readActiveVisibleOptionLabel(host, input) {
    var rows = collectVisibleScreeningOptionRows(host);
    var activeId = trimText(input && input.getAttribute && input.getAttribute("aria-activedescendant"));
    var el;
    var row;
    var i;
    if (activeId) {
      el = findNodeByIdDeep(host, activeId);
      row = el ? nearestScreeningOptionRow(el, host) : null;
      if (row) return visibleOptionLabel(row);
    }
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].active) return rows[i].label;
    }
    return "";
  }

  function looksLikeDemographicClearControl(el) {
    var blob = normalizeText(
      [
        el && el.getAttribute && el.getAttribute("aria-label"),
        el && el.getAttribute && el.getAttribute("title"),
        el && el.getAttribute && el.getAttribute("data-test"),
        nodeClassName(el),
        el && (el.innerText || el.textContent)
      ].join(" ")
    );
    if (!blob) return false;
    return /\bclear\b/.test(blob) || /\bclear selection\b/.test(blob);
  }

  function findDemographicClearButton(host) {
    var nodes;
    var i;
    var el;
    var tag;
    var role;
    if (!host) return null;
    nodes = collectComposedDescendants(host);
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!isLiveDocumentNode(el) || !isInComposedTree(el, host)) continue;
      tag = (el.tagName || "").toLowerCase();
      role = normalizeText(el.getAttribute && el.getAttribute("role"));
      if (tag !== "button" && role !== "button") continue;
      if (!looksLikeDemographicClearControl(el)) continue;
      if (nodeIsAriaHidden(el)) continue;
      return el;
    }
    return null;
  }

  function dispatchOptionPointerFallback(el) {
    var rect = null;
    var x = 0;
    var y = 0;
    var view;
    var opts;
    if (!el || typeof el.dispatchEvent !== "function") return;
    try {
      rect = el.getBoundingClientRect && el.getBoundingClientRect();
    } catch (_) {
      rect = null;
    }
    if (rect) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    view = (el.ownerDocument && el.ownerDocument.defaultView) || global;
    opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: view,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    try {
      if (typeof PointerEvent === "function") el.dispatchEvent(new PointerEvent("pointerdown", opts));
      else el.dispatchEvent(new MouseEvent("pointerdown", opts));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mousedown", opts));
    } catch (_) {}
    try {
      if (typeof PointerEvent === "function") el.dispatchEvent(new PointerEvent("pointerup", opts));
      else el.dispatchEvent(new MouseEvent("pointerup", opts));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("mouseup", opts));
    } catch (_) {}
    try {
      el.dispatchEvent(new MouseEvent("click", opts));
    } catch (_) {}
  }

  function resolveElementDocument(el) {
    var doc = el && el.ownerDocument;
    if (doc && doc.nodeType === 9) return doc;
    if (typeof document !== "undefined" && document && document.nodeType === 9) return document;
    return doc || document;
  }

  function clickExactVisibleScreeningOptionRow(row) {
    var option = row && row.el;
    var rect;
    var x;
    var y;
    var doc;
    var target;
    if (!option) return false;
    try {
      if (typeof option.scrollIntoView === "function") option.scrollIntoView({ block: "nearest" });
    } catch (_) {}
    try {
      rect = option.getBoundingClientRect();
    } catch (_) {
      rect = null;
    }
    doc = resolveElementDocument(option);
    if (rect && rect.width > 0 && rect.height > 0) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
      target = deepestElementFromPoint(x, y, doc);
    }
    if (!target || !isInComposedTree(target, option)) target = option;
    clickEl(target);
    return true;
  }

  function screeningOptionElementText(el) {
    return visibleOptionLabel(el);
  }

  function findAssociatedScreeningMenu(input, root) {
    var controls = trimText(input && input.getAttribute && input.getAttribute("aria-controls"));
    var host = closestComposedTag(input, "spl-autocomplete") || findSmartRecruitersScreeningHost(root) || root;
    var menu = null;
    if (controls) menu = findNodeByIdDeep(host, controls) || findNodeByIdDeep(root, controls);
    if (menu) return menu;
    if (host) {
      menu = queryDeepInclusive(host, "[role='listbox'], [role='menu']")[0] || null;
      if (menu) return menu;
    }
    return null;
  }

  function collectScreeningAutocompleteOptions(input, root) {
    var host = closestComposedTag(input, "spl-autocomplete");
    return collectVisibleScreeningOptionRows(host).map(function (row) {
      return row.el;
    });
  }

  function activeScreeningOptionText(input, optionEls, root) {
    var host = closestComposedTag(input, "spl-autocomplete");
    return readActiveVisibleOptionLabel(host, input);
  }

  function setScreeningInputNativeValue(el, value) {
    if (!el) return false;
    var next = value == null ? "" : String(value);
    var proto = global.HTMLInputElement && global.HTMLInputElement.prototype;
    var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    try {
      if (descriptor && descriptor.set) descriptor.set.call(el, next);
      else el.value = next;
    } catch (_) {
      try {
        el.value = next;
      } catch (__) {
        return false;
      }
    }
    try {
      el.value = next;
    } catch (_) {}
    return true;
  }

  function dispatchComposedEvent(el, type, init) {
    var opts = Object.assign({ bubbles: true, cancelable: true, composed: true }, init || {});
    if (!el || typeof el.dispatchEvent !== "function") return false;
    try {
      if ((type === "input" || type === "beforeinput") && typeof InputEvent === "function") {
        el.dispatchEvent(new InputEvent(type, opts));
        return true;
      }
    } catch (_) {}
    try {
      el.dispatchEvent(new Event(type, opts));
      return true;
    } catch (_) {
      return false;
    }
  }

  function dispatchComposedKey(el, key) {
    var keyCode = key === "ArrowDown" ? 40 : key === "Enter" ? 13 : key === "Escape" ? 27 : 0;
    var init = {
      key: key,
      code: key,
      bubbles: true,
      cancelable: true,
      composed: true,
      keyCode: keyCode,
      which: keyCode
    };
    if (!el || typeof el.dispatchEvent !== "function") return;
    ["keydown", "keyup"].forEach(function (type) {
      var ev = null;
      try {
        ev = new KeyboardEvent(type, init);
      } catch (_) {
        try {
          ev = new Event(type, init);
        } catch (__) {
          ev = { type: type, key: key, code: key, bubbles: true, cancelable: true, composed: true };
        }
      }
      try {
        if (ev && ev.key !== key) {
          try {
            Object.defineProperty(ev, "key", { configurable: true, value: key });
          } catch (_) {
            ev.key = key;
          }
        }
      } catch (_) {}
      try {
        el.dispatchEvent(ev);
      } catch (_) {}
    });
  }

  function dispatchScreeningInputEvents(el, value, extra) {
    var data = extra && extra.data != null ? extra.data : value;
    var inputType = (extra && extra.inputType) || "insertText";
    dispatchComposedEvent(el, "beforeinput", { data: data, inputType: inputType });
    dispatchComposedEvent(el, "input", { data: data, inputType: inputType });
  }

  function screeningInputExpanded(el) {
    return normalizeText(el && el.getAttribute && el.getAttribute("aria-expanded")) === "true";
  }

  function screeningInputInvalid(el) {
    var host;
    if (!el) return false;
    if (normalizeText(el.getAttribute && el.getAttribute("aria-invalid")) === "true") return true;
    host = closestComposedTag(el, "spl-autocomplete") || closestComposedTag(el, "spl-form-element");
    if (host && normalizeText(host.getAttribute && host.getAttribute("aria-invalid")) === "true") return true;
    return false;
  }

  function demographicFailureReason(message, details) {
    var info = details || {};
    return [
      message,
      "category=" + (info.category || ""),
      "proposed=" + (info.proposed || ""),
      "allowed=" + ((info.allowed || []).join(" | ") || "none"),
      "value=" + (info.value || ""),
      "aria-expanded=" + (info.expanded == null ? "" : String(info.expanded)),
      "aria-activedescendant=" + (info.active || ""),
      "menuFound=" + (info.menuFound ? "yes" : "no")
    ].join("; ");
  }

  function demographicDebug(input, root, extras) {
    var menu = input ? findAssociatedScreeningMenu(input, root) : null;
    return Object.assign(
      {
        value: trimText(input && input.value),
        expanded: input && input.getAttribute ? input.getAttribute("aria-expanded") : "",
        active: input && input.getAttribute ? input.getAttribute("aria-activedescendant") || "" : "",
        menuFound: Boolean(menu)
      },
      extras || {}
    );
  }

  async function waitUntil(predicate, tries, delayMs) {
    var i;
    for (i = 0; i < (tries || 12); i += 1) {
      if (predicate()) return true;
      await sleep(delayMs || 50);
    }
    return Boolean(predicate());
  }

  function clickMatchingScreeningOption(input, root, matchedLabel) {
    var host = closestComposedTag(input, "spl-autocomplete");
    var exact = findExactVisibleScreeningOptions(host, matchedLabel);
    if (exact.length !== 1) return false;
    return clickExactVisibleScreeningOptionRow(exact[0]);
  }

  async function typeScreeningDemographicValue(input, label) {
    try {
      if (typeof input.scrollIntoView === "function") input.scrollIntoView({ block: "nearest" });
    } catch (_) {}
    try {
      if (typeof input.click === "function") input.click();
    } catch (_) {}
    try {
      if (typeof input.focus === "function") input.focus();
    } catch (_) {}
    if (!setScreeningInputNativeValue(input, "")) return false;
    dispatchScreeningInputEvents(input, "", { data: "", inputType: "deleteContentBackward" });
    await sleep(40);
    if (!setScreeningInputNativeValue(input, label)) return false;
    dispatchScreeningInputEvents(input, label, { data: label, inputType: "insertText" });
    return true;
  }

  function committedDemographicVisibleLabel(host, input) {
    return trimText((input && input.value) || "") || observableHostSelectedLabel(host);
  }

  function demographicValueEquals(actual, expected) {
    return normalizeSensitiveOptionLabel(actual) === normalizeSensitiveOptionLabel(expected);
  }

  async function clearCommittedDemographicValue(host, input) {
    var btn = findDemographicClearButton(host);
    if (!btn) return false;
    clickEl(btn);
    dispatchOptionPointerFallback(btn);
    await sleep(80);
    host = closestComposedTag(input, "spl-autocomplete") || host;
    return !trimText(committedDemographicVisibleLabel(host, input));
  }

  async function commitScreeningDemographicSelection(input, root, matchedLabel) {
    var host = closestComposedTag(input, "spl-autocomplete");
    var exact;
    var active;
    var option;
    var rect;
    var target;
    var doc;
    var x;
    var y;
    var want = String(matchedLabel || "").replace(/\s+/g, " ").trim().toLowerCase();
    await waitUntil(function () {
      var liveHost = closestComposedTag(input, "spl-autocomplete") || host;
      var liveInput = findComboboxInDemographicHost(liveHost) || input;
      return screeningInputExpanded(liveInput) && querySplSelectOptions(liveHost).length > 0;
    }, 16, 50);
    host = closestComposedTag(input, "spl-autocomplete") || host;
    exact = findExactVisibleScreeningOptions(host, matchedLabel);
    if (exact.length !== 1) return false;
    clickExactVisibleScreeningOptionRow(exact[0]);
    await sleep(80);
    if (demographicValueEquals(committedDemographicVisibleLabel(host, input), matchedLabel)) return true;
    option = exact[0].el;
    try {
      rect = option.getBoundingClientRect();
    } catch (_) {
      rect = null;
    }
    doc = resolveElementDocument(option);
    target = option;
    if (rect && rect.width > 0 && rect.height > 0) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
      target = deepestElementFromPoint(x, y, doc) || option;
      if (!isInComposedTree(target, option)) target = option;
    }
    dispatchOptionPointerFallback(target);
    await sleep(80);
    if (demographicValueEquals(committedDemographicVisibleLabel(host, input), matchedLabel)) return true;
    active = String(readActiveVisibleOptionLabel(host, input) || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (active && active === want) {
      dispatchComposedKey(input, "Enter");
      await sleep(80);
      return true;
    }
    return false;
  }

  async function closeOtherScreeningDemographicMenus(root, keepKind) {
    var kinds = ["gender", "ethnicity"];
    var i;
    var other;
    for (i = 0; i < kinds.length; i += 1) {
      if (kinds[i] === keepKind) continue;
      other = findScreeningDemographicInput(root, kinds[i]);
      if (!other || !screeningInputExpanded(other)) continue;
      dispatchComposedKey(other, "Escape");
      try {
        if (typeof other.blur === "function") other.blur();
      } catch (_) {}
      await sleep(40);
    }
  }

  async function fillScreeningDemographicAutocomplete(field, inventory, root) {
    var kind = screeningDemographicKindFromCategory(field && field.category);
    var answer = answerForCategory(field && field.category, inventory);
    var mappedLabel = kind === "gender" ? mapGenderToPlatformLabel(answer) : trimText(answer);
    var host = findScreeningDemographicHost(root, kind);
    var input = findComboboxInDemographicHost(host) || findScreeningDemographicInput(root, kind);
    var after;
    var debug;
    var visibleRows;
    var visibleLabels;
    var exact;
    var committed;
    var cleared;

    function visibleLabelsNow(liveHost) {
      return collectVisibleScreeningOptionRows(liveHost).map(function (row) {
        return row.label;
      });
    }

    function fail(message, el, liveHost) {
      debug = demographicDebug(el || input, root, {
        category: (field && field.category) || kind,
        proposed: answer,
        allowed: visibleLabelsNow(liveHost || host)
      });
      return {
        ok: false,
        status: "failed",
        reason: demographicFailureReason(message, debug),
        value: debug.value || ""
      };
    }

    async function failWrongSensitiveValue(expected, actual, el, liveHost) {
      var liveInput = el;
      var liveHostNow = liveHost || host;
      if (actual && !demographicValueEquals(actual, expected)) {
        await clearCommittedDemographicValue(liveHostNow, liveInput);
      }
      return fail(
        "High-severity: incorrect sensitive value committed; expected " +
          expected +
          ", got " +
          (actual || "(empty)") +
          ".",
        el,
        liveHostNow
      );
    }

    if (!kind) {
      return { ok: false, status: "skipped", reason: "Unsupported demographic field." };
    }
    if (!input) {
      if (!answer) return { ok: false, status: "skipped", reason: "No saved answer." };
      return fail("Screening autocomplete was not found.");
    }
    if (!answer || !mappedLabel) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }

    committed = committedDemographicVisibleLabel(host, input);
    if (demographicValueEquals(committed, mappedLabel) && !screeningInputExpanded(input)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Field is already completed.",
        value: committed || mappedLabel
      };
    }
    if (committed && !demographicValueEquals(committed, mappedLabel)) {
      cleared = await clearCommittedDemographicValue(host, input);
      host = findScreeningDemographicHost(root, kind) || host;
      input = findComboboxInDemographicHost(host) || findScreeningDemographicInput(root, kind) || input;
      committed = committedDemographicVisibleLabel(host, input);
      if (committed && !demographicValueEquals(committed, mappedLabel)) {
        return failWrongSensitiveValue(mappedLabel, committed, input, host);
      }
      if (!cleared && committed) {
        return failWrongSensitiveValue(mappedLabel, committed, input, host);
      }
    }

    await closeOtherScreeningDemographicMenus(root, kind);
    host = findScreeningDemographicHost(root, kind) || host;
    input = findComboboxInDemographicHost(host) || findScreeningDemographicInput(root, kind) || input;
    if (!(await typeScreeningDemographicValue(input, mappedLabel))) {
      return fail("Could not set field value.", input, host);
    }
    await waitUntil(function () {
      var liveHost = findScreeningDemographicHost(root, kind) || host;
      var liveInput = findComboboxInDemographicHost(liveHost) || input;
      return screeningInputExpanded(liveInput) && querySplSelectOptions(liveHost).length > 0;
    }, 16, 50);
    host = findScreeningDemographicHost(root, kind) || host;
    input = findComboboxInDemographicHost(host) || findScreeningDemographicInput(root, kind) || input;
    visibleRows = collectVisibleScreeningOptionRows(host);
    visibleLabels = visibleRows.map(function (row) {
      return row.label;
    });
    exact = findExactVisibleScreeningOptions(host, mappedLabel);
    if (exact.length > 1) {
      return fail("Ambiguous visible option; expected exactly one \"" + mappedLabel + "\" row.", input, host);
    }
    if (!exact.length) {
      return fail("No matching visible option for \"" + mappedLabel + "\".", input, host);
    }
    await commitScreeningDemographicSelection(input, root, mappedLabel);
    await sleep(120);
    await waitUntil(function () {
      var live = findScreeningDemographicInput(root, kind);
      return !live || !screeningInputExpanded(live);
    }, 16, 50);
    after = findScreeningDemographicInput(root, kind) || input;
    host = findScreeningDemographicHost(root, kind) || host;
    committed = committedDemographicVisibleLabel(host, after);
    if (committed && !demographicValueEquals(committed, mappedLabel)) {
      return failWrongSensitiveValue(mappedLabel, committed, after, host);
    }
    try {
      if (typeof after.blur === "function") after.blur();
    } catch (_) {}
    await sleep(80);
    after = findScreeningDemographicInput(root, kind) || after;
    host = findScreeningDemographicHost(root, kind) || host;
    committed = committedDemographicVisibleLabel(host, after);
    if (screeningInputExpanded(after)) {
      return fail("Verification failed; dropdown is still open.", after, host);
    }
    if (!demographicValueEquals(committed, mappedLabel)) {
      if (committed) return failWrongSensitiveValue(mappedLabel, committed, after, host);
      return fail("Verification failed; autocomplete selection did not persist.", after, host);
    }
    if (screeningInputInvalid(after)) {
      return fail("Verification failed; question is still invalid.", after, host);
    }
    return { ok: true, status: "filled", reason: "", value: committed || mappedLabel };
  }

  function readSelectedOptionsDictionary(host) {
    if (!host || host.selectedOptionsDictionary == null) return [];
    return readOptionsDictionary({ optionsDictionary: host.selectedOptionsDictionary });
  }

  function selectedOptionsContain(selected, matched) {
    var want = normalizeText(matched && matched.label);
    var wantValue = trimText(matched && matched.value);
    var i;
    if (!want) return false;
    for (i = 0; i < (selected || []).length; i += 1) {
      if (normalizeText(selected[i].label) === want) return true;
      if (wantValue && trimText(selected[i].value) === wantValue) return true;
    }
    return false;
  }

  function demographicSelectionMatches(host, input, matched) {
    var want = normalizeText(matched && matched.label);
    var selected;
    if (!want) return false;
    if (input && normalizeText(input.value) === want) return true;
    if (host && observableHostSelectedLabel(host) && normalizeText(observableHostSelectedLabel(host)) === want) {
      return true;
    }
    selected = readSelectedOptionsDictionary(host);
    if (selected.length && selectedOptionsContain(selected, matched)) return true;
    return false;
  }

  function dictionaryHasLabel(host, label) {
    var opts = readOptionsDictionary(host);
    var want = normalizeText(label);
    var i;
    if (!want) return false;
    for (i = 0; i < opts.length; i += 1) {
      if (normalizeText(opts[i].label) === want) return true;
    }
    return false;
  }

  function observableHostSelectedLabel(host) {
    if (!host) return "";
    return trimText(host.value || host.selectedLabel || "");
  }

  async function waitForDemographicMenuClosed(root, kind) {
    await waitUntil(function () {
      var input = findScreeningDemographicInput(root, kind);
      return !input || !screeningInputExpanded(input);
    }, 16, 50);
    var stillOpen = findScreeningDemographicInput(root, kind);
    if (stillOpen && screeningInputExpanded(stillOpen)) {
      dispatchComposedKey(stillOpen, "Escape");
      try {
        if (typeof stillOpen.blur === "function") stillOpen.blur();
      } catch (_) {}
      await sleep(40);
    }
  }

  async function fillScreeningDemographicFields(inventory, root) {
    var rows = [];
    var genderField = { category: "gender", label: "Gender" };
    var ethnicityField = { category: "race_ethnicity", label: "Race/Ethnicity" };
    var genderResult = await fillScreeningDemographicAutocomplete(genderField, inventory, root);
    rows.push({ field: genderField, result: genderResult });
    await waitForDemographicMenuClosed(root, "gender");
    var ethnicityResult = await fillScreeningDemographicAutocomplete(ethnicityField, inventory, root);
    rows.push({ field: ethnicityField, result: ethnicityResult });
    return rows;
  }

  function findSmartRecruitersScreeningHost(root) {
    var AF = autofill();
    var host = null;
    if (AF && typeof AF.findSmartRecruitersScreeningForm === "function") {
      host = AF.findSmartRecruitersScreeningForm(root || document);
    } else {
      try {
        host = (root || document).querySelector(
          "sr-screening-questions-form[data-test='screening-questions-form']"
        );
      } catch (_) {
        host = null;
      }
    }
    return isLiveDocumentNode(host) ? host : null;
  }

  function screeningRadioChecked(el) {
    if (!el) return false;
    return normalizeText(el.getAttribute && el.getAttribute("aria-checked")) === "true";
  }

  function screeningRadioLabel(el) {
    if (!el) return "";
    return trimText(
      (el.getAttribute && (el.getAttribute("label") || el.getAttribute("aria-label"))) ||
        el.innerText ||
        el.textContent ||
        el.value ||
        ""
    );
  }

  function intendedScreeningSelection(radios, target) {
    var i;
    var el;
    for (i = 0; i < (radios || []).length; i += 1) {
      el = radios[i];
      if (el === target) {
        if (!screeningRadioChecked(el)) return false;
      } else if (screeningRadioChecked(el)) {
        return false;
      }
    }
    return Boolean(target);
  }

  function deepestVisibleScreeningClickTarget(el) {
    var nodes = [];
    var best = null;
    var i;
    var box;
    if (!el) return null;
    if (!el.shadowRoot) return el;
    try {
      nodes = el.shadowRoot.querySelectorAll("*");
    } catch (_) {
      nodes = [];
    }
    for (i = 0; i < nodes.length; i += 1) {
      try {
        box = nodes[i].getBoundingClientRect && nodes[i].getBoundingClientRect();
        if (box && box.width > 0 && box.height > 0) best = nodes[i];
      } catch (_) {
        best = nodes[i];
      }
    }
    return best || el;
  }

  function dispatchPointerClickFallback(el) {
    var init = { bubbles: true, cancelable: true, composed: true };
    if (!el || typeof el.dispatchEvent !== "function") return;
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (type) {
      try {
        if (type.indexOf("pointer") === 0 && typeof PointerEvent === "function") {
          el.dispatchEvent(new PointerEvent(type, init));
        } else if (typeof MouseEvent === "function") {
          el.dispatchEvent(new MouseEvent(type, init));
        } else {
          el.dispatchEvent(new Event(type, init));
        }
      } catch (_) {}
    });
  }

  function resolveScreeningRadioUnit(root, field) {
    var AF = autofill();
    var units = [];
    var i;
    var screening;
    var id = trimText(field && (field.screeningQuestionId || field.id));
    var label = normalizeText(field && (field.label || field.question));
    if (!AF || typeof AF.collectSmartRecruitersScreeningRadioUnits !== "function") return null;
    units = AF.collectSmartRecruitersScreeningRadioUnits(root || document) || [];
    for (i = 0; i < units.length; i += 1) {
      screening = units[i].screening || {};
      if (id && screening.questionId && screening.questionId === id) return units[i];
    }
    for (i = 0; i < units.length; i += 1) {
      screening = units[i].screening || {};
      if (label && normalizeText(screening.label) === label) return units[i];
    }
    return null;
  }

  function screeningRadioOptionMatchesLabel(saved, optionLabel) {
    var AF = autofill();
    if (AF && typeof AF.screeningRadioOptionMatches === "function") {
      return AF.screeningRadioOptionMatches(saved, optionLabel);
    }
    return normalizeText(saved) === normalizeText(optionLabel);
  }

  function findScreeningRadioByOption(radios, matched) {
    var i;
    var el;
    var label;
    var wantLabel = normalizeText(matched && (matched.label || ""));
    if (!matched) return null;
    for (i = 0; i < (radios || []).length; i += 1) {
      el = radios[i];
      label = normalizeText(screeningRadioLabel(el));
      if (wantLabel && label === wantLabel) return el;
    }
    for (i = 0; i < (radios || []).length; i += 1) {
      el = radios[i];
      if (wantLabel && screeningRadioOptionMatchesLabel(matched.label, screeningRadioLabel(el))) {
        return el;
      }
    }
    return null;
  }

  async function clickScreeningRadio(radio) {
    var inner;
    clickEl(radio);
    await sleep(80);
    if (screeningRadioChecked(radio)) return true;
    inner = deepestVisibleScreeningClickTarget(radio);
    if (inner && inner !== radio) {
      clickEl(inner);
      await sleep(80);
      if (screeningRadioChecked(radio)) return true;
    }
    dispatchPointerClickFallback(radio);
    if (inner && inner !== radio) dispatchPointerClickFallback(inner);
    await sleep(80);
    return screeningRadioChecked(radio);
  }

  async function fillScreeningRadioField(field, inventory, root) {
    var unit = resolveScreeningRadioUnit(root, field);
    var radios = (unit && unit.elements) || [];
    var options;
    var answer = answerForCategory(field.category, inventory);
    var AF = autofill();
    var matched;
    var target;
    var selected;
    var afterUnit;
    var afterRadios;
    if (!unit || !radios.length) {
      return { ok: false, status: "failed", reason: "Screening radio group was not found." };
    }
    options =
      (field.options && field.options.length ? field.options : null) ||
      radios.map(function (el) {
        return {
          label: screeningRadioLabel(el),
          value: trimText(el.getAttribute && el.getAttribute("value"))
        };
      });
    selected = radios.filter(screeningRadioChecked);
    if (selected.length === 1) {
      return {
        ok: false,
        status: "skipped",
        reason: "Field is already completed.",
        value: screeningRadioLabel(selected[0])
      };
    }
    if (!answer) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    matched =
      AF && typeof AF.matchSmartRecruitersScreeningRadioOption === "function"
        ? AF.matchSmartRecruitersScreeningRadioOption(answer, options)
        : null;
    if (!matched) {
      return { ok: false, status: "failed", reason: "No matching radio option." };
    }
    target = findScreeningRadioByOption(radios, matched);
    if (!target) {
      return {
        ok: false,
        status: "failed",
        reason: "Matching radio option was not found in the live group."
      };
    }
    await clickScreeningRadio(target);
    await sleep(80);
    afterUnit = resolveScreeningRadioUnit(root, field);
    afterRadios = (afterUnit && afterUnit.elements) || radios;
    target = findScreeningRadioByOption(afterRadios, matched) || target;
    if (!intendedScreeningSelection(afterRadios, target)) {
      return {
        ok: false,
        status: "failed",
        reason: "Verification failed; radio selection did not persist."
      };
    }
    return {
      ok: true,
      status: "filled",
      reason: "",
      value: screeningRadioLabel(target)
    };
  }

  function looksLikeHiringTeamScanField(field) {
    if (!field) return false;
    if (trimText(field.id) === "hiring-manager-message-input") return true;
    var blob = normalizeText(
      [field.label, field.question, field.ariaLabel, field.nearbyText, field.name].join(" ")
    );
    return /\bmessage to the hiring team\b/.test(blob);
  }

  var HIRING_TEAM_HOST_SELECTOR = "spl-textarea#hiring-manager-message-input";
  var HIRING_TEAM_INNER_SELECTOR = "textarea#hiring-manager-message-input";

  function resolveHiringTeamMessageControl(root) {
    var doc = root && root.querySelector ? root : document;
    var host = null;
    var textarea = null;
    try {
      host = doc.querySelector(HIRING_TEAM_HOST_SELECTOR);
    } catch (_) {
      host = null;
    }
    if (host && host.shadowRoot && host.shadowRoot.querySelector) {
      try {
        textarea = host.shadowRoot.querySelector(HIRING_TEAM_INNER_SELECTOR);
      } catch (_) {
        textarea = null;
      }
    }
    return { host: host, textarea: textarea };
  }

  function setTextareaNativeValue(el, value) {
    var next = value == null ? "" : String(value);
    var proto = global.HTMLTextAreaElement && global.HTMLTextAreaElement.prototype;
    var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    try {
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, next);
        return true;
      }
    } catch (_) {}
    try {
      el.value = next;
      return true;
    } catch (_) {
      return false;
    }
  }

  function dispatchHiringTeamEvents(el) {
    var init = { bubbles: true, cancelable: true, composed: true };
    if (!el || typeof el.dispatchEvent !== "function") return;
    try {
      if (typeof InputEvent === "function") {
        el.dispatchEvent(new InputEvent("beforeinput", Object.assign({ inputType: "insertFromPaste" }, init)));
      } else {
        el.dispatchEvent(new Event("beforeinput", init));
      }
    } catch (_) {
      try {
        el.dispatchEvent(new Event("beforeinput", init));
      } catch (__) {}
    }
    try {
      el.dispatchEvent(new Event("input", init));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", init));
    } catch (_) {}
    try {
      if (typeof FocusEvent === "function") {
        el.dispatchEvent(new FocusEvent("blur", init));
      } else {
        el.dispatchEvent(new Event("blur", init));
      }
    } catch (_) {
      try {
        el.dispatchEvent(new Event("blur", init));
      } catch (__) {}
    }
  }

  function syncHiringTeamHostValue(host, value) {
    if (!host) return;
    var next = value == null ? "" : String(value);
    try {
      host.value = next;
    } catch (_) {}
    try {
      if (host.setAttribute) host.setAttribute("value", next);
    } catch (_) {}
  }

  async function fillHiringTeamMessage(answer, root) {
    var message = trimText(answer);
    var resolved = resolveHiringTeamMessageControl(root);
    var again;
    var after;
    if (!resolved.textarea) {
      return {
        ok: false,
        status: "failed",
        reason: "Hiring team message field was not found."
      };
    }
    if (trimText(resolved.textarea.value)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Field is already completed.",
        value: trimText(resolved.textarea.value)
      };
    }
    if (!message) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    try {
      if (typeof resolved.textarea.focus === "function") resolved.textarea.focus();
    } catch (_) {}
    if (!setTextareaNativeValue(resolved.textarea, message)) {
      return { ok: false, status: "failed", reason: "Could not set field value." };
    }
    dispatchHiringTeamEvents(resolved.textarea);
    syncHiringTeamHostValue(resolved.host, message);
    await sleep(40);
    again = resolveHiringTeamMessageControl(root);
    after = trimText(again && again.textarea && again.textarea.value);
    if (!again.textarea || !textValuesEqual(message, after)) {
      return {
        ok: false,
        status: "failed",
        reason: "Verification failed; field does not contain the expected value.",
        value: after || ""
      };
    }
    return { ok: true, status: "filled", reason: "", value: after };
  }

  function textValuesEqual(expected, actual) {
    var AF = autofill();
    if (AF && typeof AF.textValuesMatch === "function") return AF.textValuesMatch(expected, actual);
    return normalizeText(expected) === normalizeText(actual);
  }

  function detectSmartRecruitersApplyStep(root) {
    var loc = global.location || {};
    var screeningUrl = isSmartRecruitersScreeningUrl(
      loc.href || "",
      loc.hostname || "",
      loc.pathname || ""
    );
    var screeningHost = findSmartRecruitersScreeningHost(root);
    var dropzone = findTopResumeDropzone(root);
    if (dropzone) {
      return {
        step: "application",
        runResumePreflight: true,
        dropzone: dropzone,
        screeningHost: screeningHost
      };
    }
    if (screeningUrl || screeningHost) {
      return {
        step: "screening",
        runResumePreflight: false,
        dropzone: null,
        screeningHost: screeningHost
      };
    }
    return {
      step: "application",
      runResumePreflight: true,
      dropzone: null,
      screeningHost: null
    };
  }

  function existingPrivacyConsentAutoAcceptEnabled() {
    return false;
  }

  function isScreeningConsentChecked(el) {
    var AF = autofill();
    if (AF && typeof AF.isSmartRecruitersConsentChecked === "function") {
      return AF.isSmartRecruitersConsentChecked(el);
    }
    if (!el) return false;
    if (normalizeText(el.getAttribute && el.getAttribute("aria-checked")) === "true") return true;
    return el.checked === true;
  }

  async function fillScreeningPrivacyConsent(field, root) {
    var AF = autofill();
    var found =
      AF && typeof AF.findSmartRecruitersPrivacyConsentControl === "function"
        ? AF.findSmartRecruitersPrivacyConsentControl(root || document)
        : null;
    var el = found && found.element;
    var inner;
    if (!el) {
      return { ok: false, status: "failed", reason: "Privacy consent checkbox was not found." };
    }
    if (isScreeningConsentChecked(el)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Field is already completed.",
        value: (found && found.label) || (field && field.label) || ""
      };
    }
    if (!existingPrivacyConsentAutoAcceptEnabled()) {
      return {
        ok: false,
        status: "skipped",
        reason: "User confirmation required.",
        value: ""
      };
    }
    clickEl(el);
    await sleep(80);
    if (!isScreeningConsentChecked(el)) {
      inner = deepestVisibleScreeningClickTarget(el);
      if (inner && inner !== el) clickEl(inner);
      dispatchPointerClickFallback(el);
      await sleep(80);
    }
    if (!isScreeningConsentChecked(el)) {
      return { ok: false, status: "failed", reason: "Verification failed; privacy consent was not checked." };
    }
    return { ok: true, status: "filled", reason: "", value: (found && found.label) || "" };
  }

  async function fillScreeningReferralField(field, inventory, liveEl) {
    var answer = answerForCategory("referral_source", inventory);
    var AF = autofill();
    if (!answer) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }
    if (!liveEl) {
      return { ok: false, status: "failed", reason: "Employee referral field was not found." };
    }
    if (readValue(liveEl)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Field is already completed.",
        value: readValue(liveEl)
      };
    }
    if (AF && typeof AF.fillTextElement === "function") {
      return AF.fillTextElement(liveEl, answer);
    }
    return setReactValue(liveEl, answer) ? { ok: true, status: "filled", value: answer } : { ok: false, status: "failed", reason: "Could not fill referral field." };
  }

  function isPageOneSmartRecruitersCategory(category) {
    return Boolean(
      {
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        linkedin: true,
        github: true,
        portfolio: true,
        city: true,
        location: true,
        additional_information: true,
        resume_upload: true
      }[category]
    );
  }

  function pushResult(results, field, fillResult, value) {
    results.push({
      category: field.category || "unknown",
      label: field.label || field.question || field.ariaLabel || field.category || "Field",
      status: (fillResult && fillResult.status) || "failed",
      reason: (fillResult && fillResult.reason) || "",
      ok: Boolean(fillResult && fillResult.ok),
      value: fillResult && fillResult.ok ? value || fillResult.value || "" : ""
    });
  }

  async function fillSupportedFields(context) {
    var empty = emptyReport();
    if (!isSupportedPage()) return empty;
    var ctx = context || {};
    var root = ctx.root || document;
    var inventory = Object.assign({}, ctx.inventory || {});
    var resume = ctx.resume || null;
    var handled = ctx.handledElements || [];
    var AF = autofill();
    var results = [];

    if (inventory.phone) {
      inventory.phone = nationalPhoneNumber(inventory.phone, inventory.phone_country_code || "1");
    }

    if (!AF || typeof AF.scanDocument !== "function") {
      return summarizeResults(
        [
          {
            category: "unknown",
            label: "SmartRecruiters",
            status: "failed",
            reason: "Autofill engine is not available on this page.",
            ok: false,
            value: ""
          }
        ],
        "Autofill engine is not available on this page."
      );
    }

    var step = detectSmartRecruitersApplyStep(root);
    if (!step.runResumePreflight) {
      clearResumeParserControlCache();
    } else {
      var parserResult = await uploadSmartRecruitersParserResume(resume, root);
      pushResult(
        results,
        { category: "resume_upload", label: "Resume" },
        parserResult,
        parserResult && parserResult.value
      );
      if (!(parserResult && (parserResult.ok || parserResult.status === "skipped"))) {
        return summarizeResults(results);
      }
    }

    var scan = AF.scanDocument(root, inventory) || { fields: [] };
    var scanFields = (scan.fields || []).filter(function (field) {
      if (!field || !isFillableCategory(field.category)) return false;
      if (field.category === "resume_upload") return false;
      if (step.step === "screening" && isPageOneSmartRecruitersCategory(field.category)) return false;
      if (isCountryChromeElement && field.label && looksLikeCountryChrome(field.label)) return false;
      if (field.ariaLabel && looksLikeCountryChrome(field.ariaLabel)) return false;
      if (field.placeholder && looksLikeCountryChrome(field.placeholder)) return false;
      return true;
    });

    var liveIdentities = collectLiveControls(root).map(liveFieldIdentity);
    var used = [];
    var i;
    var demoHandled = {};
    if (findScreeningDemographicHost(root, "gender") || findScreeningDemographicHost(root, "ethnicity")) {
      var demoRows = await fillScreeningDemographicFields(inventory, root);
      for (i = 0; i < demoRows.length; i += 1) {
        pushResult(results, demoRows[i].field, demoRows[i].result, demoRows[i].result && demoRows[i].result.value);
        demoHandled[demoRows[i].field.category] = true;
      }
    }

    for (i = 0; i < scanFields.length; i += 1) {
      var field = scanFields[i];
      if (demoHandled[field.category]) continue;
      if (field.category === "additional_information" && looksLikeHiringTeamScanField(field)) {
        var hiringAnswer = answerForCategory(field.category, inventory);
        var hiringResult = await fillHiringTeamMessage(hiringAnswer, root);
        pushResult(results, field, hiringResult, hiringResult && hiringResult.value);
        continue;
      }
      if (looksLikeScreeningDemographicAutocomplete(field)) {
        var demoResult = await fillScreeningDemographicAutocomplete(field, inventory, root);
        pushResult(results, field, demoResult, demoResult && demoResult.value);
        continue;
      }
      if (looksLikeScreeningRadioField(field)) {
        var radioResult = await fillScreeningRadioField(field, inventory, root);
        pushResult(results, field, radioResult, radioResult && radioResult.value);
        continue;
      }
      if (field.category === "privacy_consent") {
        var privacyResult = await fillScreeningPrivacyConsent(field, root);
        pushResult(results, field, privacyResult, privacyResult && privacyResult.value);
        continue;
      }
      if (field.category === "referral_source") {
        var liveReferral = resolveLiveElement(field, liveIdentities, used);
        var referralResult = await fillScreeningReferralField(
          field,
          inventory,
          liveReferral && liveReferral.el
        );
        if (liveReferral && liveReferral.el) {
          markHandled(used, liveReferral.el);
          markHandled(handled, liveReferral.el);
        }
        pushResult(results, field, referralResult, referralResult && referralResult.value);
        continue;
      }
      var live = resolveLiveElement(field, liveIdentities, used);
      if (!live || !live.el) {
        if (field.hasAnswer || field.fillStatus === "ready") {
          pushResult(results, field, {
            ok: false,
            status: "failed",
            reason: "Could not resolve field in the live page."
          });
        }
        continue;
      }
      markHandled(used, live.el);
      markHandled(handled, live.el);

      var currentLive = readValue(live.el);
      if (currentLive) {
        pushResult(
          results,
          field,
          {
            ok: false,
            status: "skipped",
            reason: "Field is already completed."
          },
          currentLive
        );
        continue;
      }

      if (field.category === "phone") {
        var phoneResult = await fillPhoneCompound(root, live.el, inventory, used);
        markHandled(handled, live.el);
        pushResult(results, field, phoneResult, phoneResult && phoneResult.value);
        continue;
      }

      var answer = answerForCategory(field.category, inventory);
      if (isCityField(field, live.el)) {
        if (!answer) {
          pushResult(results, field, { ok: false, status: "skipped", reason: "No saved answer." });
          continue;
        }
        var cityResult = await fillCityAutocomplete(root, live.el, answer);
        pushResult(results, field, cityResult, cityResult && cityResult.value);
        continue;
      }

      if (!answer) {
        pushResult(results, field, { ok: false, status: "skipped", reason: "No saved answer." });
        continue;
      }

      var textResult =
        AF && typeof AF.fillTextElement === "function"
          ? AF.fillTextElement(live.el, answer)
          : { ok: false, status: "failed", reason: "Autofill engine is not available." };
      pushResult(results, field, textResult, answer);
    }

    if (scanFields.length > 0 && results.length === 0) {
      return summarizeResults(
        [
          {
            category: "unknown",
            label: "SmartRecruiters",
            status: "failed",
            reason: "Ready SmartRecruiters fields were not attempted.",
            ok: false,
            value: ""
          }
        ],
        "Ready SmartRecruiters fields were not attempted."
      );
    }

    return summarizeResults(results);
  }

  global.ImpulsoSmartRecruitersAdapter = {
    isSmartRecruitersHost: isSmartRecruitersHost,
    isSmartRecruitersApplicationUrl: isSmartRecruitersApplicationUrl,
    isSmartRecruitersScreeningUrl: isSmartRecruitersScreeningUrl,
    isSupportedPage: isSupportedPage,
    detectSmartRecruitersApplyStep: detectSmartRecruitersApplyStep,
    findTopResumeDropzone: findTopResumeDropzone,
    clearResumeParserControlCache: clearResumeParserControlCache,
    fillSupportedFields: fillSupportedFields,
    isFillableCategory: isFillableCategory,
    nationalPhoneNumber: nationalPhoneNumber,
    isUnitedStatesCountryOption: isUnitedStatesCountryOption,
    scoreLiveFieldMatch: scoreLiveFieldMatch,
    looksLikeCountryChrome: looksLikeCountryChrome,
    citySuggestionMatches: citySuggestionMatches,
    pickCitySuggestion: pickCitySuggestion,
    parseCityQuery: parseCityQuery,
    fileFromResumePayload: fileFromResumePayload,
    filenamesMatch: filenamesMatch,
    resumeBasename: resumeBasename,
    ATTACHED_RESUME_DROPZONE_SELECTOR: ATTACHED_RESUME_DROPZONE_SELECTOR,
    TOP_RESUME_DROPZONE_SELECTOR: TOP_RESUME_DROPZONE_SELECTOR,
    TOP_RESUME_FILE_INPUT_SELECTOR: TOP_RESUME_FILE_INPUT_SELECTOR,
    deepestElementFromPoint: deepestElementFromPoint,
    isInComposedTree: isInComposedTree,
    resolveHiringTeamMessageControl: resolveHiringTeamMessageControl,
    fillHiringTeamMessage: fillHiringTeamMessage,
    looksLikeHiringTeamScanField: looksLikeHiringTeamScanField,
    fillScreeningRadioField: fillScreeningRadioField,
    looksLikeScreeningRadioField: looksLikeScreeningRadioField,
    looksLikeScreeningDemographicAutocomplete: looksLikeScreeningDemographicAutocomplete,
    findScreeningDemographicInput: findScreeningDemographicInput,
    findScreeningDemographicHost: findScreeningDemographicHost,
    readOptionsDictionary: readOptionsDictionary,
    matchScreeningDemographicOption: matchScreeningDemographicOption,
    mapGenderToPlatformLabel: mapGenderToPlatformLabel,
    fillScreeningDemographicAutocomplete: fillScreeningDemographicAutocomplete,
    fillScreeningPrivacyConsent: fillScreeningPrivacyConsent,
    collectVisibleScreeningOptionRows: collectVisibleScreeningOptionRows,
    querySplSelectOptions: querySplSelectOptions,
    findExactVisibleScreeningOptions: findExactVisibleScreeningOptions,
    findDemographicClearButton: findDemographicClearButton,
    normalizeSensitiveOptionLabel: normalizeSensitiveOptionLabel,
    HIRING_TEAM_HOST_SELECTOR: HIRING_TEAM_HOST_SELECTOR,
    HIRING_TEAM_INNER_SELECTOR: HIRING_TEAM_INNER_SELECTOR,
    FILLABLE_CATEGORIES: FILLABLE_CATEGORIES
  };
})(typeof window !== "undefined" ? window : self);
