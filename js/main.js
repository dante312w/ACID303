/* ---- Toast: mensajes cortos en pantalla ---- */
(function initToast() {
  var el = document.getElementById("toast");
  var hideTimer;

  window.toast = function (msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2800);
  };
})();

/* ---- Proyecto conceptual: los botones de compra no venden de verdad ---- */
(function initBuyButtons() {
  document.querySelectorAll(".js-buy").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.toast("Proyecto conceptual · la venta no está activa.");
    });
  });
})();

/* ---- Mini patrón de 16 pasos dentro de cada entrada ---- */
(function initTicketSteps() {
  document.querySelectorAll(".ticket__steps").forEach(function (el) {
    var steps = el.getAttribute("data-steps") || "";
    for (var i = 0; i < steps.length; i++) {
      var s = document.createElement("span");
      if (steps[i] === "1") s.className = "is-on";
      el.appendChild(s);
    }
  });
})();

/* ---- Barra de compra fija en móvil: aparece tras el hero, se oculta en Entradas ---- */
(function initBuybar() {
  var bar = document.getElementById("buybar");
  var hero = document.querySelector(".hero");
  var tickets = document.getElementById("entradas");
  if (!bar || !hero || !("IntersectionObserver" in window)) return;

  var pastHero = false;
  var onTickets = false;

  function update() {
    var visible = pastHero && !onTickets;
    bar.classList.toggle("is-visible", visible);
    bar.inert = !visible;
    bar.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  new IntersectionObserver(function (entries) {
    pastHero = !entries[0].isIntersecting;
    update();
  }).observe(hero);

  new IntersectionObserver(
    function (entries) {
      onTickets = entries[0].isIntersecting;
      update();
    },
    { threshold: 0.15 },
  ).observe(tickets);
})();
