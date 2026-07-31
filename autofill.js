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
    "referral_source",
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
    referral_source: "Referral source",
    additional_information: "Additional information",
    resume_upload: "Resume upload",
    unknown: "Unknown"
  };

  var BASIC_TEXT_CATEGORIES = {
    first_name: true,
    last_name: true,
    full_name: true,
    preferred_name: true,
    email: true,
    phone: true,
    linkedin: true,
    github: true,
    portfolio: true,
    project_highlight: true,
    referral_source: true,
    additional_information: true,
    cover_letter: true
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
      category: "referral_source",
      confidence: 0.93,
      include: [
        /\bhow\s+did\s+you\s+hear\b/,
        /\bwhere\s+did\s+you\s+hear\b/,
        /\bhear\s+about\s+(this\s+)?(job|role|position|opportunity)\b/,
        /\breferral\s+source\b/,
        /\bsource\s+of\s+hire\b/,
        /\bhow\s+did\s+you\s+find\b/
      ],
      exclude: [/\bcover\s*letter\b/, /\bproject\b/]
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
      include: [
        /\brelocatem?\b/,
        /\bwilling\s+to\s+move\b/,
        /\bin[-\s]?person\b/,
        /\bon[-\s]?site\b/,
        /\bwilling\s+to\s+work\s+(in[-\s]?person|on[-\s]?site)\b/
      ],
      exclude: [/\bstart\s+date\b/, /\bavailable\s+start\b/]
    },
    {
      category: "availability",
      confidence: 0.9,
      include: [
        /\bearliest\s+date\b/,
        /\bearliest\s+.*\b(start|begin)\b/,
        /\bavailable\s+start\s+date\b/,
        /\bavailable\s+to\s+start\b/,
        /\bwhen\s+can\s+you\s+(begin|start)\b/,
        /\bwhen\s+are\s+you\s+available\s+to\s+(start|begin)\b/,
        /\bdate\s+you\s+can\s+start\b/,
        /\bstart\s+date\b/,
        /\bavailability\s+date\b/,
        /\bnotice\s+period\b/,
        /\bavailability\b/
      ],
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
    if (inputType === "date") {
      if (
        /\bearliest\b/.test(questionBlob) ||
        /\bstart\s+date\b/.test(questionBlob) ||
        /\bavailable\b/.test(questionBlob) ||
        /\bwhen\s+can\s+you\b/.test(questionBlob) ||
        /\bbegin\b/.test(questionBlob) ||
        /\bavailability\b/.test(questionBlob)
      ) {
        return validateDetection({ category: "availability", confidence: 0.95 }, inputType);
      }
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

    // Never treat email-type controls as phone, or tel as email.
    if (inputType === "email" && result.category === "phone") {
      result = { category: "email", confidence: 0.98 };
    }
    if (inputType === "tel" && result.category === "email") {
      result = { category: "phone", confidence: 0.97 };
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
      // Legal/full name requires both parts — never first name alone.
      full_name: first && last ? trimText(first + " " + last) : "",
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
      // Date autofill uses availableStartDate only (never notice-period text).
      available_start_date: trimText(prefs.availableStartDate || ""),
      salary: trimText(common.salaryExpectation || ""),
      relocation: trimText(prefs.willingToRelocate || ""),
      // Sensitive demographics: only locally saved values — never inferred.
      veteran_status: trimText(demo.veteranStatus || ""),
      disability_status: trimText(
        demo.disabilityStatus || demo.disability_status || demo["disability status"] || ""
      ),
      gender: trimText(demo.gender || ""),
      race_ethnicity: trimText(demo.raceEthnicity || ""),
      cover_letter: trimText(common.defaultCoverLetter || ""),
      // Explicit saved answer only — never auto-generated from resume projects or portfolio URL.
      project_highlight: trimText(common.projectHighlight || ""),
      referral_source: trimText(common.referralSource || ""),
      additional_information: trimText(
        common.additionalInformation ||
          common.linkedinMessageOrAdditionalInfo ||
          common.whyInterestedInRole ||
          common.anythingElseToKnow ||
          ""
      ),
      resume_upload: hasResume ? resumeName || "Resume on file" : "",
      resume_filename: resumeName
    };
  }

  function resolveAutofillProfilePayload(profile) {
    var data = profile || {};
    var personal = data.personal || {};
    var links = data.links || {};
    var common = data.commonAnswers || {};
    var additional = trimText(
      common.additionalInformation ||
        common.linkedinMessageOrAdditionalInfo ||
        common.whyInterestedInRole ||
        common.anythingElseToKnow ||
        ""
    );
    var prefs = data.applicationPreferences || {};
    var work = data.workAuthorization || {};
    return {
      personal: {
        firstName: trimText(personal.firstName || ""),
        lastName: trimText(personal.lastName || ""),
        preferredName: trimText(personal.preferredName || personal.preferredFirstName || ""),
        email: trimText(personal.email || ""),
        phone: trimText(personal.phone || ""),
        location: trimText(personal.location || "")
      },
      links: {
        linkedin: trimText(links.linkedin || ""),
        github: trimText(links.github || ""),
        portfolio: trimText(links.portfolio || "")
      },
      commonAnswers: {
        projectHighlight: trimText(common.projectHighlight || ""),
        referralSource: trimText(common.referralSource || ""),
        additionalInformation: additional,
        defaultCoverLetter: trimText(common.defaultCoverLetter || "")
      },
      applicationPreferences: {
        availableStartDate: trimText(prefs.availableStartDate || ""),
        willingToRelocate: trimText(prefs.willingToRelocate || "")
      },
      workAuthorization: {
        legallyAuthorizedToWork: trimText(work.legallyAuthorizedToWork || ""),
        requireSponsorshipNow: trimText(work.requireSponsorshipNow || ""),
        requireSponsorshipFuture: trimText(work.requireSponsorshipFuture || "")
      },
      demographics: {
        gender: trimText((data.demographics || {}).gender || ""),
        veteranStatus: trimText((data.demographics || {}).veteranStatus || ""),
        disabilityStatus: trimText((data.demographics || {}).disabilityStatus || "")
      }
    };
  }

  function resolveAnswerInventory(profileOrPayload, options) {
    var data = profileOrPayload || {};
    var common = data.commonAnswers || {};
    var normalized = {
      personal: data.personal || {},
      links: data.links || {},
      commonAnswers: {
        projectHighlight: common.projectHighlight || "",
        referralSource: common.referralSource || "",
        defaultCoverLetter: common.defaultCoverLetter || "",
        additionalInformation: common.additionalInformation || "",
        linkedinMessageOrAdditionalInfo:
          common.additionalInformation || common.linkedinMessageOrAdditionalInfo || "",
        whyInterestedInRole: common.whyInterestedInRole || "",
        anythingElseToKnow: common.anythingElseToKnow || "",
        salaryExpectation: common.salaryExpectation || ""
      },
      workAuthorization: data.workAuthorization || {},
      applicationPreferences: data.applicationPreferences || {},
      demographics: data.demographics || {},
      education: data.education,
      experience: data.experience,
      skills: data.skills
    };
    return buildAnswerInventory(normalized, options || {});
  }

  function getTextAnswerForCategory(category, inventory) {
    var cat = normalizeText(category);
    if (!cat || cat === "unknown" || !BASIC_TEXT_CATEGORIES[cat]) return "";
    if (!inventory || typeof inventory !== "object") return "";

    // Full/legal name must always be first + last — never first name alone.
    if (cat === "full_name") {
      var first = trimText(inventory.first_name || "");
      var last = trimText(inventory.last_name || "");
      if (first && last) return trimText(first + " " + last);
      var stored = trimText(inventory.full_name || "");
      if (stored && /\s/.test(stored)) return stored;
      return "";
    }

    // Project narrative must never fall back to portfolio URL.
    if (cat === "project_highlight") {
      return trimText(inventory.project_highlight || "");
    }

    // Phone must never use email (or any other category).
    if (cat === "phone") {
      return trimText(inventory.phone || "");
    }

    if (cat === "preferred_name") {
      return trimText(inventory.preferred_name || "");
    }

    if (cat === "portfolio") {
      return trimText(inventory.portfolio || "");
    }

    if (cat === "referral_source") {
      return trimText(inventory.referral_source || "");
    }

    return trimText(inventory[cat] || "");
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
    if (BASIC_TEXT_CATEGORIES[category]) {
      var textAnswer = getTextAnswerForCategory(category, inventory);
      return textAnswer ? formatProposedAnswerValue(textAnswer) : NO_SAVED_ANSWER;
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

  function isBasicTextInputType(inputType) {
    var type = normalizeText(inputType);
    return (
      type === "text" ||
      type === "email" ||
      type === "tel" ||
      type === "url" ||
      type === "search" ||
      type === "textarea" ||
      type === "contenteditable"
    );
  }

  function isBasicTextElement(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "select") return false;
    var type = describeInputType(el);
    if (type === "radio" || type === "checkbox" || type === "file" || type === "hidden") {
      return false;
    }
    // Date inputs / date-like placeholders are handled by the availability-date path.
    if (type === "date") return false;
    if (looksLikeDatePlaceholder(el)) return false;
    return isBasicTextInputType(type);
  }

  function pad2(n) {
    var s = String(n == null ? "" : n);
    return s.length === 1 ? "0" + s : s;
  }

  function parseStoredDate(value) {
    var text = trimText(value);
    if (!text) return null;
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT\s].*)?$/);
    if (iso) {
      return { y: iso[1], m: iso[2], d: iso[3], iso: iso[1] + "-" + iso[2] + "-" + iso[3] };
    }
    var us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
      var m = pad2(us[1]);
      var d = pad2(us[2]);
      var y = us[3];
      return { y: y, m: m, d: d, iso: y + "-" + m + "-" + d };
    }
    var usDash = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (usDash) {
      var m2 = pad2(usDash[1]);
      var d2 = pad2(usDash[2]);
      var y2 = usDash[3];
      return { y: y2, m: m2, d: d2, iso: y2 + "-" + m2 + "-" + d2 };
    }
    return null;
  }

  function looksLikeDatePlaceholder(el) {
    if (!el) return false;
    var cue = normalizeText(
      [
        el.placeholder || "",
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("aria-placeholder"),
        el.title || "",
        el.name || "",
        el.id || ""
      ].join(" ")
    );
    return (
      /\bpick\s+date\b/.test(cue) ||
      /\bmm\/dd\/yyyy\b/.test(cue) ||
      /\bmm\-dd\-yyyy\b/.test(cue) ||
      /\byyyy\-mm\-dd\b/.test(cue) ||
      /\bselect\s+a\s+date\b/.test(cue) ||
      /\bchoose\s+a\s+date\b/.test(cue)
    );
  }

  function dateFormatCue(el) {
    var labelText = "";
    try {
      if (el && typeof findLabelText === "function") labelText = findLabelText(el) || "";
    } catch (_) {
      labelText = "";
    }
    return normalizeText(
      [
        el && el.placeholder,
        el && el.getAttribute && el.getAttribute("aria-label"),
        el && el.getAttribute && el.getAttribute("pattern"),
        el && el.name,
        el && el.id,
        labelText
      ].join(" ")
    );
  }

  function formatDateForElement(el, parsed) {
    if (!parsed) return "";
    var type = normalizeText(el && el.type);
    if (type === "date") return parsed.iso;
    var cue = dateFormatCue(el);
    if (/\bmm\/dd\/yyyy\b/.test(cue) || /\bpick\s+date\b/.test(cue) || /\bselect\s+a\s+date\b/.test(cue)) {
      return parsed.m + "/" + parsed.d + "/" + parsed.y;
    }
    if (/\bmm\-dd\-yyyy\b/.test(cue)) {
      return parsed.m + "-" + parsed.d + "-" + parsed.y;
    }
    if (/\byyyy\-mm\-dd\b/.test(cue)) {
      return parsed.iso;
    }
    // Preserve ISO when the field expectation is unclear.
    return parsed.iso;
  }

  function findNativeDateInput(el) {
    if (!el) return null;
    var tag = (el.tagName || "").toLowerCase();
    var type = normalizeText(el.type || "");
    if (tag === "input" && type === "date") return el;

    var root = el;
    if (el.closest) {
      root =
        el.closest('[class*="date"]') ||
        el.closest('[class*="field"]') ||
        el.closest("label") ||
        el.parentElement ||
        el;
    }

    if (root && root.querySelector) {
      var nativeDate = root.querySelector('input[type="date"]');
      if (nativeDate) return nativeDate;
    }

    if (tag === "input" && (type === "text" || type === "search" || !type)) return el;
    if (root && root.querySelector) {
      var textInput = root.querySelector('input[type="text"], input:not([type]), input[type="search"]');
      if (textInput) return textInput;
    }
    return tag === "input" ? el : null;
  }

  function findVisibleDateCompanion(nativeInput) {
    if (!nativeInput || !nativeInput.parentElement) return null;
    var root =
      (nativeInput.closest &&
        (nativeInput.closest('[class*="date"]') ||
          nativeInput.closest('[class*="field"]') ||
          nativeInput.closest("label"))) ||
      nativeInput.parentElement;
    if (!root || !root.querySelectorAll) return null;
    var inputs = root.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      if (input === nativeInput) continue;
      var type = normalizeText(input.type || "text");
      if (type === "hidden" || type === "radio" || type === "checkbox" || type === "file") continue;
      if (type === "text" || type === "search" || !type) return input;
    }
    return null;
  }

  function isAvailabilityDateCandidate(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag !== "input") return false;
    var type = normalizeText(el.type || "text");
    if (type === "date") return true;
    if (type === "text" || type === "search" || !type) {
      return looksLikeDatePlaceholder(el);
    }
    return false;
  }

  function dateValuesMatch(parsed, actualValue, expectedFormatted) {
    var actual = trimText(actualValue);
    if (!actual) return false;
    if (expectedFormatted && textValuesMatch(expectedFormatted, actual)) return true;
    var actualParsed = parseStoredDate(actual);
    if (parsed && actualParsed && parsed.iso === actualParsed.iso) return true;
    return false;
  }

  function availabilityDateAnswer(inventory) {
    var inv = inventory || {};
    var fromDedicated = trimText(inv.available_start_date || "");
    if (fromDedicated) return fromDedicated;
    var fromAvailability = trimText(inv.availability || "");
    if (parseStoredDate(fromAvailability)) return fromAvailability;
    return "";
  }

  function fillAvailabilityDateElement(el, rawDate) {
    if (!el) {
      return { ok: false, status: "failed", reason: "Date element not found." };
    }

    var parsed = parseStoredDate(rawDate);
    if (!parsed) {
      return { ok: false, status: "skipped", reason: "No saved available start date." };
    }

    var target = findNativeDateInput(el) || el;
    if (!target || (target.tagName || "").toLowerCase() !== "input") {
      return { ok: false, status: "failed", reason: "No native date input found." };
    }

    var companion = findVisibleDateCompanion(target);
    var currentTarget = readElementTextValue(target);
    var currentVisible = companion ? readElementTextValue(companion) : "";
    if (isFilledValue(currentTarget) || isFilledValue(currentVisible)) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var formatted = formatDateForElement(target, parsed);
    var wrote = setNativeValue(target, formatted);
    if (!wrote) {
      return { ok: false, status: "failed", reason: "Could not set date value." };
    }

    if (companion && companion !== target && !isFilledValue(readElementTextValue(companion))) {
      setNativeValue(companion, formatDateForElement(companion, parsed));
    }

    var afterTarget = readElementTextValue(target);
    var afterVisible = companion ? readElementTextValue(companion) : "";
    var persisted =
      dateValuesMatch(parsed, afterTarget, formatted) ||
      dateValuesMatch(parsed, afterVisible, formatDateForElement(companion || target, parsed));

    if (!persisted) {
      return {
        ok: false,
        status: "failed",
        reason: "Verification failed; date field does not contain the expected value."
      };
    }

    return { ok: true, status: "filled", reason: "", value: formatted };
  }

  function readElementTextValue(el) {
    if (!el) return "";
    if (
      el.isContentEditable ||
      normalizeText(el.getAttribute && el.getAttribute("contenteditable")) === "true"
    ) {
      return trimText(el.innerText || el.textContent || "");
    }
    return trimText(el.value || "");
  }

  function textValuesMatch(expected, actual) {
    return normalizeText(expected) === normalizeText(actual);
  }

  function dispatchFillEvents(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    } catch (_) {
      try {
        el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
      } catch (_) {}
    }
  }

  function setNativeValue(el, value) {
    if (!el) return false;
    var next = value == null ? "" : String(value);
    var tag = (el.tagName || "").toLowerCase();
    var proto =
      tag === "textarea"
        ? window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement && window.HTMLInputElement.prototype;
    var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    var ownProto = Object.getPrototypeOf(el);
    var ownDescriptor = ownProto ? Object.getOwnPropertyDescriptor(ownProto, "value") : null;

    try {
      if (descriptor && descriptor.set) {
        if (ownDescriptor && ownDescriptor.set && ownDescriptor.set !== descriptor.set) {
          ownDescriptor.set.call(el, next);
        } else {
          descriptor.set.call(el, next);
        }
      } else {
        el.value = next;
      }
    } catch (_) {
      try {
        el.value = next;
      } catch (_) {
        return false;
      }
    }

    dispatchFillEvents(el);
    return true;
  }

  function setContentEditableValue(el, value) {
    if (!el) return false;
    var next = value == null ? "" : String(value);
    try {
      el.focus();
    } catch (_) {}
    el.textContent = next;
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: next }));
    } catch (_) {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    try {
      el.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    } catch (_) {
      el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
    }
    return true;
  }

  function fillTextElement(el, value) {
    if (!el) {
      return { ok: false, status: "failed", reason: "Element not found." };
    }
    if (!isBasicTextElement(el)) {
      return { ok: false, status: "skipped", reason: "Not a basic text field." };
    }

    var current = readElementTextValue(el);
    if (isFilledValue(current)) {
      return { ok: false, status: "skipped", reason: "Field is already completed." };
    }

    var answer = trimText(value);
    if (!answer) {
      return { ok: false, status: "skipped", reason: "No saved answer." };
    }

    var isEditable =
      el.isContentEditable ||
      normalizeText(el.getAttribute && el.getAttribute("contenteditable")) === "true";
    var wrote = isEditable ? setContentEditableValue(el, answer) : setNativeValue(el, answer);
    if (!wrote) {
      return { ok: false, status: "failed", reason: "Could not set field value." };
    }

    var after = readElementTextValue(el);
    if (!textValuesMatch(answer, after)) {
      return {
        ok: false,
        status: "failed",
        reason: "Verification failed; field does not contain the expected value."
      };
    }

    return { ok: true, status: "filled", reason: "" };
  }

  function detectBasicTextCategory(el) {
    if (!el) return { category: "unknown", confidence: 0 };
    var context = collectContext(el);
    return detectCategory(el, context, []);
  }

  function pushFillResult(results, base, fillResult, value) {
    results.push({
      category: base.category,
      label: base.label,
      status: fillResult.status,
      reason: fillResult.reason || "",
      ok: Boolean(fillResult.ok),
      value: fillResult.ok ? value || fillResult.value || "" : ""
    });
  }

  function fillBasicTextFields(root, inventory) {
    var doc = root || document;
    var inv = inventory || {};
    var results = [];
    var nodes = [];
    var seenList = [];

    try {
      Array.prototype.forEach.call(
        doc.querySelectorAll(
          "input, textarea, [contenteditable='true'], [contenteditable='']"
        ),
        function (el) {
          nodes.push(el);
        }
      );
    } catch (_) {
      return { results: [], summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 } };
    }

    function wasSeen(el) {
      return seenList.indexOf(el) !== -1;
    }

    function markSeen(el) {
      function add(node) {
        if (node && seenList.indexOf(node) === -1) seenList.push(node);
      }
      add(el);
      var native = findNativeDateInput(el);
      add(native);
      add(findVisibleDateCompanion(native || el));
    }

    nodes.forEach(function (el) {
      if (!el || wasSeen(el)) return;

      var label = findLabelText(el) || trimText(el.getAttribute && el.getAttribute("aria-label")) || "";
      var detected = detectBasicTextCategory(el);
      var category = detected.category || "unknown";

      // Availability date autofill (native date + date-like text / Ashby native input).
      if (category === "availability") {
        var availCue = normalizeText(label + " " + (el.placeholder || "") + " " + (el.name || ""));
        if (/\bnotice\s+period\b/.test(availCue)) {
          results.push({
            category: category,
            label: label,
            status: "skipped",
            reason: "Notice period is not an availability date field.",
            ok: false,
            value: ""
          });
          return;
        }
        var tagName = (el.tagName || "").toLowerCase();
        var inputType = normalizeText(el.type || "text");
        var isDateControl =
          tagName === "input" &&
          (inputType === "date" ||
            inputType === "text" ||
            inputType === "search" ||
            !inputType ||
            looksLikeDatePlaceholder(el));
        if (!isDateControl) {
          results.push({
            category: category,
            label: label,
            status: "skipped",
            reason: "Availability field is not a date input.",
            ok: false,
            value: ""
          });
          return;
        }
        var dateAnswer = availabilityDateAnswer(inv);
        var dateResult = fillAvailabilityDateElement(el, dateAnswer);
        markSeen(el);
        pushFillResult(
          results,
          { category: "availability", label: label },
          dateResult,
          dateResult.value || dateAnswer
        );
        return;
      }

      if (!isBasicTextElement(el)) return;

      if (!BASIC_TEXT_CATEGORIES[category]) {
        results.push({
          category: category,
          label: label,
          status: "skipped",
          reason: "Category is not a basic text autofill target.",
          ok: false
        });
        return;
      }

      var answer = getTextAnswerForCategory(category, inv);
      var fillResult = fillTextElement(el, answer);
      pushFillResult(results, { category: category, label: label }, fillResult, answer);
    });

    return {
      results: results,
      summary: {
        attempted: results.length,
        filled: results.filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: results.filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: results.filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  var ASHBY_YES_NO_CATEGORIES = {
    work_authorization: true,
    sponsorship_now: true,
    sponsorship_later: true,
    relocation: true
  };

  function isAshbyHost() {
    try {
      var href = String((global.location && global.location.href) || "");
      var host = String((global.location && global.location.hostname) || "");
      return /jobs\.ashbyhq\.com/i.test(href) || /^jobs\.ashbyhq\.com$/i.test(host);
    } catch (_) {
      return false;
    }
  }

  function sleepSync(ms) {
    var end = Date.now() + Math.max(0, Number(ms) || 0);
    while (Date.now() < end) {
      /* brief wait for Ashby UI to settle */
    }
  }

  function polarityOfYesNo(value) {
    var text = normalizeText(value);
    if (!text) return "";
    if (/^(yes|y|true|1)$/.test(text)) return "yes";
    if (/^(no|n|false|0)$/.test(text)) return "no";
    if (
      /\bauthorized\b/.test(text) &&
      !/\bnot\s+authorized\b/.test(text) &&
      !/\bunauthorized\b/.test(text)
    ) {
      return "yes";
    }
    if (/\bnot\s+authorized\b/.test(text) || /\bunauthorized\b/.test(text)) return "no";
    if (/\bdo\s+not\b/.test(text) || /\bwill\s+not\b/.test(text) || /\bwon'?t\b/.test(text)) {
      return "no";
    }
    return "";
  }

  function yesNoAnswerForCategory(category, inventory) {
    if (!ASHBY_YES_NO_CATEGORIES[category]) return "";
    var raw = trimText((inventory && inventory[category]) || "");
    if (!raw) return "";
    var pol = polarityOfYesNo(raw);
    if (pol === "yes") return "Yes";
    if (pol === "no") return "No";
    if (/^(yes|no)$/i.test(raw)) {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    return "";
  }

  function getAshbyOptionWrapper(radio) {
    if (!radio || !radio.closest) return null;
    return radio.closest('div[class*="_option_"]');
  }

  function getAshbyOptionVisibleText(radio) {
    if (!radio) return "";
    var optionWrapper = getAshbyOptionWrapper(radio);
    if (optionWrapper) {
      return trimText(optionWrapper.innerText || optionWrapper.textContent || "");
    }
    return trimText(radio.value || "");
  }

  function readAshbyYesNoQuestionText(fieldset, radios) {
    if (fieldset) {
      var legend = fieldset.querySelector && fieldset.querySelector("legend");
      if (legend) {
        var legendText = trimText(legend.innerText || legend.textContent || "");
        if (legendText) return legendText;
      }
      var aria = trimText(fieldset.getAttribute && fieldset.getAttribute("aria-label"));
      if (aria) return aria;
      var prompt =
        fieldset.querySelector &&
        fieldset.querySelector("h1, h2, h3, h4, label, p, [class*='label'], [class*='question']");
      if (prompt) {
        var promptText = trimText(prompt.innerText || prompt.textContent || "");
        if (promptText && promptText.length < 280 && !isLikelyOptionCluster(promptText, ["yes", "no"])) {
          return promptText;
        }
      }
    }
    return radioGroupQuestionText(radios || []) || "";
  }

  function collectAshbyRadiosInFieldset(fieldset) {
    var found = [];
    if (!fieldset || !fieldset.querySelectorAll) return found;
    Array.prototype.forEach.call(fieldset.querySelectorAll('input[type="radio"]'), function (el) {
      if (!el || normalizeText(el.type || "") !== "radio") return;
      if (!fieldset.contains(el)) return;
      found.push(el);
    });
    return found;
  }

  function isExactYesNoOnlyGroup(radios) {
    var labels = (radios || []).map(getAshbyOptionVisibleText).map(trimText).filter(Boolean);
    if (labels.length < 2) return false;
    var hasYes = false;
    var hasNo = false;
    for (var i = 0; i < labels.length; i += 1) {
      if (!/^(yes|no)$/i.test(labels[i])) return false;
      if (/^yes$/i.test(labels[i])) hasYes = true;
      if (/^no$/i.test(labels[i])) hasNo = true;
    }
    return hasYes && hasNo;
  }

  function isCitizenshipOrExportControlQuestion(questionText) {
    var text = normalizeText(questionText);
    if (!text) return false;
    return (
      /\bexport\s+control\b/.test(text) ||
      /\bitar\b/.test(text) ||
      /\bear\b/.test(text) ||
      /\bcitizen\s+or\s+national\b/.test(text) ||
      /\bpermanent\s+resident\b/.test(text) ||
      /\basylee\b/.test(text) ||
      /\brefugee\b/.test(text)
    );
  }

  function matchExactYesNoOption(radios, yesNoAnswer) {
    var want = normalizeText(yesNoAnswer);
    if (want !== "yes" && want !== "no") return null;
    for (var i = 0; i < (radios || []).length; i += 1) {
      var optionText = normalizeText(getAshbyOptionVisibleText(radios[i]));
      if (optionText === want) {
        return {
          radio: radios[i],
          optionWrapper: getAshbyOptionWrapper(radios[i]),
          optionText: getAshbyOptionVisibleText(radios[i])
        };
      }
    }
    return null;
  }

  function setNativeRadioChecked(input, checked) {
    if (!input) return false;
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "checked") : null;
    try {
      if (descriptor && descriptor.set) {
        descriptor.set.call(input, Boolean(checked));
      } else {
        input.checked = Boolean(checked);
      }
    } catch (_) {
      try {
        input.checked = Boolean(checked);
      } catch (_) {
        return false;
      }
    }
    return Boolean(input.checked) === Boolean(checked);
  }

  function dispatchAshbyRadioInputChange(input) {
    if (!input) return;
    try {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {}
    try {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
  }

  function clickAshbyOptionWrapper(optionWrapper) {
    if (!optionWrapper) return;
    try {
      if (typeof optionWrapper.scrollIntoView === "function") {
        optionWrapper.scrollIntoView({ block: "center" });
      }
    } catch (_) {}
    try {
      var clickFn =
        window.HTMLElement &&
        window.HTMLElement.prototype &&
        typeof window.HTMLElement.prototype.click === "function"
          ? window.HTMLElement.prototype.click
          : null;
      if (clickFn) {
        clickFn.call(optionWrapper);
      } else if (typeof optionWrapper.click === "function") {
        optionWrapper.click();
      }
    } catch (_) {
      try {
        if (typeof optionWrapper.click === "function") optionWrapper.click();
      } catch (_) {}
    }
  }

  function verifyAshbyYesNoSelection(fieldset, target) {
    if (!target || !target.checked) return false;
    if (!fieldset || !fieldset.contains || !fieldset.contains(target)) return false;
    var name = trimText(target.name || "");
    var checkedCount = 0;
    var radios = collectAshbyRadiosInFieldset(fieldset);
    for (var i = 0; i < radios.length; i += 1) {
      var radio = radios[i];
      if (name && trimText(radio.name || "") !== name) continue;
      if (radio.checked) checkedCount += 1;
    }
    return checkedCount === 1 && Boolean(target.checked);
  }

  function logAshbyYesNoDiagnostics(diagnostics) {
    try {
      console.info("[Impulso Ashby Yes/No]", diagnostics);
    } catch (_) {}
  }

  function fillAshbyYesNoRadioGroup(fieldset, radios, answer, meta) {
    var info = meta || {};
    var questionText = trimText(info.questionText || "");
    var category = trimText(info.category || "");
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length && radios && radios.length) {
      scoped = (radios || []).filter(function (r) {
        return fieldset && fieldset.contains(r);
      });
    }
    var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

    function fail(reason, matchedInfo) {
      var diagnostics = {
        question: questionText,
        category: category,
        proposedAnswer: trimText(answer),
        optionTexts: optionTexts,
        matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
        radioNames: scoped
          .map(function (r) {
            return trimText(r.name || "");
          })
          .filter(Boolean)
          .filter(function (n, i, arr) {
            return arr.indexOf(n) === i;
          }),
        checkedAfter: scoped.map(function (r) {
          return {
            label: getAshbyOptionVisibleText(r),
            checked: Boolean(r.checked)
          };
        }),
        reason: reason
      };
      logAshbyYesNoDiagnostics(diagnostics);
      return {
        ok: false,
        status: "failed",
        reason: reason,
        category: category,
        question: questionText
      };
    }

    if (!fieldset) {
      return fail("Ashby Yes/No fieldset not found.");
    }
    if (!scoped.length) {
      return fail("Ashby Yes/No radio group not found.");
    }
    if (!isExactYesNoOnlyGroup(scoped)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Not an exact Yes/No radio group.",
        category: category,
        question: questionText
      };
    }
    if (isCitizenshipOrExportControlQuestion(questionText)) {
      return {
        ok: false,
        status: "skipped",
        reason: "Citizenship/export-control questions are not filled yet.",
        category: category,
        question: questionText
      };
    }

    var matched = matchExactYesNoOption(scoped, answer);
    if (!matched || !matched.radio) {
      return fail("No exact Yes/No option matched the saved answer.");
    }
    if (!fieldset.contains(matched.radio)) {
      return fail("Matched option is outside the question fieldset.", matched);
    }
    if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
      return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
    }

    // React handles selection from the outer _option_ div.
    clickAshbyOptionWrapper(matched.optionWrapper);
    sleepSync(100);

    if (!matched.radio.checked) {
      try {
        if (typeof matched.radio.click === "function") matched.radio.click();
      } catch (_) {}
    }

    if (!matched.radio.checked) {
      setNativeRadioChecked(matched.radio, true);
      dispatchAshbyRadioInputChange(matched.radio);
    }

    sleepSync(150);

    if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
      return fail("Ashby Yes/No radio click did not persist.", matched);
    }

    return {
      ok: true,
      status: "filled",
      reason: "",
      category: category,
      question: questionText
    };
  }

  function fillAshbyYesNoRadios(root, inventory) {
    var empty = {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
    if (!isAshbyHost()) return empty;

    var doc = root || document;
    var inv = inventory || {};
    var results = [];
    var fieldsets = [];
    try {
      fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
    } catch (_) {
      return empty;
    }

    fieldsets.forEach(function (fieldset) {
      var scoped = collectAshbyRadiosInFieldset(fieldset);
      if (!scoped.length) return;
      if (!isExactYesNoOnlyGroup(scoped)) return;

      var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
      if (isCitizenshipOrExportControlQuestion(questionText)) return;

      var detected = detectCategoryFromMeta({
        tagName: "input",
        inputType: "radio",
        type: "radio",
        label: questionText,
        ariaLabel: "",
        name: trimText((scoped[0] && scoped[0].name) || ""),
        id: "",
        nearby: "",
        autocomplete: "",
        optionLabels: scoped.map(getAshbyOptionVisibleText)
      });
      var category = detected.category || "unknown";
      if (!ASHBY_YES_NO_CATEGORIES[category]) return;

      var answer = yesNoAnswerForCategory(category, inv);
      if (!answer) {
        results.push({
          category: category,
          label: questionText,
          question: questionText,
          status: "skipped",
          reason: "No saved Yes/No answer for this category.",
          ok: false,
          value: ""
        });
        return;
      }

      var fillResult = fillAshbyYesNoRadioGroup(fieldset, scoped, answer, {
        questionText: questionText,
        category: category
      });
      results.push({
        category: category,
        label: questionText,
        question: questionText,
        status: fillResult.status,
        reason: fillResult.reason || "",
        ok: Boolean(fillResult.ok),
        value: fillResult.ok ? answer : ""
      });
    });

    return {
      results: results,
      summary: {
        attempted: results.length,
        filled: results.filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: results.filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: results.filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  function mergeAutofillReports(primary, secondary) {
    var a = primary || { results: [], summary: {} };
    var b = secondary || { results: [], summary: {} };
    var results = (a.results || []).concat(b.results || []);
    return {
      results: results,
      error: a.error || b.error || "",
      summary: {
        attempted: results.length,
        filled: results.filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: results.filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: results.filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  function mapSavedGenderToAshbyOption(savedGender) {
    var text = normalizeText(savedGender);
    if (!text) return "";
    if (text === "man" || text === "male") return "Male";
    if (text === "woman" || text === "female") return "Female";
    if (
      text === "prefer not to answer" ||
      text === "prefer not to say" ||
      text === "decline to self-identify"
    ) {
      return "Decline to self-identify";
    }
    // Never guess or infer gender (including Non-binary / Self-describe).
    return "";
  }

  function matchAshbyGenderOption(radios, targetOptionText) {
    var want = normalizeText(targetOptionText);
    if (!want) return null;
    for (var i = 0; i < (radios || []).length; i += 1) {
      var optionText = getAshbyOptionVisibleText(radios[i]);
      if (normalizeText(optionText) === want) {
        return {
          radio: radios[i],
          optionWrapper: getAshbyOptionWrapper(radios[i]),
          optionText: optionText
        };
      }
    }
    return null;
  }

  function logAshbyGenderDiagnostics(diagnostics) {
    try {
      console.info("[Impulso Ashby Gender]", diagnostics);
    } catch (_) {}
  }

  function fillAshbyGenderRadioGroup(fieldset, radios, targetOptionText, meta) {
    var info = meta || {};
    var questionText = trimText(info.questionText || "");
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length && radios && radios.length) {
      scoped = (radios || []).filter(function (r) {
        return fieldset && fieldset.contains(r);
      });
    }
    var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

    function fail(reason, matchedInfo) {
      var diagnostics = {
        question: questionText,
        category: "gender",
        proposedAnswer: trimText(info.savedGender || ""),
        mappedOption: trimText(targetOptionText),
        optionTexts: optionTexts,
        matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
        checkedAfter: scoped.map(function (r) {
          return {
            label: getAshbyOptionVisibleText(r),
            checked: Boolean(r.checked)
          };
        }),
        reason: reason
      };
      logAshbyGenderDiagnostics(diagnostics);
      return {
        ok: false,
        status: "failed",
        reason: reason,
        category: "gender",
        question: questionText
      };
    }

    if (!fieldset) return fail("Ashby gender fieldset not found.");
    if (!scoped.length) return fail("Ashby gender radio group not found.");

    var matched = matchAshbyGenderOption(scoped, targetOptionText);
    if (!matched || !matched.radio) {
      return fail("No exact gender option matched the saved answer.");
    }
    if (!fieldset.contains(matched.radio)) {
      return fail("Matched gender option is outside the question fieldset.", matched);
    }
    if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
      return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
    }

    clickAshbyOptionWrapper(matched.optionWrapper);
    sleepSync(100);

    if (!matched.radio.checked) {
      try {
        if (typeof matched.radio.click === "function") matched.radio.click();
      } catch (_) {}
    }

    if (!matched.radio.checked) {
      setNativeRadioChecked(matched.radio, true);
      dispatchAshbyRadioInputChange(matched.radio);
    }

    sleepSync(150);

    if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
      return fail("Ashby gender radio click did not persist.", matched);
    }

    return {
      ok: true,
      status: "filled",
      reason: "",
      category: "gender",
      question: questionText
    };
  }

  function fillAshbyGenderRadios(root, inventory, options) {
    var empty = {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
    var opts = options || {};
    if (!isAshbyHost()) return empty;
    if (!opts.fillDemographics) return empty;

    var savedGender = trimText((inventory && inventory.gender) || "");
    if (!savedGender) return empty;

    var targetOption = mapSavedGenderToAshbyOption(savedGender);
    if (!targetOption) {
      return {
        results: [
          {
            category: "gender",
            label: "Gender",
            question: "Gender",
            status: "skipped",
            reason: "Saved gender has no exact Ashby option mapping.",
            ok: false,
            value: ""
          }
        ],
        summary: { attempted: 1, filled: 0, skipped: 1, failed: 0 }
      };
    }

    var doc = root || document;
    var results = [];
    var fieldsets = [];
    try {
      fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
    } catch (_) {
      return empty;
    }

    fieldsets.forEach(function (fieldset) {
      var scoped = collectAshbyRadiosInFieldset(fieldset);
      if (!scoped.length) return;
      // Leave Yes/No work-auth/sponsorship groups to the existing Ashby Yes/No filler.
      if (isExactYesNoOnlyGroup(scoped)) return;

      var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
      var optionLabels = scoped.map(getAshbyOptionVisibleText);
      var detected = detectCategoryFromMeta({
        tagName: "input",
        inputType: "radio",
        type: "radio",
        label: questionText,
        ariaLabel: "",
        name: trimText((scoped[0] && scoped[0].name) || ""),
        id: "",
        nearby: "",
        autocomplete: "",
        optionLabels: optionLabels
      });
      var category = detected.category || "unknown";
      // Gender only — race/disability handled separately; veteran has its own filler.
      if (category !== "gender") return;

      var fillResult = fillAshbyGenderRadioGroup(fieldset, scoped, targetOption, {
        questionText: questionText,
        savedGender: savedGender
      });
      results.push({
        category: "gender",
        label: questionText,
        question: questionText,
        status: fillResult.status,
        reason: fillResult.reason || "",
        ok: Boolean(fillResult.ok),
        value: fillResult.ok ? targetOption : ""
      });
    });

    return {
      results: results,
      summary: {
        attempted: results.length,
        filled: results.filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: results.filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: results.filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  function normalizeVeteranText(value) {
    return normalizeText(value)
      .replace(/[^\w\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function veteranAliasGroup(value) {
    var text = normalizeVeteranText(value);
    if (!text) return "";
    if (
      text === "prefer not to answer" ||
      text === "prefer not to say" ||
      text === "prefer not to disclose" ||
      text === "decline to self-identify" ||
      text === "i don't wish to answer" ||
      text === "i do not wish to answer" ||
      text === "i do not want to answer"
    ) {
      return "decline";
    }
    if (
      text === "not a veteran" ||
      text === "i am not a protected veteran" ||
      text === "i am not a veteran" ||
      text === "no i am not a protected veteran"
    ) {
      return "not_protected";
    }
    if (
      text === "protected veteran" ||
      text === "i identify as one or more classifications of protected veteran" ||
      text === "i identify as a protected veteran" ||
      text.indexOf("one or more classifications of protected veteran") !== -1
    ) {
      return "protected";
    }
    return "";
  }

  function matchAshbyVeteranOption(radios, savedValue) {
    var savedNorm = normalizeVeteranText(savedValue);
    if (!savedNorm) return null;
    var list = radios || [];

    // Prefer exact normalized text match before aliases.
    for (var i = 0; i < list.length; i += 1) {
      var exactText = getAshbyOptionVisibleText(list[i]);
      if (normalizeVeteranText(exactText) === savedNorm) {
        return {
          radio: list[i],
          optionWrapper: getAshbyOptionWrapper(list[i]),
          optionText: exactText
        };
      }
    }

    var savedGroup = veteranAliasGroup(savedValue);
    if (!savedGroup) return null;

    for (var j = 0; j < list.length; j += 1) {
      var optionText = getAshbyOptionVisibleText(list[j]);
      if (veteranAliasGroup(optionText) === savedGroup) {
        return {
          radio: list[j],
          optionWrapper: getAshbyOptionWrapper(list[j]),
          optionText: optionText
        };
      }
    }
    return null;
  }

  function looksLikeVeteranQuestion(questionText, optionLabels) {
    var blob = normalizeText(
      [questionText || ""].concat(optionLabels || []).join(" ")
    );
    return /\bveteran\b/.test(blob) || /\bprotected\s+veteran\b/.test(blob);
  }

  function logAshbyVeteranDiagnostics(diagnostics) {
    try {
      console.info("[Impulso Ashby Veteran]", diagnostics);
    } catch (_) {}
  }

  function fillAshbyVeteranRadioGroup(fieldset, radios, savedValue, meta) {
    var info = meta || {};
    var questionText = trimText(info.questionText || "");
    var scoped = collectAshbyRadiosInFieldset(fieldset);
    if (!scoped.length && radios && radios.length) {
      scoped = (radios || []).filter(function (r) {
        return fieldset && fieldset.contains(r);
      });
    }
    var optionTexts = scoped.map(getAshbyOptionVisibleText).filter(Boolean);

    function fail(reason, matchedInfo) {
      var diagnostics = {
        question: questionText,
        category: "veteran_status",
        proposedAnswer: trimText(savedValue),
        optionTexts: optionTexts,
        matchedOption: matchedInfo ? matchedInfo.optionText || "" : "",
        checkedAfter: scoped.map(function (r) {
          return {
            label: getAshbyOptionVisibleText(r),
            checked: Boolean(r.checked)
          };
        }),
        reason: reason
      };
      logAshbyVeteranDiagnostics(diagnostics);
      return {
        ok: false,
        status: "failed",
        reason: reason,
        category: "veteran_status",
        question: questionText
      };
    }

    if (!fieldset) return fail("Ashby veteran fieldset not found.");
    if (!scoped.length) return fail("Ashby veteran radio group not found.");

    var matched = matchAshbyVeteranOption(scoped, savedValue);
    if (!matched || !matched.radio) {
      return fail("No veteran option matched the saved answer.");
    }
    if (!fieldset.contains(matched.radio)) {
      return fail("Matched veteran option is outside the question fieldset.", matched);
    }
    if (!matched.optionWrapper || !fieldset.contains(matched.optionWrapper)) {
      return fail("Ashby option wrapper (div[class*=\"_option_\"]) not found.", matched);
    }

    clickAshbyOptionWrapper(matched.optionWrapper);
    sleepSync(100);

    if (!matched.radio.checked) {
      try {
        if (typeof matched.radio.click === "function") matched.radio.click();
      } catch (_) {}
    }

    if (!matched.radio.checked) {
      setNativeRadioChecked(matched.radio, true);
      dispatchAshbyRadioInputChange(matched.radio);
    }

    sleepSync(150);

    if (!verifyAshbyYesNoSelection(fieldset, matched.radio)) {
      return fail("Ashby veteran radio click did not persist.", matched);
    }

    return {
      ok: true,
      status: "filled",
      reason: "",
      category: "veteran_status",
      question: questionText,
      value: matched.optionText || ""
    };
  }

  function fillAshbyVeteranRadios(root, inventory) {
    var empty = {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
    if (!isAshbyHost()) return empty;

    var savedVeteran = trimText((inventory && inventory.veteran_status) || "");
    // Skip silently when no saved veteran answer exists.
    if (!savedVeteran) return empty;

    var doc = root || document;
    var results = [];
    var fieldsets = [];
    try {
      fieldsets = Array.prototype.slice.call(doc.querySelectorAll("fieldset"));
    } catch (_) {
      return empty;
    }

    fieldsets.forEach(function (fieldset) {
      var scoped = collectAshbyRadiosInFieldset(fieldset);
      if (!scoped.length) return;
      if (isExactYesNoOnlyGroup(scoped)) return;

      var questionText = readAshbyYesNoQuestionText(fieldset, scoped);
      var optionLabels = scoped.map(getAshbyOptionVisibleText);
      if (!looksLikeVeteranQuestion(questionText, optionLabels)) return;

      var detected = detectCategoryFromMeta({
        tagName: "input",
        inputType: "radio",
        type: "radio",
        label: questionText,
        ariaLabel: "",
        name: trimText((scoped[0] && scoped[0].name) || ""),
        id: "",
        nearby: "",
        autocomplete: "",
        optionLabels: optionLabels
      });
      var category = detected.category || "unknown";
      // Veteran status only — do not process race, disability, or gender here.
      if (category === "race_ethnicity" || category === "disability_status" || category === "gender") {
        return;
      }
      if (category !== "veteran_status" && !looksLikeVeteranQuestion(questionText, optionLabels)) {
        return;
      }

      var fillResult = fillAshbyVeteranRadioGroup(fieldset, scoped, savedVeteran, {
        questionText: questionText
      });
      results.push({
        category: "veteran_status",
        label: questionText,
        question: questionText,
        status: fillResult.status,
        reason: fillResult.reason || "",
        ok: Boolean(fillResult.ok),
        value: fillResult.ok ? fillResult.value || savedVeteran : ""
      });
    });

    return {
      results: results,
      summary: {
        attempted: results.length,
        filled: results.filter(function (r) {
          return r.status === "filled";
        }).length,
        skipped: results.filter(function (r) {
          return r.status === "skipped";
        }).length,
        failed: results.filter(function (r) {
          return r.status === "failed";
        }).length
      }
    };
  }

  function normalizeDisabilityText(value) {
    var text = String(value == null ? "" : value);
    // Normalize curly and straight apostrophes before other cleanup.
    text = text.replace(/[\u2018\u2019\u02BC\u2032`]/g, "'");
    text = text.toLowerCase();
    text = text.replace(/\s+/g, " ").trim();
    // Remove commas and periods for comparison only.
    text = text.replace(/[,.]/g, "");
    // Treat "don't" and "do not" as equivalent.
    text = text.replace(/\bdon't\b/g, "do not");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function disabilityAliasGroup(value) {
    var text = normalizeDisabilityText(value);
    if (!text) return "";

    // Exact canonical forms only — no broad substring matching.
    if (
      text === "prefer not to answer" ||
      text === "decline to self-identify" ||
      text === "i do not want to answer"
    ) {
      return "decline";
    }
    if (
      text === "yes i have a disability" ||
      text === "yes i have a disability or have had one in the past"
    ) {
      return "yes";
    }
    if (
      text === "no i do not have a disability" ||
      text === "no i do not have a disability and have not had one in the past"
    ) {
      return "no";
    }
    return "";
  }

  function matchAshbyDisabilityOption(radios, savedValue) {
    var savedNorm = normalizeDisabilityText(savedValue);
    if (!savedNorm) return null;
    var list = radios || [];

    // Prefer exact normalized text match before aliases.
    for (var i = 0; i < list.length; i += 1) {
      var exactText = getAshbyOptionVisibleText(list[i]);
      if (normalizeDisabilityText(exactText) === savedNorm) {
        return {
          radio: list[i],
          optionWrapper: getAshbyOptionWrapper(list[i]),
          optionText: exactText
        };
      }
    }

    var savedGroup = disabilityAliasGroup(savedValue);
    if (!savedGroup) return null;

    for (var j = 0; j < list.length; j += 1) {
      var optionText = getAshbyOptionVisibleText(list[j]);
      if (disabilityAliasGroup(optionText) === savedGroup) {
        return {
          radio: list[j],
          optionWrapper: getAshbyOptionWrapper(list[j]),
          optionText: optionText
        };
      }
    }
    return null;
  }

  function resolveSavedDisabilityStatus(inventory, options) {
    var opts = options || {};
    var inv = inventory || {};
    var demo = opts.demographics || (opts.profile && opts.profile.demographics) || {};
    return trimText(
      inv.disability_status ||
        inv.disabilityStatus ||
        inv["disability status"] ||
        demo.disabilityStatus ||
        demo.disability_status ||
        demo["disability status"] ||
        ""
    );
  }

  function logAshbyDisabilityError(reason) {
    try {
      console.error("[Impulso Ashby Disability]", reason);
    } catch (_) {}
  }

  function applyAshbyDisabilityFallbackClick(radio, optionWrapper) {
    // Existing verified Ashby path used by gender/veteran/Yes-No.
    clickAshbyOptionWrapper(optionWrapper);
    sleepSync(100);
    if (!radio.checked) {
      try {
        if (typeof radio.click === "function") radio.click();
      } catch (_) {}
    }
    if (!radio.checked) {
      setNativeRadioChecked(radio, true);
      dispatchAshbyRadioInputChange(radio);
    }
    sleepSync(150);
  }

  function fillAshbyDisabilityRadios(root, inventory, options) {
    var empty = {
      results: [],
      summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 }
    };
    if (!isAshbyHost()) return empty;

    var savedDisability = resolveSavedDisabilityStatus(inventory, options || {});
    // Skip silently when no saved disability answer exists.
    if (!savedDisability) return empty;

    var doc = root || document;
    var fieldset = null;
    try {
      fieldset = Array.prototype.slice
        .call(doc.querySelectorAll("fieldset"))
        .find(function (fs) {
          return /disability status/i.test((fs && fs.innerText) || "");
        });
    } catch (_) {
      fieldset = null;
    }

    if (!fieldset) {
      logAshbyDisabilityError("Disability fieldset not found.");
      return {
        results: [
          {
            category: "disability_status",
            label: "Disability status",
            question: "Disability status",
            status: "failed",
            reason: "Disability fieldset not found.",
            ok: false,
            value: ""
          }
        ],
        summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
      };
    }

    var radios = [];
    try {
      radios = Array.prototype.slice.call(fieldset.querySelectorAll('input[type="radio"]'));
    } catch (_) {
      radios = [];
    }

    var questionText = "Disability status";
    try {
      var legend = fieldset.querySelector && fieldset.querySelector("legend");
      var legendText = legend ? trimText(legend.innerText || legend.textContent || "") : "";
      if (legendText) questionText = legendText;
    } catch (_) {}

    var matched = matchAshbyDisabilityOption(radios, savedDisability);
    if (!matched || !matched.radio) {
      logAshbyDisabilityError("No disability option matched the saved answer.");
      return {
        results: [
          {
            category: "disability_status",
            label: questionText,
            question: questionText,
            status: "failed",
            reason: "No disability option matched the saved answer.",
            ok: false,
            value: ""
          }
        ],
        summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
      };
    }

    var radio = matched.radio;
    var wrapper = radio.closest ? radio.closest('div[class*="_option_"]') : null;
    if (!wrapper) {
      logAshbyDisabilityError("Ashby disability option wrapper not found.");
      return {
        results: [
          {
            category: "disability_status",
            label: questionText,
            question: questionText,
            status: "failed",
            reason: "Ashby disability option wrapper not found.",
            ok: false,
            value: ""
          }
        ],
        summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
      };
    }

    // Exact console-verified approach first.
    try {
      wrapper.click();
    } catch (_) {}
    sleepSync(300);

    if (radio.checked !== true) {
      applyAshbyDisabilityFallbackClick(radio, wrapper);
    }

    if (radio.checked !== true) {
      logAshbyDisabilityError("Disability radio selection did not persist.");
      return {
        results: [
          {
            category: "disability_status",
            label: questionText,
            question: questionText,
            status: "failed",
            reason: "Disability radio selection did not persist.",
            ok: false,
            value: ""
          }
        ],
        summary: { attempted: 1, filled: 0, skipped: 0, failed: 1 }
      };
    }

    return {
      results: [
        {
          category: "disability_status",
          label: questionText,
          question: questionText,
          status: "filled",
          reason: "",
          ok: true,
          value: matched.optionText || savedDisability
        }
      ],
      summary: { attempted: 1, filled: 1, skipped: 0, failed: 0 }
    };
  }

  global.ImpulsoAutofill = {
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_ORDER: CATEGORY_ORDER,
    SENSITIVE_CATEGORIES: SENSITIVE_CATEGORIES,
    BASIC_TEXT_CATEGORIES: BASIC_TEXT_CATEGORIES,
    ASHBY_YES_NO_CATEGORIES: ASHBY_YES_NO_CATEGORIES,
    NO_SAVED_ANSWER: NO_SAVED_ANSWER,
    collectContext: collectContext,
    detectCategory: detectCategory,
    detectCategoryFromMeta: detectCategoryFromMeta,
    classifyLabel: classifyLabel,
    findLabelText: findLabelText,
    getFieldIdentity: getFieldIdentity,
    buildAnswerInventory: buildAnswerInventory,
    resolveAutofillProfilePayload: resolveAutofillProfilePayload,
    resolveAnswerInventory: resolveAnswerInventory,
    hasAnswerForCategory: hasAnswerForCategory,
    getProposedAnswer: getProposedAnswer,
    getTextAnswerForCategory: getTextAnswerForCategory,
    isSensitiveCategory: isSensitiveCategory,
    confidenceLabel: confidenceLabel,
    validateScanField: validateScanField,
    enrichScanField: enrichScanField,
    setNativeValue: setNativeValue,
    fillTextElement: fillTextElement,
    fillAvailabilityDateElement: fillAvailabilityDateElement,
    fillBasicTextFields: fillBasicTextFields,
    fillAshbyYesNoRadios: fillAshbyYesNoRadios,
    fillAshbyGenderRadios: fillAshbyGenderRadios,
    fillAshbyVeteranRadios: fillAshbyVeteranRadios,
    fillAshbyDisabilityRadios: fillAshbyDisabilityRadios,
    mapSavedGenderToAshbyOption: mapSavedGenderToAshbyOption,
    matchAshbyVeteranOption: matchAshbyVeteranOption,
    matchAshbyDisabilityOption: matchAshbyDisabilityOption,
    mergeAutofillReports: mergeAutofillReports,
    isAshbyHost: isAshbyHost,
    parseStoredDate: parseStoredDate,
    formatDateForElement: formatDateForElement,
    availabilityDateAnswer: availabilityDateAnswer,
    readElementTextValue: readElementTextValue,
    textValuesMatch: textValuesMatch,
    scanDocument: scanDocument,
    scanPage: function (inventory) {
      return scanDocument(document, inventory || {});
    },
    summarizeFields: summarizeFields
  };
})(typeof window !== "undefined" ? window : self);
