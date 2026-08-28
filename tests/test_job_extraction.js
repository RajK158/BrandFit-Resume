"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadJob(document, location) {
  const sandbox = {
    console: console,
    URL: URL,
    Date: Date,
    document: document,
    location: location
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "job.js"), "utf8"),
    sandbox,
    { filename: "job.js" }
  );
  return sandbox.ImpulsoJob;
}

function createEl(tagName) {
  const el = {
    tagName: String(tagName || "DIV").toUpperCase(),
    children: [],
    parentElement: null,
    attributes: {},
    className: "",
    id: "",
    hidden: false,
    _text: ""
  };
  el.getAttribute = function (name) {
    if (name === "id") return this.id || null;
    if (name === "class") return this.className || null;
    return this.attributes[name] != null ? this.attributes[name] : null;
  };
  el.setAttribute = function (name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
  };
  el.appendChild = function (child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  };
  el.querySelector = function (selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  };
  el.querySelectorAll = function (selector) {
    return queryAll(this, selector);
  };
  el.cloneNode = function () {
    const clone = createEl(this.tagName);
    clone.className = this.className;
    clone.id = this.id;
    clone.hidden = this.hidden;
    clone._text = this._text;
    clone.attributes = Object.assign({}, this.attributes);
    this.children.forEach(function (child) {
      clone.appendChild(child.cloneNode(true));
    });
    return clone;
  };
  el.remove = function () {
    if (!this.parentElement) return;
    const kids = this.parentElement.children;
    const idx = kids.indexOf(this);
    if (idx >= 0) kids.splice(idx, 1);
    this.parentElement = null;
  };
  Object.defineProperty(el, "innerText", {
    get() {
      if (this._text) return this._text;
      return this.children.map((child) => child.innerText || "").join(" ");
    },
    set(value) {
      this._text = String(value || "");
    }
  });
  Object.defineProperty(el, "textContent", {
    get() {
      return this.innerText;
    },
    set(value) {
      this.innerText = value;
    }
  });
  return el;
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

function matchSimple(el, part) {
  const sel = String(part || "").trim();
  if (!sel || sel === "*") return true;
  const tag = (el.tagName || "").toLowerCase();
  if (sel.charAt(0) === ".") {
    return (" " + (el.className || "") + " ").indexOf(" " + sel.slice(1) + " ") !== -1;
  }
  if (sel.charAt(0) === "#") return el.id === sel.slice(1);
  const contains = sel.match(/^\[([^\]]+)\*=['"]([^'"]+)['"]\]$/);
  if (contains) {
    const actual = String(el.getAttribute(contains[1]) || el.className || "");
    return actual.toLowerCase().indexOf(contains[2].toLowerCase()) !== -1;
  }
  const attr = sel.match(/^([a-z][\w-]*)?\[([^=]+)=['"]([^'"]+)['"]\]$/i);
  if (attr) {
    if (attr[1] && tag !== attr[1].toLowerCase()) return false;
    return el.getAttribute(attr[2]) === attr[3];
  }
  return tag === sel.toLowerCase();
}

function matchOne(el, part) {
  const tokens = String(part || "").trim().split(/\s+/);
  if (tokens.length === 1) return matchSimple(el, tokens[0]);
  if (!matchSimple(el, tokens[tokens.length - 1])) return false;
  let ancestor = el.parentElement;
  for (let i = tokens.length - 2; i >= 0; i -= 1) {
    while (ancestor && !matchSimple(ancestor, tokens[i])) ancestor = ancestor.parentElement;
    if (!ancestor) return false;
    ancestor = ancestor.parentElement;
  }
  return true;
}

function queryAll(root, selector) {
  const all = allDescendants(root);
  const parts = String(selector || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return all.filter((el) => parts.some((part) => matchOne(el, part)));
}

function createDocument(children) {
  const html = createEl("html");
  const body = createEl("body");
  html.appendChild(body);
  (children || []).forEach((child) => body.appendChild(child));
  const doc = {
    body: body,
    documentElement: html,
    title: "",
    querySelector: function (selector) {
      const all = this.querySelectorAll(selector);
      return all.length ? all[0] : null;
    },
    querySelectorAll: function (selector) {
      return queryAll(html, selector);
    }
  };
  return doc;
}

function el(tag, text, attrs) {
  const node = createEl(tag);
  if (text) node.innerText = text;
  Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
  return node;
}

function smartRecruitersDom(options) {
  const opts = options || {};
  const ie = el(
    "h1",
    "Sorry, Internet Explorer 11 is no longer supported by SmartRecruiters"
  );
  const header = createEl("header");
  const titleH1 = el("h1", opts.title || "Junior Software Engineer");
  const titleP = el("p", opts.title || "Junior Software Engineer");
  header.appendChild(titleH1);
  header.appendChild(titleP);
  const otherJobs = el(
    "div",
    "OTHER JOBS AT SOCOTEC Junior Adviser Energy Performance ...",
    { class: "company" }
  );
  const description = el(
    "article",
    "We're hiring a Software Engineer to join our US engineering team and contribute meaningfully across our AI platform and product portfolio. This is a full-stack role with significant exposure to applied AI, data infrastructure, and enterprise automation."
  );
  const children = [ie, header, otherJobs, description];
  if (opts.jsonLd) {
    const script = el("script", JSON.stringify(opts.jsonLd), {
      type: "application/ld+json"
    });
    children.unshift(script);
  }
  if (opts.includeApplication) {
    children.push(el("div", "", { id: "application" }));
  }
  return createDocument(children);
}

function assertSocotecCompany(company) {
  assert.ok(/^socotec$/i.test(String(company || "")), "company should be Socotec/SOCOTEC, got " + company);
}

function assertJuniorTitle(title) {
  assert.strictEqual(String(title || ""), "Junior Software Engineer");
}

(function testOneclickUrlExtraction() {
  const href =
    "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/744000141326319?dcr_ci=Socotec";
  const location = {
    href: href,
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/744000141326319",
    search: "?dcr_ci=Socotec"
  };
  const Job = loadJob(smartRecruitersDom({ includeApplication: true }), location);
  const extracted = Job.extractJobFromPage();
  assert.strictEqual(extracted.atsPlatform, "smartrecruiters");
  assertJuniorTitle(extracted.title);
  assertSocotecCompany(extracted.company);
  assert.ok(extracted.url.indexOf("jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/") !== -1);
  assert.ok(extracted.url.indexOf("dcr_ci=Socotec") !== -1);
  assert.ok(!/internet explorer|no longer supported|other jobs at/i.test(extracted.title));
  assert.ok(!/other jobs at/i.test(extracted.company));
  assert.ok(extracted.description.indexOf("US engineering team") !== -1);
})();
console.log("ok - SmartRecruiters oneclick Current Job extraction");

(function testCanonicalUrlJsonLdExtraction() {
  const href = "https://jobs.smartrecruiters.com/Socotec/744000141326319-junior-software-engineer-";
  const location = {
    href: href,
    hostname: "jobs.smartrecruiters.com",
    pathname: "/Socotec/744000141326319-junior-software-engineer-",
    search: ""
  };
  const Job = loadJob(
    smartRecruitersDom({
      jsonLd: {
        "@type": "JobPosting",
        title: "Junior Software Engineer",
        hiringOrganization: { name: "SOCOTEC" },
        description: "We're hiring a Software Engineer to join our US engineering team and contribute meaningfully across our AI platform and product portfolio."
      }
    }),
    location
  );
  const extracted = Job.extractJobFromPage();
  assert.strictEqual(extracted.atsPlatform, "smartrecruiters");
  assertJuniorTitle(extracted.title);
  assertSocotecCompany(extracted.company);
  assert.strictEqual(
    extracted.url,
    "https://jobs.smartrecruiters.com/Socotec/744000141326319-junior-software-engineer-"
  );
  assert.ok(!/internet explorer|other jobs at/i.test(extracted.title + " " + extracted.company));
})();
console.log("ok - SmartRecruiters canonical Current Job extraction");

(function testHeaderParagraphFallbackAndJunkRejection() {
  const href = "https://jobs.smartrecruiters.com/SOCOTEC/744000141326319-junior-software-engineer-";
  const location = {
    href: href,
    hostname: "jobs.smartrecruiters.com",
    pathname: "/SOCOTEC/744000141326319-junior-software-engineer-",
    search: ""
  };
  const ie = el(
    "h1",
    "Sorry, Internet Explorer 11 is no longer supported by SmartRecruiters"
  );
  const header = createEl("header");
  header.appendChild(el("p", "Junior Software Engineer"));
  const otherJobs = el(
    "div",
    "OTHER JOBS AT SOCOTEC Junior Adviser Energy Performance",
    { class: "company" }
  );
  const Job = loadJob(createDocument([ie, header, otherJobs]), location);
  const extracted = Job.extractJobFromPage();
  assertJuniorTitle(extracted.title);
  assertSocotecCompany(extracted.company);
})();
console.log("ok - SmartRecruiters header paragraph title fallback");

(function testReplaceOverwritesGreenhouseFields() {
  const greenhouseLocation = {
    href: "https://boards.greenhouse.io/oldco/jobs/123",
    hostname: "boards.greenhouse.io",
    pathname: "/oldco/jobs/123",
    search: ""
  };
  const ghTitle = el("h1", "Greenhouse Role", { class: "app-title" });
  const ghCompany = el("div", "Old Greenhouse Co", { class: "company-name" });
  const GreenhouseJob = loadJob(createDocument([ghTitle, ghCompany]), greenhouseLocation);
  const greenhouse = GreenhouseJob.extractJobFromPage();
  assert.strictEqual(greenhouse.atsPlatform, "greenhouse");
  assert.strictEqual(greenhouse.title, "Greenhouse Role");

  const href =
    "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/744000141326319?dcr_ci=Socotec";
  const srLocation = {
    href: href,
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/Socotec/publication/744000141326319",
    search: "?dcr_ci=Socotec"
  };
  const SmartJob = loadJob(smartRecruitersDom({ includeApplication: true }), srLocation);
  const incoming = SmartJob.extractJobFromPage();
  assert.strictEqual(incoming.atsPlatform, "smartrecruiters");
  assertJuniorTitle(incoming.title);
  assertSocotecCompany(incoming.company);
  assert.notStrictEqual(incoming.title, greenhouse.title);
  assert.notStrictEqual(incoming.company, greenhouse.company);
  assert.notStrictEqual(incoming.url, greenhouse.url);
  assert.notStrictEqual(incoming.atsPlatform, greenhouse.atsPlatform);
})();
console.log("ok - Replace Current Job overwrites Greenhouse extraction");

(function testWesternDigitalJsonLdLocation() {
  const href =
    "https://jobs.smartrecruiters.com/oneclick-ui/company/WesternDigital/publication/abc?dcr_ci=WesternDigital";
  const location = {
    href: href,
    hostname: "jobs.smartrecruiters.com",
    pathname: "/oneclick-ui/company/WesternDigital/publication/abc",
    search: "?dcr_ci=WesternDigital"
  };
  const header = createEl("header");
  header.appendChild(el("h1", "Software Engineer"));
  header.appendChild(el("p", "San Jose, CA, United States"));
  const description = el(
    "article",
    "We're hiring a Software Engineer in San Jose to join our US engineering team."
  );
  const script = el(
    "script",
    JSON.stringify({
      "@type": "JobPosting",
      title: "Software Engineer",
      hiringOrganization: { name: "Western Digital" },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "San Jose",
          addressRegion: "CA",
          addressCountry: "United States"
        }
      },
      description: "We're hiring a Software Engineer in San Jose to join our US engineering team."
    }),
    { type: "application/ld+json" }
  );
  const Job = loadJob(createDocument([script, header, description]), location);
  const extracted = Job.extractJobFromPage();
  assert.strictEqual(extracted.atsPlatform, "smartrecruiters");
  assert.strictEqual(extracted.title, "Software Engineer");
  assert.ok(/western\s*digital/i.test(extracted.company));
  assert.strictEqual(extracted.location, "San Jose, CA, United States");
  assert.ok(extracted.url.indexOf("jobs.smartrecruiters.com") !== -1);
  assert.ok(extracted.description.indexOf("US engineering team") !== -1);
  assert.ok(!/internet explorer|no longer supported/i.test(extracted.location));
})();
console.log("ok - SmartRecruiters Western Digital job location extraction");

(function testGreenhouseExtractorUnchanged() {
  const location = {
    href: "https://boards.greenhouse.io/acme/jobs/99",
    hostname: "boards.greenhouse.io",
    pathname: "/acme/jobs/99",
    search: ""
  };
  const title = el("h1", "Staff Engineer", { class: "app-title" });
  const company = el("span", "Acme Inc", { class: "company-name" });
  const Job = loadJob(createDocument([title, company]), location);
  const extracted = Job.extractJobFromPage();
  assert.strictEqual(extracted.atsPlatform, "greenhouse");
  assert.strictEqual(extracted.title, "Staff Engineer");
  assert.strictEqual(extracted.company, "Acme Inc");
})();
console.log("ok - Greenhouse job extractor preserved");

console.log("All Current Job extraction tests passed.");
