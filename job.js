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
      if (host === "jobs.smartrecruiters.com" || host.indexOf("jobs.smartrecruiters.com") >= 0) {
        return "smartrecruiters";
      }
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

    function isDisplayedElement(el) {
      if (!el) return false;
      if (el.hidden) return false;
      if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
      try {
        const style = (el.ownerDocument || document).defaultView
          ? (el.ownerDocument || document).defaultView.getComputedStyle(el)
          : global.getComputedStyle
            ? global.getComputedStyle(el)
            : null;
        if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      } catch (_) {}
      return true;
    }

    function looksLikeSmartRecruitersJunkTitle(text) {
      const lower = cleanText(text).toLowerCase();
      if (!lower) return true;
      if (lower.indexOf("internet explorer") >= 0) return true;
      if (lower.indexOf("no longer supported") >= 0) return true;
      if (lower.indexOf("other jobs at") >= 0) return true;
      if (lower.indexOf("privacy notice") >= 0) return true;
      if (lower.indexOf("cookie settings") >= 0) return true;
      return false;
    }

    function isValidSmartRecruitersTitle(text) {
      const value = cleanText(text);
      if (!value || value.length < 3 || value.length > 160) return false;
      if (looksLikeSmartRecruitersJunkTitle(value)) return false;
      return true;
    }

    function acceptSmartRecruitersCompany(name) {
      const value = cleanText(name);
      if (!value || value.length > 80) return "";
      const lower = value.toLowerCase();
      if (lower.indexOf("other jobs at") >= 0) return "";
      if (looksLikeSmartRecruitersJunkTitle(value)) return "";
      return value;
    }

    function decodeCompanySlug(slug) {
      let raw = String(slug || "").trim();
      if (!raw) return "";
      try {
        raw = decodeURIComponent(raw.replace(/\+/g, " "));
      } catch (_) {}
      raw = raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
      return acceptSmartRecruitersCompany(raw);
    }

    function smartRecruitersCompanyFromUrl(href) {
      const result = { query: "", oneclick: "", path: "" };
      try {
        const parsed = new URL(String(href || ""));
        result.query = decodeCompanySlug(
          parsed.searchParams.get("dcr_ci") || parsed.searchParams.get("dcr_CI") || ""
        );
        const parts = parsed.pathname.split("/").filter(Boolean);
        for (let i = 0; i < parts.length - 1; i += 1) {
          if (parts[i].toLowerCase() === "company" && parts[i + 1]) {
            result.oneclick = decodeCompanySlug(parts[i + 1]);
            break;
          }
        }
        const reserved = {
          "oneclick-ui": true,
          oneclick: true,
          company: true,
          publication: true,
          apply: true,
          job: true,
          jobs: true
        };
        if (parts.length >= 1 && !reserved[String(parts[0] || "").toLowerCase()]) {
          result.path = decodeCompanySlug(parts[0]);
        }
      } catch (_) {}
      return result;
    }

    function firstValidVisibleTitle(selectors) {
      for (let i = 0; i < selectors.length; i += 1) {
        const nodes = document.querySelectorAll(selectors[i]);
        for (let j = 0; j < nodes.length; j += 1) {
          const el = nodes[j];
          if (!isDisplayedElement(el)) continue;
          const value = textOf(el);
          if (isValidSmartRecruitersTitle(value)) return value;
        }
      }
      return "";
    }

    function extractSmartRecruitersTitle(jobPosting) {
      const jsonTitle = cleanText(jobPosting && jobPosting.title);
      if (isValidSmartRecruitersTitle(jsonTitle)) return jsonTitle;

      const headerH1 = firstValidVisibleTitle(["header h1"]);
      if (headerH1) return headerH1;

      const visibleH1 = firstValidVisibleTitle(["h1"]);
      if (visibleH1) return visibleH1;

      return firstValidVisibleTitle([
        "header p",
        "header [class*='title']",
        "[class*='job-title']",
        "[class*='jobTitle']",
        "[data-test*='job-title']"
      ]);
    }

    function looksLikeSmartRecruitersJunkLocation(text) {
      const lower = cleanText(text).toLowerCase();
      if (!lower) return true;
      if (lower.indexOf("internet explorer") >= 0) return true;
      if (lower.indexOf("no longer supported") >= 0) return true;
      if (lower.indexOf("other jobs at") >= 0) return true;
      if (lower.indexOf("privacy notice") >= 0) return true;
      if (lower === "location" || lower.indexOf("location:") === 0) return true;
      return false;
    }

    function isValidSmartRecruitersLocation(text) {
      const value = cleanText(text);
      if (!value || value.length < 3 || value.length > 160) return false;
      if (looksLikeSmartRecruitersJunkLocation(value)) return false;
      if (looksLikeSmartRecruitersJunkTitle(value)) return false;
      return true;
    }

    function extractSmartRecruitersLocation(jobPosting) {
      function expandCountry(value) {
        var text = cleanText(value);
        if (/^(us|usa|u\.s\.|u\.s\.a\.)$/i.test(text)) return "United States";
        return text;
      }
      function fromAddress(address) {
        if (!address) return "";
        if (typeof address === "string") return cleanText(address);
        var parts = [
          address.addressLocality,
          address.addressRegion,
          expandCountry(address.addressCountry)
        ]
          .map(cleanText)
          .filter(Boolean);
        return parts.join(", ");
      }
      function fromPlace(place) {
        if (!place) return "";
        if (typeof place === "string") return cleanText(place);
        var fromAddr = fromAddress(place.address);
        if (isValidSmartRecruitersLocation(fromAddr)) return fromAddr;
        if (isValidSmartRecruitersLocation(place.name)) return cleanText(place.name);
        return "";
      }
      var loc = jobPosting && jobPosting.jobLocation;
      var fromLd = "";
      if (Array.isArray(loc)) {
        fromLd = loc
          .map(fromPlace)
          .filter(Boolean)
          .join("; ");
      } else {
        fromLd = fromPlace(loc);
      }
      if (isValidSmartRecruitersLocation(fromLd)) return fromLd;
      fromLd = cleanText(locationFromJsonLd(jobPosting));
      if (isValidSmartRecruitersLocation(fromLd)) return fromLd;
      const headerLoc = firstText([
        "header [class*='location' i]",
        "header [data-test*='location']",
        "[data-test*='job-location']",
        "[data-testid='job-location']",
        "[class*='job-location']",
        "[itemprop='jobLocation']"
      ]);
      if (isValidSmartRecruitersLocation(headerLoc)) return headerLoc;
      const headerP = document.querySelectorAll("header p");
      for (let i = 0; i < headerP.length; i += 1) {
        const value = textOf(headerP[i]);
        if (!isValidSmartRecruitersLocation(value)) continue;
        if (/\b(ca|ny|tx|united states|usa|,)\b/i.test(value) || /\b[A-Z]{2}\b/.test(value)) {
          return value;
        }
      }
      return "";
    }

    function extractSmartRecruitersCompany(jobPosting, href) {
      const fromLd = acceptSmartRecruitersCompany(organizationNameFromJsonLd(jobPosting));
      if (fromLd) return fromLd;
      const fromUrl = smartRecruitersCompanyFromUrl(href || (location && location.href) || "");
      if (fromUrl.query) return fromUrl.query;
      if (fromUrl.oneclick) return fromUrl.oneclick;
      if (fromUrl.path) return fromUrl.path;
      return "";
    }

    function formatGreenhouseCompanySlug(slug) {
      let value = String(slug || "").trim();
      if (!value) return "";
      try {
        value = decodeURIComponent(value);
      } catch (_) {}
      const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const knownNames = {
        spacex: "SpaceX"
      };
      if (knownNames[compact]) return knownNames[compact];
      return value
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, function (character) {
          return character.toUpperCase();
        });
    }

    function greenhouseCompanyFromUrl(href) {
      try {
        const parsed = new URL(String(href || ""));
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (!parts.length) return "";
        return formatGreenhouseCompanySlug(parts[0]);
      } catch (_) {
        return "";
      }
    }

    function extractGreenhouseCompany(jobPosting, jobTitle, href) {
      let value = cleanText(organizationNameFromJsonLd(jobPosting));
      if (value) return value;
      value = firstText([".company-name", "#header .company-name"]);
      if (value) return value;
      value = firstAttr(["meta[property='og:site_name']", "header img[alt]"], "content");
      if (!value) value = firstAttr(["header img[alt]", "img[alt*='logo']"], "alt");
      if (value && !/^greenhouse$/i.test(value)) return value;
      const titleText = cleanText(document.title || "");
      const atMatch = titleText.match(/\s+at\s+(.+?)(?:\s*[|\-–—]\s*Greenhouse)?$/i);
      if (atMatch && atMatch[1]) return cleanText(atMatch[1]);
      value = companyFromDocumentTitle(titleText, jobTitle);
      if (value && !/^greenhouse$/i.test(value) && value !== jobTitle) return value;
      return greenhouseCompanyFromUrl(href);
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
      company = extractGreenhouseCompany(jsonLdJob, title, rawUrl);
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
    } else if (atsPlatform === "smartrecruiters") {
      title = extractSmartRecruitersTitle(jsonLdJob);
      company = extractSmartRecruitersCompany(jsonLdJob, rawUrl);
      jobLocation = extractSmartRecruitersLocation(jsonLdJob);
    }

    if (!title && atsPlatform !== "smartrecruiters") {
      title = firstText([
        "h1",
        "[data-testid='job-title']",
        "[itemprop='title']",
        "meta[property='og:title']"
      ]);
      if (!title) title = firstAttr(["meta[property='og:title']"], "content");
      if (!title && jsonLdJob) title = cleanText(jsonLdJob.title || "");
    }

    if (!company && atsPlatform !== "ashby" && atsPlatform !== "smartrecruiters") {
      company = firstText([
        "[itemprop='hiringOrganization']",
        "[data-company]",
        ".company",
        ".employer"
      ]);
      if (!company) company = firstAttr(["meta[property='og:site_name']"], "content");
      if (!company) company = organizationNameFromJsonLd(jsonLdJob);
    }

    if (!jobLocation && atsPlatform !== "smartrecruiters") {
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
      smartrecruiters: "SmartRecruiters",
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
      if (typeof global.refreshJobMatchAnalysis === "function") {
        try {
          global.refreshJobMatchAnalysis();
        } catch (_) {
          // Match analysis restore is best-effort.
        }
      }
      if (typeof refreshJobResumeUI === "function") {
        try {
          await refreshJobResumeUI();
        } catch (_) {
          // Job resume UI restore is best-effort.
        }
      }
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

    if (typeof global.refreshJobMatchAnalysis === "function") {
      try {
        global.refreshJobMatchAnalysis();
      } catch (_) {
        // Match analysis restore is best-effort.
      }
    }

    if (typeof refreshJobResumeUI === "function") {
      try {
        await refreshJobResumeUI();
      } catch (_) {
        // Job resume UI restore is best-effort.
      }
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

  // --- Job-specific tailored resume ---

  let pendingJobResumeReview = null;

  function setJobResumeStatus(message, isError) {
    const el = document.getElementById("jobResumeStatus");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError && message));
  }

  function hideJobResumeReview() {
    pendingJobResumeReview = null;
    const panel = document.getElementById("jobResumeReviewPanel");
    const body = document.getElementById("jobResumeReviewBody");
    if (panel) panel.hidden = true;
    if (body) body.innerHTML = "";
  }

  function previewValue(value) {
    if (Array.isArray(value)) {
      if (!value.length) return "—";
      if (typeof value[0] === "string") {
        return value.slice(0, 8).join(", ") + (value.length > 8 ? "…" : "");
      }
      return value.length + " entr" + (value.length === 1 ? "y" : "ies");
    }
    const text = String(value == null ? "" : value).trim();
    if (!text) return "—";
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  }

  function renderDiffChips(items, chipClass) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return '<p class="job-match-empty">None</p>';
    return (
      '<div class="job-match-chip-list">' +
      list
        .map(
          (item) =>
            '<span class="job-match-chip ' +
            chipClass +
            '">' +
            escapeHtml(item) +
            "</span>"
        )
        .join("") +
      "</div>"
    );
  }

  function renderSectionChangeBlocks(changes) {
    const list = Array.isArray(changes) ? changes : [];
    if (!list.length) return '<p class="job-match-empty">No changes</p>';
    return list
      .map(function (change) {
        return (
          '<div class="job-resume-diff-block">' +
          "<div><strong>" +
          escapeHtml(change.label || change.section || "Section") +
          "</strong>: master " +
          escapeHtml(String(change.masterCount || 0)) +
          " → tailored " +
          escapeHtml(String(change.parsedCount || 0)) +
          "</div>" +
          '<div class="job-resume-diff-preview"><span class="label">Master</span> ' +
          escapeHtml(previewValue(change.masterValue)) +
          "</div>" +
          '<div class="job-resume-diff-preview"><span class="label">Tailored</span> ' +
          escapeHtml(previewValue(change.parsedValue)) +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderPersonalLinkApprovals(changes, groupName) {
    const list = Array.isArray(changes) ? changes : [];
    if (!list.length) return '<p class="job-match-empty">No changes</p>';
    return (
      '<div class="job-resume-approval-list">' +
      list
        .map(function (change) {
          const id = groupName + "-" + change.field;
          return (
            '<label class="job-resume-approval-row" for="' +
            escapeHtml(id) +
            '">' +
            '<input type="checkbox" id="' +
            escapeHtml(id) +
            '" data-group="' +
            escapeHtml(groupName) +
            '" data-field="' +
            escapeHtml(change.field) +
            '" />' +
            "<span><strong>" +
            escapeHtml(change.field) +
            "</strong><br /><span class=\"muted\">Master: " +
            escapeHtml(previewValue(change.masterValue)) +
            " → Tailored: " +
            escapeHtml(previewValue(change.parsedValue)) +
            "</span><br /><span class=\"muted\">Check to use the tailored value for this job only.</span></span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function showJobResumeReview(reviewState) {
    pendingJobResumeReview = reviewState;
    const panel = document.getElementById("jobResumeReviewPanel");
    const body = document.getElementById("jobResumeReviewBody");
    if (!panel || !body) return;

    const diff = reviewState.differences || {};
    body.innerHTML =
      '<details class="job-match-section" open><summary><span>Added skills</span><span class="job-match-count">' +
      escapeHtml(String((diff.addedSkills || []).length)) +
      '</span></summary><div class="job-match-section-body">' +
      renderDiffChips(diff.addedSkills, "is-matched") +
      "</div></details>" +
      '<details class="job-match-section" open><summary><span>Removed skills</span><span class="job-match-count">' +
      escapeHtml(String((diff.removedSkills || []).length)) +
      '</span></summary><div class="job-match-section-body">' +
      renderDiffChips(diff.removedSkills, "is-missing") +
      "</div></details>" +
      '<details class="job-match-section" open><summary><span>Changed experience</span></summary><div class="job-match-section-body">' +
      renderSectionChangeBlocks(diff.changedExperience) +
      "</div></details>" +
      '<details class="job-match-section"><summary><span>Changed projects</span></summary><div class="job-match-section-body">' +
      renderSectionChangeBlocks(diff.changedProjects) +
      "</div></details>" +
      '<details class="job-match-section"><summary><span>Changed education</span></summary><div class="job-match-section-body">' +
      renderSectionChangeBlocks(diff.changedEducation) +
      "</div></details>" +
      '<details class="job-match-section" open><summary><span>Changed personal / links</span></summary><div class="job-match-section-body">' +
      "<div class=\"job-resume-diff-block\"><strong>Personal</strong>" +
      renderPersonalLinkApprovals(diff.changedPersonal, "personal") +
      "</div>" +
      "<div class=\"job-resume-diff-block\"><strong>Links</strong>" +
      renderPersonalLinkApprovals(diff.changedLinks, "links") +
      "</div></div></details>" +
      '<details class="job-match-section"><summary><span>Unchanged sections</span></summary><div class="job-match-section-body">' +
      (diff.unchangedSections && diff.unchangedSections.length
        ? '<p class="job-match-empty">' +
          escapeHtml(diff.unchangedSections.join(", ")) +
          "</p>"
        : '<p class="job-match-empty">None</p>') +
      "</div></details>";

    panel.hidden = false;
  }

  function collectJobResumeApprovals() {
    const personal = {};
    const links = {};
    document.querySelectorAll("#jobResumeReviewBody input[type='checkbox']").forEach(function (input) {
      if (!input.checked) return;
      const group = input.getAttribute("data-group");
      const field = input.getAttribute("data-field");
      if (group === "personal" && field) personal[field] = true;
      if (group === "links" && field) links[field] = true;
    });
    return { personal: personal, links: links };
  }

  async function refreshJobResumeUI() {
    const storage = ensureStorage();
    const emptyEl = document.getElementById("jobResumeEmptyState");
    const cardEl = document.getElementById("jobResumeCard");
    const selectorEl = document.getElementById("jobResumeSelector");
    const tailoredOptionEl = document.getElementById("jobResumeOptionTailored");
    const uploadBtn = document.getElementById("jobResumeUploadBtn");
    const replaceBtn = document.getElementById("jobResumeReplaceBtn");
    const removeBtn = document.getElementById("jobResumeRemoveBtn");
    const reviewBtn = document.getElementById("jobResumeReviewBtn");

    function setActionVisibility(hasTailored, canUpload) {
      if (uploadBtn) {
        uploadBtn.hidden = !canUpload || hasTailored;
        uploadBtn.disabled = !canUpload;
      }
      if (replaceBtn) {
        replaceBtn.hidden = !hasTailored;
        replaceBtn.disabled = !hasTailored;
      }
      if (removeBtn) {
        removeBtn.hidden = !hasTailored;
        removeBtn.disabled = !hasTailored;
      }
      if (reviewBtn) {
        reviewBtn.hidden = !hasTailored;
        reviewBtn.disabled = !hasTailored;
      }
    }

    const current = await storage.getCurrentJob();
    if (!current) {
      hideJobResumeReview();
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "Extract a current job before uploading a tailored resume.";
      }
      if (cardEl) {
        cardEl.hidden = true;
        cardEl.innerHTML = "";
      }
      if (selectorEl) selectorEl.hidden = true;
      if (tailoredOptionEl) tailoredOptionEl.hidden = true;
      setActionVisibility(false, false);
      return null;
    }

    const tailored = await storage.getJobSpecificResume(current.id);
    const jobProfile = await storage.getJobProfile(current.id);
    let selection = await storage.getJobResumeSelection(current.id);
    const hasApproved = Boolean(jobProfile && jobProfile.approvedProfile);
    const hasTailored = Boolean(tailored);

    if (!hasTailored && selection === "tailored") {
      selection = await storage.setJobResumeSelection(current.id, "default");
    }

    setActionVisibility(hasTailored, true);

    if (!hasTailored) {
      if (
        pendingJobResumeReview &&
        pendingJobResumeReview.jobId &&
        pendingJobResumeReview.jobId !== current.id
      ) {
        hideJobResumeReview();
      }
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "No tailored resume uploaded for this job.";
      }
      if (cardEl) {
        cardEl.hidden = true;
        cardEl.innerHTML = "";
      }
    } else {
      if (emptyEl) emptyEl.hidden = true;
      if (cardEl) {
        cardEl.hidden = false;
        cardEl.innerHTML =
          '<div class="job-card-title">' +
          escapeHtml(tailored.name || "Tailored resume") +
          "</div>" +
          '<div class="job-card-meta">' +
          "<div><span class=\"label\">Size</span> " +
          escapeHtml(
            global.ImpulsoResume && global.ImpulsoResume.formatFileSize
              ? global.ImpulsoResume.formatFileSize(tailored.size)
              : String(tailored.size || 0) + " B"
          ) +
          "</div>" +
          "<div><span class=\"label\">Uploaded</span> " +
          escapeHtml(
            global.ImpulsoResume && global.ImpulsoResume.formatUploadDate
              ? global.ImpulsoResume.formatUploadDate(tailored.updatedAt || tailored.createdAt)
              : tailored.updatedAt || "—"
          ) +
          "</div>" +
          "<div><span class=\"label\">Status</span> " +
          escapeHtml(hasApproved ? "Approved for this job" : "Uploaded — review required") +
          "</div></div>";
      }
    }

    if (selectorEl) {
      selectorEl.hidden = false;
      const defaultRadio = selectorEl.querySelector('input[value="default"]');
      const tailoredRadio = selectorEl.querySelector('input[value="tailored"]');
      if (tailoredOptionEl) {
        tailoredOptionEl.hidden = !hasTailored;
      }
      if (defaultRadio) {
        defaultRadio.checked = !hasTailored || selection !== "tailored";
      }
      if (tailoredRadio) {
        tailoredRadio.disabled = !hasTailored;
        tailoredRadio.checked = hasTailored && selection === "tailored";
      }
    }

    if (
      pendingJobResumeReview &&
      pendingJobResumeReview.jobId === current.id
    ) {
      const panel = document.getElementById("jobResumeReviewPanel");
      if (panel) panel.hidden = false;
    } else if (
      pendingJobResumeReview &&
      pendingJobResumeReview.jobId !== current.id
    ) {
      hideJobResumeReview();
    }

    return { current: current, tailored: tailored, jobProfile: jobProfile, selection: selection };
  }

  async function saveJobSpecificResumeFile(file, options) {
    const opts = options || {};
    const storage = ensureStorage();
    const resumeApi = global.ImpulsoResume;
    if (!resumeApi) {
      throw new Error("Resume helpers are unavailable.");
    }

    const current = await storage.getCurrentJob();
    if (!current) {
      throw new Error("No current job saved. Extract a job posting first.");
    }

    const validation = resumeApi.validateFile(file);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const existing = await storage.getJobSpecificResume(current.id);
    if (existing && !opts.replaceConfirmed) {
      const error = new Error("A tailored resume already exists for this job.");
      error.code = "CONFIRM_REPLACE_JOB_RESUME";
      error.existing = existing;
      throw error;
    }

    const incomingHash = await storage.hashFile(file);
    const defaultResume = await storage.getDefaultResume();
    if (defaultResume) {
      let defaultHash = defaultResume.fileHash || null;
      if (!defaultHash && defaultResume.fileData) {
        defaultHash = await storage.ensureDocumentFileHash(defaultResume);
      }
      if (defaultHash && defaultHash === incomingHash) {
        window.alert("This file is identical to your default resume.");
        await storage.setJobResumeSelection(current.id, "default");
        const error = new Error(
          "This file is identical to your default resume. Upload cancelled."
        );
        error.code = "IDENTICAL_DEFAULT_RESUME";
        throw error;
      }
    }

    const fileData = await resumeApi.readFileAsDataUrl(file);
    const extension = String(file.name || "")
      .toLowerCase()
      .slice(String(file.name || "").toLowerCase().lastIndexOf("."));
    const mimeType =
      file.type ||
      (extension === ".pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    if (existing) {
      await storage.deleteDocument(existing.id);
    }

    const documentRecord = {
      id: resumeApi.createResumeId(),
      jobId: current.id,
      name: file.name,
      type: mimeType,
      size: file.size,
      fileData: fileData,
      fileHash: incomingHash,
      isDefault: false,
      documentType: storage.JOB_SPECIFIC_RESUME_TYPE || "job-specific-resume",
      parentResumeId: defaultResume && defaultResume.id ? defaultResume.id : null
    };

    const saved = await storage.saveDocument(documentRecord);
    await storage.deleteJobProfile(current.id);
    await storage.setJobResumeSelection(current.id, "tailored");
    return { current: current, document: saved };
  }

  async function parseAndOpenJobResumeReview(documentRecord, jobId) {
    const storage = ensureStorage();
    const resumeApi = global.ImpulsoResume;
    if (!resumeApi || typeof resumeApi.parseResumeDocument !== "function") {
      throw new Error("Resume parse helper is unavailable.");
    }

    setJobResumeStatus("Parsing tailored resume...", false);
    const parsed = await resumeApi.parseResumeDocument(documentRecord);
    const master = await storage.getMasterProfile();
    const differences = storage.computeJobResumeDifferences(master, parsed.profileDraft);

    showJobResumeReview({
      jobId: jobId,
      resumeId: documentRecord.id,
      parsedProfile: parsed.profileDraft,
      differences: differences,
      masterProfile: master
    });

    setJobResumeStatus(
      "Parse complete. Review changes below — nothing is approved for this job yet.",
      false
    );
  }

  async function handleJobResumeUpload(file, options) {
    try {
      const saved = await saveJobSpecificResumeFile(file, options || {});
      await refreshJobResumeUI();
      await parseAndOpenJobResumeReview(saved.document, saved.current.id);
      if (typeof global.refreshJobMatchAnalysis === "function") {
        global.refreshJobMatchAnalysis();
      }
      return saved.document;
    } catch (error) {
      if (error && error.code === "CONFIRM_REPLACE_JOB_RESUME") {
        const accepted = window.confirm(
          'Replace tailored resume "' +
            ((error.existing && error.existing.name) || "current file") +
            '" for this job?'
        );
        if (!accepted) {
          setJobResumeStatus("Replace cancelled.", false);
          return null;
        }
        return handleJobResumeUpload(file, { replaceConfirmed: true });
      }
      if (error && error.code === "IDENTICAL_DEFAULT_RESUME") {
        hideJobResumeReview();
        await refreshJobResumeUI();
        if (typeof global.refreshJobMatchAnalysis === "function") {
          global.refreshJobMatchAnalysis();
        }
        setJobResumeStatus(error.message, true);
        return null;
      }
      setJobResumeStatus(error.message || "Failed to upload tailored resume.", true);
      throw error;
    }
  }

  async function handleJobResumeRemove() {
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (!current) {
      setJobResumeStatus("No current job saved.", true);
      return null;
    }
    const existing = await storage.getJobSpecificResume(current.id);
    if (!existing) {
      setJobResumeStatus("No tailored resume to remove.", false);
      return null;
    }

    const accepted = window.confirm(
      'Remove tailored resume "' + (existing.name || "file") + '" for this job?'
    );
    if (!accepted) {
      setJobResumeStatus("Remove cancelled.", false);
      return null;
    }

    await storage.deleteJobSpecificResumesForJob(current.id);
    await storage.deleteJobProfile(current.id);
    await storage.setJobResumeSelection(current.id, "default");
    hideJobResumeReview();
    await refreshJobResumeUI();
    if (typeof global.refreshJobMatchAnalysis === "function") {
      global.refreshJobMatchAnalysis();
    }
    setJobResumeStatus("Tailored resume removed for this job.", false);
    return true;
  }

  async function handleJobResumeReviewAgain() {
    const storage = ensureStorage();
    const current = await storage.getCurrentJob();
    if (!current) {
      setJobResumeStatus("No current job saved.", true);
      return;
    }
    const tailored = await storage.getJobSpecificResume(current.id);
    if (!tailored) {
      setJobResumeStatus("Upload a tailored resume before reviewing changes.", true);
      return;
    }
    try {
      await parseAndOpenJobResumeReview(tailored, current.id);
    } catch (error) {
      setJobResumeStatus(error.message || "Failed to review tailored resume.", true);
    }
  }

  async function runJobMatchWithProfile(profile, currentJob, meta) {
    if (typeof global.runJobMatchAnalysis !== "function") {
      return null;
    }
    return global.runJobMatchAnalysis({
      profile: profile,
      currentJob: currentJob,
      analyzedWith: meta && meta.analyzedWith,
      jobProfile: meta && meta.jobProfile,
      tailoredResume: meta && meta.tailoredResume
    });
  }

  async function handleJobResumeApprove() {
    const storage = ensureStorage();
    if (!pendingJobResumeReview) {
      setJobResumeStatus("Nothing to approve. Upload or review a tailored resume first.", true);
      return;
    }

    const current = await storage.getCurrentJob();
    if (!current || current.id !== pendingJobResumeReview.jobId) {
      setJobResumeStatus("Current job changed. Re-open review for this job.", true);
      hideJobResumeReview();
      await refreshJobResumeUI();
      return;
    }

    const master = await storage.getMasterProfile();
    const approvals = collectJobResumeApprovals();
    const approvedProfile = storage.buildApprovedJobProfile(
      master,
      pendingJobResumeReview.parsedProfile,
      approvals
    );

    const savedProfile = await storage.saveJobProfile({
      jobId: current.id,
      resumeId: pendingJobResumeReview.resumeId,
      baseProfileId: "master",
      parsedProfile: pendingJobResumeReview.parsedProfile,
      approvedProfile: approvedProfile,
      differences: pendingJobResumeReview.differences
    });

    await storage.setJobResumeSelection(current.id, "tailored");
    hideJobResumeReview();
    await refreshJobResumeUI();
    setJobResumeStatus("Approved for this job. Re-running job match analysis...", false);

    const tailored = await storage.getJobSpecificResume(current.id);
    try {
      await runJobMatchWithProfile(approvedProfile, current, {
        analyzedWith: "job-specific",
        profileSource: "job-specific",
        jobProfile: savedProfile,
        tailoredResume: tailored
      });
      setJobResumeStatus("Approved for this job. Match analysis updated with tailored resume.", false);
    } catch (error) {
      setJobResumeStatus(
        "Approved for this job, but match analysis failed: " + (error.message || error),
        true
      );
    }
  }

  function bindJobResumeUI() {
    const uploadBtn = document.getElementById("jobResumeUploadBtn");
    const replaceBtn = document.getElementById("jobResumeReplaceBtn");
    const removeBtn = document.getElementById("jobResumeRemoveBtn");
    const reviewBtn = document.getElementById("jobResumeReviewBtn");
    const approveBtn = document.getElementById("jobResumeApproveBtn");
    const cancelBtn = document.getElementById("jobResumeCancelBtn");
    const fileInput = document.getElementById("jobResumeFileInput");
    const replaceInput = document.getElementById("jobResumeReplaceInput");
    const selectorEl = document.getElementById("jobResumeSelector");

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", function () {
        fileInput.value = "";
        fileInput.click();
      });
      fileInput.addEventListener("change", function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        handleJobResumeUpload(file, { replaceConfirmed: false }).catch(function () {});
      });
    }

    if (replaceBtn && replaceInput) {
      replaceBtn.addEventListener("click", function () {
        replaceInput.value = "";
        replaceInput.click();
      });
      replaceInput.addEventListener("change", function () {
        const file = replaceInput.files && replaceInput.files[0];
        if (!file) return;
        handleJobResumeUpload(file, { replaceConfirmed: false }).catch(function () {});
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        handleJobResumeRemove().catch(function () {});
      });
    }

    if (reviewBtn) {
      reviewBtn.addEventListener("click", function () {
        handleJobResumeReviewAgain().catch(function () {});
      });
    }

    if (approveBtn) {
      approveBtn.addEventListener("click", function () {
        handleJobResumeApprove().catch(function () {});
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        hideJobResumeReview();
        setJobResumeStatus("Review cancelled. Tailored file kept; job profile not approved.", false);
      });
    }

    if (selectorEl) {
      selectorEl.addEventListener("change", async function (event) {
        const target = event.target;
        if (!target || target.name !== "jobResumeSelection") return;
        const storage = ensureStorage();
        const current = await storage.getCurrentJob();
        if (!current) return;
        try {
          await storage.setJobResumeSelection(current.id, target.value);
          await storage.syncAutofillResumeForJob(current.id);
          setJobResumeStatus(
            target.value === "tailored"
              ? "Using tailored resume for this job."
              : "Using default resume for this job.",
            false
          );
          if (typeof global.refreshJobMatchAnalysis === "function") {
            global.refreshJobMatchAnalysis();
          }
        } catch (error) {
          setJobResumeStatus(error.message || "Failed to update resume selection.", true);
        }
      });
    }
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

    bindJobResumeUI();
  }

  async function init() {
    bindJobUI();
    await refreshJobUI();
    return refreshJobResumeUI();
  }

  global.ImpulsoJob = {
    init: init,
    refresh: refreshJobUI,
    refreshJobResumeUI: refreshJobResumeUI,
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
