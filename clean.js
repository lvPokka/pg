(function () {
  "use strict";

  Lampa.Listener.follow("app", (e) => {
    if (e.type == "ready") {
      setTimeout(function () {
        $("[data-action=anime]").eq(0).remove();
        $("[data-action=feed]").eq(0).remove();
        $("[data-action=myperson]").eq(0).remove();
        $("[data-action=about]").eq(0).remove();
        $("[data-action=subscribes]").eq(0).remove();
        $("[data-action=catalog]").eq(0).remove();
        $("[data-action=relise]").eq(0).remove();
        $("[data-action=mytorrents]").eq(0).remove();
        [".open--premium", ".open--feed", ".open--notice", ".open--profile"].forEach(function (a) {
          return $(a).hide();
        });

        [".head__split"].forEach(function (a) {
          (document.querySelector(a).style.width = 0), (document.querySelector(a).style.margin = "0 0.7em");
        });
      }, 10);
    }
  });
})();
