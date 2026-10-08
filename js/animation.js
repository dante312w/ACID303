document.addEventListener("DOMContentLoaded", function () {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    return;
  }

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  gsap.registerPlugin(ScrollTrigger);

  /* ---- Entrada del hero ---- */
  if (!reduceMotion) {
    gsap
      .timeline({ defaults: { ease: "power4.out" } })
      .from(".hero__label", { opacity: 0, y: 12, duration: 0.4 })
      .from(
        ".hero__title-line",
        { yPercent: 110, opacity: 0, stagger: 0.12, duration: 0.8 },
        "-=0.2",
      )
      .from(
        ".hero__smiley",
        { scale: 0, rotation: -180, duration: 0.7, ease: "back.out(2)" },
        "-=0.4",
      )
      .from(
        ".hero__meta > div",
        { opacity: 0, y: 20, stagger: 0.07, duration: 0.4 },
        "-=0.4",
      )
      .from(
        ".hero__actions > *",
        { opacity: 0, y: 20, stagger: 0.1, duration: 0.4 },
        "-=0.25",
      );
  }

  /* ---- Revelado por sección ---- */
  gsap.utils.toArray(".section").forEach(function (section) {
    var els = section.querySelectorAll(".fx-line");
    if (!els.length || reduceMotion) return;

    gsap.set(els, { opacity: 0, y: 40 });
    ScrollTrigger.create({
      trigger: section,
      start: "top 78%",
      once: true,
      onEnter: function () {
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.08,
          ease: "power3.out",
        });
      },
    });
  });

  /* ---- Contadores de specs ---- */
  gsap.utils.toArray(".specs__num[data-count]").forEach(function (el) {
    if (reduceMotion) return;
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var counter = { val: 0 };
    el.textContent = "0" + suffix;

    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: function () {
        gsap.to(counter, {
          val: target,
          duration: 1.2,
          ease: "steps(" + target + ")",
          onUpdate: function () {
            el.textContent = Math.round(counter.val) + suffix;
          },
        });
      },
    });
  });

  /* ---- Tracks del line-up entran como en un tracklist ---- */
  if (!reduceMotion) {
    gsap.utils.toArray(".side").forEach(function (side) {
      gsap.from(side.querySelectorAll(".track"), {
        opacity: 0,
        x: -24,
        stagger: 0.07,
        duration: 0.4,
        ease: "power2.out",
        scrollTrigger: { trigger: side, start: "top 80%", once: true },
      });
    });
  }
});
