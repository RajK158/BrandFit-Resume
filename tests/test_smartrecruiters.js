"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadScript(relPath) {
  const file = path.join(__dirname, "..", relPath);
  const sandbox = { console: console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.URL = URL;
  sandbox.atob = atob;
  sandbox.Uint8Array = Uint8Array;
  sandbox.File = File;
  sandbox.Blob = Blob;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: relPath });
  return sandbox;
}

const adapterSandbox = loadScript("autofill/adapters/smartrecruiters.js");
const SR = adapterSandbox.ImpulsoSmartRecruitersAdapter;
assert.ok(SR, "ImpulsoSmartRecruitersAdapter should load");

assert.strictEqual(
  SR.isSmartRecruitersApplicationUrl(
    "https://jobs.smartrecruiters.com/oneclick-ui/company/acme/publication/abc",
    "jobs.smartrecruiters.com",
    "/oneclick-ui/company/acme/publication/abc"
  ),
  true
);
assert.strictEqual(
  SR.isSmartRecruitersApplicationUrl(
    "https://jobs.smartrecruiters.com/Acme/job-title",
    "jobs.smartrecruiters.com",
    "/Acme/job-title"
  ),
  false
);
assert.strictEqual(
  SR.isSmartRecruitersApplicationUrl(
    "https://boards.greenhouse.io/oneclick-ui/company/acme",
    "boards.greenhouse.io",
    "/oneclick-ui/company/acme"
  ),
  false
);
assert.strictEqual(SR.isSmartRecruitersHost("jobs.smartrecruiters.com"), true);
assert.strictEqual(SR.isSmartRecruitersHost("www.jobs.smartrecruiters.com"), true);
assert.strictEqual(SR.isSmartRecruitersHost("careers.example.com"), false);
assert.strictEqual(
  SR.isSmartRecruitersApplicationUrl(
    "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
    "jobs.smartrecruiters.com",
    "/oneclick-ui/company/Socotec/publication/abc/screening"
  ),
  true
);
assert.strictEqual(
  SR.isSmartRecruitersScreeningUrl(
    "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
    "jobs.smartrecruiters.com",
    "/oneclick-ui/company/Socotec/publication/abc/screening"
  ),
  true
);
assert.strictEqual(
  SR.isSmartRecruitersScreeningUrl(
    "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    "jobs.smartrecruiters.com",
    "/oneclick-ui/company/Socotec/publication/abc"
  ),
  false
);
console.log("ok - SmartRecruiters application URL detection");

const autofillSandbox = loadScript("autofill.js");
const AF = autofillSandbox.ImpulsoAutofill;
assert.ok(AF, "ImpulsoAutofill should load");
assert.strictEqual(
  AF.isSmartRecruitersApplicationUrl(
    "https://jobs.smartrecruiters.com/oneclick-ui/company/other-co/publication/xyz"
  ),
  true
);
assert.strictEqual(
  AF.classifyLabel("Confirm your email", "email").category,
  "email"
);
assert.strictEqual(AF.classifyLabel("First name", "text").category, "first_name");
assert.strictEqual(AF.classifyLabel("Last name", "text").category, "last_name");
assert.strictEqual(AF.classifyLabel("City", "text").category, "city");
assert.strictEqual(AF.classifyLabel("LinkedIn", "url").category, "linkedin");
assert.strictEqual(AF.classifyLabel("GitHub", "url").category, "github");
assert.strictEqual(AF.classifyLabel("Website", "url").category, "portfolio");
assert.strictEqual(AF.classifyLabel("Resume", "file").category, "resume_upload");
assert.strictEqual(
  AF.classifyLabel("Message to hiring manager", "textarea").category,
  "additional_information"
);
assert.strictEqual(
  AF.classifyLabel("Are you authorized to work in the United States?", "radio").category,
  "work_authorization"
);
assert.strictEqual(
  AF.classifyLabel(
    "This position requires in-office attendance at the location listed in the job description. Are you willing to relocate or are you within a commutable distance?",
    "radio"
  ).category,
  "relocation"
);
assert.strictEqual(
  AF.classifyLabel(
    "Do you now, or will you in the future, require immigration sponsorship for work authorization?",
    "radio"
  ).category,
  "sponsorship_now"
);
assert.strictEqual(
  AF.classifyLabel(
    "Do you have (or have a history/record of having) a disability? (definitions)",
    "radio"
  ).category,
  "disability_status"
);
assert.strictEqual(
  AF.classifyLabel("Are you a protected veteran? (definitions)", "radio").category,
  "veteran_status"
);
console.log("ok - SmartRecruiters first-page field classification");

assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome("Afghanistan +93"), true);
assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome("Search by country/region or code"), true);
assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome("United States +1"), true);
assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome("Phone number"), false);
assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome("City"), false);
assert.strictEqual(AF.looksLikeSmartRecruitersCountryChrome(""), false);
console.log("ok - SmartRecruiters phone-country chrome detection");

assert.strictEqual(SR.nationalPhoneNumber("+1 (562) 391-4111", "1"), "5623914111");
assert.strictEqual(SR.nationalPhoneNumber("5623914111", "1"), "5623914111");
assert.strictEqual(SR.isUnitedStatesCountryOption("United States +1"), true);
assert.strictEqual(SR.isUnitedStatesCountryOption("Canada +1"), false);
assert.strictEqual(SR.isFillableCategory("first_name"), true);
assert.strictEqual(SR.isFillableCategory("email"), true);
assert.strictEqual(SR.isFillableCategory("unknown"), false);
assert.strictEqual(SR.isFillableCategory("country"), false);
assert.strictEqual(SR.isFillableCategory("work_authorization"), true);
assert.strictEqual(SR.isFillableCategory("sponsorship_now"), true);
assert.strictEqual(SR.isFillableCategory("relocation"), true);
assert.strictEqual(SR.isFillableCategory("disability_status"), true);
assert.strictEqual(SR.isFillableCategory("veteran_status"), true);
assert.strictEqual(SR.isFillableCategory("gender"), true);
assert.strictEqual(SR.isFillableCategory("race_ethnicity"), true);
assert.strictEqual(SR.isFillableCategory("referral_source"), true);
assert.strictEqual(SR.isFillableCategory("privacy_consent"), true);

const emailLive = {
  id: "email",
  name: "email",
  label: "email",
  ariaLabel: "",
  placeholder: "",
  inputType: "email",
  category: "email"
};
assert.ok(
  SR.scoreLiveFieldMatch(
    { id: "email", name: "email", label: "Email", inputType: "email", category: "email" },
    emailLive
  ) >= 40
);
assert.ok(
  SR.scoreLiveFieldMatch(
    { id: "", name: "", label: "Confirm email", inputType: "email", category: "email" },
    emailLive
  ) <
    SR.scoreLiveFieldMatch(
      { id: "", name: "", label: "Email", inputType: "email", category: "email" },
      emailLive
    )
);
console.log("ok - SmartRecruiters phone/national number and live-field matching");

assert.strictEqual(SR.citySuggestionMatches("Long Beach, California", "Long Beach, CA"), true);
assert.strictEqual(SR.citySuggestionMatches("Long Beach, CA, USA", "Long Beach, CA"), true);
assert.strictEqual(SR.citySuggestionMatches("Long Beach, CA, US", "Long Beach, CA"), true);
assert.strictEqual(SR.citySuggestionMatches("Long Beach, California, USA", "Long Beach, CA"), true);
assert.strictEqual(SR.citySuggestionMatches("Long Beach, New York, USA", "Long Beach, CA"), false);
assert.ok(SR.pickCitySuggestion(
  [
    { label: "Long Beach, New York, USA" },
    { label: "Long Beach, California, USA" }
  ],
  "Long Beach, CA"
));
assert.strictEqual(
  SR.pickCitySuggestion(
    [
      { label: "Long Beach, New York, USA" },
      { label: "Long Beach, California, USA" }
    ],
    "Long Beach, CA"
  ).label,
  "Long Beach, California, USA"
);
assert.strictEqual(
  SR.pickCitySuggestion(
    [
      { label: "Cannot find your city? Click here to fill in manually" },
      { label: "Long Beach, CA, US" }
    ],
    "Long Beach, CA"
  ).label,
  "Long Beach, CA, US"
);
assert.strictEqual(SR.parseCityQuery("Long Beach, California, USA").region, "california");
console.log("ok - SmartRecruiters city suggestion matching");

(function testDeepestCityClickTarget() {
  function node(tag, host) {
    return {
      tagName: tag,
      parentElement: null,
      shadowRoot: null,
      _host: host || null,
      getRootNode: function () {
        return { host: this._host || null };
      }
    };
  }
  var innerDiv = node("DIV");
  var tooltip = node("SPL-TOOLTIP");
  var option = node("SPL-SELECT-OPTION");
  innerDiv._host = tooltip;
  tooltip._host = option;
  tooltip.shadowRoot = {
    elementFromPoint: function () {
      return innerDiv;
    }
  };
  option.shadowRoot = {
    elementFromPoint: function () {
      return tooltip;
    }
  };
  var doc = {
    elementFromPoint: function () {
      return option;
    }
  };
  var deep = SR.deepestElementFromPoint(12, 8, doc);
  assert.strictEqual(deep, innerDiv);
  assert.strictEqual(SR.isInComposedTree(innerDiv, option), true);
  assert.strictEqual(SR.isInComposedTree(innerDiv, tooltip), true);
})();
console.log("ok - SmartRecruiters city deepest elementFromPoint click target");

assert.strictEqual(
  SR.TOP_RESUME_DROPZONE_SELECTOR,
  'spl-dropzone[data-test="apply-with-resume-container"]'
);
assert.strictEqual(SR.TOP_RESUME_FILE_INPUT_SELECTOR, 'input#file-input[type="file"]');
const pdfPayload = SR.fileFromResumePayload({
  resumeBase64: "data:application/pdf;base64,JVBERi0=",
  resumeName: "Raj Kundur Resume.pdf"
});
assert.ok(pdfPayload.file);
assert.strictEqual(pdfPayload.file.name, "Raj Kundur Resume.pdf");
assert.strictEqual(pdfPayload.file.type, "application/pdf");
const docxPayload = SR.fileFromResumePayload({
  resumeBase64: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEs=",
  resumeName: "resume.docx",
  resumeMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
});
assert.ok(docxPayload.file);
assert.strictEqual(docxPayload.file.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
assert.strictEqual(SR.fileFromResumePayload({}).error, "No resume file is available to upload.");
assert.strictEqual(
  SR.ATTACHED_RESUME_DROPZONE_SELECTOR,
  "oc-resume-upload spl-dropzone"
);
assert.strictEqual(SR.resumeBasename("RajKundur_SWE_2026.pdf"), "rajkundur_swe_2026.pdf");
assert.strictEqual(SR.filenamesMatch("RajKundur_SWE_2026.pdf", "RajKundur_SWE_2026.PDF"), true);
assert.strictEqual(SR.filenamesMatch("C:\\\\tmp\\\\RajKundur_SWE_2026.pdf", "rajkundur_swe_2026.pdf"), true);
assert.strictEqual(SR.filenamesMatch("other.pdf", "RajKundur_SWE_2026.pdf"), false);
console.log("ok - SmartRecruiters top resume parser payload and selectors");

assert.strictEqual(
  AF.looksLikeSmartRecruitersDropzoneChrome("Choose a file or drop it here"),
  true
);
assert.strictEqual(AF.looksLikeSmartRecruitersDropzoneChrome("Resume *"), false);

function createScanNode(tagName) {
  const node = {
    tagName: String(tagName || "DIV").toUpperCase(),
    children: [],
    parentElement: null,
    parentNode: null,
    attributes: {},
    shadowRoot: null,
    id: "",
    name: "",
    type: "",
    disabled: false,
    required: false,
    files: { length: 0 },
    value: "",
    ownerDocument: null,
    className: "",
    nodeType: 1,
    _text: "",
    _rootNode: null
  };
  node.getAttribute = function (name) {
    if (name === "id") return this.id || null;
    if (name === "name") return this.name || null;
    if (name === "type") return this.type || null;
    return this.attributes[name] != null ? this.attributes[name] : null;
  };
  node.setAttribute = function (name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "name") this.name = String(value);
    if (name === "type") this.type = String(value);
  };
  node.appendChild = function (child) {
    child.parentElement = this;
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument || this;
    this.children.push(child);
    return child;
  };
  node.contains = function (other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  node.closest = function (selector) {
    let cur = this;
    while (cur) {
      if (selector === "label" && (cur.tagName || "").toLowerCase() === "label") return cur;
      if (selector === "fieldset" && (cur.tagName || "").toLowerCase() === "fieldset") return cur;
      cur = cur.parentElement;
    }
    return null;
  };
  node.querySelector = function (selector) {
    const all = node.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  node.querySelectorAll = function (selector) {
    return queryAllFrom(this, selector);
  };
  node.getRootNode = function () {
    if (this._rootNode) return this._rootNode;
    let cur = this;
    while (cur.parentNode) cur = cur.parentNode;
    return cur.ownerDocument || cur;
  };
  node.getBoundingClientRect = function () {
    return { width: 24, height: 24, top: 0, left: 0, right: 24, bottom: 24 };
  };
  Object.defineProperty(node, "innerText", {
    get() {
      if (this._text) return this._text;
      return this.children.map((child) => child.innerText || "").join(" ");
    },
    set(value) {
      this._text = String(value || "");
    }
  });
  Object.defineProperty(node, "textContent", {
    get() {
      return this.innerText;
    },
    set(value) {
      this.innerText = value;
    }
  });
  Object.defineProperty(node, "previousElementSibling", {
    get() {
      if (!this.parentElement) return null;
      const kids = this.parentElement.children || [];
      const idx = kids.indexOf(this);
      return idx > 0 ? kids[idx - 1] : null;
    }
  });
  return node;
}

function allDescendants(root) {
  const out = [];
  function walk(node) {
    (node.children || []).forEach((child) => {
      out.push(child);
      walk(child);
    });
  }
  walk(root);
  return out;
}

function matchesCompound(el, part) {
  const sel = String(part || "").trim();
  if (!sel || sel === "*") return true;
  const tokens = sel.split(/\s+/);
  if (tokens.length > 1) {
    if (!matchesCompound(el, tokens[tokens.length - 1])) return false;
    let ancestor = el.parentElement;
    for (let i = tokens.length - 2; i >= 0; i -= 1) {
      while (ancestor && !matchesCompound(ancestor, tokens[i])) {
        ancestor = ancestor.parentElement;
      }
      if (!ancestor) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  }
  let rest = sel;
  const attrs = [];
  rest = rest.replace(/\[([^\]]+)\]/g, function (_, body) {
    attrs.push(body);
    return "";
  });
  let id = "";
  rest = rest.replace(/#([^\.#]+)/, function (_, value) {
    id = value;
    return "";
  });
  const tag = rest.toLowerCase();
  const elTag = (el.tagName || "").toLowerCase();
  if (tag && tag !== "*" && tag !== elTag) return false;
  if (id && el.id !== id) return false;
  return attrs.every(function (body) {
    const match = body.match(/^([\w-]+)(?:=["']([^"']+)["'])?$/);
    if (!match) return false;
    const actual = el.getAttribute(match[1]);
    if (match[2] == null) return actual != null && actual !== "";
    return actual === match[2];
  });
}

function queryAllFrom(root, selector) {
  const all = allDescendants(root);
  if (selector === "*") return all;
  const parts = String(selector || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return all.filter((el) => parts.some((part) => matchesCompound(el, part)));
}

function stampOwnerDocument(node, doc) {
  if (!node) return;
  node.ownerDocument = doc;
  if (node.shadowRoot) stampOwnerDocument(node.shadowRoot, doc);
  (node.children || []).forEach((child) => stampOwnerDocument(child, doc));
}

function attachShadow(host, children) {
  const shadow = {
    host: host,
    children: children || [],
    nodeType: 11,
    querySelector: function (selector) {
      const all = this.querySelectorAll(selector);
      return all.length ? all[0] : null;
    },
    querySelectorAll: function (selector) {
      return queryAllFrom(this, selector);
    }
  };
  children.forEach(function (child) {
    child.parentElement = null;
    child.parentNode = shadow;
    child._rootNode = shadow;
    child.ownerDocument = host.ownerDocument || host;
    function mark(node) {
      node._rootNode = shadow;
      node.ownerDocument = host.ownerDocument || host;
      (node.children || []).forEach(mark);
    }
    (child.children || []).forEach(mark);
  });
  host.shadowRoot = shadow;
  return shadow;
}

function buildSmartRecruitersResumeFixture(attachedName) {
  const doc = createScanNode("html");
  doc.nodeType = 9;
  doc.tagName = "#DOCUMENT";
  const html = createScanNode("html");
  const body = createScanNode("body");
  html.appendChild(body);
  doc.documentElement = html;
  doc.body = body;
  doc.children = [html];
  html.parentNode = doc;
  html.ownerDocument = doc;
  body.ownerDocument = doc;
  doc.querySelector = function (selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  doc.querySelectorAll = function (selector) {
    return queryAllFrom(html, selector);
  };
  doc.getElementById = function () {
    return null;
  };

  const topDropzone = createScanNode("spl-dropzone");
  topDropzone.setAttribute("data-test", "apply-with-resume-container");
  const topInput = createScanNode("input");
  topInput.setAttribute("id", "file-input");
  topInput.setAttribute("type", "file");
  topInput.type = "file";
  topInput.id = "file-input";
  attachShadow(topDropzone, [topInput]);
  body.appendChild(topDropzone);

  const fieldWrap = createScanNode("div");
  const resumeLabel = createScanNode("label");
  resumeLabel.innerText = "Resume *";
  const oc = createScanNode("oc-resume-upload");
  const appDropzone = createScanNode("spl-dropzone");
  const lowerInput = createScanNode("input");
  lowerInput.setAttribute("id", "file-input");
  lowerInput.setAttribute("type", "file");
  lowerInput.type = "file";
  lowerInput.id = "file-input";
  const list = createScanNode("ul");
  const item = createScanNode("li");
  const fileSpan = createScanNode("span");
  if (attachedName) fileSpan.innerText = attachedName;
  item.appendChild(fileSpan);
  list.appendChild(item);
  attachShadow(appDropzone, [lowerInput, list]);
  oc.appendChild(appDropzone);
  fieldWrap.appendChild(resumeLabel);
  fieldWrap.appendChild(oc);
  body.appendChild(fieldWrap);

  const facebook = createScanNode("input");
  facebook.type = "text";
  facebook.setAttribute("type", "text");
  facebook.setAttribute("aria-label", "Facebook");
  body.appendChild(facebook);
  const twitter = createScanNode("input");
  twitter.type = "text";
  twitter.setAttribute("type", "text");
  twitter.setAttribute("aria-label", "X / Twitter");
  body.appendChild(twitter);
  const hiring = appendHiringTeamMessage(body, "");

  return {
    doc: doc,
    topDropzone: topDropzone,
    topInput: topInput,
    lowerInput: lowerInput,
    facebook: facebook,
    twitter: twitter,
    hiring: hiring
  };
}

function appendHiringTeamMessage(body, currentValue) {
  const section = createScanNode("div");
  section.setAttribute("data-test", "hiring-manager-message-container");
  const title = createScanNode("h2");
  title.innerText = "Message to the Hiring Team";
  const oc = createScanNode("oc-textarea");
  oc.setAttribute("formcontrolname", "message");
  oc.setAttribute("data-test", "hiring-manager-message-text");
  const host = createScanNode("spl-textarea");
  host.id = "hiring-manager-message-input";
  host.setAttribute("id", "hiring-manager-message-input");
  host.setAttribute("label", "Let the company know about your interest working there");
  const textarea = createScanNode("textarea");
  textarea.id = "hiring-manager-message-input";
  textarea.type = "textarea";
  textarea.setAttribute("id", "hiring-manager-message-input");
  textarea.setAttribute("aria-required", "false");
  textarea.value = currentValue || "";
  attachShadow(host, [textarea]);
  oc.appendChild(host);
  section.appendChild(title);
  section.appendChild(oc);
  body.appendChild(section);
  return { section: section, host: host, textarea: textarea };
}

(function testSmartRecruitersResumeScanClassification() {
  const fixture = buildSmartRecruitersResumeFixture("RajKundur_SWE_2026.pdf");
  assert.strictEqual(AF.isSmartRecruitersTopResumeParserControl(fixture.topInput), true);
  assert.strictEqual(AF.isSmartRecruitersTopResumeParserControl(fixture.lowerInput), false);
  assert.ok(AF.findSmartRecruitersOcResumeUpload(fixture.lowerInput));
  assert.strictEqual(AF.findSmartRecruitersOcResumeUpload(fixture.topInput), null);
  assert.strictEqual(AF.findSmartRecruitersResumeQuestionLabel(fixture.lowerInput), "Resume *");
  const attached = AF.readSmartRecruitersAttachedResumeFilenames(fixture.lowerInput);
  assert.strictEqual(attached.length, 1);
  assert.strictEqual(attached[0], "RajKundur_SWE_2026.pdf");

  autofillSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/acme/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/acme/publication/abc"
  };
  autofillSandbox.document = fixture.doc;
  const context = AF.collectContext(fixture.lowerInput);
  assert.strictEqual(context.label, "Resume *");
  assert.strictEqual(AF.detectCategory(fixture.lowerInput, context, []).category, "resume_upload");

  const inventory = AF.buildAnswerInventory(
    { personal: { firstName: "Raj" } },
    { resumeName: "RajKundur_SWE_2026.pdf", hasResume: true }
  );
  const scan = AF.scanDocument(fixture.doc, inventory);
  const resumeFields = scan.fields.filter((field) => field.category === "resume_upload");
  const unknownLabels = scan.fields
    .filter((field) => field.category === "unknown")
    .map((field) => field.question || field.label || field.ariaLabel);
  assert.strictEqual(resumeFields.length, 1, "only the application resume should be scanned");
  assert.strictEqual(resumeFields[0].required, true);
  assert.strictEqual(resumeFields[0].fillStatus, "completed");
  assert.strictEqual(resumeFields[0].currentValue, "RajKundur_SWE_2026.pdf");
  assert.ok(
    !scan.fields.some((field) => /choose a file/i.test(field.question || field.label || "")),
    "top parser and dropzone chrome must not appear in scan"
  );
  assert.ok(unknownLabels.some((label) => /facebook/i.test(label)));
  assert.ok(unknownLabels.some((label) => /twitter|\bx\b/i.test(label)));
  assert.ok(!unknownLabels.some((label) => /hiring/i.test(label)));
  assert.strictEqual(unknownLabels.length, 2);
  const hiringFields = scan.fields.filter((field) => field.category === "additional_information");
  assert.strictEqual(hiringFields.length, 1);
  assert.strictEqual(hiringFields[0].required, false);
  assert.strictEqual(hiringFields[0].fillStatus, "missing");
  assert.ok(/message to the hiring team/i.test(hiringFields[0].question || hiringFields[0].label));
})();
console.log("ok - SmartRecruiters resume scan classification");

(function testSmartRecruitersResumeReadyWhenEmpty() {
  const fixture = buildSmartRecruitersResumeFixture("");
  autofillSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/acme/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/acme/publication/abc"
  };
  autofillSandbox.document = fixture.doc;
  const inventory = AF.buildAnswerInventory(
    { personal: { firstName: "Raj" } },
    { resumeName: "RajKundur_SWE_2026.pdf", hasResume: true }
  );
  const scan = AF.scanDocument(fixture.doc, inventory);
  const resumeFields = scan.fields.filter((field) => field.category === "resume_upload");
  assert.strictEqual(resumeFields.length, 1);
  assert.strictEqual(resumeFields[0].fillStatus, "ready");
  assert.strictEqual(resumeFields[0].required, true);
})();
console.log("ok - SmartRecruiters empty resume is ready to fill");

assert.strictEqual(SR.isFillableCategory("additional_information"), true);
assert.strictEqual(
  SR.looksLikeHiringTeamScanField({
    id: "hiring-manager-message-input",
    label: "Message to the Hiring Team",
    category: "additional_information"
  }),
  true
);
assert.strictEqual(
  SR.looksLikeHiringTeamScanField({
    id: "",
    label: "Facebook",
    category: "unknown"
  }),
  false
);

const SCREENING_QUESTIONS = [
  {
    id: "q-auth",
    type: "radio",
    label: "Are you authorized to work in the United States?",
    required: true,
    questionsFields: [
      { id: "a1", label: "Yes", fieldValue: "1" },
      { id: "a2", label: "No", fieldValue: "0" }
    ]
  },
  {
    id: "q-relo",
    type: "radio",
    label:
      "This position requires in-office attendance at the location listed in the job description. Are you willing to relocate or are you within a commutable distance?",
    required: true,
    questionsFields: [
      { id: "b1", label: "Yes", fieldValue: "1" },
      { id: "b2", label: "No", fieldValue: "0" }
    ]
  },
  {
    id: "q-sponsor",
    type: "radio",
    label:
      "Do you now, or will you in the future, require immigration sponsorship for work authorization?",
    required: true,
    questionsFields: [
      { id: "c1", label: "Yes", fieldValue: "1" },
      { id: "c2", label: "No", fieldValue: "0" }
    ]
  },
  {
    id: "q-disability",
    type: "radio",
    label: "Do you have (or have a history/record of having) a disability? (definitions)",
    required: true,
    diversity: true,
    questionsFields: [
      {
        id: "d1",
        label: "Yes, I have a disability, or have a history/record of having a disability",
        fieldValue: "1"
      },
      {
        id: "d2",
        label: "No, I don't have a disability, or a history/record of having a disability",
        fieldValue: "0"
      },
      { id: "d3", label: "I don't wish to answer", fieldValue: "9" }
    ]
  },
  {
    id: "q-veteran",
    type: "radio",
    label: "Are you a protected veteran? (definitions)",
    required: true,
    diversity: true,
    questionsFields: [
      { id: "v1", label: "I am a protected veteran", fieldValue: "1" },
      { id: "v2", label: "I am not a protected veteran", fieldValue: "0" },
      { id: "v3", label: "I don't wish to answer", fieldValue: "9" }
    ]
  }
];

const SCREENING_DEMOGRAPHIC_QUESTIONS = [
  {
    id: "q-gender",
    type: "autocomplete",
    label: "Gender",
    required: true,
    diversity: true,
    questionsFields: [
      { id: "g1", label: "Male", fieldValue: "0" },
      { id: "g2", label: "Female", fieldValue: "1" },
      { id: "g3", label: "Prefer not to answer", fieldValue: "2" }
    ]
  },
  {
    id: "q-ethnicity",
    type: "autocomplete",
    label: "Race/Ethnicity",
    required: true,
    diversity: true,
    questionsFields: [
      { id: "e1", label: "White", fieldValue: "0" },
      { id: "e2", label: "Asian", fieldValue: "2" },
      { id: "e3", label: "I don't wish to answer", fieldValue: "9" }
    ]
  }
];

const SCREENING_REFERRAL_QUESTION = {
  id: "q-referral",
  type: "text",
  label: "If you were referred by a current SOCOTEC employee, please list their name below.",
  required: false
};

const SCREENING_PRIVACY_LABEL =
  "You declare that you have read and agree to the privacy notice of SOCOTEC.";

const COMPLETE_SCREENING_QUESTIONS = SCREENING_QUESTIONS.slice(0, 3)
  .concat([SCREENING_REFERRAL_QUESTION])
  .concat(SCREENING_QUESTIONS.slice(3))
  .concat(SCREENING_DEMOGRAPHIC_QUESTIONS);

function wireScreeningRadioGroup(radios) {
  radios.forEach((radio) => {
    radio.click = function () {
      radios.forEach((other) => {
        other.setAttribute("aria-checked", other === radio ? "true" : "false");
      });
    };
  });
}

function buildScreeningFixture() {
  const fixture = buildSmartRecruitersResumeFixture("");
  const host = createScanNode("sr-screening-questions-form");
  host.setAttribute("data-test", "screening-questions-form");
  host.setAttribute("definition", JSON.stringify({ questions: SCREENING_QUESTIONS }));
  const groups = SCREENING_QUESTIONS.map((question) => {
    const wrap = createScanNode("spl-form-element");
    const title = createScanNode("p");
    title.innerText = question.label;
    wrap.appendChild(title);
    const radios = question.questionsFields.map((field) => {
      const radio = createScanNode("spl-radio");
      radio.setAttribute("label", field.label);
      radio.setAttribute("value", String(field.fieldValue));
      radio.setAttribute("role", "radio");
      radio.setAttribute("aria-checked", "false");
      wrap.appendChild(radio);
      return radio;
    });
    wireScreeningRadioGroup(radios);
    return { wrap: wrap, radios: radios, question: question };
  });
  attachShadow(
    host,
    groups.map((group) => group.wrap)
  );
  fixture.doc.body.appendChild(host);
  fixture.screeningHost = host;
  fixture.screeningGroups = groups;
  return fixture;
}

function buildScreeningOnlyFixture() {
  const fixture = buildScreeningFixture();
  const host = fixture.screeningHost;
  fixture.doc.body.children.length = 0;
  fixture.doc.body.appendChild(host);
  if (fixture.topDropzone) fixture.topDropzone.isConnected = false;
  if (fixture.topInput) fixture.topInput.isConnected = false;
  if (fixture.lowerInput) fixture.lowerInput.isConnected = false;
  if (fixture.hiring && fixture.hiring.textarea) fixture.hiring.textarea.isConnected = false;
  const staleFirst = createScanNode("input");
  staleFirst.type = "text";
  staleFirst.setAttribute("type", "text");
  staleFirst.setAttribute("aria-label", "First name");
  staleFirst.isConnected = false;
  fixture.doc.body.appendChild(staleFirst);
  fixture.staleFirstName = staleFirst;
  return fixture;
}

function buildScreeningWithDetachedParser() {
  const fixture = buildScreeningFixture();
  if (fixture.topDropzone) fixture.topDropzone.isConnected = false;
  if (fixture.topInput) fixture.topInput.isConnected = false;
  if (fixture.lowerInput) fixture.lowerInput.isConnected = false;
  return fixture;
}

function buildEmptyApplicationDoc() {
  const doc = createScanNode("html");
  doc.nodeType = 9;
  doc.tagName = "#DOCUMENT";
  const html = createScanNode("html");
  const body = createScanNode("body");
  html.appendChild(body);
  doc.documentElement = html;
  doc.body = body;
  doc.children = [html];
  html.parentNode = doc;
  html.ownerDocument = doc;
  body.ownerDocument = doc;
  doc.querySelector = function (selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  doc.querySelectorAll = function (selector) {
    return queryAllFrom(html, selector);
  };
  doc.getElementById = function () {
    return null;
  };
  return { doc: doc };
}

function assignRect(el, rect) {
  el.getBoundingClientRect = function () {
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom
    };
  };
  (el.children || []).forEach((child) => assignRect(child, rect));
}

function walkComposed(root, visit) {
  function walk(node) {
    if (!node) return;
    visit(node);
    if (node.shadowRoot) walk(node.shadowRoot);
    (node.children || []).forEach(walk);
  }
  walk(root);
}

function countComposedLabelMatches(root, label) {
  const want = String(label || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  let count = 0;
  walkComposed(root, function (node) {
    if (!node || node === root) return;
    const text = String(node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (text === want) count += 1;
  });
  return count;
}

function createNestedSplSelectOption(label, value, id) {
  const option = createScanNode("spl-select-option");
  option.setAttribute("value", String(value));
  option.id = id || "";
  option.setAttribute("id", id || "");
  option.setAttribute("label", label);
  const item = createScanNode("spl-dropdown-item");
  item.className = "c-spl-dropdown-item";
  const row = createScanNode("div");
  const typography = createScanNode("spl-typography");
  typography.innerText = label;
  const truncate = createScanNode("spl-truncate");
  truncate.innerText = label;
  const tooltip = createScanNode("spl-tooltip");
  const span = createScanNode("span");
  span.innerText = label;
  tooltip.appendChild(span);
  tooltip.innerText = label;
  row.appendChild(typography);
  row.appendChild(truncate);
  row.appendChild(tooltip);
  item.appendChild(row);
  item.innerText = label;
  const shadowSpan = createScanNode("span");
  shadowSpan.innerText = label;
  attachShadow(item, [shadowSpan]);
  option.appendChild(item);
  option.innerText = label;
  option.nestedLeaf = span;
  return option;
}

function wireDemographicHitTesting(doc, hosts) {
  function containsPoint(el, x, y) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const rect = el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function deepestIn(el, x, y) {
    const kids = el.children || [];
    for (let i = kids.length - 1; i >= 0; i -= 1) {
      if (containsPoint(kids[i], x, y)) return deepestIn(kids[i], x, y);
    }
    return el;
  }
  doc.elementFromPoint = function (x, y) {
    for (let i = 0; i < hosts.length; i += 1) {
      if (containsPoint(hosts[i], x, y)) return hosts[i];
    }
    return null;
  };
  hosts.forEach((host) => {
    if (!host.shadowRoot) return;
    host.shadowRoot.elementFromPoint = function (x, y) {
      const options = queryAllFrom(host.shadowRoot, "spl-select-option");
      for (let i = 0; i < options.length; i += 1) {
        if (containsPoint(options[i], x, y)) return deepestIn(options[i], x, y);
      }
      return null;
    };
  });
}

function wireScreeningAutocomplete(input, listbox, optionLabels, opts, host) {
  const settings = opts || {};
  let active = -1;
  input.dispatchedKeys = [];
  function optionClass(index) {
    return index === active ? "c-spl-dropdown-item active" : "c-spl-dropdown-item";
  }
  function openMenu() {
    input.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-activedescendant", "");
    active = -1;
    (listbox.children || []).forEach((child) => {
      child.setAttribute("aria-selected", "false");
      const item = (child.children || []).find(
        (node) => (node.tagName || "").toLowerCase() === "spl-dropdown-item"
      );
      if (item) item.className = "c-spl-dropdown-item";
    });
  }
  function commit(index) {
    if (index < 0 || index >= optionLabels.length) return;
    if (settings.uncommitted) return;
    input.value = optionLabels[index];
    if (host) {
      host.value = optionLabels[index];
      host.selectedOptionsDictionary = {
        0: { id: "0", value: "0", label: optionLabels[index] }
      };
    }
    closeMenu();
  }
  function activate(index) {
    active = index;
    const opt = listbox.children[index];
    (listbox.children || []).forEach((child, i) => {
      child.setAttribute("aria-selected", i === index ? "true" : "false");
      const item = (child.children || []).find(
        (node) => (node.tagName || "").toLowerCase() === "spl-dropdown-item"
      );
      if (item) item.className = optionClass(i);
    });
    if (opt) input.setAttribute("aria-activedescendant", opt.id);
  }
  function normalizeLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function activateTypedMatch() {
    const typed = normalizeLabel(input.value);
    const matchIndex = optionLabels.findIndex((label) => normalizeLabel(label) === typed);
    if (matchIndex >= 0) activate(matchIndex);
  }
  input.focus = function () {
    openMenu();
    activateTypedMatch();
  };
  input.blur = function () {
    if (input.getAttribute("aria-expanded") === "true" && !settings.uncommitted) closeMenu();
    else if (!settings.uncommitted) input.setAttribute("aria-expanded", "false");
  };
  input.dispatchEvent = function (ev) {
    const type = ev && ev.type;
    const key = (ev && (ev.key || ev.code)) || "";
    if (type === "keydown") input.dispatchedKeys.push(key);
    if (type === "input" || type === "beforeinput") {
      openMenu();
      activateTypedMatch();
    }
    if (type === "keydown" && key === "ArrowDown") {
      openMenu();
      const typed = normalizeLabel(input.value);
      const matchIndex = optionLabels.findIndex((label) => normalizeLabel(label) === typed);
      if (matchIndex >= 0 && (active < 0 || normalizeLabel(optionLabels[active]) !== typed)) {
        activate(matchIndex);
      } else {
        activate(Math.min(active + 1, optionLabels.length - 1));
      }
    }
    if (type === "keydown" && key === "Enter") commit(active);
    if (type === "keydown" && key === "Escape") closeMenu();
    return true;
  };
  (listbox.children || []).forEach((opt, index) => {
    opt.clickCount = 0;
    opt.lastClicked = null;
    function bind(el) {
      el.click = function () {
        opt.clickCount += 1;
        opt.lastClicked = el;
        commit(index);
      };
      (el.children || []).forEach(bind);
    }
    bind(opt);
  });
  return input;
}

function buildScreeningDemographicFixture(opts) {
  const settings = opts || {};
  const empty = buildEmptyApplicationDoc();
  const host = createScanNode("sr-screening-questions-form");
  host.setAttribute("data-test", "screening-questions-form");
  host.setAttribute(
    "definition",
    JSON.stringify({ questions: SCREENING_QUESTIONS.concat(SCREENING_DEMOGRAPHIC_QUESTIONS) })
  );
  const genderUuid = "7f3a91c2-11ab-4cde-9f01-aa11bb22cc33";
  const ethnicityUuid = "0c9e44d1-88fe-41b0-b77a-dd22ee33ff44";
  const genderDict = {
    "0": { id: "0", value: "0", label: "Male" },
    "1": { id: "1", value: "1", label: "Female" },
    "2": { id: "2", value: "2", label: "Prefer not to answer" }
  };
  const ethnicityDict = {
    "0": { id: "0", value: "0", label: "White" },
    "2": { id: "2", value: "2", label: "Asian" },
    "9": { id: "9", value: "9", label: "I don't wish to answer" }
  };
  const genderLabels = Object.keys(genderDict).map((key) => genderDict[key].label);
  const ethnicityLabels = Object.keys(ethnicityDict).map((key) => ethnicityDict[key].label);

  function buildAutocomplete(kind, uuid, placeholder, labels, dictionary, currentValue) {
    const autocomplete = createScanNode("spl-autocomplete");
    const hostTop = kind === "gender" ? 0 : 280;
    autocomplete.setAttribute(
      "data-test",
      kind === "gender" ? "question-eeo-gender-select" : "question-eeo-ethnicity-select"
    );
    autocomplete.optionsDictionary = dictionary;
    autocomplete.value = currentValue || "";
    assignRect(autocomplete, {
      width: 240,
      height: 240,
      top: hostTop,
      left: 0,
      right: 240,
      bottom: hostTop + 240
    });
    const splInput = createScanNode("spl-input");
    const input = createScanNode("input");
    input.type = "text";
    input.setAttribute("type", "text");
    input.id = uuid + "_" + kind;
    input.setAttribute("id", uuid + "_" + kind);
    input.setAttribute("role", "combobox");
    input.setAttribute("placeholder", placeholder);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-required", "true");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", uuid + "_" + kind + "-menu");
    input.value = currentValue || "";
    const listbox = createScanNode("div");
    listbox.id = uuid + "_" + kind + "-menu";
    listbox.setAttribute("id", uuid + "_" + kind + "-menu");
    listbox.setAttribute("role", "listbox");
    labels.forEach((label, index) => {
      const option = createNestedSplSelectOption(
        label,
        String(index),
        uuid + "_" + kind + "-opt-" + index
      );
      assignRect(option, {
        width: 220,
        height: 32,
        top: hostTop + 48 + index * 36,
        left: 8,
        right: 228,
        bottom: hostTop + 80 + index * 36
      });
      listbox.appendChild(option);
    });
    const clearBtn = createScanNode("button");
    clearBtn.setAttribute("type", "button");
    clearBtn.setAttribute("aria-label", "Clear");
    clearBtn.className = "c-spl-autocomplete-clear";
    clearBtn.clickCount = 0;
    clearBtn.click = function () {
      clearBtn.clickCount += 1;
      input.value = "";
      autocomplete.value = "";
      autocomplete.selectedOptionsDictionary = {};
    };
    attachShadow(splInput, [input]);
    attachShadow(autocomplete, [splInput, listbox, clearBtn]);
    if (settings.noDictionary) delete autocomplete.optionsDictionary;
    const uncommitted =
      Boolean(settings.uncommitted) ||
      (Array.isArray(settings.uncommittedKinds) && settings.uncommittedKinds.indexOf(kind) !== -1);
    wireScreeningAutocomplete(input, listbox, labels, { uncommitted: uncommitted }, autocomplete);
    return { host: autocomplete, input: input, listbox: listbox, clearBtn: clearBtn };
  }

  const gender = buildAutocomplete(
    "gender",
    genderUuid,
    "Gender",
    genderLabels,
    genderDict,
    settings.genderValue || ""
  );
  const ethnicity = buildAutocomplete(
    "ethnicity",
    ethnicityUuid,
    "Race/Ethnicity",
    ethnicityLabels,
    ethnicityDict,
    settings.ethnicityValue || ""
  );
  attachShadow(host, [gender.host, ethnicity.host]);
  empty.doc.body.appendChild(host);
  stampOwnerDocument(host, empty.doc);
  wireDemographicHitTesting(empty.doc, [gender.host, ethnicity.host]);
  return {
    doc: empty.doc,
    screeningHost: host,
    genderInput: gender.input,
    ethnicityInput: ethnicity.input,
    genderHost: gender.host,
    ethnicityHost: ethnicity.host,
    genderListbox: gender.listbox,
    ethnicityListbox: ethnicity.listbox,
    genderClear: gender.clearBtn,
    ethnicityClear: ethnicity.clearBtn
  };
}

function buildCompleteScreeningFixture(opts) {
  const settings = opts || {};
  const base = buildScreeningOnlyFixture();
  const demo = buildScreeningDemographicFixture(settings);
  const host = base.screeningHost;
  host.setAttribute("definition", JSON.stringify({ questions: COMPLETE_SCREENING_QUESTIONS }));

  const referralWrap = createScanNode("spl-form-element");
  const referralTitle = createScanNode("p");
  referralTitle.innerText = SCREENING_REFERRAL_QUESTION.label;
  const referralHost = createScanNode("spl-input");
  const referralInput = createScanNode("input");
  referralInput.type = "text";
  referralInput.setAttribute("type", "text");
  referralInput.setAttribute("aria-label", SCREENING_REFERRAL_QUESTION.label);
  attachShadow(referralHost, [referralInput]);
  referralWrap.appendChild(referralTitle);
  referralWrap.appendChild(referralHost);

  attachShadow(
    host,
    base.screeningGroups
      .map((group) => group.wrap)
      .concat([referralWrap, demo.genderHost, demo.ethnicityHost])
  );

  const consent = createScanNode("section");
  const notice = createScanNode("p");
  notice.innerText = SCREENING_PRIVACY_LABEL;
  const checkbox = createScanNode("spl-checkbox");
  checkbox.setAttribute("role", "checkbox");
  checkbox.setAttribute("aria-checked", "false");
  checkbox.setAttribute("aria-label", "*");
  const innerBox = createScanNode("input");
  innerBox.type = "checkbox";
  innerBox.setAttribute("type", "checkbox");
  innerBox.checked = false;
  innerBox.click = function () {
    innerBox.checked = !innerBox.checked;
    checkbox.setAttribute("aria-checked", innerBox.checked ? "true" : "false");
  };
  checkbox.click = function () {
    innerBox.click();
  };
  attachShadow(checkbox, [innerBox]);
  consent.appendChild(notice);
  consent.appendChild(checkbox);
  base.doc.body.appendChild(consent);

  let submitClicks = 0;
  const submit = createScanNode("button");
  submit.setAttribute("type", "submit");
  submit.innerText = "Submit application";
  submit.click = function () {
    submitClicks += 1;
  };
  base.doc.body.appendChild(submit);

  const ocContext = {
    consent: {
      consentScopeConfigs: [
        { required: true, checkboxRequired: true, label: SCREENING_PRIVACY_LABEL }
      ]
    }
  };
  base.doc.defaultView = { __OC_CONTEXT__: ocContext };

  stampOwnerDocument(host, base.doc);
  stampOwnerDocument(consent, base.doc);
  wireDemographicHitTesting(base.doc, [demo.genderHost, demo.ethnicityHost]);

  return {
    doc: base.doc,
    screeningHost: host,
    screeningGroups: base.screeningGroups,
    staleFirstName: base.staleFirstName,
    referralInput: referralInput,
    genderInput: demo.genderInput,
    ethnicityInput: demo.ethnicityInput,
    genderHost: demo.genderHost,
    ethnicityHost: demo.ethnicityHost,
    genderListbox: demo.genderListbox,
    ethnicityListbox: demo.ethnicityListbox,
    privacyCheckbox: checkbox,
    privacyInner: innerBox,
    submit: submit,
    ocContext: ocContext,
    submitClicks: function () {
      return submitClicks;
    }
  };
}

assert.strictEqual(AF.parseSmartRecruitersScreeningDefinition("{not-json").length, 0);
assert.strictEqual(
  AF.parseSmartRecruitersScreeningDefinition(JSON.stringify({ questions: SCREENING_QUESTIONS })).length,
  5
);
assert.strictEqual(
  AF.parseSmartRecruitersScreeningDefinition(
    JSON.stringify({ questions: SCREENING_QUESTIONS.concat(SCREENING_DEMOGRAPHIC_QUESTIONS) })
  ).length,
  5
);
assert.strictEqual(
  AF.parseSmartRecruitersScreeningQuestions(JSON.stringify({ questions: COMPLETE_SCREENING_QUESTIONS })).length,
  8
);
assert.strictEqual(
  AF.looksLikeSmartRecruitersEmployeeReferral(SCREENING_REFERRAL_QUESTION.label),
  true
);
assert.strictEqual(AF.looksLikeSmartRecruitersPrivacyConsent(SCREENING_PRIVACY_LABEL), true);
assert.strictEqual(AF.looksLikeSmartRecruitersPrivacyConsent("*"), false);
assert.strictEqual(
  AF.matchSmartRecruitersScreeningRadioOption("Yes", [
    { label: "Yes", value: "1" },
    { label: "No", value: "0" }
  ]).label,
  "Yes"
);
assert.strictEqual(
  AF.matchSmartRecruitersScreeningRadioOption("Yes", [
    { label: "Yes, I have a disability, or have a history/record of having a disability", value: "1" },
    { label: "No, I don't have a disability, or a history/record of having a disability", value: "0" },
    { label: "I don't wish to answer", value: "9" }
  ]).label,
  "Yes, I have a disability, or have a history/record of having a disability"
);
assert.strictEqual(
  AF.matchSmartRecruitersScreeningRadioOption("No", [
    { label: "I am a protected veteran", value: "1" },
    { label: "I am not a protected veteran", value: "0" },
    { label: "I don't wish to answer", value: "9" }
  ]),
  null
);
assert.ok(
  /protected veteran/i.test(
    AF.matchSmartRecruitersScreeningRadioOption("I am a protected veteran", [
      { label: "I am a protected veteran", value: "1" },
      { label: "I am not a protected veteran", value: "0" },
      { label: "I don't wish to answer", value: "9" }
    ]).label
  )
);
assert.strictEqual(
  AF.matchSmartRecruitersScreeningRadioOption("Yes", [
    { label: "Yes", value: "1" },
    { label: "I don't wish to answer", value: "9" }
  ]).label,
  "Yes"
);
console.log("ok - SmartRecruiters screening definition parse and option matching");

(function testSmartRecruitersScreeningScan() {
  const fixture = buildScreeningFixture();
  autofillSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc"
  };
  autofillSandbox.document = fixture.doc;
  const emptyInv = AF.buildAnswerInventory({ personal: { firstName: "Raj" } });
  const scan = AF.scanDocument(fixture.doc, emptyInv);
  const radioFields = scan.fields.filter((field) => field.inputType === "radio");
  assert.strictEqual(radioFields.length, 5, "each radio group should be scanned once");
  const byCategory = {};
  radioFields.forEach((field) => {
    byCategory[field.category] = field;
  });
  assert.strictEqual(byCategory.work_authorization.required, true);
  assert.strictEqual(byCategory.relocation.required, true);
  assert.strictEqual(byCategory.sponsorship_now.required, true);
  assert.strictEqual(byCategory.disability_status.required, true);
  assert.strictEqual(byCategory.veteran_status.required, true);
  assert.strictEqual(byCategory.work_authorization.fillStatus, "missing");
  assert.strictEqual(byCategory.work_authorization.screeningQuestionId, "q-auth");
  assert.strictEqual(byCategory.relocation.screeningQuestionId, "q-relo");
  assert.ok(byCategory.work_authorization.options.some((opt) => opt.label === "Yes"));
  assert.ok(byCategory.work_authorization.options.some((opt) => opt.value === "1"));
  assert.ok(byCategory.relocation.options.some((opt) => opt.value === "1"));
  assert.strictEqual(byCategory.disability_status.options.length, 3);
  assert.strictEqual(byCategory.veteran_status.options.length, 3);
  assert.strictEqual(
    radioFields.filter((field) => field.required && field.fillStatus === "missing").length,
    5
  );
  fixture.screeningGroups[0].radios[0].setAttribute("aria-checked", "true");
  const completed = AF.scanDocument(fixture.doc, emptyInv);
  const authCompleted = completed.fields.find((field) => field.category === "work_authorization");
  assert.strictEqual(authCompleted.fillStatus, "completed");
  const readyInv = AF.buildAnswerInventory({
    personal: { firstName: "Raj" },
    workAuthorization: {
      legallyAuthorizedToWork: "Yes",
      requireSponsorshipNow: "No"
    },
    applicationPreferences: { willingToRelocate: "Yes" },
    demographics: {
      disabilityStatus: "Yes, I have a disability, or have a history/record of having a disability",
      veteranStatus: "I am a protected veteran"
    }
  });
  fixture.screeningGroups[0].radios[0].setAttribute("aria-checked", "false");
  const readyScan = AF.scanDocument(fixture.doc, readyInv);
  const readyAuth = readyScan.fields.find((field) => field.category === "work_authorization");
  assert.strictEqual(readyAuth.fillStatus, "ready");
  assert.strictEqual(readyAuth.hasAnswer, true);
  assert.ok(
    !scan.fields.some((field) => field.category === "first_name"),
    "screening scan must not include stale page-1 fields"
  );
})();
console.log("ok - SmartRecruiters screening radio scan");

(function testSmartRecruitersCompleteScreeningScan() {
  const fixture = buildCompleteScreeningFixture();
  const loc = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
  };
  autofillSandbox.location = loc;
  autofillSandbox.document = fixture.doc;
  autofillSandbox.__OC_CONTEXT__ = fixture.ocContext;
  const inv = AF.buildAnswerInventory({
    personal: { firstName: "Raj" },
    workAuthorization: {
      legallyAuthorizedToWork: "Yes",
      requireSponsorshipNow: "No"
    },
    applicationPreferences: { willingToRelocate: "Yes" },
    demographics: {
      gender: "Man",
      raceEthnicity: "Asian",
      disabilityStatus: "Yes, I have a disability, or have a history/record of having a disability",
      veteranStatus: "I am a protected veteran"
    }
  });
  const scan = AF.scanDocument(fixture.doc, inv);
  assert.strictEqual(scan.summary.totalFields, 9, "screening page should scan exactly nine logical fields");
  const byCategory = {};
  scan.fields.forEach((field) => {
    byCategory[field.category] = (byCategory[field.category] || 0) + 1;
  });
  assert.strictEqual(byCategory.work_authorization, 1);
  assert.strictEqual(byCategory.relocation, 1);
  assert.strictEqual(byCategory.sponsorship_now, 1);
  assert.strictEqual(byCategory.referral_source, 1);
  assert.strictEqual(byCategory.disability_status, 1);
  assert.strictEqual(byCategory.veteran_status, 1);
  assert.strictEqual(byCategory.gender, 1);
  assert.strictEqual(byCategory.race_ethnicity, 1);
  assert.strictEqual(byCategory.privacy_consent, 1);
  assert.ok(!scan.fields.some((field) => field.category === "unknown"));
  assert.ok(!scan.fields.some((field) => field.category === "first_name"));
  assert.ok(!scan.fields.some((field) => field.label === "*"));
  const referral = scan.fields.find((field) => field.category === "referral_source");
  assert.strictEqual(referral.required, false);
  assert.strictEqual(referral.fillStatus, "missing");
  assert.ok(/referred by/i.test(referral.label));
  const privacy = scan.fields.find((field) => field.category === "privacy_consent");
  assert.strictEqual(privacy.required, true);
  assert.strictEqual(privacy.fillStatus, "missing");
  assert.strictEqual(privacy.label, SCREENING_PRIVACY_LABEL);
  assert.strictEqual(privacy.actionHint, "User confirmation required");
  assert.ok(scan.summary.requiredUnansweredFields >= 1);
  assert.strictEqual(scan.fields.find((field) => field.category === "gender").fillStatus, "ready");
  assert.strictEqual(scan.fields.find((field) => field.category === "race_ethnicity").fillStatus, "ready");
  fixture.screeningGroups.forEach((group) => {
    group.radios[0].setAttribute("aria-checked", "true");
    group.radios.slice(1).forEach((radio) => radio.setAttribute("aria-checked", "false"));
  });
  const afterSelect = AF.scanDocument(fixture.doc, inv);
  const radioCompleted = afterSelect.fields.filter(
    (field) => field.inputType === "radio" && field.fillStatus === "completed"
  );
  const radioReady = afterSelect.fields.filter(
    (field) => field.inputType === "radio" && field.fillStatus === "ready"
  );
  assert.strictEqual(radioCompleted.length, 5);
  assert.strictEqual(radioReady.length, 0);
})();
console.log("ok - SmartRecruiters complete screening scan");

(function testSmartRecruitersResumePreflightRouting() {
  const page1 = buildSmartRecruitersResumeFixture("");
  adapterSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc"
  };
  const page1Step = SR.detectSmartRecruitersApplyStep(page1.doc);
  assert.strictEqual(page1Step.step, "application");
  assert.strictEqual(page1Step.runResumePreflight, true);
  assert.ok(SR.findTopResumeDropzone(page1.doc));

  const screening = buildScreeningOnlyFixture();
  adapterSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
  };
  const screeningStep = SR.detectSmartRecruitersApplyStep(screening.doc);
  assert.strictEqual(screeningStep.step, "screening");
  assert.strictEqual(screeningStep.runResumePreflight, false);
  assert.strictEqual(SR.findTopResumeDropzone(screening.doc), null);

  adapterSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc"
  };
  const hostOnly = SR.detectSmartRecruitersApplyStep(screening.doc);
  assert.strictEqual(hostOnly.runResumePreflight, false);

  const missing = buildEmptyApplicationDoc();
  const missingStep = SR.detectSmartRecruitersApplyStep(missing.doc);
  assert.strictEqual(missingStep.step, "application");
  assert.strictEqual(missingStep.runResumePreflight, true);
  assert.strictEqual(missingStep.dropzone, null);

  adapterSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
  };
  const stale = buildScreeningWithDetachedParser();
  const staleStep = SR.detectSmartRecruitersApplyStep(stale.doc);
  assert.strictEqual(staleStep.step, "screening");
  assert.strictEqual(staleStep.runResumePreflight, false);
  assert.strictEqual(SR.findTopResumeDropzone(stale.doc), null);
})();
console.log("ok - SmartRecruiters resume preflight routing");

(function testSmartRecruitersScreeningDemographicMatching() {
  adapterSandbox.ImpulsoAutofill = AF;
  const genderOptions = [
    { id: "0", value: "0", label: "Male" },
    { id: "1", value: "1", label: "Female" },
    { id: "2", value: "2", label: "Prefer not to answer" }
  ];
  const ethnicityOptions = [
    { id: "0", value: "0", label: "White" },
    { id: "2", value: "2", label: "Asian" },
    { id: "9", value: "9", label: "I don't wish to answer" }
  ];
  assert.strictEqual(SR.matchScreeningDemographicOption("Man", genderOptions, "gender").label, "Male");
  assert.strictEqual(SR.mapGenderToPlatformLabel("Man"), "Male");
  assert.strictEqual(SR.mapGenderToPlatformLabel("Woman"), "Female");
  assert.strictEqual(SR.mapGenderToPlatformLabel("Male"), "Male");
  assert.strictEqual(SR.mapGenderToPlatformLabel("Female"), "Female");
  assert.strictEqual(SR.matchScreeningDemographicOption(" man ", genderOptions, "gender").label, "Male");
  assert.strictEqual(SR.matchScreeningDemographicOption("Male", genderOptions, "gender").label, "Male");
  assert.strictEqual(SR.matchScreeningDemographicOption("Woman", genderOptions, "gender").label, "Female");
  assert.strictEqual(SR.matchScreeningDemographicOption("Female", genderOptions, "gender").label, "Female");
  assert.strictEqual(SR.matchScreeningDemographicOption("Non-binary", genderOptions, "gender"), null);
  assert.strictEqual(SR.matchScreeningDemographicOption("Asian", ethnicityOptions, "ethnicity").label, "Asian");
  assert.strictEqual(
    SR.matchScreeningDemographicOption("Asian (not Hispanic or Latino)", ethnicityOptions, "ethnicity"),
    null
  );
  assert.strictEqual(
    SR.looksLikeScreeningDemographicAutocomplete({ category: "gender" }),
    true
  );
  assert.strictEqual(
    SR.looksLikeScreeningDemographicAutocomplete({ category: "race_ethnicity" }),
    true
  );
  assert.strictEqual(
    SR.looksLikeScreeningDemographicAutocomplete({
      category: "work_authorization",
      screeningQuestionId: "q-auth"
    }),
    false
  );

  const fixture = buildScreeningDemographicFixture();
  const genderHost = SR.findScreeningDemographicHost(fixture.doc, "gender");
  const ethnicityHost = SR.findScreeningDemographicHost(fixture.doc, "ethnicity");
  assert.ok(genderHost);
  assert.ok(ethnicityHost);
  assert.strictEqual(genderHost.getAttribute("data-test"), "question-eeo-gender-select");
  assert.strictEqual(ethnicityHost.getAttribute("data-test"), "question-eeo-ethnicity-select");
  assert.strictEqual(SR.readOptionsDictionary(genderHost)[0].label, "Male");
  assert.ok(SR.readOptionsDictionary(ethnicityHost).some((opt) => opt.label === "Asian"));
  const gender = SR.findScreeningDemographicInput(fixture.doc, "gender");
  const ethnicity = SR.findScreeningDemographicInput(fixture.doc, "ethnicity");
  assert.ok(gender);
  assert.ok(ethnicity);
  assert.ok(/^[0-9a-f-]+_gender$/i.test(gender.id));
  assert.ok(/^[0-9a-f-]+_ethnicity$/i.test(ethnicity.id));
  assert.notStrictEqual(gender.id.replace(/_gender$/i, ""), ethnicity.id.replace(/_ethnicity$/i, ""));
  assert.strictEqual(gender.getAttribute("placeholder"), "Gender");
  assert.strictEqual(ethnicity.getAttribute("placeholder"), "Race/Ethnicity");
  assert.strictEqual(SR.normalizeSensitiveOptionLabel("Male"), SR.normalizeSensitiveOptionLabel(" male "));
  assert.notStrictEqual(SR.normalizeSensitiveOptionLabel("Male"), SR.normalizeSensitiveOptionLabel("Female"));
  const visible = SR.collectVisibleScreeningOptionRows(genderHost);
  assert.ok(visible.some((row) => row.label === "Male"));
  assert.ok(visible.some((row) => row.label === "Female"));
  assert.strictEqual(
    visible.filter((row) => row.label === "Male").length,
    1,
    "nested Male descendants must collapse to one spl-select-option"
  );
  const exactMale = SR.findExactVisibleScreeningOptions(genderHost, "Male");
  assert.strictEqual(exactMale.length, 1);
  assert.strictEqual(exactMale[0].label, "Male");
  assert.strictEqual((exactMale[0].el.tagName || "").toLowerCase(), "spl-select-option");
  assert.ok(
    countComposedLabelMatches(exactMale[0].el, "Male") >= 5,
    "Male row should contain nested descendants that also read Male"
  );
  assert.strictEqual(SR.querySplSelectOptions(genderHost).length, 3);
  assert.strictEqual(SR.findExactVisibleScreeningOptions(genderHost, "Female").length, 1);
  assert.ok(SR.findDemographicClearButton(genderHost));
  const extraDescendant = createScanNode("div");
  extraDescendant.className = "c-spl-dropdown-item";
  extraDescendant.innerText = "Male";
  fixture.genderListbox.appendChild(extraDescendant);
  assert.strictEqual(
    SR.findExactVisibleScreeningOptions(genderHost, "Male").length,
    1,
    "spl-dropdown-item/div descendants must not count as extra options"
  );
  const noDict = buildScreeningDemographicFixture({ noDictionary: true, visibleRowOnly: true });
  assert.strictEqual(noDict.genderHost.optionsDictionary, undefined);
  const visibleNoDict = SR.collectVisibleScreeningOptionRows(noDict.genderHost);
  assert.ok(visibleNoDict.some((row) => row.label === "Male"));
  assert.strictEqual(SR.findExactVisibleScreeningOptions(noDict.genderHost, "Male").length, 1);
  const ambiguous = buildScreeningDemographicFixture();
  const dup = createNestedSplSelectOption("Male", "dup", "gender-male-dup");
  ambiguous.genderListbox.appendChild(dup);
  assert.strictEqual(SR.findExactVisibleScreeningOptions(ambiguous.genderHost, "Male").length, 2);
})();
console.log("ok - SmartRecruiters screening demographic matching");

(function testSmartRecruitersHiringTeamScanAndFill() {
  const fixture = buildSmartRecruitersResumeFixture("");
  autofillSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc"
  };
  autofillSandbox.document = fixture.doc;
  adapterSandbox.location = autofillSandbox.location;
  adapterSandbox.document = fixture.doc;
  adapterSandbox.Event = Event;
  adapterSandbox.InputEvent = typeof InputEvent !== "undefined" ? InputEvent : Event;
  adapterSandbox.FocusEvent = typeof FocusEvent !== "undefined" ? FocusEvent : Event;
  adapterSandbox.setTimeout = setTimeout;
  adapterSandbox.clearTimeout = clearTimeout;
  let nativeSet = 0;
  adapterSandbox.HTMLTextAreaElement = function HTMLTextAreaElement() {};
  Object.defineProperty(adapterSandbox.HTMLTextAreaElement.prototype, "value", {
    configurable: true,
    enumerable: true,
    get: function () {
      return this._nativeValue || "";
    },
    set: function (value) {
      nativeSet += 1;
      this._nativeValue = String(value);
      Object.defineProperty(this, "value", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: String(value)
      });
    }
  });

  const hiringTextarea = fixture.hiring.textarea;
  hiringTextarea.events = [];
  hiringTextarea.focus = function () {};
  hiringTextarea.dispatchEvent = function (ev) {
    hiringTextarea.events.push((ev && ev.type) || "");
    return true;
  };

  assert.strictEqual(AF.isSmartRecruitersHiringTeamMessageControl(hiringTextarea), true);
  assert.strictEqual(
    AF.findSmartRecruitersHiringTeamQuestionLabel(hiringTextarea),
    "Message to the Hiring Team"
  );
  const hiringContext = AF.collectContext(hiringTextarea);
  assert.strictEqual(hiringContext.label, "Message to the Hiring Team");
  assert.strictEqual(
    AF.detectCategory(hiringTextarea, hiringContext, []).category,
    "additional_information"
  );

  const readyInventory = AF.buildAnswerInventory({
    personal: { firstName: "Raj" },
    commonAnswers: {
      additionalInformation: "I am excited to contribute to the team."
    }
  });
  const readyScan = AF.scanDocument(fixture.doc, readyInventory);
  const readyHiring = readyScan.fields.filter((field) => field.category === "additional_information");
  assert.strictEqual(readyHiring.length, 1);
  assert.strictEqual(readyHiring[0].required, false);
  assert.strictEqual(readyHiring[0].fillStatus, "ready");
  assert.strictEqual(readyHiring[0].hasAnswer, true);

  hiringTextarea.value = "Already wrote this.";
  const completedScan = AF.scanDocument(fixture.doc, readyInventory);
  const completedHiring = completedScan.fields.filter((field) => field.category === "additional_information");
  assert.strictEqual(completedHiring[0].fillStatus, "completed");
  hiringTextarea.value = "";

  const facebookStillUnknown = readyScan.fields.filter((field) =>
    /facebook/i.test(field.question || field.label || field.ariaLabel || "")
  );
  const twitterStillUnknown = readyScan.fields.filter((field) =>
    /twitter|\bx\b/i.test(field.question || field.label || field.ariaLabel || "")
  );
  assert.strictEqual(facebookStillUnknown[0].category, "unknown");
  assert.strictEqual(twitterStillUnknown[0].category, "unknown");

  return SR.fillHiringTeamMessage("I am excited to contribute to the team.", fixture.doc).then(
    function (filled) {
      assert.strictEqual(filled.status, "filled");
      assert.strictEqual(filled.ok, true);
      assert.ok(nativeSet >= 1, "native HTMLTextAreaElement value setter should be used");
      assert.strictEqual(hiringTextarea.value, "I am excited to contribute to the team.");
      assert.ok(hiringTextarea.events.indexOf("beforeinput") !== -1);
      assert.ok(hiringTextarea.events.indexOf("input") !== -1);
      assert.ok(hiringTextarea.events.indexOf("change") !== -1);
      assert.ok(hiringTextarea.events.indexOf("blur") !== -1);
      assert.strictEqual(fixture.hiring.host.value, "I am excited to contribute to the team.");
      return SR.fillHiringTeamMessage("I am excited to contribute to the team.", fixture.doc);
    }
  ).then(function (skipped) {
    assert.strictEqual(skipped.status, "skipped");
    hiringTextarea.value = "";
    hiringTextarea._nativeValue = "";
    hiringTextarea.dispatchEvent = function (ev) {
      hiringTextarea.events.push((ev && ev.type) || "");
      if (ev && ev.type === "blur") hiringTextarea.value = "";
      return true;
    };
    return SR.fillHiringTeamMessage("I am excited to contribute to the team.", fixture.doc);
  }).then(function (failed) {
    assert.strictEqual(failed.status, "failed");
    assert.ok(/verification failed/i.test(failed.reason || ""));
  });
})().then(function () {
  console.log("ok - SmartRecruiters hiring team message scan and fill");
  adapterSandbox.ImpulsoAutofill = AF;
  adapterSandbox.setTimeout = setTimeout;
  adapterSandbox.clearTimeout = clearTimeout;
  adapterSandbox.Event = Event;
  adapterSandbox.MouseEvent = typeof MouseEvent !== "undefined" ? MouseEvent : Event;
  const fixture = buildScreeningFixture();
  autofillSandbox.location = {
    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/abc"
  };
  autofillSandbox.document = fixture.doc;
  adapterSandbox.location = autofillSandbox.location;
  adapterSandbox.document = fixture.doc;
  const inventory = {
    work_authorization: "Yes",
    relocation: "No",
    sponsorship_now: "No",
    disability_status: "Yes, I have a disability, or have a history/record of having a disability",
    veteran_status: "I am a protected veteran"
  };
  const authField = {
    category: "work_authorization",
    label: SCREENING_QUESTIONS[0].label,
    screeningQuestionId: "q-auth",
    inputType: "radio",
    options: SCREENING_QUESTIONS[0].questionsFields.map((field) => ({
      label: field.label,
      value: String(field.fieldValue)
    }))
  };
  return SR.fillScreeningRadioField(authField, inventory, fixture.doc).then(function (filled) {
    assert.strictEqual(filled.status, "filled");
    assert.strictEqual(fixture.screeningGroups[0].radios[0].getAttribute("aria-checked"), "true");
    assert.strictEqual(fixture.screeningGroups[0].radios[1].getAttribute("aria-checked"), "false");
    assert.strictEqual(fixture.screeningGroups[1].radios[0].getAttribute("aria-checked"), "false");
    assert.strictEqual(fixture.screeningGroups[1].radios[1].getAttribute("aria-checked"), "false");
    return SR.fillScreeningRadioField(authField, inventory, fixture.doc);
  }).then(function (skipped) {
    assert.strictEqual(skipped.status, "skipped");
    const reloField = {
      category: "relocation",
      label: SCREENING_QUESTIONS[1].label,
      screeningQuestionId: "q-relo",
      inputType: "radio",
      options: SCREENING_QUESTIONS[1].questionsFields.map((field) => ({
        label: field.label,
        value: String(field.fieldValue)
      }))
    };
    return SR.fillScreeningRadioField(reloField, inventory, fixture.doc).then(function (reloFilled) {
      assert.strictEqual(reloFilled.status, "filled");
      assert.strictEqual(fixture.screeningGroups[1].radios[1].getAttribute("aria-checked"), "true");
      assert.strictEqual(fixture.screeningGroups[0].radios[0].getAttribute("aria-checked"), "true");
      const disabilityField = {
        category: "disability_status",
        label: SCREENING_QUESTIONS[3].label,
        screeningQuestionId: "q-disability",
        inputType: "radio",
        options: SCREENING_QUESTIONS[3].questionsFields.map((field) => ({
          label: field.label,
          value: String(field.fieldValue)
        }))
      };
      return SR.fillScreeningRadioField(disabilityField, inventory, fixture.doc);
    });
  }).then(function (disabilityFilled) {
    assert.strictEqual(disabilityFilled.status, "filled");
    assert.strictEqual(fixture.screeningGroups[3].radios[0].getAttribute("aria-checked"), "true");
    assert.strictEqual(fixture.screeningGroups[3].radios[2].getAttribute("aria-checked"), "false");
    const missingField = {
      category: "sponsorship_now",
      label: SCREENING_QUESTIONS[2].label,
      screeningQuestionId: "q-sponsor",
      inputType: "radio",
      options: SCREENING_QUESTIONS[2].questionsFields.map((field) => ({
        label: field.label,
        value: String(field.fieldValue)
      }))
    };
    return SR.fillScreeningRadioField(missingField, {}, fixture.doc);
  }).then(function (missing) {
    assert.strictEqual(missing.status, "skipped");
    fixture.screeningGroups[4].radios.forEach((radio) => {
      radio.click = function () {};
    });
    const veteranField = {
      category: "veteran_status",
      label: SCREENING_QUESTIONS[4].label,
      screeningQuestionId: "q-veteran",
      inputType: "radio",
      options: SCREENING_QUESTIONS[4].questionsFields.map((field) => ({
        label: field.label,
        value: String(field.fieldValue)
      }))
    };
    return SR.fillScreeningRadioField(veteranField, inventory, fixture.doc);
  }).then(function (failed) {
    assert.strictEqual(failed.status, "failed");
    console.log("ok - SmartRecruiters screening radio fill and verification");
    adapterSandbox.ImpulsoAutofill = AF;
    adapterSandbox.setTimeout = setTimeout;
    adapterSandbox.clearTimeout = clearTimeout;
    adapterSandbox.Event = Event;
    adapterSandbox.KeyboardEvent = typeof KeyboardEvent !== "undefined" ? KeyboardEvent : Event;
    adapterSandbox.InputEvent = typeof InputEvent !== "undefined" ? InputEvent : Event;
    adapterSandbox.FocusEvent = typeof FocusEvent !== "undefined" ? FocusEvent : Event;
    adapterSandbox.HTMLInputElement = function HTMLInputElement() {};
    Object.defineProperty(adapterSandbox.HTMLInputElement.prototype, "value", {
      configurable: true,
      enumerable: true,
      get: function () {
        return this._nativeValue != null ? this._nativeValue : "";
      },
      set: function (value) {
        this._nativeValue = String(value);
      }
    });
    const demoLocation = {
      href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
      hostname: "jobs.smartrecruiters.com",
      pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
    };
    const demoFixture = buildScreeningDemographicFixture();
    adapterSandbox.location = demoLocation;
    adapterSandbox.document = demoFixture.doc;
    autofillSandbox.location = demoLocation;
    autofillSandbox.document = demoFixture.doc;
    const demoInventory = { gender: "Man", race_ethnicity: "Asian" };
    return SR.fillScreeningDemographicAutocomplete(
      { category: "gender", label: "Gender" },
      demoInventory,
      demoFixture.doc
    ).then(function (genderFilled) {
      assert.strictEqual(genderFilled.status, "filled");
      assert.strictEqual(demoFixture.genderInput.value, "Male");
      assert.notStrictEqual(demoFixture.genderInput.value, "Female");
      assert.strictEqual(demoFixture.genderInput.getAttribute("aria-expanded"), "false");
      assert.strictEqual(demoFixture.ethnicityInput.value, "");
      assert.strictEqual(demoFixture.genderHost.value, "Male");
      assert.ok(
        demoFixture.genderInput.dispatchedKeys.indexOf("ArrowDown") === -1,
        "Male already active must not receive ArrowDown"
      );
      assert.ok(
        demoFixture.genderInput.dispatchedKeys.indexOf("ArrowUp") === -1,
        "Gender must not use ArrowUp navigation"
      );
      assert.ok(demoFixture.genderListbox.children[0].clickCount >= 1, "exact Male row must be clicked");
      assert.strictEqual(demoFixture.genderListbox.children[1].clickCount, 0, "Female must not be clicked for Male");
      assert.notStrictEqual(
        (demoFixture.genderListbox.children[0].lastClicked &&
          demoFixture.genderListbox.children[0].lastClicked.tagName) ||
          "",
        "SPL-SELECT-OPTION",
        "click target should be the deepest visible descendant of the Male row"
      );
      demoFixture.genderInput.blur();
      assert.strictEqual(demoFixture.genderInput.value, "Male");
      return SR.fillScreeningDemographicAutocomplete(
        { category: "race_ethnicity", label: "Race/Ethnicity" },
        demoInventory,
        demoFixture.doc
      );
    }).then(function (ethnicityFilled) {
      assert.strictEqual(ethnicityFilled.status, "filled");
      assert.strictEqual(demoFixture.ethnicityInput.value, "Asian");
      assert.strictEqual(demoFixture.genderInput.value, "Male");
      assert.strictEqual(demoFixture.ethnicityInput.getAttribute("aria-expanded"), "false");
      assert.strictEqual(demoFixture.ethnicityHost.value, "Asian");
      assert.ok(
        demoFixture.ethnicityInput.dispatchedKeys.indexOf("ArrowDown") === -1,
        "Race/Ethnicity must not use blind ArrowDown"
      );
      assert.ok(
        demoFixture.ethnicityInput.dispatchedKeys.indexOf("ArrowUp") === -1,
        "Race/Ethnicity must not use ArrowUp navigation"
      );
      const asianRow = demoFixture.ethnicityListbox.children.find(
        (child) => String(child.innerText || "").trim() === "Asian"
      );
      assert.ok(asianRow && asianRow.clickCount >= 1, "exact Asian row must be clicked");
      assert.notStrictEqual(
        (asianRow.lastClicked && asianRow.lastClicked.tagName) || "",
        "SPL-SELECT-OPTION",
        "click target should be the deepest visible descendant of the Asian row"
      );
      demoFixture.ethnicityInput.blur();
      assert.strictEqual(demoFixture.ethnicityInput.value, "Asian");
      assert.strictEqual(demoFixture.genderInput.value, "Male");
      return SR.fillScreeningDemographicAutocomplete(
        { category: "gender", label: "Gender" },
        demoInventory,
        demoFixture.doc
      );
    }).then(function (already) {
      assert.strictEqual(already.status, "skipped");
      assert.ok(/already completed/i.test(already.reason || ""));
      const uncommitted = buildScreeningDemographicFixture({ uncommitted: true });
      adapterSandbox.document = uncommitted.doc;
      autofillSandbox.document = uncommitted.doc;
      return SR.fillScreeningDemographicAutocomplete(
        { category: "gender", label: "Gender" },
        { gender: "Man" },
        uncommitted.doc
      ).then(function (typed) {
        assert.strictEqual(typed.status, "failed");
        assert.ok(/did not persist|still open/i.test(typed.reason || ""));
        assert.ok(/category=gender/i.test(typed.reason || ""));
        assert.ok(/proposed=Man/i.test(typed.reason || ""));
        assert.ok(/allowed=/i.test(typed.reason || ""));
        assert.ok(/aria-expanded=/i.test(typed.reason || ""));
        assert.ok(/menuFound=/i.test(typed.reason || ""));
        const isolated = buildScreeningDemographicFixture();
        isolated.genderInput.focus();
        isolated.genderInput.setAttribute("aria-expanded", "true");
        adapterSandbox.document = isolated.doc;
        autofillSandbox.document = isolated.doc;
        return SR.fillScreeningDemographicAutocomplete(
          { category: "race_ethnicity", label: "Race/Ethnicity" },
          { race_ethnicity: "Asian" },
          isolated.doc
        ).then(function (raceOnly) {
          assert.strictEqual(raceOnly.status, "filled");
          assert.strictEqual(isolated.ethnicityInput.value, "Asian");
          assert.notStrictEqual(isolated.genderInput.value, "Asian");
          const applyFixture = buildScreeningDemographicFixture();
          adapterSandbox.document = applyFixture.doc;
          autofillSandbox.document = applyFixture.doc;
          return SR.fillSupportedFields({
            root: applyFixture.doc,
            inventory: { gender: "Man", race_ethnicity: "Asian" }
          }).then(function (applyReport) {
            const genderRows = applyReport.results.filter((row) => row.category === "gender");
            const raceRows = applyReport.results.filter((row) => row.category === "race_ethnicity");
            assert.strictEqual(genderRows.length, 1);
            assert.strictEqual(genderRows[0].status, "filled");
            assert.strictEqual(raceRows.length, 1);
            assert.strictEqual(raceRows[0].status, "filled");
            assert.strictEqual(applyFixture.genderInput.value, "Male");
            assert.strictEqual(applyFixture.ethnicityInput.value, "Asian");
            applyFixture.genderInput.blur();
            applyFixture.ethnicityInput.blur();
            assert.strictEqual(applyFixture.genderInput.value, "Male");
            assert.strictEqual(applyFixture.ethnicityInput.value, "Asian");
            const postApplyScan = AF.scanDocument(applyFixture.doc, {
              gender: "Man",
              race_ethnicity: "Asian"
            });
            assert.strictEqual(
              postApplyScan.fields.find((field) => field.category === "gender").fillStatus,
              "completed"
            );
            assert.strictEqual(
              postApplyScan.fields.find((field) => field.category === "race_ethnicity").fillStatus,
              "completed"
            );
            const continued = buildScreeningDemographicFixture({ uncommittedKinds: ["gender"] });
            adapterSandbox.document = continued.doc;
            autofillSandbox.document = continued.doc;
            return SR.fillSupportedFields({
              root: continued.doc,
              inventory: { gender: "Man", race_ethnicity: "Asian" }
            }).then(function (continuedReport) {
              const failedGender = continuedReport.results.filter((row) => row.category === "gender");
              const filledRace = continuedReport.results.filter((row) => row.category === "race_ethnicity");
              assert.strictEqual(failedGender[0].status, "failed");
              assert.strictEqual(filledRace[0].status, "filled");
              assert.strictEqual(continued.ethnicityInput.value, "Asian");
              return SR.fillScreeningDemographicAutocomplete(
                { category: "gender", label: "Gender" },
                { gender: "Woman" },
                buildScreeningDemographicFixture().doc
              ).then(function (womanFilled) {
                assert.strictEqual(womanFilled.status, "filled");
                assert.strictEqual(womanFilled.value, "Female");
                return SR.fillScreeningDemographicAutocomplete(
                  { category: "gender", label: "Gender" },
                  { gender: "Non-binary" },
                  buildScreeningDemographicFixture().doc
                ).then(function (unmatched) {
                  assert.strictEqual(unmatched.status, "failed");
                  assert.notStrictEqual(unmatched.status, "skipped");
                  assert.ok(/proposed=Non-binary/i.test(unmatched.reason || ""));
                  assert.ok(/Male/i.test(unmatched.reason || ""));
                  const noDict = buildScreeningDemographicFixture({
                    noDictionary: true,
                    visibleRowOnly: true
                  });
                  adapterSandbox.document = noDict.doc;
                  autofillSandbox.document = noDict.doc;
                  return SR.fillScreeningDemographicAutocomplete(
                    { category: "gender", label: "Gender" },
                    { gender: "Man" },
                    noDict.doc
                  ).then(function (noDictFilled) {
                    assert.strictEqual(noDictFilled.status, "filled");
                    assert.strictEqual(noDict.genderInput.value, "Male");
                    assert.ok(noDict.genderInput.dispatchedKeys.indexOf("ArrowDown") === -1);
                    const wrongFemale = buildScreeningDemographicFixture({ genderValue: "Female" });
                    adapterSandbox.document = wrongFemale.doc;
                    autofillSandbox.document = wrongFemale.doc;
                    return SR.fillScreeningDemographicAutocomplete(
                      { category: "gender", label: "Gender" },
                      { gender: "Man" },
                      wrongFemale.doc
                    ).then(function (clearedThenMale) {
                      assert.ok(wrongFemale.genderClear.clickCount >= 1, "wrong Female must be cleared");
                      assert.strictEqual(clearedThenMale.status, "filled");
                      assert.strictEqual(wrongFemale.genderInput.value, "Male");
                      assert.notStrictEqual(wrongFemale.genderInput.value, "Female");
                      const ambiguous = buildScreeningDemographicFixture();
                      const dupMale = createNestedSplSelectOption("Male", "dup", "gender-male-dup");
                      ambiguous.genderListbox.appendChild(dupMale);
                      adapterSandbox.document = ambiguous.doc;
                      autofillSandbox.document = ambiguous.doc;
                      return SR.fillScreeningDemographicAutocomplete(
                        { category: "gender", label: "Gender" },
                        { gender: "Man" },
                        ambiguous.doc
                      ).then(function (ambiguousFailed) {
                        assert.strictEqual(ambiguousFailed.status, "failed");
                        assert.notStrictEqual(ambiguousFailed.status, "skipped");
                        assert.notStrictEqual(ambiguous.genderInput.value, "Female");
                        assert.ok(/ambiguous|no matching visible/i.test(ambiguousFailed.reason || ""));
                  const complete = buildCompleteScreeningFixture();
                  adapterSandbox.location = {
                    href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
                    hostname: "jobs.smartrecruiters.com",
                    pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
                  };
                  adapterSandbox.document = complete.doc;
                  autofillSandbox.document = complete.doc;
                  autofillSandbox.location = adapterSandbox.location;
                  autofillSandbox.__OC_CONTEXT__ = complete.ocContext;
                  adapterSandbox.HTMLInputElement = adapterSandbox.HTMLInputElement;
                  return SR.fillSupportedFields({
                    root: complete.doc,
                    inventory: {
                      work_authorization: "Yes",
                      relocation: "Yes",
                      sponsorship_now: "No",
                      disability_status:
                        "Yes, I have a disability, or have a history/record of having a disability",
                      veteran_status: "I am a protected veteran",
                      gender: "Man",
                      race_ethnicity: "Asian"
                    },
                    resume: { resumeBase64: "JVBERi0=", resumeName: "resume.pdf" }
                  }).then(function (completeReport) {
                    const filled = completeReport.results.filter((row) => row.status === "filled");
                    const skipped = completeReport.results.filter((row) => row.status === "skipped");
                    const failed = completeReport.results.filter((row) => row.status === "failed");
                    assert.ok(filled.length >= 5, "radio groups and demographics should fill");
                    assert.ok(
                      !failed.some((row) => row.category === "work_authorization"),
                      "selected radios should not fail"
                    );
                    const genderRow = completeReport.results.find((row) => row.category === "gender");
                    const raceRow = completeReport.results.find((row) => row.category === "race_ethnicity");
                    assert.strictEqual(genderRow.status, "filled");
                    assert.strictEqual(raceRow.status, "filled");
                    const referralRow = completeReport.results.find((row) => row.category === "referral_source");
                    assert.strictEqual(referralRow.status, "skipped");
                    assert.ok(/no saved answer/i.test(referralRow.reason || ""));
                    const privacyRow = completeReport.results.find((row) => row.category === "privacy_consent");
                    assert.strictEqual(privacyRow.status, "skipped");
                    assert.ok(/user confirmation required/i.test(privacyRow.reason || ""));
                    assert.strictEqual(complete.privacyInner.checked, false);
                    assert.strictEqual(complete.privacyCheckbox.getAttribute("aria-checked"), "false");
                    assert.strictEqual(complete.submitClicks(), 0);
                    assert.strictEqual(complete.referralInput.value, "");
                    const refreshed = AF.scanDocument(complete.doc, {
                      work_authorization: "Yes",
                      relocation: "Yes",
                      sponsorship_now: "No",
                      disability_status:
                        "Yes, I have a disability, or have a history/record of having a disability",
                      veteran_status: "I am a protected veteran",
                      gender: "Man",
                      race_ethnicity: "Asian"
                    });
                    const readyAfter = refreshed.fields.filter((field) => field.fillStatus === "ready");
                    assert.ok(
                      !readyAfter.some((field) => field.inputType === "radio"),
                      "selected radios must not remain Ready to fill"
                    );
                    assert.strictEqual(
                      refreshed.fields.find((field) => field.category === "gender").fillStatus,
                      "completed"
                    );
                    assert.strictEqual(
                      refreshed.fields.find((field) => field.category === "race_ethnicity").fillStatus,
                      "completed"
                    );
                    assert.strictEqual(
                      refreshed.fields.filter((field) => field.inputType === "radio" && field.fillStatus === "completed")
                        .length,
                      5
                    );
                    assert.strictEqual(refreshed.fields.find((field) => field.category === "privacy_consent").fillStatus, "missing");
                    assert.ok(!refreshed.fields.some((field) => field.category === "first_name"));
                    assert.ok(!refreshed.fields.some((field) => field.label === "*"));
                    assert.strictEqual(complete.submitClicks(), 0);
                    assert.ok(
                      completeReport.summary.failed === failed.length
                    );
                    assert.ok(
                      genderRow.status !== "skipped" && raceRow.status !== "skipped"
                    );
                  });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    }).then(function () {
      console.log("ok - SmartRecruiters screening demographic autocomplete fill");
    adapterSandbox.ImpulsoAutofill = AF;
    adapterSandbox.setTimeout = setTimeout;
    const page1 = buildSmartRecruitersResumeFixture("");
    adapterSandbox.location = {
      href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
      hostname: "jobs.smartrecruiters.com",
      pathname: "/oneclick-ui/company/Socotec/publication/abc"
    };
    adapterSandbox.document = page1.doc;
    return SR.fillSupportedFields({
      root: page1.doc,
      inventory: { first_name: "Raj" },
      resume: null
    }).then(function (page1Report) {
      const resumeRows = page1Report.results.filter((row) => row.category === "resume_upload");
      assert.strictEqual(resumeRows.length, 1, "page 1 resume preflight should run");
      assert.ok(
        /no resume file|not found/i.test(resumeRows[0].reason || ""),
        "page 1 preflight should report a resume-control or payload failure"
      );
      const missing = buildEmptyApplicationDoc();
      adapterSandbox.location = {
        href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc",
        hostname: "jobs.smartrecruiters.com",
        pathname: "/oneclick-ui/company/Socotec/publication/abc"
      };
      adapterSandbox.document = missing.doc;
      return SR.fillSupportedFields({
        root: missing.doc,
        inventory: { first_name: "Raj" },
        resume: { resumeBase64: "JVBERi0=", resumeName: "resume.pdf" }
      }).then(function (missingReport) {
        const missingResume = missingReport.results.filter((row) => row.category === "resume_upload");
        assert.strictEqual(missingResume.length, 1);
        assert.strictEqual(missingResume[0].status, "failed");
        assert.ok(
          /apply-with-resume-container\) was not found/i.test(missingResume[0].reason || ""),
          missingResume[0].reason
        );
        const screening = buildScreeningOnlyFixture();
        adapterSandbox.__IMPULSO_SR_PARSER_DROPZONE__ = page1.topDropzone;
        adapterSandbox.__IMPULSO_SR_PARSER_FILE_INPUT__ = page1.topInput;
        adapterSandbox.location = {
          href: "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/abc/screening",
          hostname: "jobs.smartrecruiters.com",
          pathname: "/oneclick-ui/company/Socotec/publication/abc/screening"
        };
        adapterSandbox.document = screening.doc;
        autofillSandbox.document = screening.doc;
        autofillSandbox.location = adapterSandbox.location;
        return SR.fillSupportedFields({
          root: screening.doc,
          inventory: { first_name: "Raj", work_authorization: "Yes" },
          resume: { resumeBase64: "JVBERi0=", resumeName: "resume.pdf" }
        });
      });
    }).then(function (screeningReport) {
      assert.ok(
        !screeningReport.results.some((row) => row.category === "resume_upload"),
        "screening preflight should not add a resume counter"
      );
      assert.ok(
        !screeningReport.results.some((row) => /apply-with-resume-container/i.test(row.reason || "")),
        "screening should not report a missing resume parser"
      );
      assert.ok(
        !screeningReport.results.some((row) => row.category === "first_name"),
        "screening fill should not include stale page-1 fields"
      );
      assert.strictEqual(adapterSandbox.__IMPULSO_SR_PARSER_DROPZONE__, null);
      assert.strictEqual(adapterSandbox.__IMPULSO_SR_PARSER_FILE_INPUT__, null);
      assert.ok(
        screeningReport.results.every((row) => {
          return (
            row.category === "work_authorization" ||
            row.category === "sponsorship_now" ||
            row.category === "sponsorship_later" ||
            row.category === "relocation" ||
            row.category === "disability_status" ||
            row.category === "veteran_status"
          );
        }),
        "screening Auto-Apply should only process current-step fields"
      );
      adapterSandbox.location = {
        href: "https://example.com/apply",
        hostname: "example.com",
        pathname: "/apply"
      };
      return SR.fillSupportedFields({ inventory: { first_name: "Raj" } });
    });
    });
  });
}).then(function (report) {
  assert.strictEqual(report.summary.attempted, 0);
  assert.strictEqual(report.summary.filled, 0);
  console.log("ok - SmartRecruiters fill is a no-op off the application page");
  console.log("All SmartRecruiters tests passed.");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
