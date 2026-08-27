const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const values = {};
const requests = [];
const chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get(keys, callback) {
        const result = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
        });
        callback(result);
      },
      set(next, callback) {
        Object.assign(values, next);
        callback();
      }
    }
  }
};

const window = {
  crypto: { randomUUID: () => "12345678-1234-1234-1234-123456789abc" }
};

const context = {
  window,
  chrome,
  Headers,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true };
  },
  Date,
  Math,
  Promise,
  Error,
  String,
  Object
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "api.js"), "utf8"),
  context
);

(async () => {
  await window.ImpulsoApi.request("/health", { method: "GET" });
  assert.strictEqual(requests[0].url, "http://127.0.0.1:8000/health");
  assert.strictEqual(
    requests[0].options.headers.get("X-Impulso-Client"),
    "12345678-1234-1234-1234-123456789abc"
  );

  await window.ImpulsoApi.setBaseUrl("https://api.impulso.example/");
  await window.ImpulsoApi.request("api/v1/analyze-job-match", { method: "POST" });
  assert.strictEqual(
    requests[1].url,
    "https://api.impulso.example/api/v1/analyze-job-match"
  );
  assert.strictEqual(values.impulsoClientId, "12345678-1234-1234-1234-123456789abc");
  console.log("All API client tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
