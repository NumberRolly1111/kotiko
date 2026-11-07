(function () {
  "use strict";

  var cfg = window.KOTIKO;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) document.documentElement.classList.add("js-motion");

  function waLink(text) {
    return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(text);
  }
  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // время и день недели в Астане (UTC+5)
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function astanaNow() {
    var out = {};
    new Intl.DateTimeFormat("en-US", {
      weekday: "short", hour: "numeric", minute: "numeric", hour12: false, timeZone: cfg.timezone
    }).formatToParts(new Date()).forEach(function (p) { out[p.type] = p.value; });
    return { day: WEEKDAYS.indexOf(out.weekday), hour: Number(out.hour) % 24, minute: Number(out.minute) };
  }
  function isWeekendDay(d) { return d === 0 || d === 6; }
  function hoursFor(d) { return isWeekendDay(d) ? cfg.hours.weekend : cfg.hours.weekday; }

  // кнопки WhatsApp

  document.querySelectorAll("[data-wa]").forEach(function (a) {
    a.href = waLink(cfg.messages[a.getAttribute("data-wa")] || cfg.messages.hello);
    a.target = "_blank";
    a.rel = "noopener";
  });

  // «сейчас открыто»

  function renderStatus() {
    var box = document.getElementById("status");
    var text = document.getElementById("statusText");
    var now = astanaNow();
    var today = hoursFor(now.day);
    var open = now.hour >= today.from && now.hour < today.to;
    box.classList.toggle("is-open", open);
    if (open) {
      text.textContent = "Сейчас открыто, до " + pad(today.to) + ":00";
    } else if (now.hour < today.from) {
      text.textContent = "Сейчас закрыто, откроемся сегодня в " + pad(today.from) + ":00";
    } else {
      text.textContent = "Сейчас закрыто, откроемся завтра в " + pad(hoursFor((now.day + 1) % 7).from) + ":00";
    }
  }

  // калькулятор-чек

  var state = { mode: isWeekendDay(astanaNow().day) ? "weekend" : "weekday", minutes: 60, people: 1 };
  var el = {
    total: document.getElementById("calcTotal"),
    detail: document.getElementById("calcDetail"),
    slider: document.getElementById("minutes"),
    minutesText: document.getElementById("minutesText"),
    peopleOut: document.getElementById("peopleOut"),
    seg: document.getElementById("seg"),
    modeBtns: document.querySelectorAll("[data-mode]"),
    chips: document.querySelectorAll("[data-min]")
  };

  function durationText(m) {
    if (m < 60) return m + " мин";
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + " ч " + r + " мин" : h + " ч";
  }

  // цена «накручивается» до нового значения
  var shown = null, raf = 0;
  function rollTo(target) {
    if (reduce || shown === null) { shown = target; el.total.textContent = money(target); return; }
    cancelAnimationFrame(raf);
    var from = shown, t0 = performance.now(), dur = 460;
    el.total.classList.remove("bump");
    void el.total.offsetWidth;
    el.total.classList.add("bump");
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      shown = Math.round(from + (target - from) * e);
      el.total.textContent = money(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    })(t0);
  }

  function renderCalc() {
    var rate = cfg.rate[state.mode];
    rollTo(rate * state.minutes * state.people);
    el.detail.textContent = rate + " ₸ × " + state.minutes + " мин × " + state.people + " чел.";
    el.minutesText.textContent = durationText(state.minutes);
    el.peopleOut.textContent = state.people;
    el.slider.value = state.minutes;
    var min = Number(el.slider.min), max = Number(el.slider.max);
    el.slider.style.setProperty("--p", ((state.minutes - min) / (max - min) * 100) + "%");
    el.seg.setAttribute("data-active", state.mode);
    el.modeBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === state.mode));
    });
    el.chips.forEach(function (b) {
      b.classList.toggle("is-on", Number(b.getAttribute("data-min")) === state.minutes);
    });
  }

  el.modeBtns.forEach(function (b) {
    b.addEventListener("click", function () { state.mode = b.getAttribute("data-mode"); renderCalc(); });
  });
  el.chips.forEach(function (b) {
    b.addEventListener("click", function () { state.minutes = Number(b.getAttribute("data-min")); renderCalc(); });
  });
  el.slider.addEventListener("input", function () { state.minutes = Number(el.slider.value); renderCalc(); });
  document.getElementById("peopleMinus").addEventListener("click", function () {
    state.people = Math.max(1, state.people - 1); renderCalc();
  });
  document.getElementById("peoplePlus").addEventListener("click", function () {
    state.people = Math.min(10, state.people + 1); renderCalc();
  });

  // дата на чеке
  document.getElementById("ticketDate").textContent =
    new Intl.DateTimeFormat("ru-RU", { timeZone: cfg.timezone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  // котик над чеком следит за курсором

  var peek = document.querySelector(".peek__head");
  var pupils = peek ? Array.prototype.slice.call(peek.querySelectorAll(".pupil")) : [];
  var lookRaf = 0, lastX = 0, lastY = 0;

  function look() {
    lookRaf = 0;
    var scale = peek.getBoundingClientRect().width / 260;
    pupils.forEach(function (p) {
      var r = p.parentNode.querySelector(".sclera").getBoundingClientRect();
      var dx = lastX - (r.left + r.width / 2), dy = lastY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1;
      var u = Math.min(8, d / scale / 14);
      p.style.transform = "translate(" + (dx / d * u).toFixed(2) + "px," + (dy / d * u).toFixed(2) + "px)";
    });
  }
  function resetLook() { pupils.forEach(function (p) { p.style.transform = ""; }); }

  if (pupils.length && !reduce) {
    window.addEventListener("pointermove", function (e) {
      lastX = e.clientX; lastY = e.clientY;
      if (!lookRaf) lookRaf = requestAnimationFrame(look);
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetLook);
  }

  // котики

  var COATS = [
    { fill: "#ff8a2b", stripes: true },
    { fill: "#a3abbd", stripes: true },
    { fill: "#2e2a3f", dark: true },
    { fill: "#f4e1bd" },
    { fill: "#b98355", stripes: true },
    { fill: "#ffffff" }
  ];
  var CARD_COLORS = ["#ffd15c", "#a9ddf2", "#ffb8c6", "#bdebc8", "#ffc48a"];
  var INK = "#1c1530";

  function catFace(coat, delay) {
    var eye = coat.dark ? "#ffd15c" : INK;
    var stripes = coat.stripes
      ? '<path d="M44 28v9M50 26v10M56 28v9" stroke="' + INK + '" stroke-width="3" stroke-linecap="round" fill="none"/>'
      : "";
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<g class="a-ear a-ear--l"><polygon points="13,42 17,6 47,24" fill="' + coat.fill + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><polygon points="21,33 22,17 36,26" fill="#ff9fb2"/></g>' +
      '<g class="a-ear a-ear--r"><polygon points="87,42 83,6 53,24" fill="' + coat.fill + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><polygon points="79,33 78,17 64,26" fill="#ff9fb2"/></g>' +
      '<ellipse cx="50" cy="58" rx="40" ry="35" fill="' + coat.fill + '" stroke="' + INK + '" stroke-width="4"/>' +
      stripes +
      '<g class="a-eye" style="--bd:' + delay + 's"><ellipse cx="34" cy="56" rx="5.500" ry="7" fill="' + eye + '"/><ellipse cx="66" cy="56" rx="5.500" ry="7" fill="' + eye + '"/>' +
      '<circle cx="32.300" cy="53.500" r="1.800" fill="#fff"/><circle cx="64.300" cy="53.500" r="1.800" fill="#fff"/></g>' +
      '<path d="M45 66h10l-5 6z" fill="#ff9fb2" stroke="' + INK + '" stroke-width="2.500" stroke-linejoin="round"/>' +
      '<path d="M50 72q0 7-7 7M50 72q0 7 7 7" fill="none" stroke="' + (coat.dark ? "#fff" : INK) + '" stroke-width="2.500" stroke-linecap="round"/>' +
      '<path d="M26 68 8 64M26 74 8 78M74 68l18-4M74 74l18 4" stroke="' + INK + '" stroke-width="2.500" stroke-linecap="round"/>' +
      "</svg>";
  }

  var rots = [-1.2, 0.9, -0.6, 1.3, -1, 0.7];
  var catList = document.getElementById("catList");
  cfg.cats.forEach(function (cat, i) {
    var coat = cat.id === "kurama" ? COATS[0] : COATS[(i + 1) % COATS.length];
    var li = document.createElement("li");
    li.className = "cat sticker";
    li.style.setProperty("--r", rots[i % rots.length] + "deg");
    li.style.setProperty("--c", CARD_COLORS[i % CARD_COLORS.length]);
    li.style.setProperty("--d", ((i % 3) * 0.09) + "s");
    li.setAttribute("data-reveal", "pop");

    var ava = document.createElement("div");
    ava.className = "cat__ava";
    ava.innerHTML = catFace(coat, ((i * 1.7) % 5).toFixed(1));
    var img = document.createElement("img");
    img.src = "img/cats/" + cat.id + ".jpg";
    img.alt = cat.name;
    img.loading = "lazy";
    img.addEventListener("load", function () { ava.classList.add("has-photo"); });
    img.addEventListener("error", function () { img.remove(); });
    ava.appendChild(img);

    var h = document.createElement("h3");
    h.textContent = cat.name;
    var p = document.createElement("p");
    p.textContent = cat.text;

    li.appendChild(ava);
    li.appendChild(h);
    li.appendChild(p);
    catList.appendChild(li);
  });

  // мастер-классы

  var classList = document.getElementById("classList");
  var classRots = [-1, 1.1, 0.8, -1.2];
  cfg.classes.forEach(function (c, i) {
    var li = document.createElement("li");
    li.className = "class sticker";
    li.style.setProperty("--r", classRots[i % classRots.length] + "deg");
    li.style.setProperty("--d", ((i % 2) * 0.1) + "s");
    li.setAttribute("data-reveal", "pop");

    var price = document.createElement("div");
    price.className = "class__price";
    price.textContent = money(c.price);

    var h = document.createElement("h3");
    h.textContent = c.title;
    var p = document.createElement("p");
    p.textContent = c.text;

    var foot = document.createElement("div");
    foot.className = "class__foot";
    var time = document.createElement("span");
    time.className = "class__time";
    time.textContent = c.time;
    var a = document.createElement("a");
    a.className = "btn btn--ink btn--sm";
    a.href = waLink(cfg.messages.classPrefix + "«" + c.title + "».");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Записаться";
    a.setAttribute("aria-label", "Записаться на мастер-класс «" + c.title + "» в WhatsApp");
    foot.appendChild(time);
    foot.appendChild(a);

    li.appendChild(price);
    li.appendChild(h);
    li.appendChild(p);
    li.appendChild(foot);
    classList.appendChild(li);
  });

  // появление блоков при прокрутке

  var revealEls = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (n) { n.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (n) { io.observe(n); });
  }

  // клубок катится при прокрутке

  var yarn = document.querySelector(".yarn__ball");
  var yarnWrap = document.getElementById("yarn");
  if (yarn && !reduce) {
    var yarnRaf = 0;
    window.addEventListener("scroll", function () {
      if (yarnRaf) return;
      yarnRaf = requestAnimationFrame(function () {
        yarnRaf = 0;
        var r = yarnWrap.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        yarn.style.setProperty("--rot", (window.scrollY * 0.35).toFixed(1) + "deg");
      });
    }, { passive: true });
  }

  // старт

  document.getElementById("year").textContent = new Date().getFullYear();
  renderCalc();
  renderStatus();
  setInterval(renderStatus, 60000);
})();
