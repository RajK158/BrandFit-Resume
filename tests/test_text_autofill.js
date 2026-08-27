"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function createDomHarness() {
  function NodeList(items) {
    this.length = items.length;
    items.forEach((item, i) => {
      this[i] = item;
    });
  }
  NodeList.prototype.forEach = Array.prototype.forEach;

  function El(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.id = "";
    this.name = "";
    this.type = tag === "textarea" ? "textarea" : "text";
    this.value = "";
    this.placeholder = "";
    this.parentElement = null;
    this.isContentEditable = false;
    this.multiple = false;
    this._text = "";
    this.ownerDocument = null;
  }

  El.prototype.getAttribute = function (name) {
    if (name === "class") return this.className;
    if (name === "contenteditable") return this.isContentEditable ? "true" : null;
    return this.attributes[name] != null ? this.attributes[name] : null;
  };
  El.prototype.setAttribute = function (name, value) {
    if (name === "class") this.className = String(value);
    else this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "name") this.name = String(value);
    if (name === "type") this.type = String(value);
    if (name === "placeholder") this.placeholder = String(value);
    if (name === "contenteditable") this.isContentEditable = String(value) === "true";
  };
  El.prototype.appendChild = function (child) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  };
  El.prototype.closest = function (selector) {
    let node = this;
    while (node) {
      if (selector === "label" && node.tagName === "LABEL") return node;
      node = node.parentElement;
    }
    return null;
  };
  El.prototype.querySelector = function (selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  El.prototype.querySelectorAll = function (selector) {
    const out = [];
    const walk = (node) => {
      (node.children || []).forEach((child) => {
        const tag = (child.tagName || "").toLowerCase();
        if (/^h[1-6]$/.test(selector) && tag === selector) out.push(child);
        if (selector === "label" && tag === "label") out.push(child);
        if (selector.indexOf(",") !== -1) {
          selector.split(",").map((s) => s.trim()).forEach((part) => {
            if (part === tag) out.push(child);
            if (part.charAt(0) === "." && String(child.className).indexOf(part.slice(1)) !== -1) {
              out.push(child);
            }
          });
        }
        walk(child);
      });
    };
    walk(this);
    return new NodeList(out);
  };
  El.prototype.dispatchEvent = function () {
    return true;
  };
  El.prototype.focus = function () {};
  Object.defineProperty(El.prototype, "previousElementSibling", {
    get() {
      if (!this.parentElement) return null;
      const kids = this.parentElement.children || [];
      const idx = kids.indexOf(this);
      return idx > 0 ? kids[idx - 1] : null;
    }
  });
  Object.defineProperty(El.prototype, "nextElementSibling", {
    get() {
      if (!this.parentElement) return null;
      const kids = this.parentElement.children || [];
      const idx = kids.indexOf(this);
      return idx >= 0 && idx + 1 < kids.length ? kids[idx + 1] : null;
    }
  });
  Object.defineProperty(El.prototype, "innerText", {
    get() {
      if (this._text) return this._text;
      return this.children.map((c) => c.innerText || c.value || "").join(" ");
    },
    set(v) {
      this._text = String(v || "");
    }
  });
  Object.defineProperty(El.prototype, "textContent", {
    get() {
      return this.innerText;
    },
    set(v) {
      this.innerText = v;
    }
  });

  function Document() {
    this.body = new El("body");
    this.body.ownerDocument = this;
    this.title = "";
    this.location = { href: "https://example.com/apply" };
    this._byId = {};
  }
  Document.prototype.createElement = function (tag) {
    const el = new El(tag);
    el.ownerDocument = this;
    return el;
  };
  Document.prototype.getElementById = function (id) {
    return this._byId[id] || null;
  };
  Document.prototype.querySelector = function (selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  Document.prototype.querySelectorAll = function (selector) {
    const out = [];
    const walk = (node) => {
      if (!node) return;
      const tag = (node.tagName || "").toLowerCase();
      if (selector === "label" && tag === "label") out.push(node);
      if (selector === "input, textarea, [contenteditable='true'], [contenteditable='']") {
        if (tag === "input" || tag === "textarea" || node.isContentEditable) out.push(node);
      }
      if (selector.indexOf('label[for="') === 0) {
        const id = selector.slice('label[for="'.length, -2);
        if (tag === "label" && node.getAttribute("for") === id) out.push(node);
      }
      if (selector === "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='combobox'], [role='listbox'], [role='textbox'], [role='radio'], [role='checkbox']") {
        if (tag === "input" || tag === "textarea" || tag === "select" || node.isContentEditable) {
          out.push(node);
        }
      }
      (node.children || []).forEach(walk);
    };
    walk(this.body);
    return new NodeList(out);
  };

  const doc = new Document();

  function addField(labelText, tag, type, id) {
    const wrap = doc.createElement("div");
    const label = doc.createElement("label");
    label.setAttribute("for", id);
    label.innerText = labelText;
    const input = doc.createElement(tag);
    if (tag === "input") {
      input.type = type || "text";
      input.setAttribute("type", type || "text");
    }
    input.id = id;
    input.setAttribute("id", id);
    input.name = id;
    input.setAttribute("name", id);
    wrap.appendChild(label);
    wrap.appendChild(input);
    doc.body.appendChild(wrap);
    doc._byId[id] = input;
    return input;
  }

  return { doc, addField, El };
}

const { doc, addField, El } = createDomHarness();

const inputProto = El.prototype;
const textareaProto = El.prototype;

const sandbox = {
  console,
  document: doc,
  window: {
    document: doc,
    HTMLInputElement: { prototype: inputProto },
    HTMLTextAreaElement: { prototype: textareaProto },
    Event: function Event() {},
    FocusEvent: function FocusEvent() {},
    InputEvent: function InputEvent() {}
  },
  self: null,
  Event: function Event() {},
  FocusEvent: function FocusEvent() {},
  InputEvent: function InputEvent() {},
  CSS: { escape: (v) => String(v).replace(/"/g, '\\"') },
  Object,
  Array,
  String,
  Boolean,
  Number,
  Math,
  Date,
  RegExp,
  JSON,
  Error
};
sandbox.window.window = sandbox.window;
sandbox.self = sandbox.window;
sandbox.global = sandbox.window;

const autofillPath = path.join(__dirname, "..", "autofill.js");
const code = fs.readFileSync(autofillPath, "utf8");

try {
  vm.runInNewContext(code, sandbox, { filename: "autofill.js" });
} catch (error) {
  console.error("Failed to load autofill.js:", error);
  process.exit(1);
}

const AF = sandbox.window.ImpulsoAutofill || sandbox.ImpulsoAutofill;
assert.ok(AF, "ImpulsoAutofill should load");

const profile = {
  personal: {
    firstName: "Alex",
    lastName: "Morgan",
    preferredName: "Alex",
    email: "alex.morgan@example.com",
    phone: "555-0100"
  },
  links: {
    linkedin: "https://linkedin.com/in/alex-morgan",
    github: "https://github.com/alex-morgan",
    portfolio: "https://alex-morgan.example.com"
  },
  commonAnswers: {
    projectHighlight: "Built Impulso autofill for ATS forms.",
    referralSource: "LinkedIn",
    defaultCoverLetter: "I am excited to apply.",
    linkedinMessageOrAdditionalInfo: "Happy to share more details."
  }
};

const inventory = AF.buildAnswerInventory(profile);
assert.strictEqual(inventory.full_name, "Alex Morgan");
assert.strictEqual(inventory.preferred_name, "Alex");
assert.strictEqual(inventory.email, "alex.morgan@example.com");
assert.strictEqual(inventory.phone, "555-0100");
assert.strictEqual(inventory.portfolio, "https://alex-morgan.example.com");
assert.strictEqual(AF.getTextAnswerForCategory("full_name", inventory), "Alex Morgan");
assert.strictEqual(AF.getTextAnswerForCategory("preferred_name", inventory), "Alex");
assert.strictEqual(AF.getTextAnswerForCategory("phone", inventory), "555-0100");
assert.strictEqual(AF.getTextAnswerForCategory("portfolio", inventory), "https://alex-morgan.example.com");
assert.strictEqual(
  AF.getTextAnswerForCategory("project_highlight", inventory),
  "Built Impulso autofill for ATS forms."
);
assert.strictEqual(AF.getTextAnswerForCategory("referral_source", inventory), "LinkedIn");
assert.notStrictEqual(
  AF.getTextAnswerForCategory("project_highlight", inventory),
  inventory.portfolio
);
assert.strictEqual(
  AF.getTextAnswerForCategory("full_name", { first_name: "Alex", last_name: "", full_name: "Alex" }),
  ""
);
console.log("ok - inventory mappings for generic profile");

assert.strictEqual(AF.classifyLabel("Legal Name (First Name Last Name)", "text").category, "full_name");
assert.strictEqual(AF.classifyLabel("Preferred Name", "text").category, "preferred_name");
assert.strictEqual(AF.classifyLabel("Email", "email").category, "email");
assert.strictEqual(AF.classifyLabel("Phone Number", "tel").category, "phone");
assert.strictEqual(AF.classifyLabel("Phone Number", "text").category, "phone");
assert.strictEqual(AF.classifyLabel("Website / Portfolio", "url").category, "portfolio");
assert.strictEqual(AF.classifyLabel("How did you hear about this job?", "text").category, "referral_source");
assert.strictEqual(
  AF.classifyLabel("Tell us about a project you are proud of", "textarea").category,
  "project_highlight"
);
console.log("ok - text field classification");

const legal = addField("Legal Name (First Name Last Name)", "input", "text", "legalName");
const preferred = addField("Preferred Name", "input", "text", "preferredName");
const email = addField("Email", "input", "email", "email");
const phone = addField("Phone Number", "input", "tel", "phone");
const portfolio = addField("Website / Portfolio", "input", "url", "portfolio");

const report = AF.fillBasicTextFields(doc, inventory);
assert.ok(report && report.summary, "fill report");

assert.strictEqual(legal.value, "Alex Morgan", "Legal Name -> Alex Morgan");
assert.strictEqual(preferred.value, "Alex", "Preferred Name -> Alex");
assert.strictEqual(email.value, "alex.morgan@example.com", "Email -> alex.morgan@example.com");
assert.strictEqual(phone.value, "555-0100", "Phone Number -> saved phone");
assert.strictEqual(portfolio.value, "https://alex-morgan.example.com", "Website/Portfolio -> saved portfolio URL");
console.log("ok - Legal Name -> Alex Morgan");
console.log("ok - Preferred Name -> Alex");
console.log("ok - Email -> alex.morgan@example.com");
console.log("ok - Phone Number -> saved phone");
console.log("ok - Website/Portfolio -> saved portfolio URL");

legal.value = "Already Set";
const again = AF.fillTextElement(legal, "Alex Morgan");
assert.strictEqual(again.status, "skipped");
assert.strictEqual(legal.value, "Already Set");
console.log("ok - never overwrite non-empty field");

const emptyFill = AF.fillTextElement(phone, "");
assert.strictEqual(emptyFill.status, "skipped");
console.log("ok - empty answer is skipped");

assert.strictEqual(AF.getTextAnswerForCategory("phone", { email: "x@y.com", phone: "" }), "");
assert.strictEqual(AF.classifyLabel("Contact", "email").category, "email");
assert.strictEqual(AF.classifyLabel("Contact", "tel").category, "phone");
console.log("ok - email/tel type precedence");

assert.ok(report.summary.filled >= 5, "expected at least 5 filled text fields, got " + report.summary.filled);
console.log("All text autofill tests passed.");
