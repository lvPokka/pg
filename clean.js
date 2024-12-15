(function () {
  "use strict";

  Lampa.Listener.follow("app", (e) => {
    if (e.type == "ready") {
      setTimeout(function () {
        
        ["anime", "feed", "myperson", "about", "subscribes", "catalog", "relise", "mytorrents"].forEach(function (a) {
          return $("[data-action=" + a + "]").eq(0).hide();
        });
        
        [".open--premium", ".open--feed", ".open--notice", ".open--profile", ".full-screen", ".open--settings"].forEach(function (a) {
          return $(".head__action" + a).hide();
        });
      }, 10);
    }
  });
})();
