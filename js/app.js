(function () {
  "use strict";

  // красивый адрес без .html (GitHub Pages открывает страницы и без расширения)
  if (/\.html$/.test(location.pathname) && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
    history.replaceState(null, "", location.pathname.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "") + location.search + location.hash);
  }

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
    if (!box) return;
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

  var hasCalc = !!el.total;
  function renderCalc() {
    if (!hasCalc) return;
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

  if (hasCalc) el.modeBtns.forEach(function (b) {
    b.addEventListener("click", function () { state.mode = b.getAttribute("data-mode"); renderCalc(); });
  });
  if (hasCalc) el.chips.forEach(function (b) {
    b.addEventListener("click", function () { state.minutes = Number(b.getAttribute("data-min")); renderCalc(); });
  });
  if (hasCalc) el.slider.addEventListener("input", function () { state.minutes = Number(el.slider.value); renderCalc(); });
  if (hasCalc) document.getElementById("peopleMinus").addEventListener("click", function () {
    state.people = Math.max(1, state.people - 1); renderCalc();
  });
  if (hasCalc) document.getElementById("peoplePlus").addEventListener("click", function () {
    state.people = Math.min(10, state.people + 1); renderCalc();
  });

  // дата на чеке
  if (document.getElementById("ticketDate")) document.getElementById("ticketDate").textContent =
    new Intl.DateTimeFormat("ru-RU", { timeZone: cfg.timezone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  // котик над чеком следит за курсором

  var pupils = Array.prototype.slice.call(document.querySelectorAll(".peek__head .pupil"));
  var lookRaf = 0, lastX = 0, lastY = 0;

  function look() {
    lookRaf = 0;
    pupils.forEach(function (p) {
      var scale = p.ownerSVGElement.getBoundingClientRect().width / 260 || 1;
      var r = p.parentNode.querySelector(".sclera").getBoundingClientRect();
      var dx = lastX - (r.left + r.width / 2), dy = lastY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1;
      var u = Math.min(6, d / scale / 14);
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

  var CARD_COLORS = ["#ffd15c", "#a9ddf2", "#ffb8c6", "#bdebc8", "#ffc48a"];
  var PAW_AVA = '<svg class="ava-paw" viewBox="0 0 64 64" aria-hidden="true"><use href="#paw"/></svg>';

  var rots = [-1.2, 0.9, -0.6, 1.3, -1, 0.7];
  var catList = document.getElementById("catList");
  if (catList) cfg.cats.forEach(function (cat, i) {
    var li = document.createElement("li");
    li.className = "cat sticker";
    li.style.setProperty("--r", rots[i % rots.length] + "deg");
    li.style.setProperty("--c", CARD_COLORS[i % CARD_COLORS.length]);
    li.style.setProperty("--d", ((i % 3) * 0.09) + "s");
    li.setAttribute("data-reveal", "pop");

    var ava = document.createElement("div");
    ava.className = "cat__ava";
    ava.innerHTML = PAW_AVA;
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

    var tags = document.createElement("ul");
    tags.className = "tags";
    ["спасённый"].concat(cat.tags || []).forEach(function (t, k) {
      var tg = document.createElement("li");
      tg.textContent = t;
      if (k === 0) tg.className = "tag--main";
      tags.appendChild(tg);
    });
    p.className = "cat__text";
    var more = document.createElement("button");
    more.type = "button";
    more.className = "cat__more";
    more.textContent = "Читать историю";
    more.setAttribute("aria-expanded", "false");
    more.addEventListener("click", function () {
      var open = li.classList.toggle("is-open");
      more.textContent = open ? "Свернуть" : "Читать историю";
      more.setAttribute("aria-expanded", String(open));
    });

    li.appendChild(ava);
    li.appendChild(h);
    li.appendChild(tags);
    li.appendChild(p);
    li.appendChild(more);
    catList.appendChild(li);
  });

  // котики на главной (первые шесть)
  var teaser = document.getElementById("catTeaser");
  if (teaser) cfg.cats.slice(0, 6).forEach(function (cat, i) {
    var li = document.createElement("li");
    li.setAttribute("data-reveal", "pop");
    li.style.setProperty("--d", (i * 0.06) + "s");
    var a = document.createElement("a");
    a.className = "meet__item";
    a.href = "cats";
    var ava = document.createElement("div");
    ava.className = "cat__ava";
    ava.innerHTML = PAW_AVA;
    var img = document.createElement("img");
    img.src = "img/cats/" + cat.id + ".jpg";
    img.alt = cat.name;
    img.loading = "lazy";
    img.addEventListener("load", function () { ava.classList.add("has-photo"); });
    img.addEventListener("error", function () { img.remove(); });
    ava.appendChild(img);
    var name = document.createElement("span");
    name.textContent = cat.name;
    a.appendChild(ava); a.appendChild(name); li.appendChild(a);
    teaser.appendChild(li);
  });

  // цифры считаются при появлении
  document.querySelectorAll("[data-count]").forEach(function (n) {
    var target = parseFloat(n.getAttribute("data-count")), dec = Number(n.getAttribute("data-dec") || 0);
    var suf = n.getAttribute("data-suffix") || "";
    function fmt(v) { return v.toFixed(dec).replace(".", ",") + suf; }
    n.textContent = fmt(target);
    if (reduce || !("IntersectionObserver" in window)) return;
    n.textContent = fmt(0);
    var io2 = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io2.disconnect();
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
        n.textContent = fmt(target * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    io2.observe(n);
  });

  // мастер-классы

  var S = 'fill="none" stroke="#1c1530" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"';
  var CLASS_ICONS = [
    '<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="26" rx="9" ry="7.500" fill="#fff" stroke="#1c1530" stroke-width="2.600"/><ellipse cx="9" cy="17" rx="3.200" ry="4.200" fill="#fff" stroke="#1c1530" stroke-width="2.400"/><ellipse cx="16" cy="10" rx="3.200" ry="4.200" fill="#fff" stroke="#1c1530" stroke-width="2.400"/><ellipse cx="24" cy="10" rx="3.200" ry="4.200" fill="#fff" stroke="#1c1530" stroke-width="2.400"/><ellipse cx="31" cy="17" rx="3.200" ry="4.200" fill="#fff" stroke="#1c1530" stroke-width="2.400"/></svg>',
    '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="6" width="26" height="22" rx="2.500" fill="#fff" stroke="#1c1530" stroke-width="2.600"/><path d="M12 22l5-6 4 4 3-3 4 5" ' + S + '/><circle cx="26" cy="12" r="2" fill="#1c1530"/><path d="M14 28l-4 7M26 28l4 7" ' + S + '/></svg>',
    '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="11" y="17" width="18" height="17" rx="3" fill="#fff" stroke="#1c1530" stroke-width="2.600"/><path d="M20 17v-3" ' + S + '/><path d="M20 4c4 3 4.500 6 0 9-4.500-3-4-6 0-9z" fill="#ffd15c" stroke="#1c1530" stroke-width="2.400" stroke-linejoin="round"/></svg>',
    '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 34h24M20 34V22M12 22h16" ' + S + '/><rect x="16" y="12" width="8" height="10" rx="2" fill="#fff" stroke="#1c1530" stroke-width="2.600"/><path d="M20 4c3 2.500 3.500 5 0 7.500-3.500-2.500-3-5 0-7.500z" fill="#ffd15c" stroke="#1c1530" stroke-width="2.400" stroke-linejoin="round"/></svg>'
  ];


  var classList = document.getElementById("classList");
  var classRots = [-1, 1.1, 0.8, -1.2];
  if (classList) cfg.classes.forEach(function (c, i) {
    var li = document.createElement("li");
    li.className = "class sticker";
    li.style.setProperty("--r", classRots[i % classRots.length] + "deg");
    li.style.setProperty("--d", ((i % 2) * 0.1) + "s");
    li.setAttribute("data-reveal", "pop");

    var photo = document.createElement("img");
    photo.className = "class__photo";
    photo.src = "img/classes/" + (i + 1) + ".jpg";
    photo.alt = c.title + ": пример работы";
    photo.loading = "lazy";
    photo.addEventListener("error", function () { photo.remove(); li.classList.add("no-photo"); });
    var ico = document.createElement("div");
    ico.className = "class__icon";
    ico.innerHTML = CLASS_ICONS[i % CLASS_ICONS.length];
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

    li.appendChild(photo);
    li.appendChild(price);
    li.appendChild(ico);
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

  // лента: пауза при наведении и по касанию
  var tk = document.querySelector(".ticker");
  if (tk) {
    tk.addEventListener("pointerenter", function () { tk.classList.add("is-paused"); });
    tk.addEventListener("pointerleave", function () { tk.classList.remove("is-paused"); });
    tk.addEventListener("click", function () { tk.classList.toggle("is-paused"); });
  }

  // тема

  var themeBtn = document.getElementById("theme");
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
    if (themeBtn) themeBtn.setAttribute("aria-pressed", String(t === "dark"));
  }
  applyTheme(document.documentElement.getAttribute("data-theme"));
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    var root = document.documentElement;
    root.classList.add("theme-anim");
    clearTimeout(window.__themeT);
    window.__themeT = setTimeout(function () { root.classList.remove("theme-anim"); }, 600);
    applyTheme(next);
    try { localStorage.setItem("kotiko-theme", next); } catch (e) {}
  });

  // шаги лапок в шапке показывают прогресс прокрутки

  var trail = document.getElementById("trail");
  var paws = trail ? Array.prototype.slice.call(trail.querySelectorAll("svg")) : [];
  var scrollTick = 0;
  function onScroll() {
    scrollTick = 0;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var prog = max > 0 ? window.scrollY / max : 0;
    var lit = Math.round(prog * paws.length);
    paws.forEach(function (p, i) { p.classList.toggle("is-lit", i < lit); });
  }
  if (paws.length) {
    window.addEventListener("scroll", function () { if (!scrollTick) scrollTick = requestAnimationFrame(onScroll); }, { passive: true });
    onScroll();
  }
  // сохранить чек картинкой

  var saveBtn = document.getElementById("saveReceipt");
  if (saveBtn) saveBtn.addEventListener("click", function () {
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function () {
      var W = 640, H = 740, k = 2;
      var cv = document.createElement("canvas");
      cv.width = W * k; cv.height = H * k;
      var c = cv.getContext("2d");
      c.scale(k, k);
      c.fillStyle = "#ff6a1f"; c.fillRect(0, 0, W, H);
      // чек
      var x = 60, w = W - 120, y = 70, h = H - 150;
      c.fillStyle = "#1c1530";
      c.beginPath(); c.rect(x + 8, y + 8, w, h); c.fill();
      c.fillStyle = "#fffdf6";
      c.beginPath(); c.rect(x, y, w, h); c.fill();
      c.beginPath(); c.moveTo(x, y + h);
      for (var zx = x, up = false; zx < x + w; zx += 16, up = !up) c.lineTo(zx + 8, y + h + (up ? 0 : 14));
      c.lineTo(x + w, y + h); c.closePath(); c.fill();
      var mono = '"JetBrains Mono", ui-monospace, Menlo, monospace', disp = 'Unbounded, "Montserrat", Arial, sans-serif';
      c.fillStyle = "#1c1530"; c.textAlign = "left";
      c.font = "700 34px " + disp; c.fillText("Kotiko", x + 36, y + 70);
      c.font = "500 17px " + mono; c.fillStyle = "#4b4560";
      var date = new Intl.DateTimeFormat("ru-RU", { timeZone: cfg.timezone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
      c.fillText("Котокафе, Астана · " + date, x + 36, y + 100);
      c.strokeStyle = "#1c1530"; c.lineWidth = 2; c.setLineDash([8, 7]);
      function dash(yy) { c.beginPath(); c.moveTo(x + 30, yy); c.lineTo(x + w - 30, yy); c.stroke(); }
      dash(y + 128);
      var rate = cfg.rate[state.mode];
      var rows = [
        ["День", state.mode === "weekend" ? "выходные и праздники" : "будни"],
        ["Время", durationText(state.minutes)],
        ["Гостей", String(state.people)],
        ["Цена", rate + " ₸ / мин"]
      ];
      c.font = "500 20px " + mono;
      rows.forEach(function (r, i) {
        var yy = y + 178 + i * 46;
        c.textAlign = "left"; c.fillStyle = "#4b4560"; c.fillText(r[0], x + 36, yy);
        c.textAlign = "right"; c.fillStyle = "#1c1530"; c.fillText(r[1], x + w - 36, yy);
      });
      dash(y + 178 + rows.length * 46 - 14);
      var total = money(rate * state.minutes * state.people).replace(/\u00a0/g, " ");
      c.textAlign = "left"; c.font = "700 22px " + mono; c.fillStyle = "#1c1530"; c.fillText("Итого", x + 36, y + 178 + rows.length * 46 + 62);
      c.textAlign = "right";
      c.font = "700 54px " + disp;
      var tw = c.measureText(total).width;
      c.fillStyle = "#ffd15c"; c.fillRect(x + w - 36 - tw - 8, y + 178 + rows.length * 46 + 42, tw + 16, 24);
      c.fillStyle = "#1c1530"; c.fillText(total, x + w - 36, y + 178 + rows.length * 46 + 66);
      c.setLineDash([]);
      c.textAlign = "left"; c.font = "400 16px " + mono; c.fillStyle = "#4b4560";
      c.fillText("Оплата по времени, цена за человека.", x + 36, y + h - 64);
      c.fillText("kotiko.w-smp.in", x + 36, y + h - 36);
      c.textAlign = "center"; c.font = "700 20px " + disp; c.fillStyle = "#1c1530";
      c.fillText("Ждём вас в гости!", W / 2, H - 30);
      cv.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], "kotiko-chek.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android/i.test(navigator.userAgent)) {
          navigator.share({ files: [file], title: "Мой чек в Kotiko" }).catch(function () {});
        } else {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "kotiko-chek.png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }
      }, "image/png");
    });
  });

  // старт

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  // мобильное меню
  var burger = document.getElementById("burger"), nav = document.getElementById("nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { burger.click(); burger.focus(); }
    });
  }
  renderCalc();
  renderStatus();
  setInterval(renderStatus, 60000);
})();
