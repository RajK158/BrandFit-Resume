(function (global) {
  "use strict";

  var CATEGORY_ORDER = [
    "resume_upload",
    "cover_letter",
    "linkedin",
    "github",
    "portfolio",
    "url",
    "email",
    "phone",
    "preferred_name",
    "first_name",
    "last_name",
    "full_name",
    "address",
    "city",
    "state",
    "postal_code",
    "country",
    "work_authorization",
    "sponsorship_now",
    "sponsorship_later",
    "availability",
    "salary",
    "relocation",
    "veteran_status",
    "disability_status",
    "gender",
    "race_ethnicity",
    "education",
    "experience",
    "skills",
    "project_highlight",
    "additional_information",
    "unknown"
  ];

  var CATEGORY_LABELS = {
    first_name: "First name",
    last_name: "Last name",
    full_name: "Full name",
    preferred_name: "Preferred name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    city: "City",
    state: "State",
    postal_code: "ZIP/postal code",
    country: "Country",
    linkedin: "LinkedIn",
    github: "GitHub",
    portfolio: "Portfolio",
    url: "URL",
    education: "Education",
    experience: "Experience",
    skills: "Skills",
    work_authorization: "Work authorization",
    sponsorship_now: "Sponsorship now",
    sponsorship_later: "Sponsorship later",
    availability: "Availability",
    salary: "Salary",
    relocation: "Relocation",
    veteran_status: "Veteran status",
    disability_status: "Disability status",
    gender: "Gender",
    race_ethnicity: "Race/ethnicity",
    cover_letter: "Cover letter",
    project_highlight: "Project highlight",
    additional_information: "Additional information",
    resume_upload: "Resume upload",
    unknown: "Unknown"
  };

  var SENSITIVE_CATEGORIES = {
    gender: true,
    race_ethnicity: true,
    veteran_status: true,
    disability_status: true
  };

  var NO_SAVED_ANSWER = "No saved answer";

  var TEXT_RULES = [
    {
      category: "cover_letter",
      confidence: 0.95,
      include: [/\bcover\s*letter\b/, /\bcovering\s*letter\b/],
      exclude: []
    },
    {
      category: "linkedin",
      confidence: 0.95,
      include: [/\blinkedin\b/],
      exclude: []
    },
    {
      category: "github",
      confidence: 0.92,
      include: [/\bgithub\b/],
      exclude: [/\bgitlab\b/, /\bbitbucket\b/]
    },
    {
      category: "project_highlight",
      confidence: 0.93,
      include: [
        /\bproject\s+you\s+are\s+proud\b/,
        /\bproud\s+of\b.*\bproject\b/,
        /\bproject\b.*\bproud\s+of\b/,
        /\bshare\s+a\s+project\b/,
        /\bdescribe\s+(a\s+|one\s+|your\s+)?project\b/,
        /\bproject\s+contribution\b/,
        /\bproject\s+highlight\b/,
        /\btell\s+us\s+about\s+(a\s+|one\s+|your\s+)?project\b/,
        /\bfavorite\s+project\b/
      ],
      exclude: [
        /\bportfolio\s+url\b/,
        /\bwebsite\s+url\b/,
        /\bportfolio\s+link\b/,
        /\bwebsite\s+or\s+portfolio\b/,
        /\bportfolio\s+or\s+website\b/
      ]
    },
    {
      category: "portfolio",
      confidence: 0.88,
      include: [
        /\bportfolio\b/,
        /\bpersonal\s+website\b/,
        /\bwebsite\s+url\b/,
        /\bwebsite\s+or\s+portfolio\b/,
        /\bportfolio\s+or\s+website\b/,
        /\bportfolio\s+url\b/,
        /\bportfolio\s+link\b/
      ],
      exclude: [
        /\blinkedin\b/,
        /\bgithub\b/,
        /\bresume\b/,
        /\bcv\b/,
        /\bproud\b/,
        /\bdescribe\s+(a\s+|one\s+|your\s+)?project\b/,
        /\bshare\s+a\s+project\b/,
        /\bproject\s+contribution\b/,
        /\bproject\s+highlight\b/
      ]
    },
    {
      category: "email",
      confidence: 0.96,
      include: [/\be-?mail\b/, /\bemail\s*address\b/],
      exclude: []
    },
    {
      category: "phone",
      confidence: 0.94,
      include: [/\bphone\b/, /\bmobile\b/, /\btelephone\b/, /\bcell\b/, /\bphone\s*number\b/],
      exclude: []
    },
    {
      category: "preferred_name",
      confidence: 0.94,
      include: [/\bpreferred\s+name\b/, /\bpreferred\s+first\s+name\b/],
      exclude: []
    },
    {
      category: "sponsorship_later",
      confidence: 0.9,
      include: [
        /\bsponsorship\b.*\b(future|later)\b/,
        /\bin\s+the\s+future\b.*\bsponsor/,
        /\bwill\s+you\s+.*\bfuture\b.*\bsponsor/
      ],
      exclude: [/\bnow\b/]
    },
    {
      category: "sponsorship_now",
      confidence: 0.93,
      include: [
        /\bsponsorship\b/,
        /\bvisa\s+sponsorship\b/,
        /\brequire\b.*\bsponsor/,
        /\bwill\s+you\s+.*\bsponsor/,
        /\bnow\s+or\s+in\s+the\s+future\b/
      ],
      exclude: []
    },
    {
      category: "work_authorization",
      confidence: 0.92,
      include: [
        /\blegally\s+authorized\b/,
        /\bauthorized\s+to\s+work\b/,
        /\bwork\s+authorization\b/,
        /\beligible\s+to\s+work\b/,
        /\bunited\s+states\s+citizen\b/,
        /\bcitizen\s+or\s+national\b/,
        /\ba\s+united\s+states\s+citizen\b/
      ],
      exclude: [/\bsponsor/]
    },
    {
      category: "veteran_status",
      confidence: 0.94,
      include: [/\bveteran\b/, /\bprotected\s+veteran\b/, /\bmilitary\s+status\b/],
      exclude: []
    },
    {
      category: "disability_status",
      confidence: 0.94,
      include: [/\bdisability\b/, /\bdisabled\b/, /\bdisability\s+status\b/],
      exclude: []
    },
    {
      category: "race_ethnicity",
      confidence: 0.93,
      include: [
        /\brace\b/,
        /\bethnicity\b/,
        /\bethnic\b/,
        /\bhispanic\b/,
        /\blatino\b/,
        /\blatina\b/,
        /\blatinx\b/
      ],
      // Do not exclude male/female — nearby gender options often pollute the blob.
      exclude: [/\bgender\s+identity\b/, /\bsex\s+assigned\b/]
    },
    {
      category: "gender",
      confidence: 0.9,
      include: [/\bgender\b/, /\bsex\b/, /\bgender\s+identity\b/],
      exclude: [/\bhispanic\b/, /\blatin[oa]\b/, /\blatinx\b/, /\brace\b/, /\bethnicity\b/, /\bethnic\b/]
    },
    {
      category: "salary",
      confidence: 0.9,
      include: [/\bsalary\b/, /\bcompensation\b/, /\bexpected\s+pay\b/, /\bpay\s+expectation/],
      exclude: []
    },
    {
      category: "relocation",
      confidence: 0.88,
      include: [/\brelocatem?\b/, /\bwilling\s+to\s+move\b/],
      exclude: []
    },
    {
      category: "availability",
      confidence: 0.86,
      include: [/\bstart\s+date\b/, /\bavailable\s+to\s+start\b/, /\bnotice\s+period\b/, /\bavailability\b/],
      exclude: []
    },
    {
      category: "postal_code",
      confidence: 0.9,
      include: [/\bzip\b/, /\bpostal\b/, /\bpost\s*code\b/],
      exclude: []
    },
    {
      category: "city",
      confidence: 0.86,
      include: [/\bcity\b/, /\btown\b/],
      exclude: [/\bstate\b/, /\bcountry\b/]
    },
    {
      category: "state",
      confidence: 0.86,
      include: [/\bstate\b/, /\bprovince\b/, /\bregion\b/],
      exclude: [/\bcountry\b/, /\bunited\s+states\b/]
    },
    {
      category: "country",
      confidence: 0.88,
      include: [/\bcountry\b/, /\bnation\b/],
      exclude: []
    },
    {
      category: "address",
      confidence: 0.84,
      include: [/\bstreet\s+address\b/, /\baddress\s*line\b/, /\bmailing\s+address\b/, /\bhome\s+address\b/],
      exclude: [/\bemail\b/, /\bip\b/]
    },
    {
      category: "education",
      confidence: 0.82,
      include: [/\beducation\b/, /\bdegree\b/, /\buniversity\b/, /\bschool\b/, /\bgpa\b/],
      exclude: []
    },
    {
      category: "experience",
      confidence: 0.8,
      include: [/\bwork\s+experience\b/, /\bemployment\s+history\b/, /\bprevious\s+role\b/],
      exclude: [/\bcurrent\s+employer\b/]
    },
    {
      category: "skills",
      confidence: 0.8,
      include: [/\bskills?\b/, /\btechnologies\b/, /\btech\s+stack\b/],
      exclude: []
    },
    {
      category: "additional_information",
      confidence: 0.78,
      include: [
        /\badditional\s+information\b/,
        /\banything\s+else\b/,
        /\bother\s+information\b/,
        /\bcomments?\b/,
        /\bwhy\s+(are\s+you\s+)?interested\b/
      ],
      exclude: [
        /\bcover\s*letter\b/,
        /\bproject\s+you\s+are\s+proud\b/,
        /\bshare\s+a\s+project\b/,
        /\bdescribe\s+(a\s+|one\s+|your\s+)?project\b/,
        /\bproject\s+contribution\b/
      ]
    },
    {
      category: "full_name",
      confidence: 0.92,
      include: [
        /\bfull\s*name\b/,
        /\blegal\s+name\b/,
        /\byour\s+name\b/,
        /\bapplicant\s+name\b/
      ],
      exclude: [
        /\bpreferred\b/,
        /\bemployer\b/,
        /\bcompany\b/,
        /\bcurrent\s+employer\b/,
        /\breference\b/
      ]
    },
    {
      category: "first_name",
      confidence: 0.9,
      include: [/\bfirst\s*name\b/, /\bgiven\s*name\b/, /\bforename\b/],
      exclude: [
        /\bpreferred\b/,
        /\bfull\b/,
        /\blegal\s+name\b/,
        /\blast\s*name\b/,
        /\bmiddle\b/,
        /\bemployer\b/,
        /\bcompany\b/,
        /\borganization\b/,
        /\bcurrent\s+employer\b/
      ]
    },
    {
      category: "last_name",
      confidence: 0.9,
      include: [/\blast\s*name\b/, /\bsurname\b/, /\bfamily\s*name\b/],
      exclude: [
        /\bfirst\s*name\b/,
        /\bfull\b/,
        /\blegal\s+name\b/,
        /\bpreferred\b/,
        /\bemployer\b/,
        /\bcompany\b/
      ]
    }
  ];

  var FILE_EXCLUDE = [
    /\bcover\s*letter\b/,
    /\bcovering\s*letter\b/,
    /\btranscript\b/,
    /\bportfolio\b/,
    /\bphoto\b/,
    /\bselfie\b/,
    /\bheadshot\b/,
    /\bpassport\b/,
    /\bid\s+card\b/,
    /\brecommendation\s+letter\b/
  ];

  function trimText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return trimText(value).toLowerCase();
  }

  function uniqueStrings(items) {
    var out = [];
    var seen = {};
    (items || []).forEach(function (item) {
      var text = trimText(item);
      var key = text.toLowerCase();
      if (!text || seen[key]) return;
      seen[key] = true;
      out.push(text);
    });
    return out;
  }

  function hashString(input) {
    var text = String(input || "");
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function isFilledValue(value) {
    if (value == null) return false;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(trimText(value));
  }

  function confidenceLabel(score) {
    var n = Number(score) || 0;
    if (n >= 0.85) return "High";
    if (n >= 0.65) return "Medium";
    return "Low";
  }

  function ruleMatches(rule, blob) {
    if (!blob) return false;
    for (var i = 0; i < (rule.exclude || []).length; i += 1) {
      if (rule.exclude[i].test(blob)) return false;
    }
    for (var j = 0; j < (rule.include || []).length; j += 1) {
      if (rule.include[j].test(blob)) return true;
    }
    return false;
  }

  function describeInputTypeFromMeta(meta) {
    var tag = normalizeText(meta.tagName || "");
    var type = normalizeText(meta.inputType || meta.type || "");
    var role = normalizeText(meta.role || "");
    if (meta.contentEditable) return "contenteditable";
    if (role === "combobox") return "combobox";
    if (role === "listbox") return "listbox";
    if (tag === "select") return meta.multiple ? "select-multiple" : "select";
    if (tag === "textarea") return "textarea";
    if (tag === "input" || type) return type || "text";
    if (role) return role;
    return tag || "unknown";
  }

  function describeInputType(el) {
    if (!el) return "unknown";
    return describeInputTypeFromMeta({
      tagName: el.tagName,
      inputType: el.type,
      role: el.getAttribute && el.getAttribute("role"),
      contentEditable:
        Boolean(el.isContentEditable) ||
        normalizeText(el.getAttribute && el.getAttribute("contenteditable")) === "true",
      multiple: Boolean(el.multiple)
    });
  }

  function isFileInputType(inputType) {
    return normalizeText(inputType) === "file";
  }

  function classifyResumeUpload(labelBlob) {
    var blob = normalizeText(labelBlob);
    if (!blob) return null;
    for (var i = 0; i < FILE_EXCLUDE.length; i += 1) {
      if (FILE_EXCLUDE[i].test(blob)) return null;
    }
    if (/\bresume\b/.test(blob) || /\bcv\b/.test(blob) || /\bcurriculum\s+vitae\b/.test(blob)) {
      return { category: "resume_upload", confidence: 0.96 };
    }
    return null;
  }

  function classifyFromOptions(optionLabels) {
    var blob = normalizeText((optionLabels || []).join(" "));
    if (!blob) return null;
    if (/\bhispanic\b/.test(blob) || /\blatin[oa]\b/.test(blob) || /\blatinx\b/.test(blob)) {
      return { category: "race_ethnicity", confidence: 0.92 };
    }
    if (
      (/\bmale\b/.test(blob) || /\bfemale\b/.test(blob) || /\bnon[-\s]?binary\b/.test(blob)) &&
      !/\bhispanic\b/.test(blob) &&
      !/\brace\b/.test(blob)
    ) {
      return { category: "gender", confidence: 0.9 };
    }
    if (/\bveteran\b/.test(blob)) {
      return { category: "veteran_status", confidence: 0.9 };
    }
    if (/\bdisability\b/.test(blob) || /\bdisabled\b/.test(blob)) {
      return { category: "disability_status", confidence: 0.9 };
    }
    return null;
  }

  function looksLikeProjectHighlight(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (
      /\bportfolio\s+url\b/.test(text) ||
      /\bwebsite\s+url\b/.test(text) ||
      /\bportfolio\s+link\b/.test(text) ||
      /\bwebsite\s+or\s+portfolio\b/.test(text) ||
      /\bportfolio\s+or\s+website\b/.test(text)
    ) {
      return false;
    }
    return (
      /\bproject\s+you\s+are\s+proud\b/.test(text) ||
      /\bproud\s+of\b.*\bproject\b/.test(text) ||
      /\bproject\b.*\bproud\s+of\b/.test(text) ||
      /\bshare\s+a\s+project\b/.test(text) ||
      /\bdescribe\s+(a\s+|one\s+|your\s+)?project\b/.test(text) ||
      /\bproject\s+contribution\b/.test(text) ||
      /\bproject\s+highlight\b/.test(text) ||
      /\btell\s+us\s+about\s+(a\s+|one\s+|your\s+)?project\b/.test(text) ||
      /\bfavorite\s+project\b/.test(text)
    );
  }

  function looksLikePortfolioLink(blob) {
    var text = normalizeText(blob);
    if (!text || looksLikeProjectHighlight(text)) return false;
    return (
      /\bportfolio\b/.test(text) ||
      /\bpersonal\s+website\b/.test(text) ||
      /\bwebsite\s+url\b/.test(text) ||
      /\bwebsite\s+or\s+portfolio\b/.test(text) ||
      /\bportfolio\s+or\s+website\b/.test(text) ||
      /\bportfolio\s+url\b/.test(text) ||
      /\bportfolio\s+link\b/.test(text)
    );
  }

  function detectCategoryFromMeta(meta) {
    var inputType = describeInputTypeFromMeta(meta || {});
    var label = trimText(meta.label || "");
    var placeholder = trimText(meta.placeholder || "");
    var ariaLabel = trimText(meta.ariaLabel || "");
    var name = trimText(meta.name || "");
    var id = trimText(meta.id || "");
    var nearby = trimText(meta.nearby || "");
    var autocomplete = normalizeText(meta.autocomplete || "");
    var questionBlob = normalizeText([label, ariaLabel, name, id].join(" "));
    var fullBlob = normalizeText(
      [label, placeholder, ariaLabel, name, id, nearby, autocomplete].join(" ")
    );
    var optionLabels = meta.optionLabels || [];

    // 1) DOM type first
    if (inputType === "email") {
      return validateDetection({ category: "email", confidence: 0.98 }, inputType);
    }
    if (inputType === "tel") {
      return validateDetection({ category: "phone", confidence: 0.97 }, inputType);
    }

    if (isFileInputType(inputType)) {
      if (/\bcover\s*letter\b/.test(questionBlob) || /\bcovering\s*letter\b/.test(questionBlob)) {
        return validateDetection({ category: "cover_letter", confidence: 0.96 }, inputType);
      }
      var resumeHit = classifyResumeUpload(questionBlob);
      if (resumeHit) return validateDetection(resumeHit, inputType);
      return validateDetection({ category: "unknown", confidence: 0.35 }, inputType);
    }

    // Project narrative questions before any URL/portfolio heuristics
    if (looksLikeProjectHighlight(questionBlob) || looksLikeProjectHighlight(fullBlob)) {
      return validateDetection({ category: "project_highlight", confidence: 0.94 }, inputType);
    }

    // Non-file elements can never be resume upload (enforced in validateDetection too)
    if (inputType === "url" || inputType === "text" || inputType === "search" || inputType === "textarea") {
      if (/\blinkedin\b/.test(fullBlob)) {
        return validateDetection({ category: "linkedin", confidence: 0.96 }, inputType);
      }
      if (/\bgithub\b/.test(fullBlob)) {
        return validateDetection({ category: "github", confidence: 0.95 }, inputType);
      }
      if (looksLikePortfolioLink(questionBlob) || looksLikePortfolioLink(fullBlob)) {
        return validateDetection({ category: "portfolio", confidence: 0.9 }, inputType);
      }
      if (inputType === "url") {
        return validateDetection({ category: "url", confidence: 0.7 }, inputType);
      }
    }

    if (/\bpreferred\s+name\b/.test(questionBlob) || /\bpreferred\s+first\s+name\b/.test(questionBlob)) {
      return validateDetection({ category: "preferred_name", confidence: 0.95 }, inputType);
    }

    if (/\b(current\s+employer|employer\s+name|company\s+name|organization\s+name)\b/.test(questionBlob)) {
      return validateDetection({ category: "unknown", confidence: 0.4 }, inputType);
    }

    if (autocomplete === "given-name") {
      return validateDetection({ category: "first_name", confidence: 0.97 }, inputType);
    }
    if (autocomplete === "family-name") {
      return validateDetection({ category: "last_name", confidence: 0.97 }, inputType);
    }
    if (autocomplete === "nickname") {
      return validateDetection({ category: "preferred_name", confidence: 0.95 }, inputType);
    }
    if (autocomplete === "name") {
      return validateDetection({ category: "full_name", confidence: 0.9 }, inputType);
    }
    if (autocomplete === "email") {
      return validateDetection({ category: "email", confidence: 0.97 }, inputType);
    }
    if (autocomplete === "tel") {
      return validateDetection({ category: "phone", confidence: 0.97 }, inputType);
    }
    if (autocomplete === "street-address") {
      return validateDetection({ category: "address", confidence: 0.93 }, inputType);
    }
    if (autocomplete === "address-level2") {
      return validateDetection({ category: "city", confidence: 0.9 }, inputType);
    }
    if (autocomplete === "address-level1") {
      return validateDetection({ category: "state", confidence: 0.9 }, inputType);
    }
    if (autocomplete === "postal-code") {
      return validateDetection({ category: "postal_code", confidence: 0.93 }, inputType);
    }
    if (autocomplete === "country" || autocomplete === "country-name") {
      return validateDetection({ category: "country", confidence: 0.93 }, inputType);
    }
    if (autocomplete === "url") {
      if (/\blinkedin\b/.test(fullBlob)) {
        return validateDetection({ category: "linkedin", confidence: 0.96 }, inputType);
      }
      if (/\bgithub\b/.test(fullBlob)) {
        return validateDetection({ category: "github", confidence: 0.95 }, inputType);
      }
      return validateDetection({ category: "url", confidence: 0.75 }, inputType);
    }

    // Radio/select groups: classify question first, then option cues
    if (
      inputType === "radio" ||
      inputType === "select" ||
      inputType === "select-multiple" ||
      inputType === "checkbox"
    ) {
      for (var r = 0; r < TEXT_RULES.length; r += 1) {
        if (ruleMatches(TEXT_RULES[r], questionBlob)) {
          return validateDetection(
            { category: TEXT_RULES[r].category, confidence: TEXT_RULES[r].confidence },
            inputType,
            optionLabels
          );
        }
      }
      var fromOptions = classifyFromOptions(optionLabels);
      if (fromOptions) {
        return validateDetection(fromOptions, inputType, optionLabels);
      }
    }

    for (var i = 0; i < TEXT_RULES.length; i += 1) {
      if (TEXT_RULES[i].category === "resume_upload") continue;
      // Match the field's own question text first to avoid nearby-question bleed.
      if (ruleMatches(TEXT_RULES[i], questionBlob)) {
        return validateDetection(
          { category: TEXT_RULES[i].category, confidence: TEXT_RULES[i].confidence },
          inputType,
          optionLabels
        );
      }
    }

    for (var j = 0; j < TEXT_RULES.length; j += 1) {
      if (TEXT_RULES[j].category === "resume_upload") continue;
      if (ruleMatches(TEXT_RULES[j], fullBlob)) {
        return validateDetection(
          { category: TEXT_RULES[j].category, confidence: TEXT_RULES[j].confidence },
          inputType,
          optionLabels
        );
      }
    }

    return validateDetection({ category: "unknown", confidence: 0.35 }, inputType, optionLabels);
  }

  function validateDetection(detected, inputType, optionLabels) {
    var result = {
      category: detected && detected.category ? detected.category : "unknown",
      confidence: detected && detected.confidence != null ? detected.confidence : 0.35
    };

    if (result.category === "resume_upload" && !isFileInputType(inputType)) {
      result = { category: "unknown", confidence: 0.3 };
    }

    // race/ethnicity cannot be gender
    if (result.category === "gender") {
      var raceCue = normalizeText((optionLabels || []).join(" ") + " ");
      var labelCue = normalizeText(String((detected && detected.label) || ""));
      var cue = raceCue + " " + labelCue;
      if (/\bhispanic\b/.test(cue) || /\blatin[oa]\b/.test(cue) || /\brace\b/.test(cue) || /\bethnicity\b/.test(cue)) {
        result = { category: "race_ethnicity", confidence: 0.9 };
      }
    }

    // phone inputs cannot be file fields
    if (result.category === "phone" && isFileInputType(inputType)) {
      result = { category: "unknown", confidence: 0.3 };
    }

    return result;
  }

  function findLabelText(el) {
    if (!el) return "";
    if (el.id) {
      var byFor = null;
      try {
        byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      } catch (_) {
        byFor = document.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
      }
      if (byFor) return trimText(byFor.innerText || byFor.textContent || "");
    }
    var parentLabel = el.closest("label");
    if (parentLabel) return trimText(parentLabel.innerText || parentLabel.textContent || "");

    var labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      var parts = labelledBy.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? trimText(node.innerText || node.textContent || "") : "";
      });
      return trimText(parts.join(" "));
    }
    return "";
  }

  function isLikelyOptionCluster(text, optionTexts) {
    var blob = normalizeText(text);
    if (!blob) return false;
    var hits = 0;
    (optionTexts || []).forEach(function (opt) {
      var o = normalizeText(opt);
      if (o && o.length > 0 && blob.indexOf(o) !== -1) hits += 1;
    });
    return hits >= 2;
  }

  function nearbyQuestionText(el, optionTexts) {
    if (!el) return "";
    var fieldset = el.closest("fieldset");
    if (fieldset) {
      var legend = fieldset.querySelector("legend");
      if (legend) {
        var legendText = trimText(legend.innerText || legend.textContent || "");
        if (legendText && !isLikelyOptionCluster(legendText, optionTexts)) return legendText;
      }
    }

    var labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      var parts = labelledBy.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? trimText(node.innerText || node.textContent || "") : "";
      });
      var ariaText = trimText(parts.join(" "));
      if (ariaText && !isLikelyOptionCluster(ariaText, optionTexts)) return ariaText;
    }

    var parent = el.parentElement;
    var hops = 0;
    while (parent && hops < 5) {
      var prev = parent.previousElementSibling;
      if (prev) {
        var prevText = trimText(prev.innerText || prev.textContent || "");
        if (
          prevText &&
          prevText.length < 220 &&
          !isLikelyOptionCluster(prevText, optionTexts)
        ) {
          return prevText;
        }
      }
      var heading = parent.querySelector(
        ":scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [class*='question'], :scope > label, :scope > p, :scope > span"
      );
      if (heading && heading !== el && !heading.contains(el)) {
        var headingText = trimText(heading.innerText || heading.textContent || "");
        if (
          headingText &&
          headingText.length < 220 &&
          !isLikelyOptionCluster(headingText, optionTexts)
        ) {
          return headingText;
        }
      }
      if (parent.getAttribute && parent.getAttribute("role") === "group") {
        var groupLabel = trimText(parent.getAttribute("aria-label") || "");
        if (groupLabel) return groupLabel;
      }
      parent = parent.parentElement;
      hops += 1;
    }
    return "";
  }

  function radioGroupQuestionText(radios) {
    if (!radios || !radios.length) return "";
    var first = radios[0];
    var optionTexts = radios.map(function (r) {
      return normalizeText(findLabelText(r) || r.value || "");
    });

    var fieldset = first.closest("fieldset");
    if (fieldset) {
      var legend = fieldset.querySelector("legend");
      if (legend) {
        var legendText = trimText(legend.innerText || legend.textContent || "");
        if (legendText && !isLikelyOptionCluster(legendText, optionTexts)) return legendText;
      }
    }

    var group = first.closest("[role='group'], [class*='question'], [data-automation-id], [data-qa]");
    if (group) {
      var groupAria = trimText(group.getAttribute("aria-label") || "");
      if (groupAria) return groupAria;
      var groupLabelledBy = group.getAttribute("aria-labelledby");
      if (groupLabelledBy) {
        var nodes = groupLabelledBy.split(/\s+/).map(function (id) {
          var node = document.getElementById(id);
          return node ? trimText(node.innerText || node.textContent || "") : "";
        });
        var joined = trimText(nodes.join(" "));
        if (joined && !isLikelyOptionCluster(joined, optionTexts)) return joined;
      }
      var prompt = group.querySelector(
        "legend, h1, h2, h3, h4, h5, h6, [class*='question'], [class*='label'], p, label, span"
      );
      if (prompt && !radios.some(function (r) { return prompt.contains(r); })) {
        var promptText = trimText(prompt.innerText || prompt.textContent || "");
        if (
          promptText &&
          optionTexts.indexOf(normalizeText(promptText)) === -1 &&
          !isLikelyOptionCluster(promptText, optionTexts)
        ) {
          return promptText;
        }
      }
    }

    return nearbyQuestionText(first, optionTexts);
  }

  function collectContext(el, options) {
    var opts = options || {};
    var label = opts.label != null ? opts.label : findLabelText(el);
    var placeholder = trimText(el.getAttribute("placeholder") || "");
    var ariaLabel = trimText(el.getAttribute("aria-label") || "");
    var name = trimText(el.getAttribute("name") || "");
    var id = trimText(el.id || "");
    var title = trimText(el.getAttribute("title") || "");
    var autocomplete = trimText(el.getAttribute("autocomplete") || "");
    var nearby = opts.nearby != null ? opts.nearby : nearbyQuestionText(el);
    var role = trimText(el.getAttribute("role") || "");
    var blob = normalizeText(
      [label, placeholder, ariaLabel, name, id, title, autocomplete, nearby, role].join(" ")
    );
    return {
      label: label,
      placeholder: placeholder,
      ariaLabel: ariaLabel,
      name: name,
      id: id,
      title: title,
      autocomplete: autocomplete,
      nearby: nearby,
      role: role,
      blob: blob
    };
  }

  function detectCategory(el, context, optionLabels) {
    return detectCategoryFromMeta({
      tagName: el && el.tagName,
      inputType: describeInputType(el),
      type: el && el.type,
      role: context && context.role,
      contentEditable:
        el &&
        (Boolean(el.isContentEditable) ||
          normalizeText(el.getAttribute("contenteditable")) === "true"),
      multiple: Boolean(el && el.multiple),
      label: context && context.label,
      placeholder: context && context.placeholder,
      ariaLabel: context && context.ariaLabel,
      name: context && context.name,
      id: context && context.id,
      nearby: context && context.nearby,
      autocomplete: context && context.autocomplete,
      optionLabels: optionLabels || []
    });
  }

  function isRequired(el) {
    if (!el) return false;
    if (el.required) return true;
    var aria = normalizeText(el.getAttribute("aria-required") || "");
    if (aria === "true") return true;
    var context = collectContext(el);
    if (/\brequired\b|\*$/.test(context.label) || /\brequired\b/.test(context.nearby)) return true;
    return false;
  }

  function isGroupRequired(elements) {
    return (elements || []).some(function (el) {
      return isRequired(el);
    });
  }

  function readCurrentValue(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    var type = (el.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return el.checked ? String(el.value || "on") : "";
    }
    if (type === "file") {
      if (el.files && el.files.length) {
        return Array.prototype.map.call(el.files, function (f) {
          return f.name;
        }).join(", ");
      }
      return "";
    }
    if (tag === "select") {
      if (el.multiple) {
        return Array.prototype.map
          .call(el.selectedOptions || [], function (opt) {
            return trimText(opt.textContent || opt.value || "");
          })
          .filter(Boolean)
          .join(", ");
      }
      var selected = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      return selected ? trimText(selected.textContent || selected.value || "") : trimText(el.value || "");
    }
    if (el.isContentEditable || normalizeText(el.getAttribute("contenteditable")) === "true") {
      return trimText(el.innerText || el.textContent || "");
    }
    return trimText(el.value || "");
  }

  function readRadioGroupValue(radios) {
    for (var i = 0; i < (radios || []).length; i += 1) {
      if (radios[i].checked) {
        return trimText(findLabelText(radios[i]) || radios[i].value || "on");
      }
    }
    return "";
  }

  function readOptions(el) {
    if (!el) return [];
    var tag = (el.tagName || "").toLowerCase();
    var role = normalizeText(el.getAttribute("role") || "");
    if (tag === "select") {
      return Array.prototype.map
        .call(el.options || [], function (opt) {
          return {
            value: trimText(opt.value || ""),
            label: trimText(opt.textContent || ""),
            disabled: Boolean(opt.disabled)
          };
        })
        .filter(function (opt) {
          return opt.value || opt.label;
        });
    }
    if (role === "listbox" || role === "combobox") {
      var listId = el.getAttribute("aria-controls") || el.getAttribute("list");
      var list = listId ? document.getElementById(listId) : null;
      if (list) {
        return Array.prototype.map
          .call(list.querySelectorAll('[role="option"], option'), function (opt) {
            return {
              value: trimText(opt.getAttribute("data-value") || opt.value || ""),
              label: trimText(opt.innerText || opt.textContent || ""),
              disabled: Boolean(opt.getAttribute("aria-disabled") === "true" || opt.disabled)
            };
          })
          .filter(function (opt) {
            return opt.value || opt.label;
          });
      }
    }
    return [];
  }

  function readRadioOptions(radios) {
    return (radios || [])
      .map(function (radio) {
        return {
          value: trimText(radio.value || ""),
          label: trimText(findLabelText(radio) || radio.value || ""),
          disabled: Boolean(radio.disabled)
        };
      })
      .filter(function (opt) {
        return opt.value || opt.label;
      });
  }

  function buildStableFieldId(parts, index) {
    return [
      parts.inputType || "",
      parts.name || "",
      parts.id || "",
      hashString(parts.label || parts.ariaLabel || parts.placeholder || ""),
      String(index)
    ].join("::");
  }

  function isVisibleEnough(el) {
    if (!el || el.disabled) return false;
    if (el.type && String(el.type).toLowerCase() === "hidden") return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  }

  function radioGroupKey(el) {
    if (el.name) return "name:" + el.name;
    var fieldset = el.closest("fieldset");
    if (fieldset) {
      var legend = fieldset.querySelector("legend");
      return "fieldset:" + hashString(trimText(legend ? legend.innerText || "" : "") + String(fieldset.id || ""));
    }
    var group = el.closest("[role='group'], [class*='question']");
    if (group) return "group:" + hashString(trimText((group.getAttribute("aria-label") || "") + String(group.id || "")).slice(0, 120));
    return "solo:" + (el.id || hashString(findLabelText(el) || String(Math.random())));
  }

  function collectScanUnits(root) {
    var doc = root || document;
    var nodes = Array.prototype.slice.call(
      doc.querySelectorAll(
        "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='combobox'], [role='listbox'], [role='textbox']"
      )
    );
    var choiceGroups = {};
    var checkboxNameCounts = {};
    var units = [];

    nodes.forEach(function (el) {
      var type = (el.type || "").toLowerCase();
      if (type === "checkbox" && el.name) {
        checkboxNameCounts[el.name] = (checkboxNameCounts[el.name] || 0) + 1;
      }
    });

    nodes.forEach(function (el) {
      if (!isVisibleEnough(el)) return;
      var type = (el.type || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "reset") {
        return;
      }
      if (type === "radio" || (type === "checkbox" && el.name && checkboxNameCounts[el.name] > 1)) {
        var key = (type === "checkbox" ? "checkbox:" : "radio:") + radioGroupKey(el);
        if (!choiceGroups[key]) choiceGroups[key] = [];
        choiceGroups[key].push(el);
        return;
      }
      units.push({ kind: "single", elements: [el] });
    });

    Object.keys(choiceGroups).forEach(function (key) {
      units.push({
        kind: "radio-group",
        elements: choiceGroups[key],
        groupKey: key,
        inputType: key.indexOf("checkbox:") === 0 ? "checkbox" : "radio"
      });
    });

    Array.prototype.slice
      .call(doc.querySelectorAll('[aria-haspopup="listbox"], [data-testid*="select"], [class*="dropdown"]'))
      .forEach(function (el) {
        if (!isVisibleEnough(el)) return;
        if ((el.tagName || "").toLowerCase() !== "button" && el.getAttribute("role") !== "button") {
          return;
        }
        var already = units.some(function (unit) {
          return unit.elements.indexOf(el) !== -1;
        });
        if (already) return;
        var context = collectContext(el);
        if (!context.blob) return;
        units.push({ kind: "single", elements: [el] });
      });

    return units;
  }

  function buildAnswerInventory(profile, options) {
    var opts = options || {};
    var data = profile || {};
    var personal = data.personal || {};
    var links = data.links || {};
    var work = data.workAuthorization || {};
    var prefs = data.applicationPreferences || {};
    var common = data.commonAnswers || {};
    var demo = data.demographics || {};
    var first = trimText(personal.firstName || opts.firstName || "");
    var last = trimText(personal.lastName || opts.lastName || "");
    var resumeName = trimText(opts.resumeName || "");
    var hasResume = Boolean(opts.hasResume || resumeName);
    return {
      first_name: first,
      last_name: last,
      full_name: trimText([first, last].filter(Boolean).join(" ")),
      preferred_name: trimText(personal.preferredName || personal.preferredFirstName || ""),
      email: trimText(personal.email || opts.email || ""),
      phone: trimText(personal.phone || ""),
      address: trimText(personal.location || ""),
      city: "",
      state: "",
      postal_code: "",
      country: trimText(work.countryApplyingIn || ""),
      linkedin: trimText(links.linkedin || ""),
      github: trimText(links.github || ""),
      portfolio: trimText(links.portfolio || ""),
      url: "",
      education: Array.isArray(data.education) && data.education.length ? "Saved in profile" : "",
      experience: Array.isArray(data.experience) && data.experience.length ? "Saved in profile" : "",
      skills: Array.isArray(data.skills) && data.skills.length ? data.skills.join(", ") : "",
      work_authorization: trimText(work.legallyAuthorizedToWork || ""),
      sponsorship_now: trimText(work.requireSponsorshipNow || ""),
      sponsorship_later: trimText(work.requireSponsorshipFuture || ""),
      availability: trimText(prefs.availableStartDate || prefs.noticePeriod || ""),
      salary: trimText(common.salaryExpectation || ""),
      relocation: trimText(prefs.willingToRelocate || ""),
      // Sensitive demographics: only locally saved values — never inferred.
      veteran_status: trimText(demo.veteranStatus || ""),
      disability_status: trimText(demo.disabilityStatus || ""),
      gender: trimText(demo.gender || ""),
      race_ethnicity: trimText(demo.raceEthnicity || ""),
      cover_letter: trimText(common.defaultCoverLetter || ""),
      // Explicit saved answer only — never auto-generated from resume projects or portfolio URL.
      project_highlight: trimText(common.projectHighlight || ""),
      additional_information: trimText(
        common.linkedinMessageOrAdditionalInfo ||
          common.whyInterestedInRole ||
          common.anythingElseToKnow ||
          ""
      ),
      resume_upload: hasResume ? resumeName || "Resume on file" : "",
      resume_filename: resumeName
    };
  }

  function hasAnswerForCategory(category, inventory) {
    if (!category || category === "unknown") return false;
    if (!inventory || typeof inventory !== "object") return false;
    // Exact semantic category only — never page option/placeholder text.
    return isFilledValue(inventory[category]);
  }

  function isSensitiveCategory(category) {
    return Boolean(SENSITIVE_CATEGORIES[category]);
  }

  function formatProposedAnswerValue(raw) {
    var text = trimText(raw);
    if (!text) return "";
    if (/^(yes|no)$/i.test(text)) {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return text;
  }

  function getProposedAnswer(category, inventory) {
    if (!category || category === "unknown") return NO_SAVED_ANSWER;
    if (!inventory || typeof inventory !== "object") return NO_SAVED_ANSWER;
    // Sensitive and non-sensitive alike: only the saved inventory value for that category.
    // Never infer from page option labels, placeholders, resume projects, or other categories.
    if (category === "resume_upload") {
      var resumeAnswer =
        trimText(inventory.resume_filename) ||
        trimText(inventory.resume_upload) ||
        "";
      return resumeAnswer || NO_SAVED_ANSWER;
    }
    if (category === "project_highlight") {
      // Never use portfolio URL (or any other category) as the project answer.
      var projectAnswer = trimText(inventory.project_highlight);
      return projectAnswer || NO_SAVED_ANSWER;
    }
    if (!hasAnswerForCategory(category, inventory)) return NO_SAVED_ANSWER;
    return formatProposedAnswerValue(inventory[category]) || NO_SAVED_ANSWER;
  }

  function resolveQuestionText(fieldLike) {
    var label = trimText(fieldLike && fieldLike.label);
    if (label) return label;
    var aria = trimText(fieldLike && fieldLike.ariaLabel);
    if (aria) return aria;
    var nearby = trimText(fieldLike && fieldLike.nearbyText);
    if (nearby) return nearby.split(" | ")[0];
    var name = trimText(fieldLike && fieldLike.name);
    if (name) return name;
    return trimText(fieldLike && fieldLike.inputType) || "Untitled field";
  }

  function enrichScanField(field, inventory) {
    var copy = Object.assign({}, field);
    copy.question = resolveQuestionText(copy);
    copy.isSensitive = isSensitiveCategory(copy.category);
    copy.skippable = copy.isSensitive;
    copy.proposedAnswer = getProposedAnswer(copy.category, inventory);
    // Recompute hasAnswer strictly from inventory (never from proposed page text).
    copy.hasAnswer = hasAnswerForCategory(copy.category, inventory);
    if (copy.proposedAnswer === NO_SAVED_ANSWER) {
      copy.hasAnswer = false;
    }
    copy.fillStatus = deriveFillStatus(copy);
    return copy;
  }

  function deriveFillStatus(field) {
    if (field && field.skipped) return "skipped";
    if (isFilledValue(field.currentValue)) return "completed";
    if (field.category === "unknown") return "unknown";
    if (field.hasAnswer) return "ready";
    return "missing";
  }

  function validateScanField(field) {
    var copy = Object.assign({}, field);
    var inputType = normalizeText(copy.inputType || "");

    if (copy.category === "resume_upload" && inputType !== "file") {
      copy.category = "unknown";
      copy.categoryLabel = CATEGORY_LABELS.unknown;
      copy.confidence = 0.3;
      copy.confidenceLabel = confidenceLabel(0.3);
      copy.hasAnswer = false;
    }

    if (copy.category === "gender") {
      // Only reclassify from this field's own label/options — not nearby questions.
      var labelBlob = normalizeText(
        [copy.label, copy.ariaLabel]
          .concat(
            (copy.options || []).map(function (o) {
              return o.label || o.value || "";
            })
          )
          .join(" ")
      );
      if (/\bhispanic\b/.test(labelBlob) || /\blatin[oa]\b/.test(labelBlob)) {
        copy.category = "race_ethnicity";
        copy.categoryLabel = CATEGORY_LABELS.race_ethnicity;
      }
    }

    if (copy.category === "phone" && inputType === "file") {
      copy.category = "unknown";
      copy.categoryLabel = CATEGORY_LABELS.unknown;
      copy.hasAnswer = false;
    }

    if (inputType === "url" && (copy.category === "unknown" || !copy.category)) {
      copy.category = "url";
      copy.categoryLabel = CATEGORY_LABELS.url;
    }

    // Portfolio URL fields must not become project narrative answers.
    if (copy.category === "project_highlight") {
      var projectCue = normalizeText([copy.label, copy.ariaLabel, copy.nearbyText].join(" "));
      if (
        /\bwebsite\s+or\s+portfolio\b/.test(projectCue) ||
        /\bportfolio\s+or\s+website\b/.test(projectCue) ||
        /\bportfolio\s+url\b/.test(projectCue) ||
        /\bportfolio\s+link\b/.test(projectCue)
      ) {
        copy.category = "portfolio";
        copy.categoryLabel = CATEGORY_LABELS.portfolio;
      }
    }

    copy.categoryLabel = CATEGORY_LABELS[copy.category] || copy.categoryLabel || "Unknown";
    copy.fillStatus = deriveFillStatus(copy);
    return copy;
  }

  function scanUnit(unit, index, inventory) {
    var elements = unit.elements || [];
    var primary = elements[0];
    if (!primary) return null;
    var inv = inventory || {};

    if (unit.kind === "radio-group") {
      var groupType = unit.inputType === "checkbox" ? "checkbox" : "radio";
      var question = radioGroupQuestionText(elements);
      var options = readRadioOptions(elements);
      var optionLabels = options.map(function (o) {
        return o.label || o.value;
      });
      var context = collectContext(primary, {
        label: question || findLabelText(primary),
        nearby: question || ""
      });
      // Classify from question text, not option labels as primary blob
      var detected = detectCategoryFromMeta({
        tagName: "input",
        inputType: groupType,
        type: groupType,
        label: context.label,
        ariaLabel: context.ariaLabel,
        name: context.name,
        id: context.id,
        nearby: "",
        autocomplete: context.autocomplete,
        optionLabels: optionLabels
      });
      var currentValue = readRadioGroupValue(elements);
      var required = isGroupRequired(elements);
      var field = validateScanField({
        fieldId: buildStableFieldId(
          {
            inputType: groupType,
            name: context.name,
            id: unit.groupKey || context.id,
            label: context.label
          },
          index
        ),
        inputType: groupType,
        name: context.name,
        id: context.id,
        label: context.label,
        placeholder: "",
        ariaLabel: context.ariaLabel,
        required: required,
        currentValue: currentValue,
        options: options,
        category: detected.category,
        categoryLabel: CATEGORY_LABELS[detected.category] || "Unknown",
        confidence: Math.round((Number(detected.confidence) || 0) * 100) / 100,
        confidenceLabel: confidenceLabel(detected.confidence),
        nearbyText: context.nearby,
        fillStatus: "unknown"
      });
      return enrichScanField(field, inv);
    }

    var context = collectContext(primary);
    var options = readOptions(primary);
    var detected = detectCategory(
      primary,
      context,
      options.map(function (o) {
        return o.label || o.value;
      })
    );
    var currentValue = readCurrentValue(primary);
    var required = isRequired(primary);
    var field = validateScanField({
      fieldId: buildStableFieldId(
        {
          inputType: describeInputType(primary),
          name: context.name,
          id: context.id,
          label: context.label,
          ariaLabel: context.ariaLabel,
          placeholder: context.placeholder
        },
        index
      ),
      inputType: describeInputType(primary),
      name: context.name,
      id: context.id,
      label: context.label,
      placeholder: context.placeholder,
      ariaLabel: context.ariaLabel,
      required: required,
      currentValue: currentValue,
      options: options,
      category: detected.category,
      categoryLabel: CATEGORY_LABELS[detected.category] || "Unknown",
      confidence: Math.round((Number(detected.confidence) || 0) * 100) / 100,
      confidenceLabel: confidenceLabel(detected.confidence),
      nearbyText: context.nearby,
      fillStatus: "unknown"
    });
    return enrichScanField(field, inv);
  }

  function summarizeFields(fields) {
    var list = Array.isArray(fields) ? fields : [];
    var recognized = list.filter(function (f) {
      return f.category && f.category !== "unknown";
    });
    var withAnswers = list.filter(function (f) {
      return f.hasAnswer === true;
    });
    var unanswered = list.filter(function (f) {
      return (
        f.category !== "unknown" &&
        !f.hasAnswer &&
        !f.skipped &&
        !isFilledValue(f.currentValue)
      );
    });
    var unknown = list.filter(function (f) {
      return f.category === "unknown";
    });
    var requiredUnanswered = list.filter(function (f) {
      return f.required && !isFilledValue(f.currentValue) && !f.hasAnswer && !f.skipped;
    });
    return {
      totalFields: list.length,
      recognizedFields: recognized.length,
      fieldsWithAnswers: withAnswers.length,
      unansweredFields: unanswered.length,
      unknownFields: unknown.length,
      requiredUnansweredFields: requiredUnanswered.length
    };
  }

  function scanDocument(doc, inventory) {
    var root = doc || document;
    var units = collectScanUnits(root);
    var fields = [];
    units.forEach(function (unit, index) {
      var field = scanUnit(unit, index, inventory || {});
      if (field) fields.push(field);
    });
    return {
      scannedAt: new Date().toISOString(),
      pageUrl: (root.location && root.location.href) || "",
      pageTitle: root.title || "",
      fields: fields,
      summary: summarizeFields(fields)
    };
  }

  function getFieldIdentity(el) {
    var context = collectContext(el);
    return {
      label: context.label,
      name: context.name,
      id: context.id,
      placeholder: context.placeholder,
      ariaLabel: context.ariaLabel,
      blob: context.blob
    };
  }

  function classifyLabel(label, inputType, extra) {
    var opts = extra || {};
    return detectCategoryFromMeta({
      tagName: isFileInputType(inputType) || inputType === "text" || inputType === "email" || inputType === "tel" || inputType === "url"
        ? "input"
        : inputType === "textarea"
          ? "textarea"
          : inputType === "select"
            ? "select"
            : "input",
      inputType: inputType || "text",
      type: inputType || "text",
      label: label,
      nearby: opts.nearby || "",
      name: opts.name || "",
      id: opts.id || "",
      placeholder: opts.placeholder || "",
      ariaLabel: opts.ariaLabel || "",
      autocomplete: opts.autocomplete || "",
      optionLabels: opts.optionLabels || []
    });
  }

  global.ImpulsoAutofill = {
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_ORDER: CATEGORY_ORDER,
    SENSITIVE_CATEGORIES: SENSITIVE_CATEGORIES,
    NO_SAVED_ANSWER: NO_SAVED_ANSWER,
    collectContext: collectContext,
    detectCategory: detectCategory,
    detectCategoryFromMeta: detectCategoryFromMeta,
    classifyLabel: classifyLabel,
    findLabelText: findLabelText,
    getFieldIdentity: getFieldIdentity,
    buildAnswerInventory: buildAnswerInventory,
    hasAnswerForCategory: hasAnswerForCategory,
    getProposedAnswer: getProposedAnswer,
    isSensitiveCategory: isSensitiveCategory,
    confidenceLabel: confidenceLabel,
    validateScanField: validateScanField,
    enrichScanField: enrichScanField,
    scanDocument: scanDocument,
    scanPage: function (inventory) {
      return scanDocument(document, inventory || {});
    },
    summarizeFields: summarizeFields
  };
})(typeof window !== "undefined" ? window : self);
