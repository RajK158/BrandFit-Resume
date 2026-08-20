(function (global) {
  "use strict";

  var LEVER_HOST_RE = /(?:^|\.)lever\.co$/i;

  function isSupportedPage() {
    try {
      var host = String((global.location && global.location.hostname) || "");
      if (!LEVER_HOST_RE.test(host)) return false;

      return Boolean(
        document.querySelector(
          "#application-form, form.application-form"
        )
      );
    } catch (_) {
      return false;
    }
  }

  function fillSupportedFields(context) {
    var ctx = context || {};

    return Promise.resolve({
      results: [],
      handledElements: ctx.handledElements || [],
      summary: {
        attempted: 0,
        filled: 0,
        skipped: 0,
        failed: 0
      }
    });
  }

  global.ImpulsoLeverAdapter = {
    isSupportedPage: isSupportedPage,
    fillSupportedFields: fillSupportedFields
  };
})(typeof window !== "undefined" ? window : self);
