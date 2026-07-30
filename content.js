(function () {
  function findLabelText(input) {
    if (window.ImpulsoAutofill && typeof window.ImpulsoAutofill.findLabelText === "function") {
      return window.ImpulsoAutofill.findLabelText(input);
    }
    if (input.id) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) return label.innerText;
    }
    var parentLabel = input.closest("label");
    return parentLabel ? parentLabel.innerText : "";
  }

  function getIdentityBlob(input) {
    if (window.ImpulsoAutofill && typeof window.ImpulsoAutofill.getFieldIdentity === "function") {
      var identity = window.ImpulsoAutofill.getFieldIdentity(input);
      return String(identity.blob || "").toLowerCase();
    }
    var nameAttr = (input.name || "").toLowerCase();
    var idAttr = (input.id || "").toLowerCase();
    var placeholderAttr = (input.placeholder || "").toLowerCase();
    var labelText = findLabelText(input).toLowerCase();
    return (nameAttr + " " + idAttr + " " + placeholderAttr + " " + labelText).trim();
  }

  chrome.storage.local.get(
    ["firstName", "lastName", "email", "github", "linkedin", "resumeBase64", "resumeName"],
    function (data) {
      if (!data.firstName) return;

      var inputs = document.querySelectorAll("input, textarea");

      inputs.forEach(function (input) {
        if (input.type === "file") return;

        var identity = getIdentityBlob(input);

        if (/\bpreferred\b/.test(identity) && /\bname\b/.test(identity)) {
          fillReactInput(input, data.firstName);
        } else if (/\bfirst\s*name\b/.test(identity) || (/\bfirst\b/.test(identity) && /\bname\b/.test(identity))) {
          if (/\bpreferred\b/.test(identity) || /\bemployer\b/.test(identity) || /\bcompany\b/.test(identity)) {
            return;
          }
          fillReactInput(input, data.firstName);
        } else if (/\blast\s*name\b/.test(identity) || (/\blast\b/.test(identity) && /\bname\b/.test(identity))) {
          fillReactInput(input, data.lastName);
        } else if (/\be-?mail\b/.test(identity)) {
          fillReactInput(input, data.email);
        } else if (/\bgithub\b/.test(identity)) {
          fillReactInput(input, data.github);
        } else if (/\blinkedin\b/.test(identity)) {
          fillReactInput(input, data.linkedin);
        }
      });

      if (data.resumeBase64 && data.resumeName) {
        document.querySelectorAll('input[type="file"]').forEach(function (fileInput) {
          var identity = getIdentityBlob(fileInput);
          if (
            (/\bresume\b/.test(identity) || /\bcv\b/.test(identity)) &&
            !/\bcover\b/.test(identity) &&
            !/\bletter\b/.test(identity)
          ) {
            uploadFileToInput(fileInput, data.resumeBase64, data.resumeName);
          }
        });
      }
    }
  );

  function fillReactInput(targetElement, value) {
    if (!targetElement || targetElement.value === value) return;
    var valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    var prototype = Object.getPrototypeOf(targetElement);
    var prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value");

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
      var arr = base64Data.split(",");
      var mime = arr[0].match(/:(.*?);/)[1];
      var bstr = atob(arr[1]);
      var n = bstr.length;
      var u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      var fileBlob = new Blob([u8arr], { type: mime });
      var file = new File([fileBlob], filename, { type: mime });

      var dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
      console.error("File input error:", err);
    }
  }
})();
