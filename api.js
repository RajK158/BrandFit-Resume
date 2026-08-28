(function (global) {
  "use strict";

  const DEFAULT_API_BASE_URL = "https://impulso-api-h3bj.onrender.com";
  const API_BASE_URL_KEY = "impulsoApiBaseUrl";
  const CLIENT_ID_KEY = "impulsoClientId";

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(data || {});
      });
    });
  }

  function storageSet(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function normalizeBaseUrl(value) {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    return normalized || DEFAULT_API_BASE_URL;
  }

  async function getBaseUrl() {
    const data = await storageGet([API_BASE_URL_KEY]);
    return normalizeBaseUrl(data[API_BASE_URL_KEY]);
  }

  async function setBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    await storageSet({ [API_BASE_URL_KEY]: normalized });
    return normalized;
  }

  function createClientId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "client-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  async function getClientId() {
    const data = await storageGet([CLIENT_ID_KEY]);
    const saved = String(data[CLIENT_ID_KEY] || "").trim();
    if (saved) return saved;

    const clientId = createClientId();
    await storageSet({ [CLIENT_ID_KEY]: clientId });
    return clientId;
  }

  async function request(path, options) {
    const baseUrl = await getBaseUrl();
    const requestOptions = Object.assign({}, options || {});
    const headers = new Headers(requestOptions.headers || {});
    headers.set("X-Impulso-Client", await getClientId());
    requestOptions.headers = headers;
    return fetch(baseUrl + "/" + String(path || "").replace(/^\/+/, ""), requestOptions);
  }

  global.ImpulsoApi = {
    DEFAULT_API_BASE_URL: DEFAULT_API_BASE_URL,
    getBaseUrl: getBaseUrl,
    setBaseUrl: setBaseUrl,
    getClientId: getClientId,
    request: request
  };
})(window);
