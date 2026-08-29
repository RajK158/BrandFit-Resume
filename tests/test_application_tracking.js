const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const window = {};
const context = {
  window,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  URL,
  console
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "applications.js"), "utf8"),
  context
);

const core = window.ImpulsoApplications;

const normalized = core.normalizeApplication({
  company: "Example, Inc.",
  title: "Software Engineer",
  jobUrl: "https://example.com/jobs/123",
  status: "interview",
  resumeType: "tailored",
  matchScore: 106,
  notes: "Recruiter said \"follow up\""
});

assert.strictEqual(normalized.status, "Interview");
assert.strictEqual(normalized.resumeType, "tailored");
assert.strictEqual(normalized.matchScore, 100);
assert.ok(normalized.id.startsWith("application-job-"));

const withoutScore = core.normalizeApplication({
  company: "No Score Company",
  title: "Developer",
  matchScore: null
});
assert.strictEqual(withoutScore.matchScore, null);

assert.strictEqual(
  core.findStoredMatchScore(
    { matchAnalysis: { matchScore: 87 } },
    { analysis: null, missing: true }
  ),
  87
);

assert.strictEqual(
  core.findStoredMatchScore(
    {
      matchAnalyses: {
        old: { matchScore: 71, analyzedAt: "2026-08-20T00:00:00.000Z" },
        latest: { matchScore: 93, analyzedAt: "2026-08-21T00:00:00.000Z" }
      }
    },
    null
  ),
  93
);

const csv = core.applicationsToCsv([
  normalized,
  {
    company: "Second Company",
    title: "Data Engineer",
    jobUrl: "https://example.com/jobs/456",
    status: "Applied",
    notes: "Line one\nLine two"
  }
]);

assert.ok(csv.includes('"Example, Inc."'));
assert.ok(csv.includes('"Recruiter said ""follow up"""'));

const parsed = core.parseApplicationsCsv(csv);
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed[0].company, "Example, Inc.");
assert.strictEqual(parsed[0].status, "Interview");
assert.strictEqual(parsed[0].notes, 'Recruiter said "follow up"');
assert.strictEqual(parsed[1].notes, "Line one\nLine two");

const edited = csv.replace('"Interview"', '"Offer"');
const editedParsed = core.parseApplicationsCsv(edited);
assert.strictEqual(editedParsed[0].status, "Offer");

assert.deepStrictEqual(Array.from(core.parseApplicationsCsv("company,job_title\n,")), []);

console.log("All application tracking tests passed.");
