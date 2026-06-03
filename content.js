(function() {
  chrome.storage.local.get(['firstName', 'lastName', 'email', 'github', 'linkedin', 'resumeBase64', 'resumeName'], (data) => {
    if (!data.firstName) return;

    const inputs = document.querySelectorAll("input, textarea");

    inputs.forEach((input) => {
      if (input.type === "file") return;

      const nameAttr = (input.name || "").toLowerCase();
      const idAttr = (input.id || "").toLowerCase();
      const placeholderAttr = (input.placeholder || "").toLowerCase();
      const labelText = findLabelText(input).toLowerCase();
      const identity = `${nameAttr} ${idAttr} ${placeholderAttr} ${labelText}`;

      // Tight match handling to prevent bleedover
      if (identity.includes("preferred") && (identity.includes("first name") || identity.includes("name"))) {
        fillReactInput(input, data.firstName); // Fill preferred first name if asked
      } else if (identity.includes("first name") || (identity.includes("first") && identity.includes("name"))) {
        fillReactInput(input, data.firstName);
      } else if (identity.includes("last name") || (identity.includes("last") && identity.includes("name"))) {
        fillReactInput(input, data.lastName);
      } else if (identity.includes("email") || identity.includes("e-mail")) {
        fillReactInput(input, data.email);
      } else if (identity.includes("github") || identity.includes("git")) {
        fillReactInput(input, data.github);
      } else if (identity.includes("linkedin")) {
        fillReactInput(input, data.linkedin);
      }
    });

    // Handle file input cleanly
    if (data.resumeBase64 && data.resumeName) {
      document.querySelectorAll('input[type="file"]').forEach((fileInput) => {
        const identity = `${fileInput.name} ${fileInput.id} ${findLabelText(fileInput)}`.toLowerCase();

        // ONLY match if it indicates resume/cv and explicitly lacks "cover" or "letter"
        if ((identity.includes("resume") || identity.includes("cv")) && !identity.includes("cover") && !identity.includes("letter")) {
          uploadFileToInput(fileInput, data.resumeBase64, data.resumeName);
        }
      });
    }
  });

  function findLabelText(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.innerText;
    }
    const parentLabel = input.closest("label");
    return parentLabel ? parentLabel.innerText : "";
  }

  function fillReactInput(targetElement, value) {
    if (!targetElement || targetElement.value === value) return;
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    const prototype = Object.getPrototypeOf(targetElement);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value");

    if (valueSetter && valueSetter.set !== prototypeValueSetter.set) {
      prototypeValueSetter.set.call(targetElement, value);
    } else if (valueSetter) {
      valueSetter.set.call(targetElement, value);
    } else {
      targetElement.value = value;
    }
    targetElement.dispatchEvent(new Event("input", { bubbles: true }));
    targetElement.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function uploadFileToInput(inputElement, base64Data, filename) {
    try {
      const arr = base64Data.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) { u8arr[n] = bstr.charCodeAt(n); }
      const fileBlob = new Blob([u8arr], { type: mime });
      const file = new File([fileBlob], filename, { type: mime });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.error("File input error:", err);
    }
  }
})();


// Add to the bottom of content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_JOB_DESCRIPTION") {
    // Look for standard high-probability description blocks used across Greenhouse, Lever, Workday
    const selectors = [
      '[class*="description"]', 
      '[id*="description"]', 
      '#job-details', 
      '.job-body',
      'article'
    ];
    
    let foundText = "";
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim().length > 200) {
        foundText = el.innerText;
        break;
      }
    }

    // Fallback: If layout is non-standard, grab main text content body
    if (!foundText) {
      foundText = document.body.innerText;
    }

    sendResponse({ text: foundText });
  }
  return true;
});