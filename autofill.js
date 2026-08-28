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
    "export_control_status",
    "sponsorship_now",
    "sponsorship_later",
    "availability",
    "salary",
    "relocation",
    "preferred_locations",
    "areas_of_interest",
    "veteran_status",
    "disability_status",
    "gender",
    "hispanic_latino",
    "transgender",
    "race_ethnicity",
    "employment_country_citizenship",
    "us_immigration_status",
    "sanctioned_country_citizenship",
    "company_specific",
    "education_school",
    "education_discipline",
    "education_degree",
    "education_gpa",
    "education_gpa_undergraduate",
    "education_gpa_graduate",
    "education_gpa_doctorate",
    "education_anticipated_graduation",
    "education_start_month",
    "education_end_month",
    "education_end_year",
    "education",
    "experience",
    "skills",
    "project_highlight",
    "referral_source",
    "privacy_consent",
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
    education_gpa: "GPA",
    education_gpa_undergraduate: "Undergraduate GPA",
    education_gpa_graduate: "Graduate GPA",
    education_gpa_doctorate: "Doctorate GPA",
    education_anticipated_graduation: "Graduation date",
    education_start_month: "Education start month",
    education_end_month: "Education end month",
    education: "Education",
    experience: "Experience",
    skills: "Skills",
    work_authorization: "Work authorization",
    export_control_status: "Export control / U.S. person status",
    sponsorship_now: "Sponsorship now",
    sponsorship_later: "Sponsorship later",
    availability: "Availability",
    salary: "Salary",
    relocation: "Relocation",
    preferred_locations: "Preferred locations",
    areas_of_interest: "Areas of interest",
    veteran_status: "Veteran status",
    disability_status: "Disability status",
    gender: "Gender",
    hispanic_latino: "Hispanic/Latino",
    transgender: "Transgender",
    race_ethnicity: "Race/ethnicity",
    employment_country_citizenship: "Employment-country citizenship",
    us_immigration_status: "U.S. citizenship / immigration status",
    sanctioned_country_citizenship: "Sanctioned-country citizenship",
    company_specific: "Company-specific question",
    education_school: "University / school",
    education_discipline: "Major / field of study",
    education_degree: "Highest education",
    education_end_year: "Graduation year",
    cover_letter: "Cover letter",
    project_highlight: "Project highlight",
    referral_source: "Referral source",
    privacy_consent: "Privacy notice consent",
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
    cover_letter: true,
    education_school: true
  };

  var SENSITIVE_CATEGORIES = {
    gender: true,
    hispanic_latino: true,
    transgender: true,
    race_ethnicity: true,
    veteran_status: true,
    disability_status: true,
    employment_country_citizenship: true,
    us_immigration_status: true,
    sanctioned_country_citizenship: true
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
      exclude: [
        /\bhow\s+did\s+you\s+(come\s+to\s+)?(hear|learn|find|discover)\b/,
        /\bwhere\s+did\s+you\s+(hear|learn|find|discover)\b/,
        /\breferral\s+source\b/,
        /\brecruiting\s+source\b/
      ]
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
        /\bportfolio\s+or\s+website\b/,
        /\bgithub\b/,
        /\blinkedin\b/,
        /\bpersonal\s+website\b/,
        /\bwhy\s+(this|our)\s+(company|role|position|job)\b/,
        /\btell\s+us\s+about\s+yourself\b/,
        /\bemployment\s+history\b/,
        /\binternships?\b/,
        /\byears?\s+of\s+experience\b/,
        /\bwork\s+authorization\b/,
        /\bsponsor/
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
      exclude: [/\bmobile\s+(role|position|job)\b/]
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
        /\bhow\s+did\s+you\s+(come\s+to\s+)?(learn|find|discover)\b/,
        /\bwhere\s+did\s+you\s+(hear|learn|find|discover)\b/,
        /\bhear\s+about\s+(this\s+)?(job|role|position|opportunity|company|us)\b/,
        /\blearn\s+about\s+(this\s+)?(job|role|position|opportunity|company|us)\b/,
        /\bcome\s+to\s+learn\s+about\b/,
        /\bjourney\s+to\s+discover/,
        /\breferral\s+source\b/,
        /\brecruiting\s+source\b/,
        /\bsource\s+of\s+hire\b/,
        /\bhow\s+did\s+you\s+find\b/
      ],
      exclude: [/\bcover\s*letter\b/, /\bproject\b/, /\blinkedin\s+(profile|url|link)\b/]
    },
    {
      category: "sponsorship_later",
      confidence: 0.97,
      include: [
        /\b(f-?1\s+)?stem\s+opt\b/,
        /\bf-?1\s+opt\b/,
        /\bf-?1\s+cpt\b/,
        /\bh-?1b\b/,
        /\bsponsorship\/support\b/,
        /\bimmigration\s+support\b/,
        /\b(opt|cpt)\b.*\bsponsor/,
        /\bsponsor.*\b(opt|cpt|h-?1b)\b/
      ],
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
      exclude: [/\b(f-?1\s+)?stem\s+opt\b/, /\bf-?1\s+opt\b/, /\bf-?1\s+cpt\b/, /\bh-?1b\b/]
    },
    {
      category: "export_control_status",
      confidence: 0.96,
      include: [
        /\bexport\s+control\b/,
        /\bitar\b/,
        /\bu\.?\s*s\.?\s+person\b/,
        /\bus\s+person\b/,
        /\bwhich\s+statement\s+best\s+applies\b/
      ],
      exclude: [/\blegally\s+authorized\b/, /\bsponsor/]
    },
    {
      category: "work_authorization",
      confidence: 0.92,
      include: [
        /\blegally\s+authorized\b/,
        /\bauthorized\s+to\s+work\b/,
        /\bauthorization\s+to\s+work\b/,
        /\bwork\s+authorization\b/,
        /\beligible\s+to\s+work\b/,
        /\blegally\s+eligible\s+to\s+work\b/,
        /\bunited\s+states\s+citizen\b/,
        /\bcitizen\s+or\s+national\b/,
        /\ba\s+united\s+states\s+citizen\b/
      ],
      exclude: [
        /\bsponsor/,
        /\bexport\s+control\b/,
        /\bitar\b/,
        /\bu\.?\s*s\.?\s+person\b/,
        /\brelocatem?\b/,
        /\basylee\b/,
        /\brefugee\b/,
        /\bcuba\b/,
        /\biran\b/,
        /\bnorth\s+korea\b/,
        /\bsyria\b/,
        /\bcitizen of the country\b/
      ]
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
      exclude: [
        /\bstart\s+date\s+year\b/,
        /\bend\s+date\s+year\b/,
        /\bstart\s+date\s+month\b/,
        /\bend\s+date\s+month\b/,
        /\beducation\s+start\s+month\b/,
        /\beducation\s+end\s+month\b/,
        /\beducation\s+start\b/,
        /\beducation\s+end\b/,
        /\bschool\b/,
        /\buniversity\b/,
        /\bdegree\b/
      ]
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
      exclude: [/\bcitizen/, /\bcitizenship\b/, /\basylee\b/, /\brefugee\b/, /\bemploy/]
    },
    {
      category: "address",
      confidence: 0.84,
      include: [/\bstreet\s+address\b/, /\baddress\s*line\b/, /\bmailing\s+address\b/, /\bhome\s+address\b/],
      exclude: [/\bemail\b/, /\bip\b/]
    },
    {
      category: "education",
      confidence: 0.9,
      include: [
        /\beducation\b/,
        /\bdegree\b/,
        /\buniversity\b/,
        /\bschool\b/,
        /\bgpa\b/,
        /\bstart\s+date\s+year\b/,
        /\bend\s+date\s+year\b/,
        /\beducation\s+start\s+year\b/,
        /\beducation\s+end\s+year\b/
      ],
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
        /\bwhy\s+(are\s+you\s+)?interested\b/,
        /\bmessage\s+to\s+(the\s+)?hiring\s+manager\b/,
        /\bhiring\s+manager\b/
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
    if (role === "checkbox") return "checkbox";
    if (role === "radio") return "radio";
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

  function looksLikeProjectHighlightExclusion(text) {
    if (!text) return true;
    if (/\blinkedin\b/.test(text)) return true;
    if (/\bgithub\b/.test(text) && /\b(url|link|profile|username|handle|account)\b/.test(text)) {
      return true;
    }
    if (
      /\bgithub\b/.test(text) &&
      !/\b(built|build|project|describe|tell|challeng|hard|complex|proud|problem|solved)\b/.test(text)
    ) {
      return true;
    }
    if (/\bportfolio\b/.test(text) && /\b(url|link|website)\b/.test(text)) return true;
    if (/\bpersonal\s+website\b/.test(text)) return true;
    if (/\b(project\s+url|live\s+url|demo\s+url|website\s+url|deployed\s+(url|link|site))\b/.test(text)) {
      return true;
    }
    if (
      /\b(url|link)\b/.test(text) &&
      !/\b(describe|tell|share|explain|walk|proud|challeng|difficult|hard|complex)\b/.test(text)
    ) {
      return true;
    }
    if (/\bwhy\s+(this|our)\s+(company|role|position|job|team|opportunity)\b/.test(text)) return true;
    if (/\bwhy\s+(do\s+you\s+)?want\s+to\s+(work|join|apply)\b/.test(text)) return true;
    if (/\bwhy\s+(are\s+you\s+)?interested\s+in\s+(this|our|the)\s+(company|role|position|job)\b/.test(text)) {
      return true;
    }
    if (/\btell\s+us\s+about\s+yourself\b/.test(text)) return true;
    if (/\babout\s+yourself\b/.test(text) && !/\b(project|built|build|challenge)\b/.test(text)) return true;
    if (/\bemployment\s+history\b/.test(text) || /\bwork\s+history\b/.test(text)) return true;
    if (/\bprevious\s+(employment|employers?|jobs?|roles?)\b/.test(text)) return true;
    if (/\binternships?\b/.test(text)) return true;
    if (/\byears?\s+of\s+experience\b/.test(text) || /\bhow\s+many\s+years\b/.test(text)) return true;
    if (/\bavailability\b/.test(text) || /\bnotice\s+period\b/.test(text)) return true;
    if (/\bwork\s+authorization\b/.test(text) || /\blegally\s+authorized\b/.test(text)) return true;
    if (/\bsponsor/.test(text)) return true;
    if (/\bhow\s+many\s+projects\b/.test(text) || /\bnumber\s+of\s+projects\b/.test(text)) return true;
    if (/\bproject\s+(name|title|url|link)\b/.test(text)) return true;
    if (/\b(our|company|team)\s+mission\b/.test(text)) return true;
    return false;
  }

  function looksLikeProjectHighlight(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (looksLikeProjectHighlightExclusion(text)) return false;

    var hasProject = /\bprojects?\b/.test(text);
    var hasBuild = /\b(built|build|building|developed|develop|created|create|creating|implemented|implement|implementation)\b/.test(
      text
    );
    var hasChallenge = /\b(challenging|challenged|challenges?|difficult|difficulty|hard|complex|complexity|technical|technically)\b/.test(
      text
    );
    var hasPride = /\b(proud|impressive|significant|favorite)\b/.test(text);
    var hasProblem = /\b(problems?|solved|solve|solving|solution)\b/.test(text);
    var hasEngineering = /\bengineering\b/.test(text);
    var hasDemo =
      /\bdemonstrat(?:e|es|ed|ing)?\b/.test(text) &&
      /\b(technical|technically|skills?|ability|abilities)\b/.test(text);
    var hasArch = /\b(architecture|implementation|challenges)\b/.test(text);
    var hasNarrative =
      /\b(describe|tell|share|explain|discuss|walk)\b/.test(text) ||
      /\bwhat\b/.test(text) ||
      /\bhighlight\b/.test(text) ||
      /\bcontribution\b/.test(text);

    if (hasBuild && hasChallenge) return true;
    if (hasBuild && hasNarrative) return true;
    if (hasBuild && hasDemo) return true;
    if (hasProject && (hasChallenge || hasPride || hasArch)) return true;
    if (hasProject && hasNarrative) return true;
    if ((hasEngineering || hasChallenge) && hasProblem && (hasNarrative || /\bsolved\b/.test(text))) {
      return true;
    }
    if (hasProject && /\b(contribution|highlight)\b/.test(text)) return true;
    return false;
  }

  function looksLikeSmartRecruitersEmployeeReferral(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\breferred by\b/.test(text) && /\bemployee\b/.test(text)) return true;
    if (/\bcurrent .{0,60}employee\b/.test(text) && /\b(name|referred|referral)\b/.test(text)) return true;
    if (/\blist their name\b/.test(text) && /\b(referred|referral|employee)\b/.test(text)) return true;
    if (/\bemployee referral\b/.test(text) && /\bname\b/.test(text)) return true;
    return false;
  }

  function looksLikeSmartRecruitersPrivacyConsent(blob) {
    var text = normalizeText(blob);
    if (!text || text === "*") return false;
    if (/\bprivacy notice\b/.test(text) && /\b(agree|consent|declare|read)\b/.test(text)) return true;
    if (/\bagree to the privacy\b/.test(text)) return true;
    if (/\bprivacy policy\b/.test(text) && /\b(agree|consent|acknowledge|declare)\b/.test(text)) return true;
    return false;
  }

  function looksLikeReferralSource(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (looksLikeLinkedInProfileField(text) && !/\bhow\s+did\s+you\b/.test(text) && !/\bhear\b/.test(text)) {
      return false;
    }
    return (
      /\bhow\s+did\s+you\s+(come\s+to\s+)?(hear|learn|find|discover)\b/.test(text) ||
      /\bwhere\s+did\s+you\s+(hear|learn|find|discover)\b/.test(text) ||
      /\bhow\s+did\s+you\s+find\s+(out\s+)?(about|us)\b/.test(text) ||
      /\bhow\s+did\s+you\s+hear\s+about\s+us\b/.test(text) ||
      /\bcome\s+to\s+learn\s+about\b/.test(text) ||
      /\b(hear|learn|find|discover(?:ing|ed)?)\s+about\s+(this|us|our|the)\b/.test(text) ||
      /\bhear\s+about\s+(this\s+)?(job|role|position|opportunity|company)\b/.test(text) ||
      /\blearn\s+about\s+(this\s+)?(job|role|position|opportunity|company|us)\b/.test(text) ||
      /\bjourney\s+to\s+discover/.test(text) ||
      /\breferral\s+source\b/.test(text) ||
      /\brecruiting\s+source\b/.test(text) ||
      /\bsource\s+of\s+hire\b/.test(text)
    );
  }

  function looksLikeLinkedInProfileField(blob) {
    var text = normalizeText(blob);
    if (!text || !/\blinkedin\b/.test(text)) return false;
    if (
      /\bhow\s+did\s+you\b/.test(text) ||
      /\bwhere\s+did\s+you\b/.test(text) ||
      /\b(hear|learn|find|discover)\s+about\b/.test(text) ||
      /\breferral\b/.test(text) ||
      /\brecruiting\s+source\b/.test(text) ||
      /\bsource\s+of\s+hire\b/.test(text) ||
      /\bjourney\s+to\s+discover/.test(text)
    ) {
      return false;
    }
    if (/\blinkedin\s+(profile|url|link)\b/.test(text)) return true;
    if (/\b(profile|url|link)\s+.{0,20}\blinkedin\b/.test(text)) return true;
    if (/\bplease\s+(enter|provide|add|share|paste)\s+(your\s+)?linkedin\b/.test(text)) return true;
    if (/\byour\s+linkedin\b/.test(text) && text.length < 80) return true;
    var compact = text.replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim();
    return compact === "linkedin" || compact === "linkedin profile" || compact === "linkedin url";
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

  function looksLikeCompanySpecificUserConfirmation(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (
      (/\bfamily\b/.test(text) || /\bclose\s+friend\b/.test(text)) &&
      /\b(friend|relationship)\b/.test(text) &&
      /\bemploy/.test(text)
    ) {
      return true;
    }
    if (/\bhave you ever been employed\b/.test(text) || (/\bemployed by\b/.test(text) && /\bsubsidiar/.test(text))) {
      return true;
    }
    if (
      /\brestrictive\b/.test(text) &&
      (/\bagreement\b/.test(text) || /\bconsulting\b/.test(text) || /\bpersonal[-\s]?services\b/.test(text))
    ) {
      return true;
    }
    if (/\bconflict of interest\b/.test(text)) return true;
    if (/\boutside business\b/.test(text) && (/\bactivit/.test(text) || /\btransaction/.test(text))) return true;
    if (looksLikePreviouslyAppliedQuestion(text)) return true;
    return false;
  }

  function looksLikePreviouslyAppliedQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bpreviously applied\b/.test(text)) return true;
    return /\bhave you\b/.test(text) && /\bapplied\b/.test(text) && /\b(this company|this employer|our company)\b/.test(text);
  }

  function looksLikeExportControlRestrictionQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bu\.?\s*s\.?\s+person\b/.test(text) || /\bwhich statement best applies\b/.test(text)) return false;
    return (
      /\bexport control restrictions?\b/.test(text) ||
      (/\bexport control\b/.test(text) && /\brestrictions?\b/.test(text) && /\bprevent\b/.test(text))
    );
  }

  function looksLikeEmploymentCountryCitizenshipQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\basylee\b/.test(text) || /\brefugee\b/.test(text) || /\blawful permanent resident\b/.test(text)) {
      return false;
    }
    if (/\bcuba\b/.test(text) && /\biran\b/.test(text)) return false;
    return (
      /\bcitizen of the country\b/.test(text) ||
      (/\bcitizen\b/.test(text) && /\bemployed in\b/.test(text)) ||
      (/\bcitizen\b/.test(text) && /\byou.?ll be employed\b/.test(text)) ||
      (/\bcitizen\b/.test(text) && /\bcountry you (have )?selected\b/.test(text))
    );
  }

  function looksLikeUsImmigrationStatusQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bcuba\b/.test(text) && /\biran\b/.test(text)) return false;
    return (
      /\blawful permanent resident\b/.test(text) ||
      (/\basylee\b/.test(text) && /\brefugee\b/.test(text)) ||
      (/\bcitizen of the u\.?\s*s/.test(text) && /\bpermanent resident\b/.test(text))
    );
  }

  function looksLikeSanctionedCountryCitizenshipQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bsubsequently obtained\b/.test(text) || /\basylum elsewhere\b/.test(text)) return false;
    return (
      (/\bcuba\b/.test(text) && /\biran\b/.test(text) && (/\bnorth korea\b/.test(text) || /\bsyria\b/.test(text))) ||
      /\bcitizen of cuba\b/.test(text)
    );
  }

  function looksLikeSanctionedCountryFollowUpQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    return (
      /\bif yes to the previous\b/.test(text) ||
      /\bsubsequently obtained citizenship\b/.test(text) ||
      (/\bpermanent residence\b/.test(text) && /\basylum elsewhere\b/.test(text))
    );
  }

  function classifyScreeningEducationCategory(ownLabel) {
    var text = normalizeText(ownLabel);
    if (!text) return "";
    if (/\bgpa\b/.test(text) || /\bgrade\s+point\s+average\b/.test(text)) return "";
    if (/\bgraduation\s+month\b/.test(text) || (/\bmonth\b/.test(text) && /\bgraduat/.test(text))) {
      return "education_end_month";
    }
    if (/\bgraduation\s+year\b/.test(text) || (/\byear\b/.test(text) && /\bgraduat/.test(text) && !/\bmonth\b/.test(text))) {
      return "education_end_year";
    }
    if (
      /\bcurrent\s+university\b/.test(text) ||
      (/\buniversity\b/.test(text) && !/\bdegree\b/.test(text) && !/\bmajor\b/.test(text) && !/\beducation\b/.test(text))
    ) {
      return "education_school";
    }
    if (/\bmajor\b/.test(text) || /\bfield of study\b/.test(text) || /\bdiscipline\b/.test(text)) {
      return "education_discipline";
    }
    if (
      /\bhighest\s+(level\s+of\s+)?education\b/.test(text) ||
      (/\beducation\b/.test(text) && /\bdegree\b/.test(text)) ||
      text === "education" ||
      text === "highest education"
    ) {
      return "education_degree";
    }
    return "";
  }

  function looksLikeAreasOfInterestQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    return /\bareas?\s+of\s+interest\b/.test(text) || /\bjob\s+categor(?:y|ies)\b/.test(text);
  }

  function looksLikeEducationDateField(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bstart\s+date\s+year\b/.test(text) || /\bend\s+date\s+year\b/.test(text)) return true;
    if (/\bstart\s+date\s+month\b/.test(text) || /\bend\s+date\s+month\b/.test(text)) return true;
    if (/\beducation\s+(start|end)\s+year\b/.test(text)) return true;
    if (/\beducation\s+(start|end)\s+month\b/.test(text)) return true;
    if (/\banticipated\s+graduation\b/.test(text)) return true;
    if (/\bexpected\s+graduation\b/.test(text)) return true;
    if (/\bgraduation\s+date\b/.test(text)) return true;
    if (
      (/\bstart\s+year\b/.test(text) || /\bend\s+year\b/.test(text)) &&
      /\b(education|school|degree|university|college)\b/.test(text)
    ) {
      return true;
    }
    return false;
  }

  function looksLikePreferredLocationsQuestion(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bcurrent\s+location\b/.test(text)) return false;
    if (/\blocation\s*\(?\s*city\s*\)?/.test(text)) return false;
    if (/\bhome\s+address\b/.test(text) || /\bstreet\s+address\b/.test(text) || /\bmailing\s+address\b/.test(text)) {
      return false;
    }
    if (/\bjob\s+location\b/.test(text)) return false;
    if (/\bphone\b/.test(text) && /\bcountry\b/.test(text)) return false;
    if (/\bwhere\s+are\s+you\s+located\b/.test(text)) return false;
    if (/\bwilling\s+to\s+relocate\b/.test(text) && !/\blocations?\b/.test(text) && !/\boffices?\b/.test(text)) {
      return false;
    }
    if (/\brelocatem?\b/.test(text) && !/\blocations?\b/.test(text) && !/\boffices?\b/.test(text)) {
      return false;
    }
    if (/\bpreferred\s+(work\s+)?locations?\b/.test(text)) return true;
    if (/\bdesired\s+(work\s+)?locations?\b/.test(text)) return true;
    if (/\bselect\s+all\s+locations\b/.test(text)) return true;
    if (/\bopen\s+to\s+being\s+placed\b/.test(text)) return true;
    if (/\blocations?\b/.test(text) && /\bopen\s+to\b/.test(text)) return true;
    if (/\boffices?\b/.test(text) && /\bwork\s+from\b/.test(text)) return true;
    return false;
  }

  function looksLikeLocationCityField(blob) {
    var text = normalizeText(blob);
    if (!text) return false;
    if (/\bjob\s+location\b/.test(text)) return false;
    if (/\bpreferred\s+(work\s+)?location\b/.test(text)) return false;
    if (/\breloc/.test(text)) return false;
    if (/\bphone\b/.test(text) && /\bcountry\b/.test(text)) return false;
    if (/\bcitizen/.test(text) || /\bcitizenship\b/.test(text) || /\bnationality\b/.test(text)) return false;
    return (
      /\blocation\s*\(?\s*city\s*\)?/.test(text) ||
      /\bcurrent\s+location\b/.test(text) ||
      text === "city" ||
      text === "city *" ||
      /^city\b/.test(text) ||
      /\bwhere\s+are\s+you\s+located\b/.test(text)
    );
  }

  function normalizeEducationRecord(item) {
    var row = item && typeof item === "object" ? item : {};
    return {
      institution: trimText(row.institution || row.school_name || row.school || ""),
      degree: trimText(row.degree || row.degree_type || ""),
      field: trimText(row.field || row.major || row.discipline || ""),
      location: trimText(row.location || ""),
      startDate: trimText(row.startDate || row.start_date || ""),
      endDate: trimText(row.endDate || row.end_date || row.graduation_year || ""),
      gpa: trimText(row.gpa || ""),
      isCurrent: Boolean(row.isCurrent || row.currentlyEnrolled || row.inProgress)
    };
  }

  function normalizeExperienceRecord(item) {
    var row = item && typeof item === "object" ? item : {};
    var current = false;
    if (row.current === true || row.current === "true") current = true;
    if (row.currentRole === true || row.currentRole === "true") current = true;
    if (row.isCurrent === true || row.isCurrent === "true") current = true;
    return {
      company: trimText(row.company || row.company_name || row.employer || row.companyName || ""),
      title: trimText(row.title || row.job_title || row.role || row.position || ""),
      startDate: trimText(row.startDate || row.start_date || ""),
      endDate: trimText(row.endDate || row.end_date || ""),
      current: current
    };
  }

  function extractMonthFromEducationDate(value) {
    var text = trimText(value);
    if (!text) return "";
    if (/^(present|current|now|ongoing|in\s*progress|expected|n\/?a)$/i.test(text)) return "";
    var names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    function fromNumber(raw) {
      var num = parseInt(raw, 10);
      if (!num || num < 1 || num > 12) return "";
      return names[num - 1];
    }
    var parsed = parseStoredDate(text);
    if (parsed && parsed.m) {
      var fromParsed = fromNumber(parsed.m);
      if (fromParsed) return fromParsed;
    }
    var yearMonth = text.match(/^(\d{4})-(\d{1,2})$/);
    if (yearMonth) return fromNumber(yearMonth[2]);
    var monthYear = text.match(/^(\d{1,2})\/(\d{4})$/);
    if (monthYear) return fromNumber(monthYear[1]);
    var lower = normalizeText(text);
    var abbrs = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    var i;
    for (i = 0; i < names.length; i += 1) {
      if (new RegExp("\\b" + names[i].toLowerCase() + "\\b").test(lower)) return names[i];
    }
    if (/\bsept\b/.test(lower)) return "September";
    for (i = 0; i < abbrs.length; i += 1) {
      if (new RegExp("\\b" + abbrs[i] + "\\b").test(lower)) return names[i];
    }
    return "";
  }

  function extractYearFromEducationDate(value) {
    var text = trimText(value);
    if (!text) return "";
    if (/^(present|current|now|ongoing|in\s*progress|expected|n\/?a)$/i.test(text)) return "";
    var match = text.match(/\b((?:19|20)\d{2})\b/);
    return match ? match[1] : "";
  }

  function educationEndSortValue(record) {
    var row = normalizeEducationRecord(record);
    if (isEducationInProgress(row)) return Number.POSITIVE_INFINITY;
    var year = extractYearFromEducationDate(row.endDate);
    if (year) return parseInt(year, 10);
    var parsed = parseStoredDate(row.endDate);
    if (parsed && parsed.y) return parseInt(parsed.y, 10);
    return Number.NEGATIVE_INFINITY;
  }

  function isEducationInProgress(record) {
    var row = normalizeEducationRecord(record);
    if (row.isCurrent) return true;
    var end = normalizeText(row.endDate);
    if (!end) return Boolean(row.institution || row.degree || row.field);
    return /^(present|current|now|ongoing|in\s*progress)$/.test(end) || /\bin\s*progress\b/.test(end);
  }

  function isValidEducationRecord(record) {
    var row = normalizeEducationRecord(record);
    return Boolean(row.institution || row.degree || row.field || row.startDate || row.endDate);
  }

  function listValidEducationRecords(educationList) {
    // Preserve stored order. Do not reorder by graduation date for multi-entry fill.
    var list = Array.isArray(educationList) ? educationList : [];
    var valid = [];
    list.forEach(function (item) {
      if (isValidEducationRecord(item)) valid.push(normalizeEducationRecord(item));
    });
    return valid;
  }

  function listValidExperienceRecords(experienceList) {
    var list = Array.isArray(experienceList) ? experienceList : [];
    var valid = [];
    list.forEach(function (item) {
      var row = normalizeExperienceRecord(item);
      if (row.company || row.title || row.startDate || row.endDate || row.current) {
        valid.push(row);
      }
    });
    return valid;
  }

  function educationDegreeLevel(value) {
    var text = String(value == null ? "" : value)
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/\./g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    var undergraduate =
      /\bbachelor(?:s)?\b/.test(text) ||
      /\bbs\b/.test(text) ||
      /\bbe\b/.test(text) ||
      /\bbeng\b/.test(text) ||
      /\bbtech\b/.test(text);
    var graduate =
      /\bmaster(?:s)?\b/.test(text) ||
      /\bms\b/.test(text) ||
      /\bmeng\b/.test(text) ||
      /\bmtech\b/.test(text);
    var doctorate =
      /\bdoctorate\b/.test(text) ||
      /\bdoctoral\b/.test(text) ||
      /\bphd\b/.test(text) ||
      /\bdoctor of philosophy\b/.test(text);
    var count = (undergraduate ? 1 : 0) + (graduate ? 1 : 0) + (doctorate ? 1 : 0);
    if (count !== 1) return "";
    if (undergraduate) return "undergraduate";
    if (graduate) return "graduate";
    return "doctorate";
  }

  function educationDegreeRank(level) {
    if (level === "doctorate") return 3;
    if (level === "graduate") return 2;
    if (level === "undergraduate") return 1;
    return 0;
  }

  function selectHighestDegreeEducation(educationList) {
    var valid = listValidEducationRecords(educationList);
    if (!valid.length) return null;
    var best = valid[0];
    var bestRank = educationDegreeRank(educationDegreeLevel(best.degree));
    var i;
    var rank;
    for (i = 1; i < valid.length; i += 1) {
      rank = educationDegreeRank(educationDegreeLevel(valid[i].degree));
      if (rank > bestRank) {
        best = valid[i];
        bestRank = rank;
      } else if (rank === bestRank) {
        if (isEducationInProgress(valid[i]) && !isEducationInProgress(best)) {
          best = valid[i];
        } else if (
          !isEducationInProgress(best) &&
          educationEndSortValue(valid[i]) > educationEndSortValue(best)
        ) {
          best = valid[i];
        }
      }
    }
    return best;
  }

  function gpaForGenericScreeningQuestion(educationList) {
    var highest = selectHighestDegreeEducation(educationList);
    if (highest && trimText(highest.gpa)) return trimText(highest.gpa);
    var graduate = educationGpaForLevel(educationList, "graduate");
    if (graduate) return graduate;
    var doctorate = educationGpaForLevel(educationList, "doctorate");
    if (doctorate) return doctorate;
    var primary = selectPrimaryEducation(educationList);
    return (primary && trimText(primary.gpa)) || "";
  }

  function parseGpaRangeLabel(label) {
    var text = normalizeText(label).replace(/,/g, ".");
    var match;
    var min;
    var max;
    if (!text) return null;
    match = text.match(/(\d+(?:\.\d+)?)\s*(?:\+|and above|or above|or higher|and higher|and over)/);
    if (match) {
      min = parseFloat(match[1]);
      if (!isFinite(min)) return null;
      return { min: min, max: Infinity, exclusiveMax: false };
    }
    match = text.match(/(?:above|over|greater than|more than)\s+(\d+(?:\.\d+)?)/);
    if (match) {
      min = parseFloat(match[1]);
      if (!isFinite(min)) return null;
      return { min: min, max: Infinity, exclusiveMax: false };
    }
    match = text.match(/(?:less than|below|under)\s+(\d+(?:\.\d+)?)/);
    if (match) {
      max = parseFloat(match[1]);
      if (!isFinite(max)) return null;
      return { min: -Infinity, max: max, exclusiveMax: true };
    }
    match = text.match(/(\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?)/);
    if (match) {
      min = parseFloat(match[1]);
      max = parseFloat(match[2]);
      if (!isFinite(min) || !isFinite(max)) return null;
      return { min: min, max: max, exclusiveMax: false };
    }
    return null;
  }

  function optionsLookLikeGpaRanges(optionLabels) {
    var labels = optionLabels || [];
    var i;
    var hits = 0;
    for (i = 0; i < labels.length; i += 1) {
      if (parseGpaRangeLabel(labels[i])) hits += 1;
    }
    return hits >= 2;
  }

  function gpaValueInParsedRange(value, range) {
    if (!range || !isFinite(value)) return false;
    if (range.min !== -Infinity && value < range.min - 1e-9) return false;
    if (range.max === Infinity) return true;
    if (range.exclusiveMax) return value < range.max - 1e-9;
    return value <= range.max + 1e-9;
  }

  function mapNumericGpaToRangeOption(saved, optionLabels) {
    var options = (optionLabels || []).map(trimText).filter(Boolean);
    var exact = trimText(saved);
    var n;
    var i;
    var label;
    var hits;
    if (!options.length) return "";
    if (exact) {
      for (i = 0; i < options.length; i += 1) {
        if (normalizeText(options[i]) === normalizeText(exact)) return options[i];
      }
    }
    n = parseFloat(String(saved == null ? "" : saved).replace(/[^0-9.]/g, ""));
    if (!isFinite(n)) return "";
    hits = [];
    for (i = 0; i < options.length; i += 1) {
      label = options[i];
      if (gpaValueInParsedRange(n, parseGpaRangeLabel(label))) hits.push(label);
    }
    return hits.length === 1 ? hits[0] : "";
  }

  function educationGpaForLevel(educationList, level) {
    if (level !== "undergraduate" && level !== "graduate" && level !== "doctorate") return "";
    var valid = listValidEducationRecords(educationList);
    var gpas = [];
    var i;
    for (i = 0; i < valid.length; i += 1) {
      var row = valid[i];
      if (educationDegreeLevel(row.degree) !== level) continue;
      var gpa = trimText(row.gpa);
      if (!gpa) continue;
      gpas.push(gpa);
    }
    if (!gpas.length) return "";
    var first = gpas[0];
    for (i = 1; i < gpas.length; i += 1) {
      if (gpas[i] !== first) return "";
    }
    return first;
  }

  function selectPrimaryEducation(educationList) {
    var valid = listValidEducationRecords(educationList);
    if (!valid.length) return null;

    var inProgress = valid.filter(function (row) {
      return isEducationInProgress(row);
    });
    if (inProgress.length) return inProgress[0];

    var best = valid[0];
    var bestScore = educationEndSortValue(best);
    for (var i = 1; i < valid.length; i += 1) {
      var score = educationEndSortValue(valid[i]);
      if (score > bestScore) {
        best = valid[i];
        bestScore = score;
      }
    }
    return best;
  }

  function buildPrimaryEducationAnswers(educationList) {
    var primary = selectPrimaryEducation(educationList);
    if (!primary) {
      return {
        primary_education: null,
        education_school: "",
        education_degree: "",
        education_discipline: "",
        education_start_year: "",
        education_end_year: "",
        education_start_month: "",
        education_end_month: "",
        education_anticipated_graduation: "",
        education_gpa: ""
      };
    }
    return {
      primary_education: primary,
      education_school: primary.institution || "",
      education_degree: primary.degree || "",
      education_discipline: primary.field || "",
      education_start_year: extractYearFromEducationDate(primary.startDate),
      education_end_year: extractYearFromEducationDate(primary.endDate),
      education_start_month: extractMonthFromEducationDate(primary.startDate),
      education_end_month: extractMonthFromEducationDate(primary.endDate),
      education_anticipated_graduation: primary.endDate || "",
      education_gpa: gpaForGenericScreeningQuestion(educationList) || primary.gpa || ""
    };
  }

  function phoneDigitsOnly(value) {
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function phoneValuesMatch(expected, actual) {
    var want = phoneDigitsOnly(expected);
    var got = phoneDigitsOnly(actual);
    if (!want || !got) return false;
    return want === got || want.endsWith(got) || got.endsWith(want);
  }

  function isProtectedManualTextCue(name, id, ariaLabel, placeholder) {
    var nameId = String(name || "") + " " + String(id || "");
    var aria = String(ariaLabel || "");
    var ph = String(placeholder || "");
    var identity = (nameId + " " + aria + " " + ph).toLowerCase();
    if (identity.indexOf("signature") !== -1) return true;
    var blob = normalizeText(identity);
    if (/\backnowledg(?:e|ement|ment)\b/.test(blob)) return true;
    if (/\battestation\b/.test(blob)) return true;
    return false;
  }

  function isProtectedManualTextField(el) {
    if (!el) return false;
    return isProtectedManualTextCue(
      el.name || (el.getAttribute && el.getAttribute("name")),
      el.id,
      el.getAttribute && el.getAttribute("aria-label"),
      el.placeholder || (el.getAttribute && el.getAttribute("placeholder"))
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
    if (isProtectedManualTextCue(name, id, ariaLabel, placeholder)) {
      return validateDetection({ category: "unknown", confidence: 0.99 }, inputType);
    }
    var questionBlob = normalizeText([label, ariaLabel, name, id].join(" "));
    var fullBlob = normalizeText(
      [label, placeholder, ariaLabel, name, id, nearby, autocomplete].join(" ")
    );
    var optionLabels = meta.optionLabels || [];

   
    if (inputType === "email") {
      return validateDetection({ category: "email", confidence: 0.98 }, inputType);
    }
    if (inputType === "tel") {
      return validateDetection({ category: "phone", confidence: 0.97 }, inputType);
    }

    var ownLabel = normalizeText([label, ariaLabel].join(" "));
    if (isSmartRecruitersApplicationPage()) {
      if (looksLikeSmartRecruitersPrivacyConsent(fullBlob) || looksLikeSmartRecruitersPrivacyConsent(questionBlob)) {
        return validateDetection({ category: "privacy_consent", confidence: 0.98 }, inputType);
      }
      if (
        looksLikeSmartRecruitersEmployeeReferral(fullBlob) ||
        looksLikeSmartRecruitersEmployeeReferral(questionBlob)
      ) {
        return validateDetection({ category: "referral_source", confidence: 0.96 }, inputType);
      }
    }
    if (looksLikeCompanySpecificUserConfirmation(questionBlob) || looksLikeCompanySpecificUserConfirmation(ownLabel)) {
      return validateDetection({ category: "company_specific", confidence: 0.99 }, inputType, optionLabels);
    }
    if (looksLikeExportControlRestrictionQuestion(questionBlob) || looksLikeExportControlRestrictionQuestion(ownLabel)) {
      return validateDetection({ category: "export_control_status", confidence: 0.98 }, inputType, optionLabels);
    }
    if (looksLikeSanctionedCountryFollowUpQuestion(questionBlob) || looksLikeSanctionedCountryFollowUpQuestion(ownLabel)) {
      return validateDetection(
        { category: "sanctioned_country_citizenship", confidence: 0.98 },
        inputType,
        optionLabels
      );
    }
    if (looksLikeSanctionedCountryCitizenshipQuestion(questionBlob) || looksLikeSanctionedCountryCitizenshipQuestion(ownLabel)) {
      return validateDetection(
        { category: "sanctioned_country_citizenship", confidence: 0.99 },
        inputType,
        optionLabels
      );
    }
    if (looksLikeUsImmigrationStatusQuestion(questionBlob) || looksLikeUsImmigrationStatusQuestion(ownLabel)) {
      return validateDetection({ category: "us_immigration_status", confidence: 0.99 }, inputType, optionLabels);
    }
    if (looksLikeEmploymentCountryCitizenshipQuestion(questionBlob) || looksLikeEmploymentCountryCitizenshipQuestion(ownLabel)) {
      return validateDetection(
        { category: "employment_country_citizenship", confidence: 0.99 },
        inputType,
        optionLabels
      );
    }
    if (looksLikeAreasOfInterestQuestion(ownLabel) || looksLikeAreasOfInterestQuestion(questionBlob)) {
      return validateDetection({ category: "areas_of_interest", confidence: 0.97 }, inputType, optionLabels);
    }
    var educationKind = classifyScreeningEducationCategory(ownLabel) || classifyScreeningEducationCategory(questionBlob);
    if (educationKind) {
      return validateDetection({ category: educationKind, confidence: 0.98 }, inputType, optionLabels);
    }
    var ownWebsiteExact = (normalizeText(label) || normalizeText(ariaLabel))
      .replace(/\s*\*+\s*$/g, "")
      .trim();
    if (ownWebsiteExact === "website" || ownWebsiteExact === "personal website") {
      return validateDetection({ category: "portfolio", confidence: 0.96 }, inputType);
    }
    if (/\bstart\s+date\s+month\b/.test(ownLabel) || /\beducation\s+start\s+month\b/.test(ownLabel)) {
      return validateDetection({ category: "education_start_month", confidence: 0.98 }, inputType);
    }
    if (/\bend\s+date\s+month\b/.test(ownLabel) || /\beducation\s+end\s+month\b/.test(ownLabel)) {
      return validateDetection({ category: "education_end_month", confidence: 0.98 }, inputType);
    }
    if (
      /\bgraduation\s+date\b/.test(ownLabel) ||
      /\banticipated\s+graduation\b/.test(ownLabel) ||
      /\bexpected\s+graduation\b/.test(ownLabel)
    ) {
      return validateDetection(
        { category: "education_anticipated_graduation", confidence: 0.98 },
        inputType
      );
    }
    if (looksLikeEducationDateField(ownLabel)) {
      return validateDetection({ category: "education", confidence: 0.98 }, inputType);
    }
    if (looksLikeEducationDateField(questionBlob) || looksLikeEducationDateField(fullBlob)) {
      return validateDetection({ category: "education", confidence: 0.93 }, inputType);
    }

    if (/\bgpa\b/.test(ownLabel) || /\bgrade\s+point\s+average\b/.test(ownLabel)) {
      if (
        /\bundergraduate\b/.test(ownLabel) ||
        /\bundergrad\b/.test(ownLabel) ||
        /\bbachelor/.test(ownLabel)
      ) {
        return validateDetection(
          { category: "education_gpa_undergraduate", confidence: 0.99 },
          inputType
        );
      }
      if (
        /\bdoctorate\b/.test(ownLabel) ||
        /\bdoctoral\b/.test(ownLabel) ||
        /\bphd\b/.test(ownLabel) ||
        /\bph\.d/.test(ownLabel)
      ) {
        return validateDetection(
          { category: "education_gpa_doctorate", confidence: 0.99 },
          inputType
        );
      }
      if (/\bgraduate\b/.test(ownLabel) || /\bmaster/.test(ownLabel)) {
        return validateDetection(
          { category: "education_gpa_graduate", confidence: 0.99 },
          inputType
        );
      }
      return validateDetection({ category: "education_gpa", confidence: 0.98 }, inputType);
    }

    if (looksLikePreferredLocationsQuestion(ownLabel) || looksLikePreferredLocationsQuestion(questionBlob)) {
      return validateDetection({ category: "preferred_locations", confidence: 0.98 }, inputType);
    }

    if (
      (inputType === "checkbox" ||
        inputType === "select" ||
        inputType === "select-multiple") &&
      looksLikePreferredLocationsQuestion(ownLabel)
    ) {
      return validateDetection({ category: "preferred_locations", confidence: 0.98 }, inputType);
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

   
    if (looksLikeProjectHighlight(questionBlob) || looksLikeProjectHighlight(fullBlob)) {
      return validateDetection({ category: "project_highlight", confidence: 0.94 }, inputType);
    }

    if (
      looksLikeReferralSource(ownLabel) ||
      looksLikeReferralSource(questionBlob) ||
      (looksLikeReferralSource(fullBlob) &&
        !looksLikeLinkedInProfileField(ownLabel) &&
        !looksLikeLinkedInProfileField(questionBlob))
    ) {
      return validateDetection({ category: "referral_source", confidence: 0.96 }, inputType);
    }

    
    if (inputType === "url" || inputType === "text" || inputType === "search" || inputType === "textarea") {
      if (looksLikeLinkedInProfileField(ownLabel) || looksLikeLinkedInProfileField(questionBlob)) {
        return validateDetection({ category: "linkedin", confidence: 0.96 }, inputType);
      }
      if (/\blinkedin\b/.test(fullBlob) && !looksLikeReferralSource(fullBlob)) {
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
      if (
        looksLikeReferralSource(ownLabel) ||
        looksLikeReferralSource(questionBlob) ||
        (looksLikeReferralSource(fullBlob) && !looksLikeLinkedInProfileField(ownLabel))
      ) {
        return validateDetection({ category: "referral_source", confidence: 0.96 }, inputType);
      }
      if (/\blinkedin\b/.test(fullBlob) && !looksLikeReferralSource(fullBlob)) {
        return validateDetection({ category: "linkedin", confidence: 0.96 }, inputType);
      }
      if (/\blinkedin\b/.test(questionBlob) && looksLikeLinkedInProfileField(questionBlob)) {
        return validateDetection({ category: "linkedin", confidence: 0.96 }, inputType);
      }
      if (/\bgithub\b/.test(fullBlob)) {
        return validateDetection({ category: "github", confidence: 0.95 }, inputType);
      }
      return validateDetection({ category: "url", confidence: 0.75 }, inputType);
    }

    
    if (
      (/\bhispanic\b/.test(questionBlob) ||
        /\blatino\b/.test(questionBlob) ||
        /\blatina\b/.test(questionBlob) ||
        /\blatinx\b/.test(questionBlob)) &&
      !/\brace\b/.test(questionBlob) &&
      !/\bethnicity\b/.test(questionBlob) &&
      !/\bethnic\b/.test(questionBlob)
    ) {
      return validateDetection(
        { category: "hispanic_latino", confidence: 0.98 },
        inputType,
        optionLabels
      );
    }

    if (/\btransgender\b/.test(questionBlob)) {
      return validateDetection(
        { category: "transgender", confidence: 0.98 },
        inputType,
        optionLabels
      );
    }

    if (
      (/\bsms\b/.test(questionBlob) || /\bwhatsapp\b/.test(questionBlob)) &&
      (/\bcommunications?\b/.test(questionBlob) || /\bmessage\b/.test(questionBlob)) &&
      (/\bselect\s+yes\b/.test(questionBlob) ||
        /\bselect\s+no\b/.test(questionBlob) ||
        /\bopt\s+out\b/.test(questionBlob) ||
        /\bstop\b/.test(questionBlob))
    ) {
      return validateDetection(
        { category: "unknown", confidence: 0.98 },
        inputType,
        optionLabels
      );
    }

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

  function fieldRootNode(el) {
    if (el && typeof el.getRootNode === "function") {
      try {
        return el.getRootNode();
      } catch (_) {}
    }
    return (el && el.ownerDocument) || document;
  }

  function queryLabelByFor(root, id) {
    if (!root || !root.querySelector || !id) return null;
    try {
      return root.querySelector('label[for="' + CSS.escape(id) + '"]');
    } catch (_) {
      try {
        return root.querySelector('label[for="' + String(id).replace(/"/g, '\\"') + '"]');
      } catch (__) {
        return null;
      }
    }
  }

  function getElementByIdInRoot(root, id) {
    if (!root || !id) return null;
    if (typeof root.getElementById === "function") {
      try {
        return root.getElementById(id);
      } catch (_) {}
    }
    if (root.querySelector) {
      try {
        return root.querySelector("#" + CSS.escape(id));
      } catch (_) {}
    }
    return null;
  }

  function findLabelText(el) {
    if (!el) return "";
    var root = fieldRootNode(el);
    var doc = el.ownerDocument || document;
    var byFor;
    var labelledBy;
    var parts;
    if (el.id) {
      byFor = queryLabelByFor(root, el.id) || queryLabelByFor(doc, el.id);
      if (byFor) return trimText(byFor.innerText || byFor.textContent || "");
    }
    var parentLabel = el.closest && el.closest("label");
    if (parentLabel) return trimText(parentLabel.innerText || parentLabel.textContent || "");

    labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledBy) {
      parts = labelledBy.split(/\s+/).map(function (id) {
        var node = getElementByIdInRoot(root, id) || getElementByIdInRoot(doc, id);
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

  function isSmartRecruitersApplicationUrl(href, hostname, pathname) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    var path = String(pathname || "").toLowerCase();
    if (!host || !path) {
      try {
        var parsed = new URL(String(href || ""));
        host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        path = parsed.pathname.toLowerCase();
      } catch (_) {
        return false;
      }
    }
    return host === "jobs.smartrecruiters.com" && path.indexOf("/oneclick-ui/") !== -1;
  }

  function isSmartRecruitersApplicationPage() {
    try {
      if (
        global.ImpulsoSmartRecruitersAdapter &&
        typeof global.ImpulsoSmartRecruitersAdapter.isSupportedPage === "function"
      ) {
        return global.ImpulsoSmartRecruitersAdapter.isSupportedPage();
      }
    } catch (_) {}
    try {
      return isSmartRecruitersApplicationUrl(
        (global.location && global.location.href) || "",
        (global.location && global.location.hostname) || "",
        (global.location && global.location.pathname) || ""
      );
    } catch (_) {
      return false;
    }
  }

  function nearbyParentNode(el) {
    if (!el) return null;
    if (isSmartRecruitersApplicationPage()) return composedParentNode(el);
    return el.parentElement || null;
  }

  function composedParentNode(el) {
    if (!el) return null;
    if (el.parentElement) return el.parentElement;
    try {
      var root = el.getRootNode && el.getRootNode();
      return root && root.host ? root.host : null;
    } catch (_) {
      return null;
    }
  }

  function closestComposed(el, predicate) {
    var node = el;
    var hops = 0;
    while (node && hops < 24) {
      if (predicate(node)) return node;
      node = composedParentNode(node);
      hops += 1;
    }
    return null;
  }

  function looksLikeSmartRecruitersDropzoneChrome(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (/\bchoose a file\b/.test(t)) return true;
    if (/\bdrop (it|files?) here\b/.test(t)) return true;
    if (/\bdrag (and|&) drop\b/.test(t)) return true;
    return false;
  }

  function isSmartRecruitersTopResumeParserControl(el) {
    return Boolean(
      closestComposed(el, function (node) {
        return (
          (node.tagName || "").toLowerCase() === "spl-dropzone" &&
          node.getAttribute &&
          node.getAttribute("data-test") === "apply-with-resume-container"
        );
      })
    );
  }

  function findSmartRecruitersOcResumeUpload(el) {
    return closestComposed(el, function (node) {
      return (node.tagName || "").toLowerCase() === "oc-resume-upload";
    });
  }

  function extractSmartRecruitersResumeSectionLabel(text) {
    var raw = trimText(text);
    var first;
    if (!raw) return "";
    if (/\bcover\s*letter\b/i.test(raw)) return "";
    if (/\bresume\b/i.test(raw) && /\*/.test(raw)) return "Resume *";
    first = trimText(raw.split(/\n+/)[0]);
    if (!first || first.length > 80) return "";
    if (looksLikeSmartRecruitersDropzoneChrome(first)) return "";
    if (!/\bresume\b/i.test(first)) return "";
    return first;
  }

  function findSmartRecruitersResumeQuestionLabel(el) {
    var host = findSmartRecruitersOcResumeUpload(el);
    var extracted;
    var labelled;
    var labelledBy;
    var parts;
    var wrapLabel;
    var node;
    var parent;
    var child;
    var i;
    var hops;
    if (!host) return "";
    labelled = trimText(host.getAttribute && host.getAttribute("aria-label"));
    extracted = extractSmartRecruitersResumeSectionLabel(labelled);
    if (extracted) return extracted;
    labelledBy = host.getAttribute && host.getAttribute("aria-labelledby");
    if (labelledBy) {
      parts = String(labelledBy)
        .split(/\s+/)
        .map(function (id) {
          var labelledNode =
            getElementByIdInRoot(fieldRootNode(host), id) ||
            getElementByIdInRoot(host.ownerDocument || document, id);
          return labelledNode ? trimText(labelledNode.innerText || labelledNode.textContent || "") : "";
        });
      extracted = extractSmartRecruitersResumeSectionLabel(parts.join(" "));
      if (extracted) return extracted;
    }
    wrapLabel = host.closest && host.closest("label");
    if (wrapLabel) {
      extracted = extractSmartRecruitersResumeSectionLabel(wrapLabel.innerText || wrapLabel.textContent);
      if (extracted) return extracted;
    }
    node = host;
    hops = 0;
    while (node && hops < 8) {
      if (node.previousElementSibling) {
        extracted = extractSmartRecruitersResumeSectionLabel(
          node.previousElementSibling.innerText || node.previousElementSibling.textContent
        );
        if (extracted) return extracted;
      }
      parent = composedParentNode(node);
      if (parent && parent.children) {
        for (i = 0; i < parent.children.length; i += 1) {
          child = parent.children[i];
          if (!child || child === node) continue;
          if ((child.tagName || "").toLowerCase() === "oc-resume-upload") continue;
          if ((child.tagName || "").toLowerCase() === "spl-dropzone") continue;
          extracted = extractSmartRecruitersResumeSectionLabel(child.innerText || child.textContent);
          if (extracted) return extracted;
        }
        extracted = extractSmartRecruitersResumeSectionLabel(
          String(parent.innerText || parent.textContent || "").slice(0, 160)
        );
        if (extracted) return extracted;
      }
      node = parent;
      hops += 1;
    }
    return "Resume";
  }

  function readSmartRecruitersAttachedResumeFilenames(el) {
    var host = findSmartRecruitersOcResumeUpload(el);
    var dropzone = null;
    var names = [];
    var nodes = [];
    if (!host) return names;
    try {
      dropzone = host.querySelector && host.querySelector("spl-dropzone");
    } catch (_) {
      dropzone = null;
    }
    if (!dropzone) {
      dropzone = closestComposed(el, function (node) {
        return (node.tagName || "").toLowerCase() === "spl-dropzone";
      });
    }
    if (!dropzone || !dropzone.shadowRoot) return names;
    try {
      nodes = dropzone.shadowRoot.querySelectorAll("ul li span, ul li div, ul li");
    } catch (_) {
      nodes = [];
    }
    Array.prototype.forEach.call(nodes, function (node) {
      var text = trimText(node.innerText || node.textContent || "");
      if (!text || text.length > 180) return;
      if (looksLikeSmartRecruitersDropzoneChrome(text)) return;
      if (names.indexOf(text) === -1) names.push(text);
    });
    return names;
  }

  function looksLikeSmartRecruitersHiringTeamTitle(text) {
    return /\bmessage to the hiring team\b/.test(normalizeText(text));
  }

  function looksLikeSmartRecruitersHiringTeamHelperLabel(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (/\blet the company know\b/.test(t)) return true;
    if (/\binterest working there\b/.test(t)) return true;
    return false;
  }

  function isSmartRecruitersHiringTeamHostChrome(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    var dataTest = el.getAttribute && el.getAttribute("data-test");
    if (tag === "spl-textarea" && (el.id === "hiring-manager-message-input" || dataTest === "hiring-manager-message-text")) {
      return true;
    }
    if (tag === "oc-textarea" && (dataTest === "hiring-manager-message-text" || (el.getAttribute && el.getAttribute("formcontrolname") === "message"))) {
      return true;
    }
    return false;
  }

  function isSmartRecruitersHiringTeamMessageControl(el) {
    if (!el) return false;
    if (isSmartRecruitersHiringTeamHostChrome(el)) return false;
    return Boolean(
      closestComposed(el, function (node) {
        var tag = (node.tagName || "").toLowerCase();
        var dataTest = node.getAttribute && node.getAttribute("data-test");
        var formName = node.getAttribute && node.getAttribute("formcontrolname");
        if (dataTest === "hiring-manager-message-container") return true;
        if (dataTest === "hiring-manager-message-text") return true;
        if (tag === "oc-textarea" && formName === "message") return true;
        if (tag === "spl-textarea" && node.id === "hiring-manager-message-input") return true;
        if (tag === "textarea" && node.id === "hiring-manager-message-input") return true;
        return false;
      })
    );
  }

  function extractSmartRecruitersHiringTeamTitle(text) {
    var raw = trimText(text);
    if (!raw) return "";
    if (!looksLikeSmartRecruitersHiringTeamTitle(raw)) return "";
    return "Message to the Hiring Team";
  }

  function findSmartRecruitersHiringTeamQuestionLabel(el) {
    var node = el;
    var hops = 0;
    var extracted;
    var parent;
    var child;
    var i;
    while (node && hops < 12) {
      extracted = extractSmartRecruitersHiringTeamTitle(
        (node.getAttribute && (node.getAttribute("aria-label") || node.getAttribute("label"))) ||
          node.innerText ||
          node.textContent
      );
      if (extracted) return extracted;
      if (node.previousElementSibling) {
        extracted = extractSmartRecruitersHiringTeamTitle(
          node.previousElementSibling.innerText || node.previousElementSibling.textContent
        );
        if (extracted) return extracted;
      }
      parent = composedParentNode(node);
      if (parent && parent.children) {
        for (i = 0; i < parent.children.length; i += 1) {
          child = parent.children[i];
          if (!child || child === node) continue;
          if (isSmartRecruitersHiringTeamHostChrome(child)) continue;
          extracted = extractSmartRecruitersHiringTeamTitle(child.innerText || child.textContent);
          if (extracted) return extracted;
        }
      }
      node = parent;
      hops += 1;
    }
    return "Message to the Hiring Team";
  }

  var SMARTRECRUITERS_SCREENING_FORM_SELECTOR =
    'sr-screening-questions-form[data-test="screening-questions-form"]';

  function isSmartRecruitersSplRadio(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    return tag === "spl-radio" || role === "radio";
  }

  function readSmartRecruitersSplRadioLabel(el) {
    if (!el) return "";
    return trimText(
      (el.getAttribute && (el.getAttribute("label") || el.getAttribute("aria-label"))) ||
        el.label ||
        el.innerText ||
        el.textContent ||
        ""
    );
  }

  function readSmartRecruitersSplRadioValue(el) {
    if (!el) return "";
    var value = "";
    if (el.getAttribute) value = el.getAttribute("value");
    if (value == null || value === "") value = el.value;
    return trimText(value == null ? "" : value);
  }

  function isSmartRecruitersSplRadioChecked(el) {
    if (!el) return false;
    return normalizeText(el.getAttribute && el.getAttribute("aria-checked")) === "true";
  }

  function findSmartRecruitersScreeningForm(root) {
    var doc = root || document;
    var nodes = [];
    var i;
    var el;
    var dataTest;
    try {
      if (doc.querySelector) {
        el = doc.querySelector(SMARTRECRUITERS_SCREENING_FORM_SELECTOR);
        if (el) return el;
      }
    } catch (_) {}
    try {
      nodes = querySelectorAllDeep(doc, "sr-screening-questions-form");
    } catch (_) {
      nodes = [];
    }
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      dataTest = el && el.getAttribute && el.getAttribute("data-test");
      if (!dataTest || dataTest === "screening-questions-form") return el;
    }
    return nodes[0] || null;
  }

  function isInsideSmartRecruitersScreeningForm(el) {
    return Boolean(
      closestComposed(el, function (node) {
        return (node.tagName || "").toLowerCase() === "sr-screening-questions-form";
      })
    );
  }

  function unescapeScreeningDefinitionText(raw) {
    return String(raw == null ? "" : raw)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function normalizeScreeningQuestionLabel(value) {
    return trimText(String(value == null ? "" : value))
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/[^\w\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isScreeningDefinitionRadioQuestion(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    var type = normalizeText(node.type || node.questionType || node.inputType || node.component || "");
    return type === "radio" || type === "radiogroup" || type === "radio-group" || type === "radiobutton";
  }

  function screeningDefinitionOptionList(node) {
    var fields =
      (node && (node.questionsFields || node.questionFields || node.fields || node.options || node.availableValues)) ||
      [];
    if (!Array.isArray(fields)) return [];
    return fields
      .map(function (field) {
        if (field == null) return null;
        if (typeof field !== "object") {
          return { id: "", label: trimText(field), value: trimText(field) };
        }
        return {
          id: trimText(field.id || field.fieldId || ""),
          label: trimText(field.label || field.name || field.text || field.displayValue || ""),
          value: trimText(
            field.fieldValue != null ? field.fieldValue : field.value != null ? field.value : ""
          )
        };
      })
      .filter(function (opt) {
        return opt && (opt.label || opt.value);
      });
  }

  function normalizeScreeningRadioQuestion(node) {
    return {
      id: trimText((node && (node.id || node.questionId || node.uuid)) || ""),
      type: "radio",
      label: trimText((node && (node.label || node.question || node.title || node.text)) || ""),
      required: Boolean(
        node && (node.required === true || node.required === "true" || node.mandatory === true)
      ),
      diversity: Boolean(node && node.diversity),
      options: screeningDefinitionOptionList(node)
    };
  }

  function collectScreeningRadioQuestionsFromDefinition(data) {
    var out = [];
    function walk(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (isScreeningDefinitionRadioQuestion(node)) {
        out.push(normalizeScreeningRadioQuestion(node));
        walk(node.questions);
        walk(node.screeningQuestions);
        return;
      }
      Object.keys(node).forEach(function (key) {
        if (
          key === "questionsFields" ||
          key === "questionFields" ||
          key === "availableValues" ||
          key === "options"
        ) {
          return;
        }
        walk(node[key]);
      });
    }
    walk(data);
    return out.filter(function (q) {
      return q && q.label;
    });
  }

  function parseSmartRecruitersScreeningDefinition(raw) {
    var text = unescapeScreeningDefinitionText(raw);
    var data;
    if (!trimText(text)) return [];
    try {
      data = JSON.parse(text);
    } catch (_) {
      return [];
    }
    return collectScreeningRadioQuestionsFromDefinition(data);
  }

  function screeningRadioGroupParent(el) {
    return closestComposed(el, function (node) {
      if (node === el) return false;
      var tag = (node.tagName || "").toLowerCase();
      var role = normalizeText(node.getAttribute && node.getAttribute("role"));
      if (role === "radiogroup" || role === "group") return true;
      if (
        tag === "spl-radio-group" ||
        tag === "spl-form-element" ||
        tag === "spl-form-field" ||
        tag === "sr-screening-question"
      ) {
        return true;
      }
      return false;
    });
  }

  function collectRenderedScreeningRadioGroups(host) {
    var root = host && host.shadowRoot ? host.shadowRoot : host;
    var radios = querySelectorAllDeep(root, "spl-radio, [role='radio']").filter(isSmartRecruitersSplRadio);
    var groups = [];
    var seen = [];
    radios.forEach(function (radio) {
      var parent;
      var members;
      if (seen.indexOf(radio) !== -1) return;
      parent = screeningRadioGroupParent(radio);
      members = radios.filter(function (other) {
        if (parent) return screeningRadioGroupParent(other) === parent;
        return other.parentElement === radio.parentElement;
      });
      if (!members.length) members = [radio];
      members.forEach(function (member) {
        if (seen.indexOf(member) === -1) seen.push(member);
      });
      groups.push({ parent: parent || radio.parentElement, radios: members });
    });
    return groups;
  }

  function screeningOptionLabelKey(options) {
    return (options || [])
      .map(function (opt) {
        return normalizeText((opt && (opt.label || opt.value)) || "");
      })
      .filter(Boolean)
      .sort()
      .join("|");
  }

  function nearbyScreeningGroupQuestionText(group) {
    var parent = group && group.parent;
    var text;
    var prev;
    var child;
    var i;
    if (!parent) return "";
    text = trimText(
      parent.getAttribute &&
        (parent.getAttribute("label") || parent.getAttribute("aria-label") || parent.getAttribute("legend"))
    );
    if (text && text.length < 420) return text;
    var slotNodes = querySelectorAllDeep(parent, '[slot="label-content"]');
    if (slotNodes && slotNodes.length) {
      text = trimText(slotNodes[0].innerText || slotNodes[0].textContent || "");
      if (text && text.length < 420) return text;
    }
    prev = parent.previousElementSibling;
    if (prev && !isSmartRecruitersSplRadio(prev)) {
      text = trimText(prev.innerText || prev.textContent || "");
      if (text && text.length < 420) return trimText(text.split("\n")[0]);
    }
    if (parent.children) {
      for (i = 0; i < parent.children.length; i += 1) {
        child = parent.children[i];
        if (!child || isSmartRecruitersSplRadio(child)) continue;
        text = trimText(
          (child.getAttribute && child.getAttribute("label")) || child.innerText || child.textContent || ""
        );
        if (text && text.length < 420) return trimText(text.split("\n")[0]);
      }
    }
    text = trimText(parent.innerText || parent.textContent || "");
    (group.radios || []).forEach(function (radio) {
      var label = readSmartRecruitersSplRadioLabel(radio);
      if (label && text.indexOf(label) !== -1) text = text.replace(label, " ");
    });
    text = trimText(text.split("\n")[0]);
    return text.length && text.length < 420 ? text : "";
  }

  function screeningLabelsAlign(definitionLabel, liveLabel) {
    var a = normalizeScreeningQuestionLabel(definitionLabel);
    var b = normalizeScreeningQuestionLabel(liveLabel);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 80;
    var aWords = a.split(" ").filter(function (w) {
      return w.length > 3;
    });
    var overlap = 0;
    aWords.forEach(function (word) {
      if (b.indexOf(word) !== -1) overlap += 1;
    });
    if (aWords.length && overlap / aWords.length >= 0.7) return 60;
    if (a.slice(0, 48) && a.slice(0, 48) === b.slice(0, 48)) return 50;
    return 0;
  }

  function screeningOptionsAreGenericYesNo(options) {
    var labels = (options || [])
      .map(function (opt) {
        return normalizeText((opt && (opt.label || opt.value)) || "");
      })
      .filter(Boolean);
    var yesNo = labels.filter(function (label) {
      return label === "yes" || label === "no";
    });
    return yesNo.length >= 2 && labels.length <= 4;
  }

  function associateScreeningQuestionsToGroups(questions, groups) {
    var used = [];
    var assigned = [];
    var pairs = [];

    function groupLiveLabel(group) {
      return nearbyScreeningGroupQuestionText(group);
    }

    function groupLiveOptions(group) {
      return ((group && group.radios) || []).map(function (radio) {
        return {
          label: readSmartRecruitersSplRadioLabel(radio),
          value: readSmartRecruitersSplRadioValue(radio)
        };
      });
    }

    function scoreQuestionGroup(question, group) {
      var score = screeningLabelsAlign(question.label, groupLiveLabel(group));
      var liveLabels = groupLiveOptions(group);
      if (
        question.options &&
        question.options.length &&
        screeningOptionLabelKey(question.options) &&
        screeningOptionLabelKey(question.options) === screeningOptionLabelKey(liveLabels)
      ) {
        score += screeningOptionsAreGenericYesNo(question.options) ? 10 : 40;
      }
      return score;
    }

    function uniqueBestIndex(question, minScore) {
      var best = -1;
      var bestScore = 0;
      var ties = 0;
      var gi;
      var score;
      for (gi = 0; gi < (groups || []).length; gi += 1) {
        if (used.indexOf(gi) !== -1) continue;
        score = scoreQuestionGroup(question, groups[gi]);
        if (score > bestScore) {
          bestScore = score;
          best = gi;
          ties = 1;
        } else if (score === bestScore && score > 0) {
          ties += 1;
        }
      }
      if (best >= 0 && bestScore >= minScore && ties === 1) return best;
      return -1;
    }

    (questions || []).forEach(function (question, qi) {
      var best = uniqueBestIndex(question, 80);
      if (best < 0) return;
      used.push(best);
      assigned[qi] = true;
      pairs.push({ question: question, group: groups[best] });
    });

    (questions || []).forEach(function (question, qi) {
      var wantKey;
      var matches;
      var gi;
      if (assigned[qi]) return;
      if (screeningOptionsAreGenericYesNo(question.options)) return;
      wantKey = screeningOptionLabelKey(question.options);
      if (!wantKey) return;
      matches = [];
      for (gi = 0; gi < (groups || []).length; gi += 1) {
        if (used.indexOf(gi) !== -1) continue;
        if (screeningOptionLabelKey(groupLiveOptions(groups[gi])) === wantKey) matches.push(gi);
      }
      if (matches.length !== 1) return;
      used.push(matches[0]);
      assigned[qi] = true;
      pairs.push({ question: question, group: groups[matches[0]] });
    });

    (questions || []).forEach(function (question, qi) {
      var remainingQuestions;
      var remainingGroups;
      var gi;
      if (assigned[qi]) return;
      remainingQuestions = 0;
      remainingGroups = [];
      (questions || []).forEach(function (other, otherIndex) {
        if (!assigned[otherIndex]) remainingQuestions += 1;
      });
      for (gi = 0; gi < (groups || []).length; gi += 1) {
        if (used.indexOf(gi) === -1) remainingGroups.push(gi);
      }
      if (remainingQuestions !== 1 || remainingGroups.length !== 1) return;
      if (scoreQuestionGroup(question, groups[remainingGroups[0]]) < 50) return;
      used.push(remainingGroups[0]);
      assigned[qi] = true;
      pairs.push({ question: question, group: groups[remainingGroups[0]] });
    });

    return pairs;
  }

  function looksLikeDeclineToAnswer(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (/\bprefer not to (say|answer|disclose|self[- ]identify)\b/.test(t)) return true;
    if (/\bi don['’]?t wish to answer\b/.test(t)) return true;
    if (/\bdecline to (answer|self[- ]identify|identify)\b/.test(t)) return true;
    return false;
  }

  function yesNoPolarity(text) {
    var t = normalizeText(text);
    if (!t || looksLikeDeclineToAnswer(t)) return "";
    if (/^yes\b/.test(t)) return "yes";
    if (/^no\b/.test(t) || /^no,/.test(t)) return "no";
    return "";
  }

  function screeningRadioOptionMatches(savedAnswer, optionLabel) {
    var savedN = normalizeText(savedAnswer);
    var optN = normalizeText(optionLabel);
    var savedPol;
    var optPol;
    if (!savedN || !optN) return false;
    if (looksLikeDeclineToAnswer(optN)) return looksLikeDeclineToAnswer(savedN);
    if (looksLikeDeclineToAnswer(savedN)) return false;
    if (savedN === optN) return true;
    savedPol = yesNoPolarity(savedN);
    optPol = yesNoPolarity(optN);
    if (savedPol && optPol) return savedPol === optPol;
    if (savedPol === "no" && /\bnot a protected veteran\b/.test(optN)) return true;
    if (savedPol === "yes" && /^i am a protected veteran$/.test(optN)) return true;
    if (savedN.length >= 10 && (optN.indexOf(savedN) !== -1 || savedN.indexOf(optN) !== -1)) return true;
    return false;
  }

  function matchSmartRecruitersScreeningRadioOption(savedAnswer, options) {
    var saved = trimText(savedAnswer);
    var hits;
    if (!saved || saved === NO_SAVED_ANSWER) return null;
    hits = (options || []).filter(function (opt) {
      return screeningRadioOptionMatches(saved, opt && (opt.label || opt.value));
    });
    if (hits.length !== 1) return null;
    return hits[0];
  }

  function collectSmartRecruitersScreeningRadioUnits(root) {
    var host = findSmartRecruitersScreeningForm(root);
    var questions;
    var groups;
    var pairs;
    var pairedGroups = [];
    var units = [];
    if (!host) return units;
    questions = parseSmartRecruitersScreeningQuestions(host.getAttribute && host.getAttribute("definition")).filter(
      function (question) {
        return screeningDefinitionQuestionKind(question) === "radio";
      }
    );
    if (!questions.length) {
      questions = parseSmartRecruitersScreeningDefinition(host.getAttribute && host.getAttribute("definition"));
    }
    groups = collectRenderedScreeningRadioGroups(host);
    pairs = associateScreeningQuestionsToGroups(questions, groups);
    pairs.forEach(function (pair) {
      var question = pair.question;
      var radios = (pair.group && pair.group.radios) || [];
      if (!radios.length) return;
      pairedGroups.push(pair.group);
      units.push({
        kind: "radio-group",
        elements: radios,
        groupKey: "sr-screening:" + (question.id || hashString(question.label)),
        inputType: "radio",
        screening: {
          questionId: question.id,
          label: question.label,
          required: question.required,
          diversity: question.diversity,
          options: question.options
        }
      });
    });
    groups.forEach(function (group) {
      var radios;
      var liveLabel;
      if (!group || pairedGroups.indexOf(group) !== -1) return;
      radios = group.radios || [];
      if (!radios.length) return;
      liveLabel = nearbyScreeningGroupQuestionText(group);
      units.push({
        kind: "radio-group",
        elements: radios,
        groupKey: "sr-screening-live:" + hashString(liveLabel || radios.length),
        inputType: "radio",
        screening: {
          questionId: "",
          label: liveLabel,
          required: false,
          diversity: false,
          options: radios.map(function (radio) {
            return {
              id: "",
              label: readSmartRecruitersSplRadioLabel(radio),
              value: readSmartRecruitersSplRadioValue(radio)
            };
          })
        }
      });
    });
    return units;
  }

  function parseSmartRecruitersScreeningDefinitionJson(raw) {
    var text = unescapeScreeningDefinitionText(raw);
    if (!trimText(text)) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function isScreeningDefinitionQuestionNode(node) {
    var type;
    var label;
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    label = trimText(node.label || node.question || node.title || node.text || "");
    if (!label) return false;
    type = trimText(node.type || node.questionType || node.inputType || node.component || "");
    if (type) return true;
    if (node.diversity) return true;
    if (Array.isArray(node.questionsFields) || Array.isArray(node.questionFields)) return true;
    return false;
  }

  function normalizeScreeningDefinitionQuestion(node) {
    var fields =
      (node && (node.questionsFields || node.questionFields || node.fields || node.options)) || [];
    var multipleChoice = Boolean(
      node &&
        (node.multipleChoice === true ||
          node.multipleChoice === "true" ||
          (fields[0] && typeof fields[0] === "object" && fields[0].multipleChoice === true))
    );
    return {
      id: trimText((node && (node.id || node.questionId || node.uuid)) || ""),
      type: trimText((node && (node.type || node.questionType || node.inputType || node.component)) || ""),
      label: trimText((node && (node.label || node.question || node.title || node.text)) || ""),
      required: Boolean(node && (node.required === true || node.required === "true" || node.mandatory === true)),
      diversity: Boolean(node && node.diversity),
      multipleChoice: multipleChoice,
      options: screeningDefinitionOptionList(node)
    };
  }

  function collectScreeningDefinitionQuestions(data) {
    var out = [];
    function walk(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (isScreeningDefinitionQuestionNode(node)) {
        out.push(normalizeScreeningDefinitionQuestion(node));
        walk(node.questions);
        walk(node.screeningQuestions);
        return;
      }
      Object.keys(node).forEach(function (key) {
        if (
          key === "questionsFields" ||
          key === "questionFields" ||
          key === "availableValues" ||
          key === "options" ||
          key === "fields"
        ) {
          return;
        }
        walk(node[key]);
      });
    }
    walk(data);
    return out.filter(function (q) {
      return q && q.label;
    });
  }

  function parseSmartRecruitersScreeningQuestions(raw) {
    var data = parseSmartRecruitersScreeningDefinitionJson(raw);
    if (!data) return [];
    return collectScreeningDefinitionQuestions(data);
  }

  function screeningDefinitionQuestionKind(question) {
    var blob;
    var type;
    if (!question) return "";
    blob = normalizeText(question.label || "");
    type = normalizeText(question.type || "");
    if (looksLikeSmartRecruitersPrivacyConsent(blob)) return "privacy_consent";
    if (looksLikeSmartRecruitersEmployeeReferral(blob)) return "referral";
    if (type === "info" || type === "information" || type === "instruction") return "info";
    if (/\brace\/ethnicity\b/.test(blob) || /\bethnicity\b/.test(blob)) return "ethnicity";
    if (/\brace\b/.test(blob) && !/\bgender\b/.test(blob) && !/\bhispanic\b/.test(blob) && !/\blatin/.test(blob)) {
      return "ethnicity";
    }
    if (/\bgender\b/.test(blob)) return "gender";
    if (isScreeningDefinitionRadioQuestion({ type: question.type })) return "radio";
    if (
      type === "radio" ||
      type === "radiogroup" ||
      type === "radio-group" ||
      type === "radiobutton" ||
      type === "choice" ||
      type === "boolean" ||
      type === "yesno"
    ) {
      return "radio";
    }
    if (
      question.multipleChoice ||
      type === "multiselect" ||
      type === "multi-select" ||
      type === "multiselectautocomplete" ||
      type === "multi_select"
    ) {
      return "multiselect";
    }
    if (
      type === "text" ||
      type === "textarea" ||
      type === "string" ||
      type === "input" ||
      type === "textbox"
    ) {
      return "text";
    }
    if (
      type === "autocomplete" ||
      type === "select" ||
      type === "dropdown" ||
      type === "combobox" ||
      type === "single-select" ||
      type === "singleselect"
    ) {
      return "autocomplete";
    }
    if (type === "checkbox" || type === "boolean") return "checkbox";
    return type || "text";
  }

  function findSmartRecruitersNestedEditableControl(host, kinds) {
    var want = kinds || ["combobox", "text", "checkbox"];
    var nodes;
    var i;
    var el;
    var tag;
    var type;
    var role;
    if (!host) return null;
    nodes = querySelectorAllDeep(
      host,
      "input, textarea, [role='combobox'], [role='textbox'], [role='checkbox'], spl-checkbox"
    );
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || el.isConnected === false) continue;
      tag = (el.tagName || "").toLowerCase();
      type = normalizeText(el.type || (el.getAttribute && el.getAttribute("type")) || "");
      role = normalizeText(el.getAttribute && el.getAttribute("role"));
      if (type === "hidden" || type === "file" || type === "submit" || type === "button") continue;
      if (want.indexOf("combobox") !== -1 && (role === "combobox" || type === "combobox")) return el;
      if (want.indexOf("checkbox") !== -1 && (type === "checkbox" || role === "checkbox" || tag === "spl-checkbox")) {
        return el;
      }
      if (want.indexOf("text") !== -1 && role !== "combobox" && type !== "checkbox" && tag !== "spl-checkbox") {
        return el;
      }
    }
    return null;
  }

  function findSmartRecruitersAutocompleteHost(scope, dataTest) {
    var want = trimText(dataTest);
    var nodes;
    var i;
    var el;
    if (!scope || !want) return null;
    nodes = querySelectorAllDeep(scope, "spl-autocomplete, [data-test='" + want + "']");
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || el.isConnected === false) continue;
      if (trimText(el.getAttribute && el.getAttribute("data-test")) === want) return el;
    }
    return null;
  }

  function readSmartRecruitersOcConsentLabel(root) {
    var win;
    var ctx;
    var configs;
    var i;
    var label;
    try {
      win = (root && (root.defaultView || root.parentWindow)) || global;
    } catch (_) {
      win = global;
    }
    ctx = win && win.__OC_CONTEXT__;
    configs = ctx && ctx.consent && ctx.consent.consentScopeConfigs;
    if (!Array.isArray(configs)) return "";
    for (i = 0; i < configs.length; i += 1) {
      label = trimText(
        (configs[i] &&
          (configs[i].label || configs[i].text || configs[i].title || configs[i].consentLabel)) ||
          ""
      );
      if (looksLikeSmartRecruitersPrivacyConsent(label)) return label;
    }
    for (i = 0; i < configs.length; i += 1) {
      if (!configs[i]) continue;
      if (configs[i].required === true || configs[i].checkboxRequired === true) {
        label = trimText(configs[i].label || configs[i].text || configs[i].title || "");
        if (label && label !== "*") return label;
      }
    }
    return "";
  }

  function composedSmartRecruitersConsentLabel(el, root) {
    var aria = trimText(el && el.getAttribute && el.getAttribute("aria-label"));
    var hostLabel = trimText(el && el.getAttribute && el.getAttribute("label"));
    var nearby = trimText(nearbyQuestionText(el));
    var parent = el && (el.parentElement || el.parentNode);
    var parentText = "";
    var oc = readSmartRecruitersOcConsentLabel(root);
    var hops = 0;
    if (aria && aria !== "*") return aria;
    if (hostLabel && hostLabel !== "*") return hostLabel;
    if (looksLikeSmartRecruitersPrivacyConsent(nearby)) return nearby.split("\n")[0];
    if (looksLikeSmartRecruitersPrivacyConsent(oc)) return oc;
    while (parent && hops < 6) {
      parentText = trimText(parent.innerText || parent.textContent || "");
      if (looksLikeSmartRecruitersPrivacyConsent(parentText)) {
        return trimText(parentText.split("\n").filter(Boolean)[0] || parentText).slice(0, 420);
      }
      parent = parent.parentElement || parent.parentNode || (parent.host ? parent.host.parentElement : null);
      hops += 1;
    }
    if (oc && oc !== "*") return oc;
    if (nearby && nearby !== "*") return nearby.split("\n")[0];
    return "";
  }

  function findSmartRecruitersPrivacyConsentControl(root) {
    var doc = root || document;
    var nodes = querySelectorAllDeep(doc, "spl-checkbox, input[type='checkbox'], [role='checkbox']");
    var i;
    var el;
    var label;
    var oc = readSmartRecruitersOcConsentLabel(doc);
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || el.isConnected === false) continue;
      label = composedSmartRecruitersConsentLabel(el, doc);
      if (!looksLikeSmartRecruitersPrivacyConsent(label) && !looksLikeSmartRecruitersPrivacyConsent(oc)) {
        continue;
      }
      if (!label && looksLikeSmartRecruitersPrivacyConsent(oc)) label = oc;
      if (!label || label === "*") continue;
      return {
        element: el,
        label: label,
        required: true
      };
    }
    return null;
  }

  function screeningQuestionHostId(questionId) {
    var id = trimText(questionId);
    return id ? "question_" + id : "";
  }

  function findScreeningControlByQuestionId(scope, questionId) {
    var want = screeningQuestionHostId(questionId);
    var nodes;
    var i;
    var el;
    var id;
    if (!scope || !want) return null;
    nodes = querySelectorAllDeep(
      scope,
      "spl-input, spl-autocomplete, spl-multiselect-autocomplete, [data-spl-field], [id]"
    );
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || el.isConnected === false) continue;
      id = trimText((el.id || (el.getAttribute && el.getAttribute("id"))) || "");
      if (id === want) return el;
    }
    return null;
  }

  function screeningControlKindFromHost(el, questionKind) {
    var tag = ((el && el.tagName) || "").toLowerCase();
    if (tag === "spl-multiselect-autocomplete") return "multiselect";
    if (tag === "spl-autocomplete") return "autocomplete";
    if (tag === "spl-input") return "text";
    if (tag === "spl-radio-group") return "radio";
    if (questionKind === "multiselect" || questionKind === "autocomplete" || questionKind === "text" || questionKind === "radio") {
      return questionKind;
    }
    return questionKind || "text";
  }

  function readSmartRecruitersMultiselectValue(host) {
    var chips;
    var labels;
    var text;
    if (!host) return "";
    chips = querySelectorAllDeep(host, "spl-chip, [data-test*='chip'], [class*='chip']");
    labels = (chips || [])
      .map(function (el) {
        return trimText(el.innerText || el.textContent || (el.getAttribute && el.getAttribute("label")) || "");
      })
      .filter(Boolean);
    if (labels.length) return labels.join(", ");
    text = trimText(host.innerText || host.textContent || "");
    return text;
  }

  function classifyDefinitionQuestionCategory(question, kind, optionLabels) {
    var detected;
    if (kind === "gender") return "gender";
    if (kind === "ethnicity") return "race_ethnicity";
    if (kind === "referral") return "referral_source";
    if (kind === "privacy_consent") return "privacy_consent";
    detected = detectCategoryFromMeta({
      tagName: kind === "radio" ? "input" : "input",
      inputType:
        kind === "radio"
          ? "radio"
          : kind === "multiselect"
            ? "select-multiple"
            : kind === "autocomplete"
              ? "select"
              : "text",
      type: kind === "radio" ? "radio" : "text",
      label: (question && question.label) || "",
      ariaLabel: (question && question.label) || "",
      name: "",
      id: (question && question.id) || "",
      nearby: "",
      autocomplete: "",
      optionLabels: optionLabels || (question && question.options
        ? question.options.map(function (opt) {
            return opt.label || opt.value;
          })
        : [])
    });
    return (detected && detected.category) || "unknown";
  }

  function parentRadioValueForQuestion(questions, index, radioById) {
    var i;
    var prev;
    var unit;
    var selected;
    for (i = index - 1; i >= 0; i -= 1) {
      prev = questions[i];
      if (!prev || normalizeText(prev.type) === "info") continue;
      unit = radioById[prev.id];
      if (!unit) return { parent: prev, value: "", answered: false };
      selected = (unit.elements || []).filter(isSmartRecruitersSplRadioChecked);
      if (selected.length === 1) {
        return {
          parent: prev,
          value: readSmartRecruitersSplRadioLabel(selected[0]),
          answered: true
        };
      }
      return { parent: prev, value: "", answered: false };
    }
    return null;
  }

  function looksLikeConditionalDetailQuestion(label) {
    var blob = normalizeText(label);
    if (!blob) return false;
    if (/\bif yes\b/.test(blob) && (/\bprevious\b/.test(blob) || /\bexplain\b/.test(blob) || /\bprovide\b/.test(blob))) {
      return true;
    }
    if (/\bplease (list|explain|describe|provide|enter|specify)\b/.test(blob) && /\bname\b/.test(blob)) return true;
    if (/\bplease (list|explain|describe|provide|enter|specify)\b/.test(blob)) return true;
    if (/\bdetails?\b/.test(blob) && (/\brelationship\b/.test(blob) || /\bconflict\b/.test(blob))) return true;
    return looksLikeSanctionedCountryFollowUpQuestion(blob);
  }

  function applyScreeningConditionalState(questions, units, radioById) {
    var byId = {};
    units.forEach(function (unit) {
      var id = unit && unit.screening && unit.screening.questionId;
      if (id) byId[id] = unit;
    });
    (questions || []).forEach(function (question, index) {
      var unit = byId[question.id];
      var parentInfo;
      var parentUnit;
      var parentYes;
      if (!unit || !unit.screening) return;
      if (!looksLikeConditionalDetailQuestion(question.label)) return;
      parentInfo = parentRadioValueForQuestion(questions, index, radioById);
      if (!parentInfo || !parentInfo.parent) return;
      parentUnit = byId[parentInfo.parent.id];
      parentYes = /\byes\b/i.test(parentInfo.value);
      if (parentUnit && parentUnit.screening && parentUnit.screening.category === "company_specific") {
        unit.screening.category = "company_specific";
        if (!parentInfo.answered) {
          unit.screening.conditionalState = "blocked";
          unit.screening.skipped = true;
          unit.screening.actionHint = "Blocked by parent confirmation";
          unit.screening.required = false;
        } else if (!parentYes) {
          unit.screening.conditionalState = "not_applicable";
          unit.screening.skipped = true;
          unit.screening.actionHint = "Conditionally not applicable";
          unit.screening.required = false;
        }
        return;
      }
      if (looksLikeSanctionedCountryFollowUpQuestion(question.label) ||
          (parentInfo.parent && looksLikeSanctionedCountryCitizenshipQuestion(parentInfo.parent.label))) {
        if (!parentInfo.answered) {
          unit.screening.conditionalState = "blocked";
          unit.screening.skipped = true;
          unit.screening.actionHint = "Blocked by parent confirmation";
          unit.screening.required = false;
        } else if (!parentYes) {
          unit.screening.conditionalState = "not_applicable";
          unit.screening.skipped = true;
          unit.screening.actionHint = "Conditionally not applicable";
          unit.screening.required = false;
        }
      }
    });
  }

  function collectSmartRecruitersScreeningLogicalUnits(root) {
    var doc = root || document;
    var host = findSmartRecruitersScreeningForm(doc);
    var units = [];
    var seen = [];
    var radioUnits;
    var radioById = {};
    var radioByLabel = {};
    var usedRadios = [];
    var questions;
    var consent;
    var genderHost;
    var ethnicityHost;
    var genderInput;
    var ethnicityInput;
    var referralInput;

    function remember(el) {
      if (el && seen.indexOf(el) === -1) seen.push(el);
    }

    function already(el) {
      return Boolean(el && seen.indexOf(el) !== -1);
    }

    function pushSingle(el, screening) {
      if (!el || already(el)) return;
      remember(el);
      units.push({
        kind: "single",
        elements: [el],
        screening: screening || null
      });
    }

    function screeningPayload(question, kind, extra) {
      var optionLabels = ((question && question.options) || []).map(function (opt) {
        return opt.label || opt.value;
      });
      var category = classifyDefinitionQuestionCategory(question, kind, optionLabels);
      var payload = Object.assign(
        {
          questionId: (question && question.id) || "",
          label: (question && question.label) || "",
          required: Boolean(question && question.required),
          diversity: Boolean(question && question.diversity),
          kind: kind,
          category: category,
          options: (question && question.options) || [],
          multipleChoice: kind === "multiselect"
        },
        extra || {}
      );
      if (category === "company_specific") {
        payload.skipped = true;
        payload.actionHint = "User confirmation required";
        payload.required = Boolean(question && question.required);
      }
      if (kind === "gender" || kind === "ethnicity") {
        payload.required = question && question.required !== false;
      }
      if (kind === "privacy_consent") payload.required = true;
      return payload;
    }

    if (!host || host.isConnected === false) return units;

    radioUnits = collectSmartRecruitersScreeningRadioUnits(doc);
    radioUnits.forEach(function (unit) {
      var screening = unit.screening || {};
      if (screening.questionId) radioById[screening.questionId] = unit;
      if (screening.label) radioByLabel[normalizeScreeningQuestionLabel(screening.label)] = unit;
    });

    questions = parseSmartRecruitersScreeningQuestions(host.getAttribute && host.getAttribute("definition"));
    questions.forEach(function (question) {
      var kind = screeningDefinitionQuestionKind(question);
      var radio = radioById[question.id] || radioByLabel[normalizeScreeningQuestionLabel(question.label)];
      var controlHost;
      var input;
      var controlKind;
      if (kind === "info") return;
      if (kind === "radio") {
        if (radio && usedRadios.indexOf(radio) === -1) {
          usedRadios.push(radio);
          (radio.elements || []).forEach(remember);
          radio.screening = Object.assign({}, radio.screening || {}, screeningPayload(question, "radio"));
          units.push(radio);
        }
        return;
      }
      controlHost = findScreeningControlByQuestionId(host, question.id);
      if (kind === "gender" && !controlHost) {
        controlHost = findSmartRecruitersAutocompleteHost(host, "question-eeo-gender-select");
      }
      if (kind === "ethnicity" && !controlHost) {
        controlHost = findSmartRecruitersAutocompleteHost(host, "question-eeo-ethnicity-select");
      }
      if ((kind === "referral" || looksLikeSmartRecruitersEmployeeReferral(question.label)) && !controlHost) {
        input = findSmartRecruitersReferralInput(host, seen);
        if (input) {
          pushSingle(input, screeningPayload(question, "referral"));
        }
        return;
      }
      if (kind === "privacy_consent") {
        consent = findSmartRecruitersPrivacyConsentControl(doc);
        if (consent && consent.element) {
          pushSingle(
            consent.element,
            screeningPayload(question, "privacy_consent", { label: consent.label || question.label })
          );
        }
        return;
      }
      if (!controlHost) return;
      controlKind = screeningControlKindFromHost(controlHost, kind);
      if (controlKind === "autocomplete" || controlKind === "multiselect" || kind === "gender" || kind === "ethnicity") {
        input = findSmartRecruitersNestedEditableControl(controlHost, ["combobox", "text"]);
        if (input) {
          remember(controlHost);
          pushSingle(
            input,
            screeningPayload(question, kind === "gender" || kind === "ethnicity" ? kind : controlKind, {
              hostId: screeningQuestionHostId(question.id)
            })
          );
        }
        return;
      }
      input = findSmartRecruitersNestedEditableControl(controlHost, ["text", "combobox"]);
      if (input) {
        remember(controlHost);
        pushSingle(
          input,
          screeningPayload(question, controlKind === "text" ? "text" : kind, {
            hostId: screeningQuestionHostId(question.id)
          })
        );
      }
    });

    radioUnits.forEach(function (unit) {
      if (usedRadios.indexOf(unit) !== -1) return;
      (unit.elements || []).forEach(remember);
      if (unit.screening && unit.screening.label) {
        unit.screening.category = classifyDefinitionQuestionCategory(
          {
            id: unit.screening.questionId,
            label: unit.screening.label,
            options: unit.screening.options
          },
          "radio"
        );
        if (unit.screening.category === "company_specific") {
          unit.screening.skipped = true;
          unit.screening.actionHint = "User confirmation required";
        }
      }
      units.push(unit);
    });

    genderHost = findSmartRecruitersAutocompleteHost(host, "question-eeo-gender-select");
    genderInput = findSmartRecruitersNestedEditableControl(genderHost, ["combobox", "text"]);
    if (genderInput && !already(genderInput)) {
      pushSingle(genderInput, {
        questionId: "",
        label: "Gender",
        required: true,
        kind: "gender",
        category: "gender"
      });
    }

    ethnicityHost = findSmartRecruitersAutocompleteHost(host, "question-eeo-ethnicity-select");
    ethnicityInput = findSmartRecruitersNestedEditableControl(ethnicityHost, ["combobox", "text"]);
    if (ethnicityInput && !already(ethnicityInput)) {
      pushSingle(ethnicityInput, {
        questionId: "",
        label: "Race/Ethnicity",
        required: true,
        kind: "ethnicity",
        category: "race_ethnicity"
      });
    }

    referralInput = findSmartRecruitersReferralInput(host, seen);
    if (referralInput && !already(referralInput)) {
      pushSingle(referralInput, {
        questionId: "",
        label: collectContext(referralInput).label || "Employee referral",
        required: false,
        kind: "referral",
        category: "referral_source"
      });
    }

    if (!units.some(function (unit) { return unit.screening && unit.screening.kind === "privacy_consent"; })) {
      consent = findSmartRecruitersPrivacyConsentControl(doc);
      if (consent && consent.element && !already(consent.element)) {
        pushSingle(consent.element, {
          questionId: "",
          label: consent.label,
          required: true,
          kind: "privacy_consent",
          category: "privacy_consent"
        });
      }
    }

    applyScreeningConditionalState(questions, units, radioById);
    return units;
  }

  function screeningDemographicKindFromPlaceholder(el) {
    var blob = normalizeText(
      [
        el && el.getAttribute && el.getAttribute("placeholder"),
        el && el.getAttribute && el.getAttribute("aria-label"),
        el && el.getAttribute && el.getAttribute("label")
      ].join(" ")
    );
    if (/\brace\/ethnicity\b/.test(blob) || /\bethnicity\b/.test(blob)) return "ethnicity";
    if (/\bgender\b/.test(blob)) return "gender";
    return "";
  }

  function findSmartRecruitersReferralInput(host, seen) {
    var nodes;
    var i;
    var el;
    var ctx;
    var blob;
    nodes = querySelectorAllDeep(host, "input, textarea, [role='textbox']");
    for (i = 0; i < nodes.length; i += 1) {
      el = nodes[i];
      if (!el || el.isConnected === false) continue;
      if (seen && seen.indexOf(el) !== -1) continue;
      if (normalizeText(el.getAttribute && el.getAttribute("role")) === "combobox") continue;
      if (screeningDemographicKindFromPlaceholder(el)) continue;
      ctx = collectContext(el);
      blob = [ctx.label, ctx.ariaLabel, ctx.placeholder, ctx.nearby, ctx.blob].join(" ");
      if (looksLikeSmartRecruitersEmployeeReferral(blob) || looksLikeSmartRecruitersEmployeeReferral(ctx.label)) {
        return el;
      }
    }
    return null;
  }

  function shortHostLabelText(host) {
    var text;
    var child;
    var i;
    if (!host) return "";
    text = trimText((host.getAttribute && host.getAttribute("aria-label")) || "");
    if (text) return text;
    if (host.children && host.children.length) {
      for (i = 0; i < host.children.length; i += 1) {
        child = host.children[i];
        if (!child || child === host) continue;
        if (child.querySelector && child.querySelector("input, textarea, select, [role='combobox']")) continue;
        text = trimText(child.innerText || child.textContent || "");
        if (text && text.length < 120) return text;
      }
    }
    text = trimText(host.innerText || host.textContent || "");
    if (text && text.length < 80) return text;
    return "";
  }

  function findSmartRecruitersHostLabel(el) {
    var host = el;
    var hops = 0;
    var root;
    var text;
    var labelledBy;
    var parts;
    var resumeLabel;
    if (((el && el.type) || "").toLowerCase() === "file" && findSmartRecruitersOcResumeUpload(el)) {
      resumeLabel = findSmartRecruitersResumeQuestionLabel(el);
      if (resumeLabel) return resumeLabel;
    }
    while (host && hops < 8) {
      root = fieldRootNode(host);
      if (!root || !root.host) break;
      host = root.host;
      text = shortHostLabelText(host);
      if (text && !looksLikeSmartRecruitersDropzoneChrome(text)) return text;
      labelledBy = host.getAttribute && host.getAttribute("aria-labelledby");
      if (labelledBy) {
        parts = labelledBy.split(/\s+/).map(function (id) {
          var node = getElementByIdInRoot(root, id) || getElementByIdInRoot(host.ownerDocument || document, id);
          return node ? trimText(node.innerText || node.textContent || "") : "";
        });
        text = trimText(parts.join(" "));
        if (text && !looksLikeSmartRecruitersDropzoneChrome(text)) return text;
      }
      hops += 1;
    }
    return "";
  }

  function querySelectorAllDeep(root, selector) {
    var out = [];
    var seen = [];
    var walked = [];
    function addMatch(node) {
      if (!node || seen.indexOf(node) !== -1) return;
      seen.push(node);
      out.push(node);
    }
    function walk(ctx) {
      var list;
      var all;
      if (!ctx || walked.indexOf(ctx) !== -1) return;
      walked.push(ctx);
      if (ctx.shadowRoot && walked.indexOf(ctx.shadowRoot) === -1) walk(ctx.shadowRoot);
      try {
        list = ctx.querySelectorAll ? ctx.querySelectorAll(selector) : [];
      } catch (_) {
        list = [];
      }
      Array.prototype.forEach.call(list, addMatch);
      try {
        all = ctx.querySelectorAll ? ctx.querySelectorAll("*") : [];
      } catch (_) {
        all = [];
      }
      Array.prototype.forEach.call(all, function (el) {
        if (el && el.shadowRoot) walk(el.shadowRoot);
        if (el && (el.tagName || "").toLowerCase() === "iframe") {
          try {
            if (el.contentDocument) walk(el.contentDocument);
          } catch (_) {}
        }
      });
    }
    walk(root && root.nodeType === 9 ? root : root);
    if (root && root.documentElement) walk(root.documentElement);
    return out;
  }

  var SCAN_CONTROL_SELECTOR =
    "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='combobox'], [role='listbox'], [role='textbox']";
  var SMARTRECRUITERS_SCAN_CONTROL_SELECTOR =
    SCAN_CONTROL_SELECTOR + ", [role='searchbox']";

  function collectScanControlNodes(doc) {
    if (isSmartRecruitersApplicationPage()) {
      return querySelectorAllDeep(doc, SMARTRECRUITERS_SCAN_CONTROL_SELECTOR);
    }
    return Array.prototype.slice.call(doc.querySelectorAll(SCAN_CONTROL_SELECTOR));
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
        var node =
          getElementByIdInRoot(fieldRootNode(el), id) ||
          getElementByIdInRoot(el.ownerDocument || document, id);
        return node ? trimText(node.innerText || node.textContent || "") : "";
      });
      var ariaText = trimText(parts.join(" "));
      if (ariaText && !isLikelyOptionCluster(ariaText, optionTexts)) return ariaText;
    }

    var parent = nearbyParentNode(el);
    var hops = 0;
    while (parent && hops < 5) {
      var prev = parent.previousElementSibling;
      if (prev) {
        var prevText = trimText(prev.innerText || prev.textContent || "");
        if (
          prevText &&
          prevText.length < 220 &&
          !isLikelyOptionCluster(prevText, optionTexts) &&
          !(isSmartRecruitersApplicationPage() && looksLikeSmartRecruitersDropzoneChrome(prevText))
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
          !isLikelyOptionCluster(headingText, optionTexts) &&
          !(isSmartRecruitersApplicationPage() && looksLikeSmartRecruitersDropzoneChrome(headingText))
        ) {
          return headingText;
        }
      }
      if (parent.getAttribute && parent.getAttribute("role") === "group") {
        var groupLabel = trimText(parent.getAttribute("aria-label") || "");
        if (groupLabel) return groupLabel;
      }
      parent = nearbyParentNode(parent);
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
    var srResumeHost = isSmartRecruitersApplicationPage() && findSmartRecruitersOcResumeUpload(el);
    var srResumeLabel = "";
    var placeholder;
    var ariaLabel;
    var name;
    var id;
    var title;
    var autocomplete;
    var nearby;
    var role;
    var blob;
    var srHiringHost = isSmartRecruitersApplicationPage() && isSmartRecruitersHiringTeamMessageControl(el);
    var srHiringLabel = "";
    if (srResumeHost && ((el.type || "").toLowerCase() === "file")) {
      srResumeLabel = findSmartRecruitersResumeQuestionLabel(el);
      if (srResumeLabel && (!label || looksLikeSmartRecruitersDropzoneChrome(label))) {
        label = srResumeLabel;
      }
    }
    if (srHiringHost) {
      srHiringLabel = findSmartRecruitersHiringTeamQuestionLabel(el);
      if (srHiringLabel && (!label || looksLikeSmartRecruitersHiringTeamHelperLabel(label))) {
        label = srHiringLabel;
      }
    }
    if (!label && isSmartRecruitersApplicationPage()) {
      label = findSmartRecruitersHostLabel(el);
    }
    placeholder = trimText(el.getAttribute("placeholder") || "");
    ariaLabel = trimText(el.getAttribute("aria-label") || "");
    name = trimText(el.getAttribute("name") || "");
    id = trimText(el.id || "");
    title = trimText(el.getAttribute("title") || "");
    autocomplete = trimText(el.getAttribute("autocomplete") || "");
    nearby = opts.nearby != null ? opts.nearby : nearbyQuestionText(el);
    if (isSmartRecruitersApplicationPage() && looksLikeSmartRecruitersDropzoneChrome(nearby)) {
      nearby = srResumeLabel || "";
    }
    role = trimText(el.getAttribute("role") || "");
    blob = normalizeText(
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
    if (isSmartRecruitersApplicationPage() && isSmartRecruitersHiringTeamMessageControl(el)) {
      return validateDetection(
        { category: "additional_information", confidence: 0.98 },
        describeInputType(el)
      );
    }
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
    var aria = normalizeText(el.getAttribute("aria-required") || "");
    if (isSmartRecruitersApplicationPage() && isSmartRecruitersHiringTeamMessageControl(el)) {
      if (aria === "false") return false;
      if (el.required) return true;
      if (aria === "true") return true;
      return false;
    }
    if (el.required) return true;
    if (aria === "true") return true;
    var context = collectContext(el);
    var oc;
    if (/\brequired\b|\*$/.test(context.label) || /\brequired\b/.test(context.nearby)) return true;
    if (isSmartRecruitersApplicationPage() && findSmartRecruitersOcResumeUpload(el)) {
      if (/\bresume\s*\*/i.test((context.label || "") + " " + (context.nearby || ""))) return true;
      oc = findSmartRecruitersOcResumeUpload(el);
      if (oc && normalizeText(oc.getAttribute && oc.getAttribute("aria-required")) === "true") {
        return true;
      }
    }
    return false;
  }

  function isGroupRequired(elements) {
    return (elements || []).some(function (el) {
      return isRequired(el);
    });
  }

  function isSmartRecruitersConsentChecked(el) {
    var aria;
    var inner;
    var i;
    if (!el) return false;
    aria = normalizeText(el.getAttribute && el.getAttribute("aria-checked"));
    if (aria === "true") return true;
    if (aria === "false") return false;
    if (el.checked === true) return true;
    inner = querySelectorAllDeep(el, "input[type='checkbox'], [role='checkbox']");
    for (i = 0; i < inner.length; i += 1) {
      if (inner[i] === el) continue;
      aria = normalizeText(inner[i].getAttribute && inner[i].getAttribute("aria-checked"));
      if (aria === "true") return true;
      if (inner[i].checked === true) return true;
    }
    return false;
  }

  function readCurrentValue(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    var type = (el.type || "").toLowerCase();
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    if (type === "checkbox" || type === "radio" || role === "checkbox" || tag === "spl-checkbox") {
      if (tag === "spl-checkbox" || role === "checkbox") {
        return isSmartRecruitersConsentChecked(el) ? String(el.value || "on") : "";
      }
      return el.checked ? String(el.value || "on") : "";
    }
    if (type === "file") {
      if (el.files && el.files.length) {
        return Array.prototype.map.call(el.files, function (f) {
          return f.name;
        }).join(", ");
      }
      if (isSmartRecruitersApplicationPage()) {
        return readSmartRecruitersAttachedResumeFilenames(el).join(", ");
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

  function readSmartRecruitersScreeningRadioGroupValue(radios) {
    var checked = [];
    (radios || []).forEach(function (el) {
      if (isSmartRecruitersSplRadio(el) && isSmartRecruitersSplRadioChecked(el)) checked.push(el);
    });
    if (checked.length !== 1) return "";
    return trimText(
      readSmartRecruitersSplRadioLabel(checked[0]) || readSmartRecruitersSplRadioValue(checked[0]) || "on"
    );
  }

  function readRadioGroupValue(radios) {
    var i;
    if ((radios || []).some(isSmartRecruitersSplRadio)) {
      return readSmartRecruitersScreeningRadioGroupValue(radios);
    }
    for (i = 0; i < (radios || []).length; i += 1) {
      if (radios[i] && radios[i].checked) {
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
        if (isSmartRecruitersSplRadio(radio)) {
          return {
            value: readSmartRecruitersSplRadioValue(radio),
            label: readSmartRecruitersSplRadioLabel(radio) || readSmartRecruitersSplRadioValue(radio),
            disabled: Boolean(radio.disabled)
          };
        }
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

  function looksLikeSmartRecruitersCountryChrome(text) {
    var t = normalizeText(text);
    if (!t) return false;
    if (/\bsearch by country\b/.test(t)) return true;
    if (/\bcountry\/region\b/.test(t) || /\bcountry or region\b/.test(t)) return true;
    if (/\bregion or code\b/.test(t)) return true;
    if (/^[a-z][a-z .'-]+ \+\d{1,4}$/.test(t)) return true;
    return false;
  }

  function smartRecruitersOwnNameParts(el) {
    var tag = ((el && el.tagName) || "").toLowerCase();
    var role = normalizeText(el && el.getAttribute && el.getAttribute("role"));
    var text = "";
    if (tag === "button" || role === "button" || role === "combobox" || role === "listbox") {
      text = trimText((el.innerText || el.textContent || "")).slice(0, 120);
    }
    return {
      label: findLabelText(el),
      aria: trimText(el && el.getAttribute && el.getAttribute("aria-label")),
      placeholder: trimText(el && el.getAttribute && el.getAttribute("placeholder")),
      title: trimText(el && el.getAttribute && el.getAttribute("title")),
      value: trimText(el && el.value),
      text: text
    };
  }

  function hasMeaningfulAccessibleName(el) {
    if (!el) return false;
    var ctx = collectContext(el);
    if (trimText(ctx.label || ctx.ariaLabel || ctx.placeholder || ctx.title)) return true;
    var type = ((el.type || "") + "").toLowerCase();
    if (type === "file" && /\b(resume|cv|upload)\b/.test(normalizeText(ctx.blob || ctx.nearby || ""))) {
      return true;
    }
    return false;
  }

  function isSmartRecruitersMenuInternal(el) {
    if (!el) return true;
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    if (role === "listbox" || role === "option" || role === "presentation" || role === "none") {
      return true;
    }
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return true;
    if (
      el.closest &&
      (el.closest("[role='listbox']") ||
        el.closest("[role='option']") ||
        el.closest("[role='menu']"))
    ) {
      return true;
    }
    return false;
  }

  function isSmartRecruitersScanNoise(el) {
    if (!el) return true;
    if (!isSmartRecruitersApplicationPage()) return false;
    var type = ((el.type || "") + "").toLowerCase();
    var role = normalizeText(el.getAttribute && el.getAttribute("role"));
    if (isSmartRecruitersTopResumeParserControl(el)) return true;
    if (isSmartRecruitersHiringTeamHostChrome(el)) return true;
    if (type === "hidden" || el.disabled) return true;
    if (role === "presentation" || role === "none") return true;
    if (isSmartRecruitersMenuInternal(el)) return true;
    try {
      if (type !== "file" && !isSmartRecruitersHiringTeamMessageControl(el) && el.getBoundingClientRect) {
        var box = el.getBoundingClientRect();
        if (box && box.width === 0 && box.height === 0) return true;
      }
    } catch (_) {}
    var own = smartRecruitersOwnNameParts(el);
    var ctx = collectContext(el);
    var ownBlob = [own.label, own.aria, own.placeholder, own.title, own.value, own.text].join(" ");
    if (looksLikeSmartRecruitersCountryChrome(ownBlob)) return true;
    if (looksLikeSmartRecruitersCountryChrome(own.value) || looksLikeSmartRecruitersCountryChrome(own.text)) {
      return true;
    }
    if (
      looksLikeSmartRecruitersCountryChrome(ctx.label) ||
      looksLikeSmartRecruitersCountryChrome(ctx.ariaLabel) ||
      looksLikeSmartRecruitersCountryChrome(ctx.placeholder)
    ) {
      return true;
    }
    if (role === "searchbox" && looksLikeSmartRecruitersCountryChrome(ownBlob)) return true;
    if (!hasMeaningfulAccessibleName(el) && type !== "file") return true;
    return false;
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
    var nodes = collectScanControlNodes(doc);
    var choiceGroups = {};
    var checkboxNameCounts = {};
    var units = [];
    var screeningRadios = [];
    var screeningHost;

    if (isSmartRecruitersApplicationPage()) {
      screeningHost = findSmartRecruitersScreeningForm(doc);
      if (screeningHost && screeningHost.isConnected !== false) {
        return collectSmartRecruitersScreeningLogicalUnits(doc);
      }
      collectSmartRecruitersScreeningRadioUnits(doc).forEach(function (unit) {
        units.push(unit);
        (unit.elements || []).forEach(function (el) {
          if (screeningRadios.indexOf(el) === -1) screeningRadios.push(el);
        });
      });
    }

    nodes.forEach(function (el) {
      var type = (el.type || "").toLowerCase();
      if (type === "checkbox" && el.name) {
        checkboxNameCounts[el.name] = (checkboxNameCounts[el.name] || 0) + 1;
      }
    });

    nodes.forEach(function (el) {
      if (!isVisibleEnough(el)) return;
      if (isSmartRecruitersApplicationPage() && el.isConnected === false) return;

      var className = String((el.className && el.className.baseVal) || el.className || "");
      var elId = String(el.id || "");
      var role = String(el.getAttribute && el.getAttribute("role") || "").toLowerCase();
      if (screeningRadios.indexOf(el) !== -1) return;
      if (isSmartRecruitersApplicationPage() && isSmartRecruitersSplRadio(el) && isInsideSmartRecruitersScreeningForm(el)) {
        return;
      }
      if (
        /\biti__search-input\b/.test(className) ||
        /^iti-\d+__search-input$/.test(elId) ||
        (role === "listbox" && /\biti__country-list\b/.test(className)) ||
        (role === "listbox" && /^iti-\d+__country-listbox$/.test(elId))
      ) {
        return;
      }
      if (isSmartRecruitersApplicationPage() && isSmartRecruitersScanNoise(el)) return;
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

    (isSmartRecruitersApplicationPage()
      ? querySelectorAllDeep(doc, '[aria-haspopup="listbox"], [data-testid*="select"], [class*="dropdown"]')
      : Array.prototype.slice.call(
          doc.querySelectorAll('[aria-haspopup="listbox"], [data-testid*="select"], [class*="dropdown"]')
        )
    ).forEach(function (el) {
        if (!isVisibleEnough(el)) return;
        if ((el.tagName || "").toLowerCase() !== "button" && el.getAttribute("role") !== "button") {
          return;
        }
        var already = units.some(function (unit) {
          return unit.elements.indexOf(el) !== -1;
        });
        if (already) return;
        if (isSmartRecruitersApplicationPage() && isSmartRecruitersScanNoise(el)) return;
        var context = collectContext(el);
        if (!context.blob) return;
        if (isSmartRecruitersApplicationPage() && !hasMeaningfulAccessibleName(el)) return;
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
    var educationAnswers = buildPrimaryEducationAnswers(data.education);
    return {
      first_name: first,
      last_name: last,
      // Legal/full name requires both parts — never first name alone.
      full_name: first && last ? trimText(first + " " + last) : "",
      preferred_name: trimText(personal.preferredName || personal.preferredFirstName || ""),
      email: trimText(personal.email || opts.email || ""),
      phone: trimText(personal.phone || ""),
      phone_country: trimText(personal.phoneCountry || ""),
      phone_country_code: trimText(personal.phoneCountryCode || ""),
      address: trimText(personal.location || ""),
      // Reuse personal.location as the applicant's current city/location (never inferred).
      location: trimText(personal.location || ""),
      current_location: trimText(personal.location || ""),
      city: trimText(personal.location || ""),
      address_line_1: trimText(personal.addressLine1 || ""),
      address_line_2: trimText(personal.addressLine2 || ""),
      state: trimText(personal.state || ""),
      postal_code: trimText(personal.postalCode || ""),
      country: trimText(work.countryApplyingIn || ""),
      linkedin: trimText(links.linkedin || ""),
      github: trimText(links.github || ""),
      portfolio: trimText(links.portfolio || ""),
      url: "",
      education: Array.isArray(data.education) && data.education.length ? "Saved in profile" : "",
      education_records: listValidEducationRecords(data.education),
      primary_education: educationAnswers.primary_education,
      education_school: educationAnswers.education_school,
      education_degree: educationAnswers.education_degree,
      education_discipline: educationAnswers.education_discipline,
      education_start_year: educationAnswers.education_start_year,
      education_end_year: educationAnswers.education_end_year,
      education_start_month: educationAnswers.education_start_month,
      education_end_month: educationAnswers.education_end_month,
      education_anticipated_graduation: educationAnswers.education_anticipated_graduation,
      education_gpa: educationAnswers.education_gpa,
      education_gpa_undergraduate: educationGpaForLevel(data.education, "undergraduate"),
      education_gpa_graduate: educationGpaForLevel(data.education, "graduate"),
      education_gpa_doctorate: educationGpaForLevel(data.education, "doctorate"),
      experience: Array.isArray(data.experience) && data.experience.length ? "Saved in profile" : "",
      experience_records: listValidExperienceRecords(data.experience),
      skills: Array.isArray(data.skills) && data.skills.length ? data.skills.join(", ") : "",
      work_authorization: trimText(work.legallyAuthorizedToWork || ""),
      // Explicit export-control / U.S. person status only — never inferred.
      export_control_status: trimText(work.exportControlStatus || ""),
      sponsorship_now: trimText(work.requireSponsorshipNow || ""),
      sponsorship_later: trimText(work.requireSponsorshipFuture || ""),
      availability: trimText(prefs.availableStartDate || prefs.noticePeriod || ""),
      // Date autofill uses availableStartDate only (never notice-period text).
      available_start_date: trimText(prefs.availableStartDate || ""),
      salary: trimText(common.salaryExpectation || ""),
      relocation: trimText(prefs.willingToRelocate || ""),
      preferred_locations: trimText(prefs.preferredLocations || ""),
      current_job_title: trimText(opts.currentJobTitle || ""),
      current_job_location: trimText(opts.currentJobLocation || ""),
      areas_of_interest: trimText(common.areasOfInterest || prefs.areasOfInterest || ""),
      employment_country_citizenship: trimText(
        work.citizenOfEmploymentCountry || work.employmentCountryCitizenship || ""
      ),
      us_immigration_status: trimText(work.usCitizenOrLpr || work.usImmigrationStatus || ""),
      sanctioned_country_citizenship: trimText(
        work.sanctionedCountryCitizen || work.cubaIranNorthKoreaSyriaCitizen || ""
      ),
      // Sensitive demographics: only locally saved values — never inferred.
      veteran_status: trimText(demo.veteranStatus || ""),
      disability_status: trimText(
        demo.disabilityStatus || demo.disability_status || demo["disability status"] || ""
      ),
      gender: trimText(demo.gender || ""),
      hispanic_latino: trimText(
        demo.hispanicLatino ||
          demo.hispanic_latino ||
          demo["hispanic latino"] ||
          ""
      ),
      transgender: trimText(demo.transgender || ""),
      race_ethnicity: trimText(
        demo.raceEthnicity || demo.race_ethnicity || demo["race ethnicity"] || ""
      ),
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
    var education = Array.isArray(data.education)
      ? data.education.map(function (item) {
          return normalizeEducationRecord(item);
        })
      : [];
    var experience = listValidExperienceRecords(data.experience);
    return {
      personal: {
        firstName: trimText(personal.firstName || ""),
        lastName: trimText(personal.lastName || ""),
        preferredName: trimText(personal.preferredName || personal.preferredFirstName || ""),
        email: trimText(personal.email || ""),
        phone: trimText(personal.phone || ""),
        phoneCountry: trimText(personal.phoneCountry || ""),
        phoneCountryCode: trimText(personal.phoneCountryCode || ""),
        location: trimText(personal.location || ""),
        addressLine1: trimText(personal.addressLine1 || ""),
        addressLine2: trimText(personal.addressLine2 || ""),
        city: trimText(personal.city || ""),
        state: trimText(personal.state || ""),
        postalCode: trimText(personal.postalCode || "")
      },
      links: {
        linkedin: trimText(links.linkedin || ""),
        github: trimText(links.github || ""),
        portfolio: trimText(links.portfolio || "")
      },
      education: education,
      experience: experience,
      commonAnswers: {
        projectHighlight: trimText(common.projectHighlight || ""),
        referralSource: trimText(common.referralSource || ""),
        additionalInformation: additional,
        defaultCoverLetter: trimText(common.defaultCoverLetter || "")
      },
      applicationPreferences: {
        availableStartDate: trimText(prefs.availableStartDate || ""),
        willingToRelocate: trimText(prefs.willingToRelocate || ""),
        preferredLocations: trimText(prefs.preferredLocations || "")
      },
      workAuthorization: {
        legallyAuthorizedToWork: trimText(work.legallyAuthorizedToWork || ""),
        requireSponsorshipNow: trimText(work.requireSponsorshipNow || ""),
        requireSponsorshipFuture: trimText(work.requireSponsorshipFuture || ""),
        exportControlStatus: trimText(work.exportControlStatus || ""),
        citizenOfEmploymentCountry: trimText(work.citizenOfEmploymentCountry || ""),
        usCitizenOrLpr: trimText(work.usCitizenOrLpr || ""),
        sanctionedCountryCitizen: trimText(work.sanctionedCountryCitizen || "")
      },
      demographics: {
        gender: trimText((data.demographics || {}).gender || ""),
        hispanicLatino: trimText(
          (data.demographics || {}).hispanicLatino ||
            (data.demographics || {}).hispanic_latino ||
            (data.demographics || {})["hispanic latino"] ||
            ""
        ),
        transgender: trimText((data.demographics || {}).transgender || ""),
        raceEthnicity: trimText(
          (data.demographics || {}).raceEthnicity ||
            (data.demographics || {}).race_ethnicity ||
            (data.demographics || {})["race ethnicity"] ||
            ""
        ),
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

  function screeningOptionLabels(field) {
    return ((field && field.options) || [])
      .map(function (opt) {
        if (typeof opt === "string") return trimText(opt);
        return trimText((opt && (opt.label || opt.value)) || "");
      })
      .filter(Boolean);
  }

  function splitLocationNeedles(value) {
    var text = trimText(value);
    var parts = [];
    if (!text) return parts;
    if (text.indexOf(",") === -1 && text.indexOf(";") === -1) {
      parts.push(text);
    }
    String(text)
      .split(/[,;|/]+/)
      .forEach(function (part) {
        var token = trimText(part);
        if (token.length < 4) return;
        if (/^[A-Z]{2}$/.test(token)) return;
        if (/^(united states|usa|us)$/i.test(token)) return;
        if (parts.indexOf(token) === -1) parts.push(token);
      });
    return parts;
  }

  function optionLabelsMatchingNeedle(options, needle) {
    var want = normalizeText(needle);
    var hits = [];
    var i;
    var label;
    var stem;
    if (!want) return hits;
    for (i = 0; i < options.length; i += 1) {
      label = normalizeText(options[i]);
      if (!label) continue;
      if (label === want || label.indexOf(want) !== -1 || want.indexOf(label) !== -1) {
        if (hits.indexOf(options[i]) === -1) hits.push(options[i]);
        continue;
      }
      stem = want.replace(/(ers|er|ing)$/g, "");
      if (stem.length >= 5 && label.indexOf(stem) !== -1) {
        if (hits.indexOf(options[i]) === -1) hits.push(options[i]);
      }
    }
    return hits;
  }

  function uniquelyMatchedOptionsForNeedles(options, needles) {
    var chosen = [];
    (needles || []).forEach(function (needle) {
      var hits = optionLabelsMatchingNeedle(options, needle);
      if (hits.length === 1 && chosen.indexOf(hits[0]) === -1) chosen.push(hits[0]);
    });
    return chosen;
  }

  function uniqueScreeningOptionMatches(field, inventory) {
    var options = screeningOptionLabels(field);
    var inv = inventory || {};
    var jobNeedles;
    var prefNeedles;
    var jobHits;
    var prefHits;
    if (!options.length) return [];
    if (field.category === "preferred_locations") {
      jobNeedles = []
        .concat(splitLocationNeedles(inv.current_job_location))
        .concat(splitLocationNeedles(inv.location))
        .concat(splitLocationNeedles(inv.city));
      jobHits = uniquelyMatchedOptionsForNeedles(options, jobNeedles);
      if (jobHits.length === 1) return jobHits;
      if (jobHits.length > 1) return [];
      prefNeedles = [];
      String(inv.preferred_locations || "")
        .split(/[,;]+/)
        .forEach(function (part) {
          var token = trimText(part);
          if (token.length < 3) return;
          if (prefNeedles.indexOf(token) === -1) prefNeedles.push(token);
        });
      prefHits = uniquelyMatchedOptionsForNeedles(options, prefNeedles);
      return prefHits;
    }
    if (field.category === "areas_of_interest") {
      return uniquelyMatchedOptionsForNeedles(options, [inv.areas_of_interest, inv.current_job_title].filter(Boolean));
    }
    if (field.category === "education_discipline") {
      return uniquelyMatchedOptionsForNeedles(options, [inv.education_discipline].filter(Boolean));
    }
    return [];
  }

  function uniqueScreeningOptionMatch(field, inventory) {
    var hits = uniqueScreeningOptionMatches(field, inventory);
    return hits.length === 1 ? hits[0] : "";
  }

  function enrichScanField(field, inventory) {
    var copy = Object.assign({}, field);
    var optionMatch;
    var gpaMapped;
    var optionLabels = screeningOptionLabels(copy);
    copy.question = resolveQuestionText(copy);
    copy.isSensitive = isSensitiveCategory(copy.category);
    copy.skippable = copy.isSensitive;
    copy.proposedAnswer = getProposedAnswer(copy.category, inventory);
    // Recompute hasAnswer strictly from inventory (never from proposed page text).
    copy.hasAnswer = hasAnswerForCategory(copy.category, inventory);
    if (copy.proposedAnswer === NO_SAVED_ANSWER) {
      copy.hasAnswer = false;
    }
    if (copy.category === "preferred_locations") {
      optionMatch = uniqueScreeningOptionMatch(copy, inventory || {});
      if (optionMatch) {
        copy.proposedAnswer = optionMatch;
        copy.hasAnswer = true;
      } else if (trimText((inventory || {}).current_job_location)) {
        copy.proposedAnswer = trimText(inventory.current_job_location);
        copy.hasAnswer = true;
      } else {
        var prefHits = uniqueScreeningOptionMatches(copy, inventory || {});
        if (prefHits.length) {
          copy.proposedAnswer = prefHits[0];
          copy.hasAnswer = true;
        } else {
          copy.hasAnswer = false;
          copy.proposedAnswer = NO_SAVED_ANSWER;
        }
      }
    } else if (copy.category === "areas_of_interest") {
      optionMatch = uniqueScreeningOptionMatch(copy, inventory || {});
      if (optionMatch) {
        copy.proposedAnswer = optionMatch;
        copy.hasAnswer = true;
      } else if (trimText((inventory || {}).areas_of_interest) || trimText((inventory || {}).current_job_title)) {
        copy.proposedAnswer =
          trimText((inventory || {}).areas_of_interest) || trimText((inventory || {}).current_job_title);
        copy.hasAnswer = true;
      }
    } else if (copy.category === "education_discipline") {
      optionMatch = uniqueScreeningOptionMatch(copy, inventory || {});
      if (optionMatch) {
        copy.proposedAnswer = optionMatch;
        copy.hasAnswer = true;
      }
    }
    if (copy.category === "education_gpa") {
      gpaMapped = mapNumericGpaToRangeOption(
        (inventory && inventory.education_gpa) || copy.proposedAnswer,
        optionLabels
      );
      if (gpaMapped) {
        copy.proposedAnswer = gpaMapped;
        copy.hasAnswer = true;
      }
    }
    if (copy.category === "export_control_status") {
      var yesNoOnly = optionLabels.length > 0 && optionLabels.every(function (label) {
        return /^(yes|no)$/i.test(normalizeText(label).replace(/[^a-z]/g, ""));
      });
      if (yesNoOnly && !/^(yes|no)$/i.test(normalizeText(copy.proposedAnswer))) {
        copy.hasAnswer = false;
        copy.proposedAnswer = NO_SAVED_ANSWER;
      }
    }
    if (!copy.hasAnswer) {
      optionMatch = uniqueScreeningOptionMatch(copy, inventory || {});
      if (optionMatch) {
        copy.proposedAnswer = optionMatch;
        copy.hasAnswer = true;
      }
    }
    if (copy.category === "privacy_consent") {
      copy.hasAnswer = false;
      copy.proposedAnswer = NO_SAVED_ANSWER;
      copy.skippable = false;
      copy.isSensitive = false;
      if (!isFilledValue(copy.currentValue)) {
        copy.actionHint = "User confirmation required";
      }
    }
    if (copy.category === "company_specific") {
      copy.hasAnswer = false;
      copy.proposedAnswer = NO_SAVED_ANSWER;
      copy.skipped = true;
      copy.skippable = false;
      copy.actionHint = copy.actionHint || "User confirmation required";
    }
    if (copy.conditionalState === "not_applicable") {
      copy.hasAnswer = false;
      copy.skipped = true;
      copy.required = false;
      copy.actionHint = "Conditionally not applicable";
    }
    if (copy.conditionalState === "blocked") {
      copy.hasAnswer = false;
      copy.skipped = true;
      copy.required = false;
      copy.actionHint = "Blocked by parent confirmation";
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

    if (
      copy.category !== "privacy_consent" &&
      isProtectedManualTextCue(copy.name, copy.id, copy.ariaLabel, copy.placeholder)
    ) {
      copy.category = "unknown";
      copy.categoryLabel = CATEGORY_LABELS.unknown;
      copy.confidence = 0.99;
      copy.confidenceLabel = confidenceLabel(0.99);
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
      var screening = unit.screening || null;
      var question = screening && screening.label ? screening.label : radioGroupQuestionText(elements);
      var options = readRadioOptions(elements);
      if (screening && screening.options && screening.options.length && !options.length) {
        options = screening.options.map(function (opt) {
          return { value: opt.value || "", label: opt.label || opt.value || "", disabled: false };
        });
      }
      var optionLabels = options.map(function (o) {
        return o.label || o.value;
      });
      var context = collectContext(primary, {
        label: question || findLabelText(primary),
        nearby: question || ""
      });
      if (screening && screening.label) context.label = screening.label;
      var detected =
        screening && screening.category
          ? { category: screening.category, confidence: 0.99 }
          : detectCategoryFromMeta({
        tagName: "input",
        inputType: groupType,
        type: groupType,
        label: context.label,
        ariaLabel: context.ariaLabel,
        name: context.name,
        id: (screening && screening.questionId) || context.id,
        nearby: "",
        autocomplete: context.autocomplete,
        optionLabels: optionLabels
      });
      var currentValue = readRadioGroupValue(elements);
      var required = screening ? Boolean(screening.required) : isGroupRequired(elements);
      var field = validateScanField({
        fieldId: buildStableFieldId(
          {
            inputType: groupType,
            name: context.name,
            id: unit.groupKey || (screening && screening.questionId) || context.id,
            label: context.label
          },
          index
        ),
        inputType: groupType,
        name: context.name,
        id: (screening && screening.questionId) || context.id,
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
        fillStatus: "unknown",
        screeningQuestionId: screening && screening.questionId,
        screeningKind: screening && screening.kind,
        skipped: Boolean(screening && screening.skipped),
        actionHint: (screening && screening.actionHint) || "",
        conditionalState: (screening && screening.conditionalState) || ""
      });
      return enrichScanField(field, inv);
    }

    var screening = unit.screening || null;
    var context = collectContext(primary);
    var options = readOptions(primary);
    var detected;
    var currentValue;
    var required;
    var field;
    if (screening && screening.label) {
      context.label = screening.label;
      context.nearby = screening.label;
    }
    detected =
      screening && screening.category
        ? { category: screening.category, confidence: 0.99 }
        : detectCategory(
            primary,
            context,
            options.map(function (o) {
              return o.label || o.value;
            })
          );
    currentValue = readCurrentValue(primary);
    if (screening && screening.kind === "privacy_consent") {
      currentValue = isSmartRecruitersConsentChecked(primary) ? screening.label || "on" : "";
    }
    if (screening && screening.kind === "multiselect") {
      currentValue =
        readSmartRecruitersMultiselectValue(
          closestComposed(primary, function (node) {
            return (node.tagName || "").toLowerCase() === "spl-multiselect-autocomplete";
          })
        ) || currentValue;
    }
    required = screening && screening.required != null ? Boolean(screening.required) : isRequired(primary);
    if (screening && (screening.conditionalState === "not_applicable" || screening.conditionalState === "blocked")) {
      required = false;
    }
    field = validateScanField({
      fieldId: buildStableFieldId(
        {
          inputType: describeInputType(primary),
          name: context.name,
          id: (screening && screening.questionId) || context.id,
          label: context.label,
          ariaLabel: context.ariaLabel,
          placeholder: context.placeholder
        },
        index
      ),
      inputType:
        screening && screening.kind === "multiselect"
          ? "select-multiple"
          : screening && (screening.kind === "autocomplete" || screening.kind === "gender" || screening.kind === "ethnicity")
            ? "select"
            : describeInputType(primary),
      name: context.name,
      id: (screening && screening.questionId) || context.id,
      label: context.label,
      placeholder: context.placeholder,
      ariaLabel: context.ariaLabel,
      required: required,
      currentValue: currentValue,
      options: (screening && screening.options && screening.options.length ? screening.options : options),
      category: detected.category,
      categoryLabel: CATEGORY_LABELS[detected.category] || "Unknown",
      confidence: Math.round((Number(detected.confidence) || 0) * 100) / 100,
      confidenceLabel: confidenceLabel(detected.confidence),
      nearbyText: context.nearby,
      fillStatus: "unknown",
      screeningQuestionId: screening && screening.questionId,
      screeningKind: screening && screening.kind,
      skipped: Boolean(screening && screening.skipped),
      actionHint: (screening && screening.actionHint) || "",
      conditionalState: (screening && screening.conditionalState) || ""
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
        f.category !== "company_specific" &&
        f.conditionalState !== "not_applicable" &&
        f.conditionalState !== "blocked" &&
        !isFilledValue(f.currentValue)
      );
    });
    var unknown = list.filter(function (f) {
      return f.category === "unknown";
    });
    var requiredUnanswered = list.filter(function (f) {
      return (
        f.required &&
        !isFilledValue(f.currentValue) &&
        !f.hasAnswer &&
        !f.skipped &&
        f.category !== "company_specific" &&
        f.conditionalState !== "not_applicable" &&
        f.conditionalState !== "blocked"
      );
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

  function dispatchFillEvents(el, options) {
    if (!el) return;
    var opts = options || {};
    try {
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (_) {}
    try {
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    } catch (_) {}
    if (opts.blur === false) return;
    try {
      el.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    } catch (_) {
      try {
        el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
      } catch (_) {}
    }
  }

  function setNativeValue(el, value, options) {
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

    dispatchFillEvents(el, options);
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
    try {
      if (typeof el.focus === "function") el.focus();
    } catch (_) {}
    var wrote = isEditable ? setContentEditableValue(el, answer) : setNativeValue(el, answer);
    if (!wrote) {
      return { ok: false, status: "failed", reason: "Could not set field value." };
    }

    var after = readElementTextValue(el);
    var inputType = normalizeText(el.type || "");
    var phoneCue = normalizeText(
      [el.name || "", el.id || "", el.getAttribute && el.getAttribute("aria-label"), findLabelText(el)].join(" ")
    );
    var treatAsPhone = inputType === "tel" || /\bphone\b/.test(phoneCue) || /\bmobile\b/.test(phoneCue);
    if (treatAsPhone) {
      if (!phoneValuesMatch(answer, after)) {
        return {
          ok: false,
          status: "failed",
          reason: "Verification failed; field does not contain the expected value."
        };
      }
    } else if (!textValuesMatch(answer, after)) {
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

  function fillBasicTextFields(root, inventory, options) {
    var doc = root || document;
    var inv = inventory || {};
    var opts = options || {};
    var handledElements = opts.handledElements || [];
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
      return {
        results: [],
        summary: { attempted: 0, filled: 0, skipped: 0, failed: 0 },
        handledElements: handledElements
      };
    }

    function wasSeen(el) {
      return seenList.indexOf(el) !== -1 || handledElements.indexOf(el) !== -1;
    }

    function markSeen(el) {
      function add(node) {
        if (!node) return;
        if (seenList.indexOf(node) === -1) seenList.push(node);
        if (handledElements.indexOf(node) === -1) handledElements.push(node);
      }
      add(el);
      var native = findNativeDateInput(el);
      add(native);
      add(findVisibleDateCompanion(native || el));
    }

    nodes.forEach(function (el) {
      if (!el || wasSeen(el)) return;

      if (isProtectedManualTextField(el)) {
        markSeen(el);
        results.push({
          category: "unknown",
          label: findLabelText(el) || trimText(el.getAttribute && el.getAttribute("aria-label")) || "",
          status: "skipped",
          reason: "Manual signature/acknowledgement field.",
          ok: false,
          value: ""
        });
        return;
      }

      var label = findLabelText(el) || trimText(el.getAttribute && el.getAttribute("aria-label")) || "";
      var detected = detectBasicTextCategory(el);
      var category = detected.category || "unknown";
      var labelCue = normalizeText(label + " " + (el.placeholder || "") + " " + (el.name || "") + " " + (el.id || ""));

      // Education fields are owned by ATS adapters (e.g. Greenhouse). Do not mark handled.
      if (
        looksLikeEducationDateField(labelCue) ||
        category === "education" ||
        category === "education_gpa" ||
        category === "education_gpa_undergraduate" ||
        category === "education_gpa_graduate" ||
        category === "education_gpa_doctorate" ||
        category === "education_anticipated_graduation" ||
        category === "education_start_month" ||
        category === "education_end_month"
      ) {
        return;
      }

      // Location (City) autocomplete is owned by the Greenhouse adapter.
      // Do not mark handled here — the adapter must still be able to select a suggestion.
      if (looksLikeLocationCityField(labelCue) || category === "city" || category === "location") {
        return;
      }

      // Availability date autofill (native date + date-like text / Ashby native input).
      if (category === "availability") {
        var availCue = labelCue;
        if (/\bnotice\s+period\b/.test(availCue)) {
          markSeen(el);
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

      if (category === "referral_source" || looksLikeReferralSource(labelCue) || looksLikeReferralSource(label)) {
        markSeen(el);
        results.push({
          category: "referral_source",
          label: label,
          status: "skipped",
          reason: "Referral source is left manual.",
          ok: false,
          value: ""
        });
        return;
      }

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
      markSeen(el);
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
      },
      handledElements: handledElements
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

  function detectActiveAtsHost() {
    try {
      if (
        global.ImpulsoAshbyAdapter &&
        typeof global.ImpulsoAshbyAdapter.isSupportedPage === "function" &&
        global.ImpulsoAshbyAdapter.isSupportedPage()
      ) {
        return "ashby";
      }
    } catch (_) {}
    try {
      if (
        global.ImpulsoGreenhouseAdapter &&
        typeof global.ImpulsoGreenhouseAdapter.isSupportedPage === "function" &&
        global.ImpulsoGreenhouseAdapter.isSupportedPage()
      ) {
        return "greenhouse";
      }
    } catch (_) {}
    try {
      if (
        global.ImpulsoSmartRecruitersAdapter &&
        typeof global.ImpulsoSmartRecruitersAdapter.isSupportedPage === "function" &&
        global.ImpulsoSmartRecruitersAdapter.isSupportedPage()
      ) {
        return "smartrecruiters";
      }
    } catch (_) {}
    if (isSmartRecruitersApplicationPage()) return "smartrecruiters";
    return "generic";
  }

  global.ImpulsoAutofill = {
    CATEGORY_LABELS: CATEGORY_LABELS,
    CATEGORY_ORDER: CATEGORY_ORDER,
    SENSITIVE_CATEGORIES: SENSITIVE_CATEGORIES,
    BASIC_TEXT_CATEGORIES: BASIC_TEXT_CATEGORIES,
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
    mergeAutofillReports: mergeAutofillReports,
    parseStoredDate: parseStoredDate,
    formatDateForElement: formatDateForElement,
    availabilityDateAnswer: availabilityDateAnswer,
    readElementTextValue: readElementTextValue,
    textValuesMatch: textValuesMatch,
    phoneValuesMatch: phoneValuesMatch,
    phoneDigitsOnly: phoneDigitsOnly,
    uniqueScreeningOptionMatch: uniqueScreeningOptionMatch,
    uniqueScreeningOptionMatches: uniqueScreeningOptionMatches,
    mapNumericGpaToRangeOption: mapNumericGpaToRangeOption,
    gpaForGenericScreeningQuestion: gpaForGenericScreeningQuestion,
    selectHighestDegreeEducation: selectHighestDegreeEducation,
    looksLikePreviouslyAppliedQuestion: looksLikePreviouslyAppliedQuestion,
    looksLikeExportControlRestrictionQuestion: looksLikeExportControlRestrictionQuestion,
    looksLikePreferredLocationsQuestion: looksLikePreferredLocationsQuestion,
    looksLikeCompanySpecificUserConfirmation: looksLikeCompanySpecificUserConfirmation,
    classifyScreeningEducationCategory: classifyScreeningEducationCategory,
    normalizeScreeningQuestionLabel: normalizeScreeningQuestionLabel,
    findScreeningControlByQuestionId: findScreeningControlByQuestionId,
    screeningQuestionHostId: screeningQuestionHostId,
    readSmartRecruitersMultiselectValue: readSmartRecruitersMultiselectValue,
    looksLikeLocationCityField: looksLikeLocationCityField,
    looksLikeSmartRecruitersCountryChrome: looksLikeSmartRecruitersCountryChrome,
    looksLikeSmartRecruitersDropzoneChrome: looksLikeSmartRecruitersDropzoneChrome,
    isSmartRecruitersTopResumeParserControl: isSmartRecruitersTopResumeParserControl,
    findSmartRecruitersOcResumeUpload: findSmartRecruitersOcResumeUpload,
    findSmartRecruitersResumeQuestionLabel: findSmartRecruitersResumeQuestionLabel,
    readSmartRecruitersAttachedResumeFilenames: readSmartRecruitersAttachedResumeFilenames,
    isSmartRecruitersHiringTeamMessageControl: isSmartRecruitersHiringTeamMessageControl,
    findSmartRecruitersHiringTeamQuestionLabel: findSmartRecruitersHiringTeamQuestionLabel,
    findSmartRecruitersScreeningForm: findSmartRecruitersScreeningForm,
    parseSmartRecruitersScreeningDefinition: parseSmartRecruitersScreeningDefinition,
    collectSmartRecruitersScreeningRadioUnits: collectSmartRecruitersScreeningRadioUnits,
    collectSmartRecruitersScreeningLogicalUnits: collectSmartRecruitersScreeningLogicalUnits,
    parseSmartRecruitersScreeningQuestions: parseSmartRecruitersScreeningQuestions,
    findSmartRecruitersPrivacyConsentControl: findSmartRecruitersPrivacyConsentControl,
    looksLikeSmartRecruitersEmployeeReferral: looksLikeSmartRecruitersEmployeeReferral,
    looksLikeSmartRecruitersPrivacyConsent: looksLikeSmartRecruitersPrivacyConsent,
    isSmartRecruitersConsentChecked: isSmartRecruitersConsentChecked,
    matchSmartRecruitersScreeningRadioOption: matchSmartRecruitersScreeningRadioOption,
    screeningRadioOptionMatches: screeningRadioOptionMatches,
    SMARTRECRUITERS_SCREENING_FORM_SELECTOR: SMARTRECRUITERS_SCREENING_FORM_SELECTOR,
    isSmartRecruitersScanNoise: isSmartRecruitersScanNoise,
    hasMeaningfulAccessibleName: hasMeaningfulAccessibleName,
    looksLikeProjectHighlight: looksLikeProjectHighlight,
    looksLikeReferralSource: looksLikeReferralSource,
    normalizeEducationRecord: normalizeEducationRecord,
    normalizeExperienceRecord: normalizeExperienceRecord,
    extractYearFromEducationDate: extractYearFromEducationDate,
    extractMonthFromEducationDate: extractMonthFromEducationDate,
    listValidEducationRecords: listValidEducationRecords,
    listValidExperienceRecords: listValidExperienceRecords,
    educationDegreeLevel: educationDegreeLevel,
    educationGpaForLevel: educationGpaForLevel,
    selectPrimaryEducation: selectPrimaryEducation,
    buildPrimaryEducationAnswers: buildPrimaryEducationAnswers,
    detectActiveAtsHost: detectActiveAtsHost,
    isSmartRecruitersApplicationUrl: isSmartRecruitersApplicationUrl,
    isSmartRecruitersApplicationPage: isSmartRecruitersApplicationPage,
    querySelectorAllDeep: querySelectorAllDeep,
    scanDocument: scanDocument,
    scanPage: function (inventory) {
      return scanDocument(document, inventory || {});
    },
    summarizeFields: summarizeFields
  };
})(typeof window !== "undefined" ? window : self);
