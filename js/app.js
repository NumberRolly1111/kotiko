(function () {
  "use strict";

  var cfg = window.KOTIKO;

  function waLink(text) {
    return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(text);
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }

  // время и день недели в Астане (UTC+5)
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function astanaNow() {
    var parts = new Intl.DateTimeFormat("en-US", {
      weekday: "short", hour: "numeric", minute: "numeric", hour12: false, timeZone: cfg.timezone
    }).formatToParts(new Date());
    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    return {
      day: WEEKDAYS.indexOf(out.weekday),
      hour: Number(out.hour) % 24,
      minute: Number(out.minute)
    };
  }

  function isWeekendDay(d) { return d === 0 || d === 6; }
  function hoursFor(d) { return isWeekendDay(d) ? cfg.hours.weekend : cfg.hours.weekday; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

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
      var next = hoursFor((now.day + 1) % 7);
      text.textContent = "Сейчас закрыто, откроемся завтра в " + pad(next.from) + ":00";
    }
  }

  // калькулятор

  var state = { mode: isWeekendDay(astanaNow().day) ? "weekend" : "weekday", minutes: 60, people: 1 };
  var el = {
    total: document.getElementById("calcTotal"),
    detail: document.getElementById("calcDetail"),
    slider: document.getElementById("minutes"),
    minutesText: document.getElementById("minutesText"),
    peopleOut: document.getElementById("peopleOut"),
    modeBtns: document.querySelectorAll("[data-mode]"),
    chips: document.querySelectorAll("[data-min]")
  };

  function durationText(m) {
    if (m < 60) return m + " мин";
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + " ч " + r + " мин" : h + " ч";
  }

  function renderCalc() {
    var rate = cfg.rate[state.mode];
    el.total.textContent = money(rate * state.minutes * state.people);
    el.detail.textContent = rate + " ₸ × " + state.minutes + " мин × " + state.people + " чел.";
    el.minutesText.textContent = durationText(state.minutes);
    el.peopleOut.textContent = state.people;
    el.slider.value = state.minutes;
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

  // котики

  var catList = document.getElementById("catList");
  cfg.cats.forEach(function (cat, i) {
    var li = document.createElement("li");
    li.className = "cat";

    var ava = document.createElement("div");
    ava.className = "cat__ava cat__ava--" + (i % 3);
    ava.setAttribute("aria-hidden", "true");
    ava.textContent = cat.name.charAt(0);
    var img = document.createElement("img");
    img.src = "img/cats/" + cat.id + ".jpg";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", function () { img.remove(); });
    ava.appendChild(img);

    var body = document.createElement("div");
    var h = document.createElement("h3");
    h.textContent = cat.name;
    var p = document.createElement("p");
    p.textContent = cat.text;
    body.appendChild(h);
    body.appendChild(p);

    li.appendChild(ava);
    li.appendChild(body);
    catList.appendChild(li);
  });

  // мастер-классы

  var classList = document.getElementById("classList");
  cfg.classes.forEach(function (c) {
    var li = document.createElement("li");
    li.className = "class";

    var main = document.createElement("div");
    var h = document.createElement("h3");
    h.textContent = c.title;
    var p = document.createElement("p");
    p.textContent = c.text;
    main.appendChild(h);
    main.appendChild(p);

    var meta = document.createElement("div");
    meta.className = "class__meta";
    var price = document.createElement("strong");
    price.textContent = money(c.price);
    var time = document.createElement("span");
    time.textContent = c.time + ", с человека";
    meta.appendChild(price);
    meta.appendChild(time);

    var a = document.createElement("a");
    a.className = "btn btn--ink btn--sm";
    a.href = waLink(cfg.messages.classPrefix + "«" + c.title + "».");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Записаться";
    a.setAttribute("aria-label", "Записаться на мастер-класс «" + c.title + "» в WhatsApp");

    li.appendChild(main);
    li.appendChild(meta);
    li.appendChild(a);
    classList.appendChild(li);
  });

  // старт

  document.getElementById("year").textContent = new Date().getFullYear();
  renderCalc();
  renderStatus();
  setInterval(renderStatus, 60000);
})();
