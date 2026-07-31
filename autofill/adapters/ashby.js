(function (global) {
  function trimText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }
  function normalizeText(value) {
    return trimText(value).toLowerCase();
  }
  function detectCategoryFromMeta(meta) {
    return (window.ImpulsoAutofill && window.ImpulsoAutofill.detectCategoryFromMeta)
      ? window.ImpulsoAutofill.detectCategoryFromMeta(meta)
      : { category: "unknown", confidence: 0 };
  }

function findLabelText(el) {
  if (!el) return "";
  if (el.id) {
    var byFor = null;
    try {
      byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
    } catch (_) {
      byFor = document.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
    }
    if (byFor) return trimText(byFor.innerText || byFor.textContent || "");
  }
  var parentLabel = el.closest("label");
  if (parentLabel) return trimText(parentLabel.innerText || parentLabel.textContent || "");

  var labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    var parts = labelledBy.split(/\s+/).map(function (id) {
      var node = document.getElementById(id);
      return node ? trimText(node.innerText || node.textContent || "") : "";
    });
    return trimText(parts.join(" "));
  }
  return "";
}

function isLikelyOptionCluster(text, optionTexts) {
  var blob = normalizeText(text);
  if (!blob) return false;
  var hits = 0;
  (optionTexts || []).forEach(function (opt) {
    var o = normalizeText(opt);
    if (o && o.length > 0 && blob.indexOf(o) !== -1) hits += 1;
  });
  return hits >= 2;
}

function nearbyQuestionText(el, optionTexts) {
  if (!el) return "";
  var fieldset = el.closest("fieldset");
  if (fieldset) {
    var legend = fieldset.querySelector("legend");
    if (legend) {
      var legendText = trimText(legend.innerText || legend.textContent || "");
      if (legendText && !isLikelyOptionCluster(legendText, optionTexts)) return legendText;
    }
  }

  var labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    var parts = labelledBy.split(/\s+/).map(function (id) {
      var node = document.getElementById(id);
      return node ? trimText(node.innerText || node.textContent || "") : "";
    });
    var ariaText = trimText(parts.join(" "));
    if (ariaText && !isLikelyOptionCluster(ariaText, optionTexts)) return ariaText;
  }

  var parent = el.parentElement;
  var hops = 0;
  while (parent && hops < 5) {
    var prev = parent.previousElementSibling;
    if (prev) {
      var prevText = trimText(prev.innerText || prev.textContent || "");
      if (
        prevText &&
        prevText.length < 220 &&
        !isLikelyOptionCluster(prevText, optionTexts)
      ) {
        return prevText;
      }
    }
    var heading = parent.querySelector(
      ":scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [class*='question'], :scope > label, :scope > p, :scope > span"
    );
    if (heading && heading !== el && !heading.contains(el)) {
      var headingText = trimText(heading.innerText || heading.textContent || "");
      if (
        headingText &&
        headingText.length < 220 &&
        !isLikelyOptionCluster(headingText, optionTexts)
      ) {
        return headingText;
      }
    }
    if (parent.getAttribute && parent.getAttribute("role") === "group") {
      var groupLabel = trimText(parent.getAttribute("aria-label") || "");
      if (groupLabel) return groupLabel;
    }
    parent = parent.parentElement;
    hops += 1;
  }
  return "";
}

function radioGroupQuestionText(radios) {
  if (!radios || !radios.length) return "";
  var first = radios[0];
  var optionTexts = radios.map(function (r) {
    return normalizeText(findLabelText(r) || r.value || "");
  });

  var fieldset = first.closest("fieldset");
  if (fieldset) {
    var legend = fieldset.querySelector("legend");
    if (legend) {
      var legendText = trimText(legend.innerText || legend.textContent || "");
      if (legendText && !isLikelyOptionCluster(legendText, optionTexts)) return legendText;
    }
  }

  var group = first.closest("[role='group'], [class*='question'], [data-automation-id], [data-qa]");
  if (group) {
    var groupAria = trimText(group.getAttribute("aria-label") || "");
    if (groupAria) return groupAria;
    var groupLabelledBy = group.getAttribute("aria-labelledby");
    if (groupLabelledBy) {
      var nodes = groupLabelledBy.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? trimText(node.innerText || node.textContent || "") : "";
      });
      var joined = trimText(nodes.join(" "));
      if (joined && !isLikelyOptionCluster(joined, optionTexts)) return joined;
    }
    var prompt = group.querySelector(
      "legend, h1, h2, h3, h4, h5, h6, [class*='question'], [class*='label'], p, label, span"
    );
    if (prompt && !radios.some(function (r) { return prompt.contains(r); })) {
      var promptText = trimText(prompt.innerText || prompt.textContent || "");
      if (
        promptText &&
        optionTexts.indexOf(normalizeText(promptText)) === -1 &&
        !isLikelyOptionCluster(promptText, optionTexts)
      ) {
        return promptText;
      }
    }
  }

  return nearbyQuestionText(first, optionTexts);
}

var ASHBY_YES_NO_CATEGORIES = {
  work_authorization: true,
  sponsorship_now: true,
  sponsorship_later: true,
  relocation: true
};

function isAshbyHost() {
  try {
    var href = String((global.location && global.location.href) || "");
    var host = String((global.location && global.location.hostname) || "");
    return /jobs\.ashbyhq\.com/i.test(href) || /^jobs\.ashbyhq\.com$/i.test(host);
  } catch (_) {
    return false;
  }
}

function sleepSync(ms) {
  var end = Date.now() + Math.max(0, Number(ms) || 0);
  while (Date.now() < end) {
    /* brief wait for Ashby UI to settle */
  }
}

function polarityOfYesNo(value) {
  var text = normalizeText(value);
  if (!text) return "";
  if (/^(yes|y|true|1)$/.test(text)) return "yes";
  if (/^(no|n|false|0)$/.test(text)) return "no";
  if (
    /\bauthorized\b/.test(text) &&
    !/\bnot\s+authorized\b/.test(text) &&
    !/\bunauthorized\b/.test(text)
  ) {
    return "yes";
  }
  if (/\bnot\s+authorized\b/.test(text) || /\bunauthorized\b/.test(text)) return "no";
  if (/\bdo\s+not\b/.test(text) || /\bwill\s+not\b/.test(text) || /\bwon'?t\b/.test(text)) {
    return "no";
  }
  return "";
}

function yesNoAnswerForCategory(category, inventory) {
  if (!ASHBY_YES_NO_CATEGORIES[category]) return "";
  var raw = trimText((inventory && inventory[category]) || "");
  if (!raw) return "";
  var pol = polarityOfYesNo(raw);
  if (pol === "yes") return "Yes";
  if (pol === "no") return "No";
  if (/^(yes|no)$/i.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  return "";
}

function getAshbyOptionWrapper(radio) {
  if (!radio || !radio.closest) return null;
  return radio.closest('div[class*="_option_"]');
}

function getAshbyOptionVisibleText(radio) {
  if (!radio) return "";
  var optionWrapper = getAshbyOptionWrapper(radio);
  if (optionWrapper) {
    return trimText(optionWrapper.innerText || optionWrapper.textContent || "");
  }
  return trimText(radio.value || "");
}

function readAshbyYesNoQuestionText(fieldset, radios) {
  if (fieldset) {
    var legend = fieldset.querySelector && fieldset.querySelector("legend");
    if (legend) {
      var legendText = trimText(legend.innerText || legend.textContent || "");
      if (legendText) return legendText;
    }
    var aria = trimText(fieldset.getAttribute && fieldset.getAttribute("aria-label"));
    if (aria) return aria;
    var prompt =
      fieldset.querySelector &&
      fieldset.querySelector("h1, h2, h3, h4, label, p, [class*='label'], [class*='question']");
    if (prompt) {
      var promptText = trimText(prompt.innerText || prompt.textContent || "");
      if (promptText && promptText.length < 280 && !isLikelyOptionCluster(promptText, ["yes", "no"])) {
        return promptText;
      }
    }
  }
  return radioGroupQuestionText(radios || []) || "";
}

function collectAshbyRadiosInFieldset(fieldset) {
  var found = [];
  if (!fieldset || !fieldset.querySelectorAll) return found;
  Array.prototype.forEach.call(fieldset.querySelectorAll('input[type="radio"]'), function (el) {
    if (!el || normalizeText(el.type || "") !== "radio") return;
    if (!fieldset.contains(el)) return;
    found.push(el);
  });
  return found;
}

function isExactYesNoOnlyGroup(radios) {
  var labels = (radios || []).map(getAshbyOptionVisibleText).map(trimText).filter(Boolean);
  if (labels.length < 2) return false;
  var hasYes = false;
  var hasNo = false;
  for (var i = 0; i < labels.length; i += 1) {
    if (!/^(yes|no)$/i.test(labels[i])) return false;
    if (/^yes$/i.test(labels[i])) hasYes = true;
    if (/^no$/i.test(labels[i])) hasNo = true;
  }
  return hasYes && hasNo;
}

function isCitizenshipOrExportControlQuestion(questionText) {
  var text = normalizeText(questionText);
  if (!text) return false;
  return (
    /\bexport\s+control\b/.test(text) ||
    /\bitar\b/.test(text) ||
    /\bear\b/.test(text) ||
    /\bcitizen\s+or\s+national\b/.test(text) ||
    /\bpermanent\s+resident\b/.test(text) ||
    /\basylee\b/.test(text) ||
    /\brefugee\b/.test(text)
  );
}

function matchExactYesNoOption(radios, yesNoAnswer) {
  var want = normalizeText(yesNoAnswer);
  if (want !== "yes" && want !== "no") return null;
  for (var i = 0; i < (radios || []).length; i += 1) {
    var optionText = normalizeText(getAshbyOptionVisibleText(radios[i]));
    if (optionText === want) {
      return {
        radio: radios[i],
        optionWrapper: getAshbyOptionWrapper(radios[i]),
        optionText: getAshbyOptionVisibleText(radios[i])
      };
    }
  }
  return null;
}

function setNativeRadioChecked(input, checked) {
  if (!input) return false;
  var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
  var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "checked") : null;
  try {
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, Boolean(checked));
    } else {
      input.checked = Boolean(checked);
    }
  } catch (_) {
    try {
      input.checked = Boolean(checked);
    } catch (_) {
      return false;
    }
  }
  return Boolean(input.checked) === Boolean(checked);
}

function dispatchAshbyRadioInputChange(input) {
  if (!input) return;
  try {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (_) {}
  try {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (_) {}
}

function clickAshbyOptionWrapper(optionWrapper) {
  if (!optionWrapper) return;
  try {
    if (typeof optionWrapper.scrollIntoView === "function") {
      optionWrapper.scrollIntoView({ block: "center" });
    }
  } catch (_) {}
  try {
    var clickFn =
      window.HTMLElement &&
      window.HTMLElement.prototype &&
      typeof window.HTMLElement.prototype.click === "function"
        ? window.HTMLElement.prototype.click
        : null;
    if (clickFn) {
      clickFn.call(optionWrapper);
    } else if (typeof optionWrapper.click === "function") {
      optionWrapper.click();
    }
  } catch (_) {
    try {
      if (typeof optionWrapper.click === "function") optionWrapper.click();
    } catch (_) {}
  }
}

function verifyAshbyYesNoSelection(fieldset, target) {
  if (!target || !target.checked) return false;
  if (!fieldset || !fieldset.contains || !fieldset.contains(target)) return false;
  var name = trimText(target.name || "");
  var checkedCount = 0;
  var radios = collectAshbyRadiosInFieldset(fieldset);
  for (var i = 0; i < radios.length; i += 1) {
    var radio = radios[i];
    if (name && trimText(radio.name || "") !== name) continue;
    if (radio.checked) checkedCount += 1;
  }
  return checkedCount === 1 && Boolean(target.checked);
}

function logAshbyYesNoDiagnostics(diagnostics) {
  try {
    console.info("[Impulso Ashby Yes/No]", diagnostics);
  } catch (_) {}
}

function fillAshbyYesNoRadioGroup(fieldset, radios, answer, meta) {
  var info = meta || {};
  var questionText = trimText(info.questionText || "");
  var category = trimText(info.category || "");
  var scoped = collectAshbyRadiosInFieldset(fieldset);
  if (!scoped.length && radios && radios.length) {
    scoped = (radios || []).filter(function (r) {
      return fieldset && fieldset.contains(r);
    });
  }
  var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

  function fail(reason, matchedInfo) {
    var diagnostics = {
      question: questionText,
      category: category,
      proposedAnswer: trimText(answer),
      optionTexts: optionTexts,
      matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
      radioNames: scoped
        .map(function (r) {
          return trimText(r.name || "");
        })
        .filter(Boolean)
        .filter(function (n, i, arr) {
          return arr.indexOf(n) === i;
        }),
      checkedAfter: scoped.map(function (r) {
        return {
          label: getAshbyOptionVisibleText(r),
          checked: Boolean(r.checked)
        };
      }),
      reason: reason
    };
    logAshbyYesNoDiagnostics(diagnostics);
    return {
      ok: false,
      status: "failed",
      reason: reason,
      category: category,
      question: questionText
    };
  }

  if (!fieldset) {
    return fail("Ashby Yes/No fieldset not found.");
  }
  if (!scoped.length) {
    return fail("Ashby Yes/No radio group not found.");
  }
  if (!isExactYesNoOnlyGroup(scoped)) {
    return {
      ok: false,
      status: "skipped",
      reason: "Not an exact Yes/No radio group.",
      category: category,
      question: questionText
    };
  }
  if (isCitizenshipOrExportControlQuestion(questionText)) {
    return {
      ok: false,
      status: "skipped",
      reason: "Citizenship/export-control questions are not filled yet.",
      category: category,
      question: questionText
    };
  }

  var matched = matchExactYesNoOption(scoped, answer);
  if (!matched || !matched.radio) {
    return fail("No exact Yes/No option matched the saved answer.");
  }
  if (!fieldset.contains(matched.radio)) {
    return fail("Matched option is outside the question fieldset.", matched);
  }
  if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
    return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
  }

  // React handles selection from the outer _option_ div.
  clickAshbyOptionWrapper(matched.optionWrapper);
  sleepSync(100);

  if (!matched.radio.checked) {
    try {
      if (typeof matched.radio.click === "function") matched.radio.click();
    } catch (_) {}
  }

  if (!matched.radio.checked) {
    setNativeRadioChecked(matched.radio, true);
    dispatchAshbyRadioInputChange(matched.radio);
  }

  sleepSync(150);

  if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
    return fail("Ashby Yes/No radio click did not persist.", matched);
  }

  return {
    ok: true,
    status: "filled",
    reason: "",
    category: category,
    question: questionText
  };
}

function fillAshbyYesNoRadios(root, inventory) {
  var empty = {
    results: [],
    summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
  };
  if (!isAshbyHost()) return empty;

  var doc = root || document;
  var inv = inventory || {};
  var results = [];
  var fieldsets = [];
  try {
    fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
  } catch (_) {
    return empty;
  }

  fieldsets.forEach(function (fieldset) {
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length) return;
    if (!isExactYesNoOnlyGroup(scoped)) return;

    var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
    if (isCitizenshipOrExportControlQuestion(questionText)) return;

    var detected = detectCategoryFromMeta({
      tagName: "input",
      inputType: "radio",
      type: "radio",
      label: questionText,
      ariaLabel: "",
      name: trimText((scoped[0] && scoped[0].name) || ""),
      id: "",
      nearby: "",
      autocomplete: "",
      optionLabels: scoped.map(getAshbyOptionVisibleText)
    });
    var category = detected.category || "unknown";
    if (!ASHBY_YES_NO_CATEGORIES[category]) return;

    var answer = yesNoAnswerForCategory(category, inv);
    if (!answer) {
      results.push({
        category: category,
        label: questionText,
        question: questionText,
        status: "skipped",
        reason: "No saved Yes/No answer for this category.",
        ok: false,
        value: ""
      });
      return;
    }

    var fillResult = fillAshbyYesNoRadioGroup(fieldset, scoped, answer, {
      questionText: questionText,
      category: category
    });
    results.push({
      category: category,
      label: questionText,
      question: questionText,
      status: fillResult.status,
      reason: fillResult.reason || "",
      ok: Boolean(fillResult.ok),
      value: fillResult.ok ? answer : ""
    });
  });

  return {
    results: results,
    summary: {
      attempted: results.length,
      filled: results.filter(function (r) {
        return r.status === "filled";
      }).length,
      skipped: results.filter(function (r) {
        return r.status === "skipped";
      }).length,
      failed: results.filter(function (r) {
        return r.status === "failed";
      }).length
    }
  };
}


function mapSavedGenderToAshbyOption(savedGender) {
  var text = normalizeText(savedGender);
  if (!text) return "";
  if (text === "man" || text === "male") return "Male";
  if (text === "woman" || text === "female") return "Female";
  if (
    text === "prefer not to answer" ||
    text === "prefer not to say" ||
    text === "decline to self-identify"
  ) {
    return "Decline to self-identify";
  }
  // Never guess or infer gender (including Non-binary / Self-describe).
  return "";
}

function matchAshbyGenderOption(radios, targetOptionText) {
  var want = normalizeText(targetOptionText);
  if (!want) return null;
  for (var i = 0; i < (radios || []).length; i += 1) {
    var optionText = getAshbyOptionVisibleText(radios[i]);
    if (normalizeText(optionText) === want) {
      return {
        radio: radios[i],
        optionWrapper: getAshbyOptionWrapper(radios[i]),
        optionText: optionText
      };
    }
  }
  return null;
}

function logAshbyGenderDiagnostics(diagnostics) {
  try {
    console.info("[Impulso Ashby Gender]", diagnostics);
  } catch (_) {}
}

function fillAshbyGenderRadioGroup(fieldset, radios, targetOptionText, meta) {
  var info = meta || {};
  var questionText = trimText(info.questionText || "");
  var scoped = collectAshbyRadiosInFieldset(fieldset);
  if (!scoped.length && radios && radios.length) {
    scoped = (radios || []).filter(function (r) {
      return fieldset && fieldset.contains(r);
    });
  }
  var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

  function fail(reason, matchedInfo) {
    var diagnostics = {
      question: questionText,
      category: "gender",
      proposedAnswer: trimText(info.savedGender || ""),
      mappedOption: trimText(targetOptionText),
      optionTexts: optionTexts,
      matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
      checkedAfter: scoped.map(function (r) {
        return {
          label: getAshbyOptionVisibleText(r),
          checked: Boolean(r.checked)
        };
      }),
      reason: reason
    };
    logAshbyGenderDiagnostics(diagnostics);
    return {
      ok: false,
      status: "failed",
      reason: reason,
      category: "gender",
      question: questionText
    };
  }

  if (!fieldset) return fail("Ashby gender fieldset not found.");
  if (!scoped.length) return fail("Ashby gender radio group not found.");

  var matched = matchAshbyGenderOption(scoped, targetOptionText);
  if (!matched || !matched.radio) {
    return fail("No exact gender option matched the saved answer.");
  }
  if (!fieldset.contains(matched.radio)) {
    return fail("Matched gender option is outside the question fieldset.", matched);
  }
  if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
    return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
  }

  clickAshbyOptionWrapper(matched.optionWrapper);
  sleepSync(100);

  if (!matched.radio.checked) {
    try {
      if (typeof matched.radio.click === "function") matched.radio.click();
    } catch (_) {}
  }

  if (!matched.radio.checked) {
    setNativeRadioChecked(matched.radio, true);
    dispatchAshbyRadioInputChange(matched.radio);
  }

  sleepSync(150);

  if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
    return fail("Ashby gender radio click did not persist.", matched);
  }

  return {
    ok: true,
    status: "filled",
    reason: "",
    category: "gender",
    question: questionText
  };
}

function fillAshbyGenderRadios(root, inventory, options) {
  var empty = {
    results: [],
    summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
  };
  var opts = options || {};
  if (!isAshbyHost()) return empty;
  if (!opts.fillDemographics) return empty;

  var savedGender = trimText((inventory && inventory.gender) || "");
  if (!savedGender) return empty;

  var targetOption = mapSavedGenderToAshbyOption(savedGender);
  if (!targetOption) {
    return {
      results: [
        {
          category: "gender",
          label: "Gender",
          question: "Gender",
          status: "skipped",
          reason: "Saved gender has no exact Ashby option mapping.",
          ok: false,
          value: ""
        }
      ],
      summary: { attempted: 1, filled: 0, skipped: 1, failed: 0 }
    };
  }

  var doc = root || document;
  var results = [];
  var fieldsets = [];
  try {
    fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
  } catch (_) {
    return empty;
  }

  fieldsets.forEach(function (fieldset) {
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length) return;
    // Leave Yes/No work-auth/sponsorship groups to the existing Ashby Yes/No filler.
    if (isExactYesNoOnlyGroup(scoped)) return;

    var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
    var optionLabels = scoped.map(getAshbyOptionVisibleText);
    var detected = detectCategoryFromMeta({
      tagName: "input",
      inputType: "radio",
      type: "radio",
      label: questionText,
      ariaLabel: "",
      name: trimText((scoped[0] && scoped[0].name) || ""),
      id: "",
      nearby: "",
      autocomplete: "",
      optionLabels: optionLabels
    });
    var category = detected.category || "unknown";
    // Gender only — race/disability handled separately; veteran has its own filler.
    if (category !== "gender") return;

    var fillResult = fillAshbyGenderRadioGroup(fieldset, scoped, targetOption, {
      questionText: questionText,
      savedGender: savedGender
    });
    results.push({
      category: "gender",
      label: questionText,
      question: questionText,
      status: fillResult.status,
      reason: fillResult.reason || "",
      ok: Boolean(fillResult.ok),
      value: fillResult.ok ? targetOption : ""
    });
  });

  return {
    results: results,
    summary: {
      attempted: results.length,
      filled: results.filter(function (r) {
        return r.status === "filled";
      }).length,
      skipped: results.filter(function (r) {
        return r.status === "skipped";
      }).length,
      failed: results.filter(function (r) {
        return r.status === "failed";
      }).length
    }
  };
}

function normalizeVeteranText(value) {
  return normalizeText(value)
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function veteranAliasGroup(value) {
  var text = normalizeVeteranText(value);
  if (!text) return "";
  if (
    text === "prefer not to answer" ||
    text === "prefer not to say" ||
    text === "prefer not to disclose" ||
    text === "decline to self-identify" ||
    text === "i don't wish to answer" ||
    text === "i do not wish to answer" ||
    text === "i do not want to answer"
  ) {
    return "decline";
  }
  if (
    text === "not a veteran" ||
    text === "i am not a protected veteran" ||
    text === "i am not a veteran" ||
    text === "no i am not a protected veteran"
  ) {
    return "not_protected";
  }
  if (
    text === "protected veteran" ||
    text === "i identify as one or more classifications of protected veteran" ||
    text === "i identify as a protected veteran" ||
    text.indexOf("one or more classifications of protected veteran") !== -1
  ) {
    return "protected";
  }
  return "";
}

function matchAshbyVeteranOption(radios, savedValue) {
  var savedNorm = normalizeVeteranText(savedValue);
  if (!savedNorm) return null;
  var list = radios || [];

  // Prefer exact normalized text match before aliases.
  for (var i = 0; i < list.length; i += 1) {
    var exactText = getAshbyOptionVisibleText(list[i]);
    if (normalizeVeteranText(exactText) === savedNorm) {
      return {
        radio: list[i],
        optionWrapper: getAshbyOptionWrapper(list[i]),
        optionText: exactText
      };
    }
  }

  var savedGroup = veteranAliasGroup(savedValue);
  if (!savedGroup) return null;

  for (var j = 0; j < list.length; j += 1) {
    var optionText = getAshbyOptionVisibleText(list[j]);
    if (veteranAliasGroup(optionText) === savedGroup) {
      return {
        radio: list[j],
        optionWrapper: getAshbyOptionWrapper(list[j]),
        optionText: optionText
      };
    }
  }
  return null;
}

function looksLikeVeteranQuestion(questionText, optionLabels) {
  var blob = normalizeText(
    [questionText || ""].concat(optionLabels || []).join(" ")
  );
  return /\bveteran\b/.test(blob) || /\bprotected\s+veteran\b/.test(blob);
}

function logAshbyVeteranDiagnostics(diagnostics) {
  try {
    console.info("[Impulso Ashby Veteran]", diagnostics);
  } catch (_) {}
}

function fillAshbyVeteranRadioGroup(fieldset, radios, savedValue, meta) {
  var info = meta || {};
  var questionText = trimText(info.questionText || "");
  var scoped = collectAshbyRadiosInFieldset(fieldset);
  if (!scoped.length && radios && radios.length) {
    scoped = (radios || []).filter(function (r) {
      return fieldset && fieldset.contains(r);
    });
  }
  var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

  function fail(reason, matchedInfo) {
    var diagnostics = {
      question: questionText,
      category: "veteran_status",
      proposedAnswer: trimText(savedValue),
      optionTexts: optionTexts,
      matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
      checkedAfter: scoped.map(function (r) {
        return {
          label: getAshbyOptionVisibleText(r),
          checked: Boolean(r.checked)
        };
      }),
      reason: reason
    };
    logAshbyVeteranDiagnostics(diagnostics);
    return {
      ok: false,
      status: "failed",
      reason: reason,
      category: "veteran_status",
      question: questionText
    };
  }

  if (!fieldset) return fail("Ashby veteran fieldset not found.");
  if (!scoped.length) return fail("Ashby veteran radio group not found.");

  var matched = matchAshbyVeteranOption(scoped, savedValue);
  if (!matched || !matched.radio) {
    return fail("No veteran option matched the saved answer.");
  }
  if (!fieldset.contains(matched.radio)) {
    return fail("Matched veteran option is outside the question fieldset.", matched);
  }
  if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
    return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
  }

  clickAshbyOptionWrapper(matched.optionWrapper);
  sleepSync(100);

  if (!matched.radio.checked) {
    try {
      if (typeof matched.radio.click === "function") matched.radio.click();
    } catch (_) {}
  }

  if (!matched.radio.checked) {
    setNativeRadioChecked(matched.radio, true);
    dispatchAshbyRadioInputChange(matched.radio);
  }

  sleepSync(150);

  if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
    return fail("Ashby veteran radio click did not persist.", matched);
  }

  return {
    ok: true,
    status: "filled",
    reason: "",
    category: "veteran_status",
    question: questionText,
    value: matched.optionText || ""
  };
}

function fillAshbyVeteranRadios(root, inventory) {
  var empty = {
    results: [],
    summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
  };
  if (!isAshbyHost()) return empty;

  var savedVeteran = trimText((inventory && inventory.veteran_status) || "");
  // Skip silently when no saved veteran answer exists.
  if (!savedVeteran) return empty;

  var doc = root || document;
  var results = [];
  var fieldsets = [];
  try {
    fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
  } catch (_) {
    return empty;
  }

  fieldsets.forEach(function (fieldset) {
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length) return;
    if (isExactYesNoOnlyGroup(scoped)) return;

    var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
    var optionLabels = scoped.map(getAshbyOptionVisibleText);
    if (!looksLikeVeteranQuestion(questionText, optionLabels)) return;

    var detected = detectCategoryFromMeta({
      tagName: "input",
      inputType: "radio",
      type: "radio",
      label: questionText,
      ariaLabel: "",
      name: trimText((scoped[0] && scoped[0].name) || ""),
      id: "",
      nearby: "",
      autocomplete: "",
      optionLabels: optionLabels
    });
    var category = detected.category || "unknown";
    // Veteran status only — do not process race, disability, or gender here.
    if (category === "race_ethnicity" || category === "disability_status" || category === "gender") {
      return;
    }
    if (category !== "veteran_status" && !looksLikeVeteranQuestion(questionText, optionLabels)) {
      return;
    }

    var fillResult = fillAshbyVeteranRadioGroup(fieldset, scoped, savedVeteran, {
      questionText: questionText
    });
    results.push({
      category: "veteran_status",
      label: questionText,
      question: questionText,
      status: fillResult.status,
      reason: fillResult.reason || "",
      ok: Boolean(fillResult.ok),
      value: fillResult.ok ? fillResult.value || savedVeteran : ""
    });
  });

  return {
    results: results,
    summary: {
      attempted: results.length,
      filled: results.filter(function (r) {
        return r.status === "filled";
      }).length,
      skipped: results.filter(function (r) {
        return r.status === "skipped";
      }).length,
      failed: results.filter(function (r) {
        return r.status === "failed";
      }).length
    }
  };
}

function normalizeDisabilityText(value) {
  var text = String(value == null ? "" : value);
  // Normalize curly and straight apostrophes before other cleanup.
  text = text.replace(/[\u2018\u2019\u02BC\u2032`]/g, "'");
  text = text.toLowerCase();
  text = text.replace(/\s+/g, " ").trim();
  // Remove commas and periods for comparison only.
  text = text.replace(/[,.]/g, "");
  // Treat "don't" and "do not" as equivalent.
  text = text.replace(/\bdon't\b/g, "do not");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function disabilityAliasGroup(value) {
  var text = normalizeDisabilityText(value);
  if (!text) return "";

  // Exact canonical forms only — no broad substring matching.
  if (
    text === "prefer not to answer" ||
    text === "decline to self-identify" ||
    text === "i do not want to answer"
  ) {
    return "decline";
  }
  if (
    text === "yes i have a disability" ||
    text === "yes i have a disability or have had one in the past"
  ) {
    return "yes";
  }
  if (
    text === "no i do not have a disability" ||
    text === "no i do not have a disability and have not had one in the past"
  ) {
    return "no";
  }
  return "";
}

function matchAshbyDisabilityOption(radios, savedValue) {
  var savedNorm = normalizeDisabilityText(savedValue);
  if (!savedNorm) return null;
  var list = radios || [];

  // Prefer exact normalized text match before aliases.
  for (var i = 0; i < list.length; i += 1) {
    var exactText = getAshbyOptionVisibleText(list[i]);
    if (normalizeDisabilityText(exactText) === savedNorm) {
      return {
        radio: list[i],
        optionWrapper: getAshbyOptionWrapper(list[i]),
        optionText: exactText
      };
    }
  }

  var savedGroup = disabilityAliasGroup(savedValue);
  if (!savedGroup) return null;

  for (var j = 0; j < list.length; j += 1) {
    var optionText = getAshbyOptionVisibleText(list[j]);
    if (disabilityAliasGroup(optionText) === savedGroup) {
      return {
        radio: list[j],
        optionWrapper: getAshbyOptionWrapper(list[j]),
        optionText: optionText
      };
    }
  }
  return null;
}

function resolveSavedDisabilityStatus(inventory, options) {
  var opts = options || {};
  var inv = inventory || {};
  var demo = opts.demographics || (opts.profile && opts.profile.demographics) || {};
  return trimText(
    inv.disability_status ||
      inv.disabilityStatus ||
      inv["disability status"] ||
      demo.disabilityStatus ||
      demo.disability_status ||
      demo["disability status"] ||
      ""
  );
}

function logAshbyDisabilityError(reason) {
  try {
    console.error("[Impulso Ashby Disability]", reason);
  } catch (_) {}
}

function applyAshbyDisabilityFallbackClick(radio, optionWrapper) {
  // Existing verified Ashby path used by gender/veteran/Yes-No.
  clickAshbyOptionWrapper(optionWrapper);
  sleepSync(100);
  if (!radio.checked) {
    try {
      if (typeof radio.click === "function") radio.click();
    } catch (_) {}
  }
  if (!radio.checked) {
    setNativeRadioChecked(radio, true);
    dispatchAshbyRadioInputChange(radio);
  }
  sleepSync(150);
}

function fillAshbyDisabilityRadios(root, inventory, options) {
  var empty = {
    results: [],
    summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
  };
  if (!isAshbyHost()) return empty;

  var savedDisability = resolveSavedDisabilityStatus(inventory, options || {});
  // Skip silently when no saved disability answer exists.
  if (!savedDisability) return empty;

  var doc = root || document;
  var fieldset = null;
  try {
    fieldset = Array.prototype.slice
      .call(doc.querySelectorAll("fieldset"))
      .find(function (fs) {
        return /disability status/i.test((fs && fs.innerText) || "");
      });
  } catch (_) {
    fieldset = null;
  }

  if (!fieldset) {
    logAshbyDisabilityError("Disability fieldset not found.");
    return {
      results: [
        {
          category: "disability_status",
          label: "Disability status",
          question: "Disability status",
          status: "failed",
          reason: "Disability fieldset not found.",
          ok: false,
          value: ""
        }
      ],
      summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
    };
  }

  var radios = [];
  try {
    radios = Array.prototype.slice.call(fieldset.querySelectorAll('input[type="radio"]'));
  } catch (_) {
    radios = [];
  }

  var questionText = "Disability status";
  try {
    var legend = fieldset.querySelector && fieldset.querySelector("legend");
    var legendText = legend ? trimText(legend.innerText || legend.textContent || "") : "";
    if (legendText) questionText = legendText;
  } catch (_) {}

  var matched = matchAshbyDisabilityOption(radios, savedDisability);
  if (!matched || !matched.radio) {
    logAshbyDisabilityError("No disability option matched the saved answer.");
    return {
      results: [
        {
          category: "disability_status",
          label: questionText,
          question: questionText,
          status: "failed",
          reason: "No disability option matched the saved answer.",
          ok: false,
          value: ""
        }
      ],
      summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
    };
  }

  var radio = matched.radio;
  var wrapper = radio.closest ? radio.closest('div[class*="_option_"]') : null;
  if (!wrapper) {
    logAshbyDisabilityError("Ashby disability option wrapper not found.");
    return {
      results: [
        {
          category: "disability_status",
          label: questionText,
          question: questionText,
          status: "failed",
          reason: "Ashby disability option wrapper not found.",
          ok: false,
          value: ""
        }
      ],
      summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
    };
  }

  // Exact console-verified approach first.
  try {
    wrapper.click();
  } catch (_) {}
  sleepSync(300);

  if (radio.checked !== true) {
    applyAshbyDisabilityFallbackClick(radio, wrapper);
  }

  if (radio.checked !== true) {
    logAshbyDisabilityError("Disability radio selection did not persist.");
    return {
      results: [
        {
          category: "disability_status",
          label: questionText,
          question: questionText,
          status: "failed",
          reason: "Disability radio selection did not persist.",
          ok: false,
          value: ""
        }
      ],
      summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
    };
  }

  return {
    results: [
      {
        category: "disability_status",
        label: questionText,
        question: questionText,
        status: "filled",
        reason: "",
        ok: true,
        value: matched.optionText || savedDisability
      }
    ],
    summary: { attempted: 1, filled: 1, skipped: 0, failed: 0 }
  };
}

function canonicalizeRaceOptionText(value) {
  var text = String(value == null ? "" : value);
  // Drop explanatory text after " - " / en-dash / em-dash.
  text = text.split(/\s+[-–—]\s+/)[0] || text;
  // Drop the Ashby EEOC parenthetical suffix (and any other parentheticals).
  text = text.replace(/\s*\(\s*Not\s+Hispanic\s+or\s+Latino\s*\)/gi, "");
  text = text.replace(/\s*\([^)]*\)/g, "");
  // Case-insensitive, punctuation-insensitive, collapse whitespace.
  text = text.toLowerCase();
  text = text.replace(/[^\w\s]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function raceDeclineCanonical(value) {
  var text = canonicalizeRaceOptionText(value);
  if (text === "prefer not to answer" || text === "decline to self identify") {
    return "decline to self identify";
  }
  return text;
}

function matchAshbyRaceEthnicityOption(inputs, savedValue) {
  var savedCanon = raceDeclineCanonical(savedValue);
  if (!savedCanon) return null;
  var list = inputs || [];

  // Exact canonical equality only — no broad substring matching.
  for (var i = 0; i < list.length; i += 1) {
    var optionText = getAshbyOptionVisibleText(list[i]);
    if (raceDeclineCanonical(optionText) === savedCanon) {
      return {
        input: list[i],
        radio: list[i],
        optionText: optionText,
        primaryLabel: optionText,
        canonical: savedCanon
      };
    }
  }
  return null;
}

function resolveSavedRaceEthnicity(inventory, options) {
  var opts = options || {};
  var inv = inventory || {};
  var demo = opts.demographics || (opts.profile && opts.profile.demographics) || {};
  return trimText(
    inv.race_ethnicity ||
      inv.raceEthnicity ||
      inv["race ethnicity"] ||
      demo.raceEthnicity ||
      demo.race_ethnicity ||
      demo["race ethnicity"] ||
      ""
  );
}

function findAshbyEeocRaceRadioGroup(doc) {
  var root = doc || document;
  var allRadios = [];
  try {
    allRadios = Array.prototype.slice.call(root.querySelectorAll('input[type="radio"]'));
  } catch (_) {
    return { name: "", radios: [] };
  }

  var seed = null;
  for (var i = 0; i < allRadios.length; i += 1) {
    var name = String((allRadios[i] && allRadios[i].name) || "");
    if (/systemfield_eeoc_race/i.test(name)) {
      seed = allRadios[i];
      break;
    }
  }
  if (!seed) return { name: "", radios: [] };

  var groupName = String(seed.name || "");
  var radios = allRadios.filter(function (radio) {
    return radio && String(radio.name || "") === groupName;
  });
  return { name: groupName, radios: radios };
}

function logAshbyRaceMatchFailure(savedValue, inputs) {
  var visible = (inputs || []).map(getAshbyOptionVisibleText);
  try {
    console.info("[Impulso Ashby Race/Ethnicity]", {
      savedValue: trimText(savedValue),
      canonicalSavedValue: raceDeclineCanonical(savedValue),
      visibleOptions: visible,
      canonicalVisibleOptions: visible.map(raceDeclineCanonical)
    });
  } catch (_) {}
}

function verifyAshbyEeocRaceSelection(target, groupRadios) {
  if (!target || target.checked !== true) return false;
  var name = String(target.name || "");
  var checkedCount = 0;
  var list = groupRadios || [];
  for (var i = 0; i < list.length; i += 1) {
    var radio = list[i];
    if (!radio) continue;
    if (name && String(radio.name || "") !== name) continue;
    if (radio.checked) checkedCount += 1;
  }
  return checkedCount === 1 && target.checked === true;
}

function canonicalizeAshbyRaceValue(value) {
  return raceDeclineCanonical(value);
}

/**
 * Build a Race autofill report from the MAIN-world selection result.
 * Race is counted filled only when result.success is true.
 */
function raceReportFromMainWorldResult(mainResult) {
  var result = mainResult || {};
  if (result.success) {
    return {
      results: [
        {
          category: "race_ethnicity",
          label: "Race",
          question: "Race",
          status: "filled",
          reason: "",
          ok: true,
          value: trimText(result.selectedText || "")
        }
      ],
      summary: { attempted: 1, filled: 1, skipped: 0, failed: 0 }
    };
  }

  var reason = trimText(result.reason || "Race selection failed.");
  return {
    results: [
      {
        category: "race_ethnicity",
        label: "Race",
        question: "Race",
        status: "failed",
        reason: reason,
        ok: false,
        value: ""
      }
    ],
    summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
  };
}

function prepareAshbyRaceEthnicity(inventory, options) {
  var empty = {
    shouldFill: false,
    canonicalRaceValue: "",
    savedRace: ""
  };
  if (!isAshbyHost()) return empty;

  var savedRace = resolveSavedRaceEthnicity(inventory, options || {});
  // Skip silently when no saved race/ethnicity answer exists.
  if (!savedRace) return empty;

  var canonicalRaceValue = canonicalizeAshbyRaceValue(savedRace);
  if (!canonicalRaceValue) return empty;

  return {
    shouldFill: true,
    canonicalRaceValue: canonicalRaceValue,
    savedRace: savedRace
  };
}

// Legacy sync entry point retained for API stability; Race selection runs in MAIN world.
function fillAshbyRaceEthnicity(root, inventory, options) {
  var prepared = prepareAshbyRaceEthnicity(inventory, options || {});
  if (!prepared.shouldFill) {
    return {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
  }
  return {
    results: [],
    summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 },
    pendingMainWorld: true,
    canonicalRaceValue: prepared.canonicalRaceValue
  };
}

function resolveSavedExportControlStatus(inventory, options) {
  var opts = options || {};
  var inv = inventory || {};
  var work =
    opts.workAuthorization ||
    (opts.profile && opts.profile.workAuthorization) ||
    {};
  return trimText(
    inv.export_control_status ||
      inv.exportControlStatus ||
      work.exportControlStatus ||
      work.export_control_status ||
      ""
  );
}

function prepareAshbyExportControl(inventory, options) {
  var empty = {
    shouldFill: false,
    savedValue: ""
  };
  if (!isAshbyHost()) return empty;

  var savedValue = resolveSavedExportControlStatus(inventory, options || {});
  // Skip silently when the user has not explicitly saved a value.
  // Never infer from work auth, sponsorship, visa, citizenship, or resume.
  if (!savedValue) return empty;

  return {
    shouldFill: true,
    savedValue: savedValue
  };
}

function exportControlReportFromMainWorldResult(mainResult) {
  var result = mainResult || {};
  if (result.success) {
    return {
      results: [
        {
          category: "export_control_status",
          label: "Export control / U.S. person status",
          question: "Export control / U.S. person status",
          status: "filled",
          reason: "",
          ok: true,
          value: trimText(result.selectedText || "")
        }
      ],
      summary: { attempted: 1, filled: 1, skipped: 0, failed: 0 }
    };
  }

  return {
    results: [
      {
        category: "export_control_status",
        label: "Export control / U.S. person status",
        question: "Export control / U.S. person status",
        status: "failed",
        reason: trimText(result.reason || "Export-control selection failed."),
        ok: false,
        value: ""
      }
    ],
    summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
  };
}

  var ASHBY_RACE_MAIN_TYPE = "IMPULSO_ASHBY_RACE_MAIN";
  var ASHBY_EXPORT_CONTROL_MAIN_TYPE = "IMPULSO_ASHBY_EXPORT_CONTROL_MAIN";

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
    var prepared = prepareAshbyRaceEthnicity(inventory || {}, {
      demographics: (options && options.demographics) || null,
      profile: (options && options.profile) || null
    });
    if (!prepared || !prepared.shouldFill) {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var mainResult = await requestAshbyRaceMainWorld(prepared.canonicalRaceValue, tabId);
    return raceReportFromMainWorldResult(mainResult);
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
    var prepared = prepareAshbyExportControl(inventory || {}, {
      workAuthorization: (options && options.workAuthorization) || null,
      profile: (options && options.profile) || null
    });
    if (!prepared || !prepared.shouldFill) {
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
      };
    }

    var mainResult = await requestAshbyExportControlMainWorld(prepared.savedValue, tabId);
    return exportControlReportFromMainWorldResult(mainResult);
  }

  async function fillSupportedFields(context) {
    var ctx = context || {};
    var root = ctx.root || document;
    var inventory = ctx.inventory || {};
    var empty = { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } };
    if (!isAshbyHost()) return empty;
    var report = empty;
    function merge(a, b) {
      if (window.ImpulsoAutofill && typeof window.ImpulsoAutofill.mergeAutofillReports === "function") {
        return window.ImpulsoAutofill.mergeAutofillReports(a, b);
      }
      var results = (a.results || []).concat((b && b.results) || []);
      return {
        results: results,
        summary: {
          attempted: results.length,
          filled: results.filter(function (r) { return r.status === "filled"; }).length,
          skipped: results.filter(function (r) { return r.status === "skipped"; }).length,
          failed: results.filter(function (r) { return r.status === "failed"; }).length
        }
      };
    }
    report = merge(report, fillAshbyYesNoRadios(root, inventory));
    report = merge(report, fillAshbyGenderRadios(root, inventory, {
      fillDemographics: ctx.fillDemographics !== false
    }));
    report = merge(report, fillAshbyVeteranRadios(root, inventory));
    report = merge(report, fillAshbyDisabilityRadios(root, inventory, {
      demographics: ctx.demographics || null,
      profile: ctx.profile || null
    }));
    report = merge(report, await fillAshbyRaceViaMainWorld(inventory, {
      demographics: ctx.demographics || null,
      profile: ctx.profile || null
    }, ctx.tabId));
    report = merge(report, await fillAshbyExportControlViaMainWorld(inventory, {
      workAuthorization: ctx.workAuthorization || null,
      profile: ctx.profile || null
    }, ctx.tabId));
    return report;
  }

  function normalizeOptionText(value) {
    if (value && value.nodeType === 1) {
      return getAshbyOptionVisibleText(value);
    }
    return trimText(value);
  }

  function verifyField(container, target, groupRadios) {
    if (groupRadios) return verifyAshbyEeocRaceSelection(target, groupRadios);
    return verifyAshbyYesNoSelection(container, target);
  }

  global.ImpulsoAshbyAdapter = {
    isSupportedPage: isAshbyHost,
    fillSupportedFields: fillSupportedFields,
    verifyField: verifyField,
    normalizeOptionText: normalizeOptionText,
    fillAshbyYesNoRadios: fillAshbyYesNoRadios,
    fillAshbyGenderRadios: fillAshbyGenderRadios,
    fillAshbyVeteranRadios: fillAshbyVeteranRadios,
    fillAshbyDisabilityRadios: fillAshbyDisabilityRadios,
    prepareAshbyRaceEthnicity: prepareAshbyRaceEthnicity,
    prepareAshbyExportControl: prepareAshbyExportControl,
    raceReportFromMainWorldResult: raceReportFromMainWorldResult,
    exportControlReportFromMainWorldResult: exportControlReportFromMainWorldResult,
    matchAshbyRaceEthnicityOption: matchAshbyRaceEthnicityOption,
    matchAshbyVeteranOption: matchAshbyVeteranOption,
    matchAshbyDisabilityOption: matchAshbyDisabilityOption,
    mapSavedGenderToAshbyOption: mapSavedGenderToAshbyOption,
    canonicalizeAshbyRaceValue: canonicalizeAshbyRaceValue,
    ASHBY_YES_NO_CATEGORIES: ASHBY_YES_NO_CATEGORIES
  };
})(typeof window !== "undefined" ? window : self);
