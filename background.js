// Allow the sidepanel to pop open cleanly when clicking the extension toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting sidepanel behavior:", error));

var ASHBY_RACE_MAIN_TYPE = "IMPULSO_ASHBY_RACE_MAIN";

/**
 * Runs in the webpage MAIN world so Ashby/React handlers update state.
 * Must stay self-contained (no extension globals).
 * @param {string} canonicalRaceValue
 * @returns {Promise<{success: boolean, selectedText: string, reason: string}>}
 */
async function fillAshbyRaceInMainWorld(canonicalRaceValue) {
  function canonicalize(value) {
    var text = String(value == null ? "" : value);
    text = text.split(/\s+[-–—]\s+/)[0] || text;
    text = text.replace(/\s*\(\s*Not\s+Hispanic\s+or\s+Latino\s*\)/gi, "");
    text = text.replace(/\s*\([^)]*\)/g, "");
    text = text.toLowerCase();
    text = text.replace(/[^\w\s]/g, " ");
    text = text.replace(/\s+/g, " ").trim();
    if (text === "prefer not to answer" || text === "decline to self identify") {
      return "decline to self identify";
    }
    return text;
  }

  function optionText(radio) {
    try {
      var wrapper = radio && radio.closest ? radio.closest('div[class*="_option_"]') : null;
      return String((wrapper && wrapper.innerText) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function getReactProps(el) {
    if (!el) return null;
    try {
      var reactKey = Object.keys(el).find(function (key) {
        return key.indexOf("__reactProps$") === 0;
      });
      return reactKey ? el[reactKey] : null;
    } catch (_) {
      return null;
    }
  }

  function buildReactChangeEvent(radio) {
    return {
      target: {
        ...radio,
        checked: true,
        value: radio.value,
        name: radio.name
      },
      currentTarget: radio,
      type: "change",
      preventDefault() {},
      stopPropagation() {}
    };
  }

  function buildReactClickEvent(radio) {
    return {
      target: {
        ...radio,
        checked: true,
        value: radio.value,
        name: radio.name
      },
      currentTarget: radio,
      type: "click",
      preventDefault() {},
      stopPropagation() {}
    };
  }

  function selectionPersists(matched, radios, want) {
    if (!matched || matched.checked !== true) return false;
    var checkedCount = 0;
    var checkedRadio = null;
    for (var i = 0; i < radios.length; i += 1) {
      if (radios[i] && radios[i].checked) {
        checkedCount += 1;
        checkedRadio = radios[i];
      }
    }
    if (checkedCount !== 1) return false;
    return canonicalize(optionText(checkedRadio)) === want;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  var want = canonicalize(canonicalRaceValue);
  if (!want) {
    return { success: false, selectedText: "", reason: "No race value provided." };
  }

  var allRadios = Array.prototype.slice.call(
    document.querySelectorAll('input[type="radio"]')
  );
  var seed = null;
  for (var i = 0; i < allRadios.length; i += 1) {
    if (/systemfield_eeoc_race/i.test(String((allRadios[i] && allRadios[i].name) || ""))) {
      seed = allRadios[i];
      break;
    }
  }
  if (!seed) {
    return { success: false, selectedText: "", reason: "Race radio group not found." };
  }

  var groupName = String(seed.name || "");
  var radios = allRadios.filter(function (radio) {
    return radio && String(radio.name || "") === groupName;
  });

  var matched = null;
  var matchedVisible = "";
  for (var j = 0; j < radios.length; j += 1) {
    var visible = optionText(radios[j]);
    if (canonicalize(visible) === want) {
      matched = radios[j];
      matchedVisible = visible;
      break;
    }
  }
  if (!matched) {
    return { success: false, selectedText: "", reason: "No matching race option." };
  }

  var props = getReactProps(matched);
  var wrapper = null;
  try {
    wrapper = matched.closest('div[class*="_option_"]');
  } catch (_) {
    wrapper = null;
  }
  var wrapperProps = getReactProps(wrapper);

  // 1) Preferred: React onChange on the radio (or its option wrapper).
  var onChange =
    props && typeof props.onChange === "function"
      ? props.onChange
      : wrapperProps && typeof wrapperProps.onChange === "function"
        ? wrapperProps.onChange
        : null;
  if (onChange) {
    try {
      onChange(buildReactChangeEvent(matched));
    } catch (_) {}
    await sleep(80);
  }

  // 2) React onClick fallback when onChange did not persist.
  if (!selectionPersists(matched, radios, want)) {
    var onClick =
      props && typeof props.onClick === "function"
        ? props.onClick
        : wrapperProps && typeof wrapperProps.onClick === "function"
          ? wrapperProps.onClick
          : null;
    if (onClick) {
      try {
        onClick(buildReactClickEvent(matched));
      } catch (_) {}
      await sleep(80);
    }
  }

  // 3) Native checked setter fallback.
  if (!selectionPersists(matched, radios, want)) {
    try {
      var setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked"
      ).set;
      setter.call(matched, true);
      matched.dispatchEvent(
        new Event("input", {
          bubbles: true,
          composed: true
        })
      );
      matched.dispatchEvent(
        new Event("change", {
          bubbles: true,
          composed: true
        })
      );
    } catch (_) {}
    await sleep(80);
  }

  // 4) Normal click fallbacks.
  if (!selectionPersists(matched, radios, want)) {
    try {
      if (wrapper && typeof wrapper.click === "function") wrapper.click();
    } catch (_) {}
    try {
      if (typeof matched.click === "function") matched.click();
    } catch (_) {}
  }

  await sleep(500);

  var checkedVisible = "";
  for (var k = 0; k < radios.length; k += 1) {
    if (radios[k] && radios[k].checked) {
      checkedVisible = optionText(radios[k]);
      break;
    }
  }

  if (!selectionPersists(matched, radios, want)) {
    return {
      success: false,
      selectedText: checkedVisible || "",
      reason: "Race selection did not persist."
    };
  }

  return {
    success: true,
    selectedText: matchedVisible || checkedVisible || "",
    reason: ""
  };
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== ASHBY_RACE_MAIN_TYPE) return;

  var tabId =
    typeof message.tabId === "number" && message.tabId > 0
      ? message.tabId
      : sender && sender.tab && typeof sender.tab.id === "number"
        ? sender.tab.id
        : null;
  var canonicalRaceValue = String(message.canonicalRaceValue || "").trim();

  if (!tabId) {
    sendResponse({
      success: false,
      selectedText: "",
      reason: "Active tab unavailable."
    });
    return;
  }

  chrome.scripting
    .executeScript({
      target: { tabId: tabId },
      world: "MAIN",
      func: fillAshbyRaceInMainWorld,
      args: [canonicalRaceValue]
    })
    .then(function (injection) {
      var result =
        injection && injection[0] && injection[0].result
          ? injection[0].result
          : null;
      if (!result || typeof result !== "object") {
        sendResponse({
          success: false,
          selectedText: "",
          reason: "Race selection returned no result."
        });
        return;
      }
      sendResponse({
        success: Boolean(result.success),
        selectedText: String(result.selectedText || ""),
        reason: String(result.reason || "")
      });
    })
    .catch(function () {
      sendResponse({
        success: false,
        selectedText: "",
        reason: "Race selection failed."
      });
    });

  return true;
});
