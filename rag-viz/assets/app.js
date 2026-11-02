/* 启动入口：等 DOM 就绪后交给 UI.init()。 */
(function () {
  "use strict";
  function boot() {
    window.UI.init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
