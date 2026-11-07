(function () {
  "use strict";

  var cfg = window.HADIYA;
  var dict = window.I18N;
  var menu = window.HADIYA_MENU || [];
  var lang = "ru";
  var activeTab = 0;

  function t(key) {
    return (dict[lang] && dict[lang][key]) || dict.ru[key] || key;
  }

  function waLink(text) {
    return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(text);
  }

  // язык

  function applyLang(next) {
    lang = dict[next] ? next : "ru";
    try { localStorage.setItem("hadiya-lang", lang); } catch (e) {}
    document.documentElement.lang = lang === "kk" ? "kk" : "ru";

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-lang]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === lang));
    });
    document.querySelectorAll("[data-wa]").forEach(function (a) {
      a.href = waLink(t(a.getAttribute("data-wa") === "menu" ? "wa_menu" : "wa_hello"));
      a.target = "_blank";
      a.rel = "noopener";
    });
    renderMenu();
    renderStatus();
  }

  function detectLang() {
    try {
      var saved = localStorage.getItem("hadiya-lang");
      if (saved && dict[saved]) return saved;
    } catch (e) {}
    return /^kk/i.test(navigator.language || "") ? "kk" : "ru";
  }

  // открыто или закрыто (Астана, UTC+5)

  function renderStatus() {
    var box = document.getElementById("status");
    var text = document.getElementById("statusText");
    var hour = Number(new Intl.DateTimeFormat("en-GB", {
      hour: "numeric", hour12: false, timeZone: cfg.timezone
    }).format(new Date())) % 24;
    var open = hour >= cfg.open.from && hour < cfg.open.to;
    box.classList.toggle("is-open", open);
    text.textContent = t(open ? "status_open" : "status_closed");
  }

  // меню

  function formatPrice(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }

  function renderMenu() {
    var tabs = document.getElementById("menuTabs");
    var list = document.getElementById("menuList");
    var empty = document.getElementById("menuEmpty");
    tabs.textContent = "";
    list.textContent = "";

    if (!menu.length) { empty.hidden = false; return; }
    empty.hidden = true;
    if (activeTab >= menu.length) activeTab = 0;

    menu.forEach(function (cat, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === activeTab));
      b.textContent = cat.title[lang] || cat.title.ru;
      b.addEventListener("click", function () { activeTab = i; renderMenu(); });
      tabs.appendChild(b);
    });

    menu[activeTab].items.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "menu__item";
      var name = document.createElement("strong");
      name.textContent = it.name[lang] || it.name.ru;
      var price = document.createElement("span");
      price.textContent = formatPrice(it.price);
      row.appendChild(name);
      row.appendChild(price);
      if (it.desc) {
        var d = document.createElement("p");
        d.textContent = it.desc[lang] || it.desc.ru;
        row.appendChild(d);
      }
      list.appendChild(row);
    });
  }

  // бронь через WhatsApp

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: cfg.timezone }).format(new Date());
  }

  function initForm() {
    var form = document.getElementById("bookForm");
    var error = document.getElementById("formError");
    form.elements.date.min = todayISO();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements;
      ["name", "date", "time"].forEach(function (n) { f[n].classList.remove("is-bad"); });

      var missing = ["name", "date", "time"].filter(function (n) { return !f[n].value.trim(); });
      if (missing.length) {
        missing.forEach(function (n) { f[n].classList.add("is-bad"); });
        showError(t("err_fill"));
        f[missing[0]].focus();
        return;
      }
      if (f.date.value < todayISO()) {
        f.date.classList.add("is-bad");
        showError(t("err_past"));
        f.date.focus();
        return;
      }
      showError("");

      var lines = [
        t("wa_book"),
        t("wa_name") + ": " + f.name.value.trim(),
        t("wa_date") + ": " + f.date.value.split("-").reverse().join("."),
        t("wa_time") + ": " + f.time.value,
        t("wa_guests") + ": " + (f.guests.value || "2"),
        t("wa_hall") + ": " + t("hall_" + f.hall.value)
      ];
      if (f.note.value.trim()) lines.push(t("wa_note") + ": " + f.note.value.trim());

      window.open(waLink(lines.join("\n")), "_blank", "noopener");
    });

    function showError(msg) {
      error.textContent = msg;
      error.hidden = !msg;
    }
  }

  // старт

  document.querySelectorAll("[data-lang]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyLang(btn.getAttribute("data-lang")); });
  });
  document.getElementById("year").textContent = new Date().getFullYear();
  initForm();
  applyLang(detectLang());
  setInterval(renderStatus, 60000);
})();
