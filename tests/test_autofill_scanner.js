"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const autofillPath = path.join(__dirname, "..", "autofill.js");
const code = fs.readFileSync(autofillPath, "utf8");
const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.runInNewContext(code, sandbox, { filename: "autofill.js" });

const AF = sandbox.ImpulsoAutofill;
assert.ok(AF, "ImpulsoAutofill should load");

function classify(label, inputType, extra) {
  return AF.classifyLabel(label, inputType, extra || {});
}

const cases = [
  {
    name: "Legal Name (First Name Last Name)",
    label: "Legal Name (First Name Last Name)",
    inputType: "text",
    expected: "full_name"
  },
  {
    name: "Email",
    label: "Email",
    inputType: "email",
    expected: "email"
  },
  {
    name: "Confirm your email",
    label: "Confirm your email",
    inputType: "email",
    expected: "email"
  },
  {
    name: "Message to hiring manager",
    label: "Message to hiring manager",
    inputType: "textarea",
    expected: "additional_information"
  },
  {
    name: "Phone Number",
    label: "Phone Number",
    inputType: "text",
    expected: "phone"
  },
  {
    name: "Resume",
    label: "Resume",
    inputType: "file",
    expected: "resume_upload"
  },
  {
    name: "Resume text field is not resume upload",
    label: "Resume",
    inputType: "text",
    expected: "unknown"
  },
  {
    name: "Cover letter file is not resume",
    label: "Cover Letter",
    inputType: "file",
    expected: "cover_letter"
  },
  {
    name: "LinkedIn Profile",
    label: "LinkedIn Profile",
    inputType: "url",
    expected: "linkedin"
  },
  {
    name: "Preferred Name",
    label: "Preferred Name",
    inputType: "text",
    expected: "preferred_name"
  },
  {
    name: "Are you legally authorized to work in the United States?",
    label: "Are you legally authorized to work in the United States?",
    inputType: "radio",
    expected: "work_authorization"
  },
  {
    name: "A United States citizen or national",
    label: "A United States citizen or national",
    inputType: "radio",
    expected: "work_authorization"
  },
  {
    name: "Will you require sponsorship now or in the future?",
    label: "Will you require sponsorship now or in the future?",
    inputType: "radio",
    expected: "sponsorship_now"
  },
  {
    name: "Hispanic or Latino",
    label: "Hispanic or Latino",
    inputType: "radio",
    expected: "hispanic_latino"
  },
  {
    name: "Veteran Status",
    label: "Veteran Status",
    inputType: "radio",
    expected: "veteran_status"
  },
  {
    name: "Disability Status",
    label: "Disability Status",
    inputType: "radio",
    expected: "disability_status"
  },
  {
    name: "Gender from Male/Female options",
    label: "Gender",
    inputType: "radio",
    extra: { optionLabels: ["Male", "Female", "Non-binary"] },
    expected: "gender"
  }
];

let failed = 0;
cases.forEach(function (testCase) {
  const result = classify(testCase.label, testCase.inputType, testCase.extra);
  try {
    assert.strictEqual(
      result.category,
      testCase.expected,
      testCase.name + " => " + result.category + " (expected " + testCase.expected + ")"
    );
    console.log("ok - " + testCase.name);
  } catch (error) {
    failed += 1;
    console.error("fail - " + error.message);
  }
});

const inventory = AF.buildAnswerInventory(
  {
    personal: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "" },
    links: { linkedin: "https://linkedin.com/in/ada" },
    workAuthorization: { legallyAuthorizedToWork: "Yes", requireSponsorshipNow: "" },
    demographics: {}
  },
  { hasResume: true }
);

assert.strictEqual(AF.hasAnswerForCategory("first_name", inventory), true);
assert.strictEqual(AF.hasAnswerForCategory("phone", inventory), false);
assert.strictEqual(AF.hasAnswerForCategory("preferred_name", inventory), false);
assert.strictEqual(AF.hasAnswerForCategory("resume_upload", inventory), true);
assert.strictEqual(AF.hasAnswerForCategory("linkedin", inventory), true);
// Page option text must not count as an Impulso answer
assert.strictEqual(AF.hasAnswerForCategory("gender", { gender: "" }), false);
assert.strictEqual(AF.hasAnswerForCategory("unknown", inventory), false);
console.log("ok - hasAnswer uses inventory only");

assert.strictEqual(AF.getProposedAnswer("work_authorization", inventory), "Yes");
assert.strictEqual(AF.getProposedAnswer("phone", inventory), "No saved answer");
assert.strictEqual(AF.getProposedAnswer("gender", inventory), "No saved answer");
assert.strictEqual(
  AF.getProposedAnswer("gender", { gender: "Non-binary" }),
  "Non-binary"
);
assert.strictEqual(
  AF.getProposedAnswer("resume_upload", {
    resume_upload: "Ada_Lovelace_Resume.pdf",
    resume_filename: "Ada_Lovelace_Resume.pdf"
  }),
  "Ada_Lovelace_Resume.pdf"
);
console.log("ok - proposed answers use inventory only");

const inventoryWithResume = AF.buildAnswerInventory(
  { personal: { firstName: "Ada" }, demographics: { gender: "Woman" } },
  { hasResume: true, resumeName: "tailored.pdf" }
);
assert.strictEqual(inventoryWithResume.resume_upload, "tailored.pdf");
assert.strictEqual(AF.getProposedAnswer("resume_upload", inventoryWithResume), "tailored.pdf");
assert.strictEqual(AF.getProposedAnswer("gender", inventoryWithResume), "Woman");
assert.strictEqual(AF.isSensitiveCategory("gender"), true);
assert.strictEqual(AF.isSensitiveCategory("email"), false);
console.log("ok - resume filename and sensitive categories");

const enriched = AF.enrichScanField(
  {
    category: "work_authorization",
    label: "Are you legally authorized to work in the United States?",
    inputType: "radio",
    required: true,
    currentValue: "",
    confidence: 0.92,
    confidenceLabel: "High"
  },
  inventory
);
assert.strictEqual(enriched.question, "Are you legally authorized to work in the United States?");
assert.strictEqual(enriched.proposedAnswer, "Yes");
assert.strictEqual(enriched.hasAnswer, true);
console.log("ok - enriched scan field proposed answer");

const bogusResume = AF.validateScanField({
  category: "resume_upload",
  inputType: "text",
  hasAnswer: true,
  currentValue: "",
  label: "Resume"
});
assert.strictEqual(bogusResume.category, "unknown");
console.log("ok - non-file cannot be resume upload");

const summary = AF.summarizeFields([
  {
    category: "email",
    required: true,
    currentValue: "",
    hasAnswer: false,
    fillStatus: "missing"
  },
  {
    category: "phone",
    required: true,
    currentValue: "",
    hasAnswer: true,
    fillStatus: "ready"
  },
  {
    category: "gender",
    required: true,
    currentValue: "",
    hasAnswer: false,
    skipped: true,
    fillStatus: "skipped"
  }
]);
assert.strictEqual(summary.requiredUnansweredFields, 1);
console.log("ok - required unanswered excludes fields with Impulso answers and skipped");

// Nearby pollution should not flip Gender into race/ethnicity
const genderNearRace = AF.classifyLabel("Gender", "radio", {
  nearby: "Hispanic or Latino Yes No",
  optionLabels: ["Male", "Female", "Non-binary"]
});
assert.strictEqual(genderNearRace.category, "gender");
console.log("ok - gender question boundary resists nearby race options");

const hispanicQ = AF.classifyLabel("Hispanic or Latino", "radio", {
  optionLabels: ["Yes", "No"]
});
assert.strictEqual(hispanicQ.category, "hispanic_latino");
console.log("ok - Hispanic or Latino is a dedicated hispanic/latino field");

if (failed) {
  console.error(failed + " classification test(s) failed");
  process.exit(1);
}

console.log("All autofill scanner tests passed.");
