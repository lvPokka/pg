"use strict";
(function () {
    var a = function () {
        var a = "[".concat("data-action=\"mad_kp\"", "]"),
        b = "\u041A\u0438\u043D\u043E\u043F\u043E\u0438\u0441\u043A",
        c = "[data-action=\"catalog\"]",
        d = $("\n          <li class=\"menu__item selector\" ".concat("data-action=\"mad_kp\"", ">\n             <div class=\"menu__ico\">\n                <svg width=\"24\" height=\"23\" viewBox=\"0 0 24 23\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <path d=\"M15.6162 7.10981L15.8464 7.55198L16.3381 7.63428L22.2841 8.62965C22.8678 8.72736 23.0999 9.44167 22.6851 9.86381L18.4598 14.1641L18.1104 14.5196L18.184 15.0127L19.0748 20.9752C19.1622 21.5606 18.5546 22.002 18.025 21.738L12.6295 19.0483L12.1833 18.8259L11.7372 19.0483L6.34171 21.738C5.81206 22.002 5.20443 21.5606 5.29187 20.9752L6.18264 15.0127L6.25629 14.5196L5.9069 14.1641L1.68155 9.86381C1.26677 9.44167 1.49886 8.72736 2.08255 8.62965L8.02855 7.63428L8.52022 7.55198L8.75043 7.10981L11.5345 1.76241C11.8078 1.23748 12.5589 1.23748 12.8322 1.76241L15.6162 7.10981Z\" stroke=\"currentColor\" stroke-width=\"2.2\"></path>\n                </svg>\n             </div>\n             <div class=\"menu__text\">").concat(b, "</div>\n          </li>\n        "));
        d.on("hover:enter", function () {
            Lampa.Activity.push({
                url: "",
                title: b,
                component: "main",
                source: "KP"
            })
        }),
        Lampa.Menu.render().find(c).before(d),
        function moveItemBefore(a, b) {
            return setTimeout(function () {
                return $(a).insertBefore($(b))
            }, 2e3)
        }
        (a, c)
    };
    window.appready ? a() : Lampa.Listener.follow("app", function (b) {
        "ready" === b.type && a()
    })
})();
