(function (global) {
  "use strict";

  /**
   * Page-context extractor. Must stay self-contained for chrome.scripting.executeScript.
   */
  function extractJobFromPage() {
    function cleanText(value) {
      return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function textOf(el) {
      if (!el) return "";
      return cleanText(el.innerText || el.textContent || "");
    }

    function attrOf(el, name) {
      if (!el) return "";
      return cleanText(el.getAttribute(name) || "");
    }

    function firstText(selectors) {
      for (let i = 0; i < selectors.length; i += 1) {
        const el = document.querySelector(selectors[i]);
        const value = textOf(el);
        if (value) return value;
      }
      return "";
    }

    function firstAttr(selectors, attrName) {
      for (let i = 0; i < selectors.length; i += 1) {
        const el = document.querySelector(selectors[i]);
        const value = attrOf(el, attrName);
        if (value) return value;
      }
      return "";
    }

    function collectDescription(selectors, minLength) {
      const min = minLength || 180;
      for (let i = 0; i < selectors.length; i += 1) {
        const el = document.querySelector(selectors[i]);
        const value = textOf(el);
        if (value && value.length >= min) return value;
      }
      return "";
    }

    function bodyFallback() {
      const clone = document.body ? document.body.cloneNode(true) : null;
      if (!clone) return "";
      clone
        .querySelectorAll("script, style, noscript, svg, nav, footer, header, aside, form, input, button, label")
        .forEach(function (el) {
          el.remove();
        });
      return cleanText(clone.innerText || "");
    }

    function canonicalizeUrl(rawUrl) {
      try {
        const parsed = new URL(String(rawUrl || ""));
        parsed.hash = "";
        const dropExact = {
          src: true,
          source: true,
          ref: true,
          refid: true,
          trk: true,
          trackingid: true,
          fbclid: true,
          gclid: true,
          mc_cid: true,
          mc_eid: true,
          _ga: true,
          _gl: true
        };
        Array.from(parsed.searchParams.keys()).forEach(function (key) {
          const lower = String(key || "").toLowerCase();
          if (dropExact[lower] || lower.indexOf("utm_") === 0) {
            parsed.searchParams.delete(key);
          }
        });
        var path = parsed.pathname.replace(/\/+$/, "");
        if (!path) path = "";
        var query = parsed.searchParams.toString();
        return parsed.origin + path + (query ? "?" + query : "");
      } catch (_) {
        return String(rawUrl || "").trim();
      }
    }

    function detectAts(hostname, href) {
      const host = String(hostname || "").toLowerCase();
      const url = String(href || "").toLowerCase();

      if (host.indexOf("linkedin.com") >= 0) return "linkedin";
      if (
        host.indexOf("greenhouse.io") >= 0 ||
        host.indexOf("boards.greenhouse") >= 0 ||
        document.querySelector("#greenhouse-job-application, #application, .app-title")
      ) {
        return "greenhouse";
      }
      if (host.indexOf("lever.co") >= 0 || document.querySelector(".posting, .postings-wrapper")) {
        return "lever";
      }
      if (host.indexOf("ashbyhq.com") >= 0 || host.indexOf("jobs.ashby") >= 0) {
        return "ashby";
      }
      if (
        host.indexOf("myworkdayjobs.com") >= 0 ||
        host.indexOf("workday.com") >= 0 ||
        (url.indexOf("/job/") >= 0 && document.querySelector("[data-automation-id]"))
      ) {
        return "workday";
      }
      return "generic";
    }

    function parseJsonLdJobPosting() {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (let i = 0; i < scripts.length; i += 1) {
        const raw = scripts[i].textContent || scripts[i].innerText || "";
        if (!raw.trim()) continue;
        try {
          const parsed = JSON.parse(raw);
          const queue = Array.isArray(parsed)
            ? parsed.slice()
            : parsed && parsed["@graph"]
              ? parsed["@graph"].slice()
              : [parsed];
          while (queue.length) {
            const item = queue.shift();
            if (!item || typeof item !== "object") continue;
            if (Array.isArray(item)) {
              queue.push.apply(queue, item);
              continue;
            }
            const type = item["@type"];
            const isJob =
              type === "JobPosting" ||
              (Array.isArray(type) && type.indexOf("JobPosting") >= 0);
            if (isJob) return item;
            if (item["@graph"]) queue.push(item["@graph"]);
          }
        } catch (_) {
          // Ignore invalid JSON-LD blocks.
        }
      }
      return null;
    }

    function organizationNameFromJsonLd(jobPosting) {
      if (!jobPosting) return "";
      const org = jobPosting.hiringOrganization;
      if (!org) return "";
      if (typeof org === "string") return cleanText(org);
      if (typeof org === "object") return cleanText(org.name || "");
      return "";
    }

    function locationFromJsonLd(jobPosting) {
      if (!jobPosting) return "";
      const loc = jobPosting.jobLocation;
      if (!loc) {
        return cleanText(jobPosting.jobLocationType || "");
      }

      function fromPlace(place) {
        if (!place) return "";
        if (typeof place === "string") return cleanText(place);
        if (place.name) return cleanText(place.name);
        const address = place.address;
        if (!address) return "";
        if (typeof address === "string") return cleanText(address);
        const parts = [
          address.streetAddress,
          address.addressLocality,
          address.addressRegion,
          address.postalCode,
          address.addressCountry
        ]
          .map(cleanText)
          .filter(Boolean);
        return parts.join(", ");
      }

      if (Array.isArray(loc)) {
        return loc
          .map(fromPlace)
          .filter(Boolean)
          .join("; ");
      }
      return fromPlace(loc);
    }

    function isAshbyJunkCompany(name) {
      const value = cleanText(name);
      if (!value) return true;
      const lower = value.toLowerCase();
      if (lower === "ashby" || lower === "ashbyhq" || lower === "ashby hq") return true;
      if (lower === "powered by" || lower === "powered by ashby") return true;
      if (lower.indexOf("powered by") >= 0) return true;
      if (lower === "apply now" || lower.indexOf("apply now") === 0) return true;
      if (lower === "jobs" || lower === "careers") return true;
      return false;
    }

    function acceptCompany(name) {
      const value = cleanText(name);
      if (!value || isAshbyJunkCompany(value)) return "";
      return value;
    }

    function formatOrgSlug(slug) {
      const raw = cleanText(slug).replace(/^@+/, "");
      if (!raw || isAshbyJunkCompany(raw)) return "";
      return raw
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, function (ch) {
          return ch.toUpperCase();
        });
    }

    function ashbyOrgFromUrl(href) {
      try {
        const parsed = new URL(String(href || ""));
        const host = parsed.hostname.toLowerCase();
        if (host.indexOf("ashbyhq.com") < 0 && host.indexOf("jobs.ashby") < 0) return "";
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (!parts.length) return "";
        const reserved = {
          job: true,
          jobs: true,
          api: true,
          application: true,
          apply: true,
          posting: true
        };
        for (let i = 0; i < parts.length; i += 1) {
          const part = parts[i];
          const lower = part.toLowerCase();
          if (reserved[lower]) continue;
          if (/^[0-9a-f-]{8,}$/i.test(part)) continue;
          const formatted = formatOrgSlug(part);
          if (formatted) return formatted;
        }
      } catch (_) {
        return "";
      }
      return "";
    }

    function companyFromDocumentTitle(docTitle, jobTitle) {
      let titleText = cleanText(docTitle);
      if (!titleText) return "";
      const role = cleanText(jobTitle);
      if (role && titleText.toLowerCase().indexOf(role.toLowerCase()) === 0) {
        titleText = cleanText(titleText.slice(role.length).replace(/^[\s|\-–—@:]+/, ""));
      }
      const patterns = [
        /\s+[|\u2013\u2014\-]\s+(.+)$/,
        /\s+@\s+(.+)$/,
        /\s+at\s+(.+)$/i
      ];
      for (let i = 0; i < patterns.length; i += 1) {
        const match = titleText.match(patterns[i]);
        if (match && match[1]) {
          const candidate = acceptCompany(match[1].replace(/\s+[|\-].*$/, ""));
          if (candidate) return candidate;
        }
      }
      return acceptCompany(titleText);
    }

    function extractAshbyCompany(jobPosting, jobTitle) {
      let company = acceptCompany(organizationNameFromJsonLd(jobPosting));
      if (company) return company;

      company = acceptCompany(firstAttr(["meta[property='og:site_name']", "meta[name='application-name']"], "content"));
      if (company) return company;

      const logoSelectors = [
        "header img[alt]",
        "[class*='Logo'] img[alt]",
        "[class*='logo'] img[alt]",
        "img[alt*='logo' i]",
        "a[href*='ashbyhq.com'] img[alt]"
      ];
      for (let i = 0; i < logoSelectors.length; i += 1) {
        const img = document.querySelector(logoSelectors[i]);
        company = acceptCompany(attrOf(img, "alt"));
        if (company) return company;
      }

      company = acceptCompany(
        firstText([
          "header [class*='Company']",
          "[class*='OrganizationName']",
          "[class*='company-name']",
          "[data-testid='company-name']"
        ])
      );
      if (company) return company;

      company = ashbyOrgFromUrl(location.href);
      if (company) return company;

      return companyFromDocumentTitle(document.title || "", jobTitle);
    }

    function extractAshbyLocation(jobPosting) {
      let locationValue = cleanText(locationFromJsonLd(jobPosting));
      if (locationValue) return locationValue;

      const labeled = Array.from(
        document.querySelectorAll("div, span, p, li, dt, dd")
      );
      for (let i = 0; i < labeled.length; i += 1) {
        const el = labeled[i];
        const text = textOf(el);
        if (!text || text.length > 120) continue;
        const lower = text.toLowerCase();
        if (
          lower.indexOf("location") === 0 ||
          lower.indexOf("workplace") === 0 ||
          lower.indexOf("office") === 0
        ) {
          const next = el.nextElementSibling ? textOf(el.nextElementSibling) : "";
          if (next && next.length < 120) return next;
          const afterColon = cleanText(text.split(":").slice(1).join(":"));
          if (afterColon) return afterColon;
        }
      }

      locationValue = firstText([
        "[data-testid='job-location']",
        "[class*='JobLocation']",
        "[class*='job-location']",
        "[class*='Location']",
        "[itemprop='jobLocation']",
        "header [class*='location' i]"
      ]);
      if (locationValue && locationValue.toLowerCase().indexOf("location") === 0) {
        locationValue = cleanText(locationValue.replace(/^location\s*:?\s*/i, ""));
      }
      return locationValue;
    }

    const rawUrl = location.href;
    const url = canonicalizeUrl(rawUrl);
    const domain = (location.hostname || "").replace(/^www\./i, "");
    const atsPlatform = detectAts(location.hostname, rawUrl);
    const jsonLdJob = parseJsonLdJobPosting();

    let title = "";
    let company = "";
    let jobLocation = "";
    let description = "";

    if (atsPlatform === "linkedin") {
      title = firstText([
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        "h1.t-24",
        "h1"
      ]);
      company = firstText([
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".topcard__flavor a"
      ]);
      jobLocation = firstText([
        ".job-details-jobs-unified-top-card__bullet",
        ".topcard__flavor--bullet",
        ".jobs-unified-top-card__bullet"
      ]);
      description = collectDescription(
        [
          "#job-details",
          ".jobs-description__content",
          ".jobs-box__html-content",
          ".jobs-description-content__text",
          ".description__text"
        ],
        160
      );
    } else if (atsPlatform === "greenhouse") {
      title = firstText([".app-title", "h1.app-title", "h1"]);
      company = firstText([".company-name", "#header .company-name", "meta[property='og:site_name']"]);
      if (!company) {
        company = firstAttr(["meta[property='og:site_name']"], "content");
      }
      jobLocation = firstText([".location", "#header .location", ".app-location"]);
      description = collectDescription(
        ["#content", "#app_body", ".content", "#job_description", "[data-qa='job-description']"],
        160
      );
    } else if (atsPlatform === "lever") {
      title = firstText([".posting-headline h2", ".posting-headline h1", "h2", "h1"]);
      company = firstText([".main-header-logo img[alt]", ".main-header-logo", "title"]);
      const logo = document.querySelector(".main-header-logo img[alt]");
      if (logo && logo.getAttribute("alt")) company = cleanText(logo.getAttribute("alt"));
      jobLocation = firstText([
        ".posting-categories .location",
        ".posting-categories .sort-by-time",
        ".location"
      ]);
      description = collectDescription(
        [".content", ".section-wrapper", "[data-qa='job-description']", ".posting"],
        160
      );
    } else if (atsPlatform === "ashby") {
      title = firstText([
        "h1",
        "[class*='JobBoard'] h1",
        "[data-testid='job-title']",
        "[itemprop='title']"
      ]);
      if (!title && jsonLdJob) title = cleanText(jsonLdJob.title || "");
      company = extractAshbyCompany(jsonLdJob, title);
      jobLocation = extractAshbyLocation(jsonLdJob);
      description = collectDescription(
        [
          "[class*='JobDescription']",
          "[itemprop='description']",
          "[class*='description']",
          "article",
          "main"
        ],
        160
      );
      if ((!description || description.length < 160) && jsonLdJob && jsonLdJob.description) {
        description = cleanText(String(jsonLdJob.description).replace(/<[^>]+>/g, " "));
      }
    } else if (atsPlatform === "workday") {
      title = firstText([
        "[data-automation-id='jobPostingHeader']",
        "h2[data-automation-id='jobPostingHeader']",
        "h1",
        "h2"
      ]);
      company = firstText([
        "[data-automation-id='company']",
        "[data-automation-id='jobPostingCompanyName']",
        "meta[property='og:site_name']"
      ]);
      if (!company) company = firstAttr(["meta[property='og:site_name']"], "content");
      jobLocation = firstText([
        "[data-automation-id='locations']",
        "[data-automation-id='location']",
        "[data-automation-id='jobPostingHeader'] + div"
      ]);
      description = collectDescription(
        [
          "[data-automation-id='jobPostingDescription']",
          "[data-automation-id='job-posting-description']",
          "[data-automation-id='jobPostingDetails']",
          "main"
        ],
        160
      );
    }

    if (!title) {
      title = firstText([
        "h1",
        "[data-testid='job-title']",
        "[itemprop='title']",
        "meta[property='og:title']"
      ]);
      if (!title) title = firstAttr(["meta[property='og:title']"], "content");
      if (!title && jsonLdJob) title = cleanText(jsonLdJob.title || "");
    }

    if (!company && atsPlatform !== "ashby") {
      company = firstText([
        "[itemprop='hiringOrganization']",
        "[data-company]",
        ".company",
        ".employer"
      ]);
      if (!company) company = firstAttr(["meta[property='og:site_name']"], "content");
      if (!company) company = organizationNameFromJsonLd(jsonLdJob);
    }

    if (!jobLocation) {
      jobLocation = locationFromJsonLd(jsonLdJob) || firstText([
        "[itemprop='jobLocation']",
        "[data-testid='job-location']",
        ".location",
        ".job-location"
      ]);
    }

    if (!description || description.length < 180) {
      description =
        collectDescription(
          [
            "[itemprop='description']",
            "[class*='description']",
            "[id*='description']",
            "#job-details",
            ".job-body",
            "article",
            "main",
            "#content",
            "#main"
          ],
          180
        ) || description;
    }

    if (!description || description.length < 220) {
      const fallback = bodyFallback();
      if (fallback && fallback.length > (description ? description.length : 0)) {
        description = fallback;
      }
    }

    if (title && title.length > 180) {
      title = title.slice(0, 180);
    }

    if (atsPlatform === "ashby") {
      company = acceptCompany(company);
    }

    return {
      title: title || "",
      company: company || "",
      location: jobLocation || "",
      description: description || "",
      url: url,
      domain: domain,
      atsPlatform: atsPlatform,
      extractedAt: new Date().toISOString()
    };
  }

  function canonicalizeJobUrl(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || ""));
      parsed.hash = "";
      const dropExact = {
        src: true,
        source: true,
        ref: true,
        refid: true,
        trk: true,
        trackingid: true,
        fbclid: true,
        gclid: true,
        mc_cid: true,
        mc_eid: true,
        _ga: true,
        _gl: true
      };
      Array.from(parsed.searchParams.keys()).forEach(function (key) {
        const lower = String(key || "").toLowerCase();
        if (dropExact[lower] || lower.indexOf("utm_") === 0) {
          parsed.searchParams.delete(key);
        }
      });
      var path = parsed.pathname.replace(/\/+$/, "");
      if (!path) path = "";
      var query = parsed.searchParams.toString();
      return parsed.origin + path + (query ? "?" + query : "");
    } catch (_) {
      return String(rawUrl || "").trim();
    }
  }

  function formatAtsPlatformLabel(platform) {
    const key = String(platform || "generic").trim().toLowerCase();
    const labels = {
      ashby: "Ashby",
      greenhouse: "Greenhouse",
      lever: "Lever",
      workday: "Workday",
      linkedin: "LinkedIn",
      generic: "Generic"
    };
    return labels[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Generic");
  }

  function ensureStorage() {
    if (!global.ImpulsoStorage) {
      throw new Error("ImpulsoStorage is not available.");
    }
    return global.ImpulsoStorage;
  }

  function setJobStatus(message, isError) {
    const el = document.getElementById("jobStatus");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", Boolean(isError));
  }

  function setStaleWarning(message) {
    const el = document.getElementById("jobStaleWarning");
    if (!el) return;
    if (message) {
      el.hidden = false;
      el.textContent = message;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function formatExtractedAt(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString();
  }

  function previewDescription(text, maxLen) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    const limit = maxLen || 280;
    if (!value) return "No description captured.";
    if (value.length <= limit) return value;
    return value.slice(0, limit - 1) + "…";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0] ? tabs[0] : null;
  }

  async function syncLegacyJobDescription(job) {
    const description = job && job.description ? job.description : "";
    return new Promise((resolve) => {
      chrome.storage.local.set({ currentJobDescription: description }, () => resolve(description));
    });
  }

  async function extractFromActiveTab() {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("No active browser tab found.");
    }
    if (!tab.url || tab.url.indexOf("chrome://") === 0 || tab.url.indexOf("chrome-extension://") === 0) {
      throw new Error("Open a job posting page in the active tab, then try again.");
    }

    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobFromPage
      });
    } catch (error) {
      throw new Error(
        "Could not access this page for extraction. " + (error && error.message ? error.message : "")
      );
    }

    const payload = results && results[0] ? results[0].result : null;
    if (!payload || typeof payload !== "object") {
      throw new Error("Extraction failed. Ensure you are on an active job page.");
    }

    if (!String(payload.description || "").trim() && !String(payload.title || "").trim()) {
      throw new Error("Could not find job details on this page.");
    }

    payload.url = canonicalizeJobUrl(payload.url || tab.url || "");
    if (!payload.domain && payload.url) {
      try {
        payload.domain = new URL(payload.url).hostname.replace(/^www\./i, "");
      } catch (_) {
        payload.domain = "";
      }
    }

    return payload;
  }

  async function buildJobFromExtraction(extracted) {
    const storage = ensureStorage();
    const canonicalUrl = canonicalizeJobUrl(extracted.url || "");
    const record = storage.createJobRecord({
      title: extracted.title,
      company: extracted.company,
      location: extracted.location,
      description: extracted.description,
      url: canonicalUrl,
      domain: extracted.domain,
      atsPlatform: extracted.atsPlatform,
      extractedAt: extracted.extractedAt
    });
    record.url = canonicalUrl;
    record.id = storage.buildStableJobId(record.url, record.company, record.title);
    return record;
  }

  async function isSameAsCurrent(job) {
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (!current || !job) return false;
    return current.id === job.id;
  }

  async function saveAsCurrentJob(job, options) {
    const opts = options || {};
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();

    if (current && current.id !== job.id && !opts.replaceConfirmed) {
      const error = new Error("A current job is already saved. Confirm before replacing it.");
      error.code = "CONFIRM_REPLACE_JOB";
      error.existing = current;
      error.incoming = job;
      throw error;
    }

    const existingSame = await storage.getJob(job.id);
    if (existingSame) {
      job.createdAt = existingSame.createdAt || job.createdAt;
    }

    const saved = await storage.setCurrentJob(job);
    await syncLegacyJobDescription(saved);
    return saved;
  }

  async function clearCurrentJobWithConfirm(options) {
    const opts = options || {};
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (!current) return null;

    if (!opts.clearConfirmed) {
      const error = new Error("Confirm before clearing the current job.");
      error.code = "CONFIRM_CLEAR_JOB";
      error.existing = current;
      throw error;
    }

    await storage.clearCurrentJob();
    await syncLegacyJobDescription(null);
    return current;
  }

  async function getStaleState() {
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (!current || !current.url) {
      return { stale: false, current: current, activeUrl: "", message: "" };
    }

    const tab = await getActiveTab();
    const activeUrl = tab && tab.url ? tab.url : "";
    if (!activeUrl || activeUrl.indexOf("http") !== 0) {
      return {
        stale: false,
        current: current,
        activeUrl: activeUrl,
        message: ""
      };
    }

    const normalizedStored = canonicalizeJobUrl(current.url).toLowerCase();
    const normalizedActive = canonicalizeJobUrl(activeUrl).toLowerCase();
    const stale = normalizedStored !== normalizedActive;

    return {
      stale: stale,
      current: current,
      activeUrl: activeUrl,
      message: stale
        ? "Active tab URL differs from the stored current job. Re-extract before analyzing this role."
        : ""
    };
  }

  async function getCurrentJobForAnalysis() {
    const state = await getStaleState();
    if (!state.current) {
      const error = new Error("No current job is saved. Extract a job first.");
      error.code = "NO_CURRENT_JOB";
      throw error;
    }
    if (state.stale) {
      const error = new Error(
        "Stored job is stale for the active tab. Extract or replace the current job before analyzing."
      );
      error.code = "STALE_JOB";
      error.stale = true;
      throw error;
    }
    return state.current;
  }

  async function refreshJobUI() {
    const emptyEl = document.getElementById("jobEmptyState");
    const cardEl = document.getElementById("jobCard");
    const replaceBtn = document.getElementById("jobReplaceBtn");
    const clearBtn = document.getElementById("jobClearBtn");

    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    const staleState = await getStaleState();

    if (!current) {
      if (emptyEl) emptyEl.hidden = false;
      if (cardEl) {
        cardEl.hidden = true;
        cardEl.innerHTML = "";
      }
      if (replaceBtn) replaceBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      setStaleWarning("");
      return null;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (replaceBtn) replaceBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    setStaleWarning(staleState.message || "");

    if (cardEl) {
      cardEl.hidden = false;
      const url = current.url || "";
      cardEl.innerHTML =
        '<div class="job-card-header">' +
        '<div class="job-card-title">' +
        escapeHtml(current.title || "Untitled role") +
        "</div>" +
        '<div class="job-card-company">' +
        escapeHtml(current.company || "Unknown company") +
        "</div>" +
        "</div>" +
        '<div class="job-card-meta">' +
        "<div><span class=\"label\">Location</span> " +
        escapeHtml(current.location || "—") +
        "</div>" +
        "<div><span class=\"label\">Source</span> " +
        escapeHtml(formatAtsPlatformLabel(current.atsPlatform)) +
        "</div>" +
        "<div><span class=\"label\">Extracted</span> " +
        escapeHtml(formatExtractedAt(current.extractedAt || current.updatedAt)) +
        "</div>" +
        "</div>" +
        (url
          ? '<div class="job-card-url"><span class="label">URL</span> <a href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(url) +
            "</a></div>"
          : "") +
        '<div class="job-card-preview"><span class="label">Description preview</span><p>' +
        escapeHtml(previewDescription(current.description)) +
        "</p></div>";
    }

    return current;
  }

  async function handleExtract(options) {
    const opts = options || {};
    setJobStatus("Extracting job from the active tab…", false);
    setStaleWarning("");

    try {
      const extracted = await extractFromActiveTab();
      const job = await buildJobFromExtraction(extracted);
      const same = await isSameAsCurrent(job);

      const saved = await saveAsCurrentJob(job, {
        replaceConfirmed: Boolean(opts.replaceConfirmed || same)
      });

      await refreshJobUI();
      if (typeof global.refreshHomeStatus === "function") {
        global.refreshHomeStatus();
      }

      const updatedNote = same ? " Updated existing job record." : "";
      setJobStatus(
        "Saved current job: " +
          (saved.title || "Untitled role") +
          " @ " +
          (saved.company || "Unknown") +
          "." +
          updatedNote,
        false
      );
      return saved;
    } catch (error) {
      if (error && error.code === "CONFIRM_REPLACE_JOB") {
        const existing = error.existing || {};
        const incoming = error.incoming || {};
        const accepted = window.confirm(
          'Replace current job "' +
            (existing.title || "Untitled") +
            " @ " +
            (existing.company || "Unknown") +
            '" with "' +
            (incoming.title || "Untitled") +
            " @ " +
            (incoming.company || "Unknown") +
            '"?'
        );
        if (!accepted) {
          setJobStatus("Replace cancelled. Current job unchanged.", false);
          return null;
        }
        return handleExtract({ replaceConfirmed: true });
      }

      setJobStatus(error.message || "Failed to extract job.", true);
      throw error;
    }
  }

  async function handleReplace() {
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (current) {
      const accepted = window.confirm(
        'Replace current job "' +
          (current.title || "Untitled") +
          " @ " +
          (current.company || "Unknown") +
          '" with the job from the active tab?'
      );
      if (!accepted) {
        setJobStatus("Replace cancelled. Current job unchanged.", false);
        return null;
      }
    }
    return handleExtract({ replaceConfirmed: true });
  }

  async function handleClear() {
    try {
      await clearCurrentJobWithConfirm({ clearConfirmed: false });
    } catch (error) {
      if (error && error.code === "CONFIRM_CLEAR_JOB") {
        const existing = error.existing || {};
        const accepted = window.confirm(
          'Clear current job "' +
            (existing.title || "Untitled") +
            " @ " +
            (existing.company || "Unknown") +
            '"?'
        );
        if (!accepted) {
          setJobStatus("Clear cancelled. Current job unchanged.", false);
          return null;
        }

        try {
          await clearCurrentJobWithConfirm({ clearConfirmed: true });
          await refreshJobUI();
          if (typeof global.refreshHomeStatus === "function") {
            global.refreshHomeStatus();
          }
          setJobStatus("Current job cleared.", false);
          return true;
        } catch (clearError) {
          setJobStatus(clearError.message || "Failed to clear current job.", true);
          return null;
        }
      }
      setJobStatus(error.message || "Failed to clear current job.", true);
      return null;
    }
    return null;
  }

  function bindJobUI() {
    const extractBtn = document.getElementById("jobExtractBtn");
    const replaceBtn = document.getElementById("jobReplaceBtn");
    const clearBtn = document.getElementById("jobClearBtn");

    if (extractBtn) {
      extractBtn.addEventListener("click", () => {
        handleExtract({ replaceConfirmed: false }).catch(() => {});
      });
    }
    if (replaceBtn) {
      replaceBtn.addEventListener("click", () => {
        handleReplace().catch(() => {});
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        handleClear();
      });
    }
  }

  async function init() {
    bindJobUI();
    return refreshJobUI();
  }

  global.ImpulsoJob = {
    init: init,
    refresh: refreshJobUI,
    extractJobFromPage: extractJobFromPage,
    extractFromActiveTab: extractFromActiveTab,
    extractCurrentJob: handleExtract,
    replaceCurrentJob: handleReplace,
    clearCurrentJob: handleClear,
    getCurrentJob: function () {
      return ensureStorage().getCurrentJob();
    },
    getCurrentJobForAnalysis: getCurrentJobForAnalysis,
    getStaleState: getStaleState,
    syncLegacyJobDescription: syncLegacyJobDescription,
    buildJobFromExtraction: buildJobFromExtraction,
    previewDescription: previewDescription,
    canonicalizeJobUrl: canonicalizeJobUrl,
    formatAtsPlatformLabel: formatAtsPlatformLabel
  };
})(typeof window !== "undefined" ? window : self);
