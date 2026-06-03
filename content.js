(function() {
  chrome.storage.local.get(['fullName', 'email', 'github', 'linkedin'], (data) => {
    if (!data.fullName) {
      console.log("BrandResume: No profile data found. Please set it up in the extension popup.");
      return;
    }

    const inputs = document.querySelectorAll("input, textarea");

    inputs.forEach((input) => {
      const nameAttr = (input.name || "").toLowerCase();
      const idAttr = (input.id || "").toLowerCase();
      const placeholderAttr = (input.placeholder || "").toLowerCase();
      const labelText = findLabelText(input);
      
      const identityString = `${nameAttr} ${idAttr} ${placeholderAttr} ${labelText}`.toLowerCase();

      if (identityString.includes("first name") || identityString.includes("last name") || identityString.includes("full name") || identityString.includes("name")) {
        fillReactInput(input, data.fullName);
      } else if (identityString.includes("email") || identityString.includes("e-mail")) {
        fillReactInput(input, data.email);
      } else if (identityString.includes("github") || identityString.includes("git")) {
        fillReactInput(input, data.github);
      } else if (identityString.includes("linkedin")) {
        fillReactInput(input, data.linkedin);
      }
    });
  });

  // Helper to extract text from associated labels
  function findLabelText(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.innerText;
    }
    const parentLabel = input.closest("label");
    if (parentLabel) return parentLabel.innerText;
    return "";
  }

  // React state bypass engine
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
})();