/* sites.js — каталог сайтов кластера строится из /hub.json, а не правится
 * руками: список сайтов живёт в одном месте, и страница не может отстать.
 *
 * Развёрнутые описания (то, что не влезает в подпись хаба) лежат рядом, в
 * api/tables/sites.json, и подставляются по пути сайта. Если описания нет,
 * берётся короткое из хаба. Порядок тот же, что в общем подвале кластера:
 * справочник, relmet, дальше по алфавиту.
 */
'use strict';
(function () {
  var FIRST = ['/ref/', '/relmet/'];
  var host = document.getElementById('sites-list');
  if (!host) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(sites, long) {
    sites.sort(function (a, b) {
      var ia = FIRST.indexOf(a.path), ib = FIRST.indexOf(b.path);
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      }
      return String(a.name).localeCompare(String(b.name), 'ru');
    });
    var dl = document.createElement('dl');
    sites.forEach(function (s) {
      var here = s.path === '/ref/';
      var dt = document.createElement('dt');
      dt.style.cssText = 'font-weight:700;margin-top:14px';
      dt.innerHTML = '<a href="' + esc(here ? './' : 'https://shadeswd.duckdns.org' + s.path) + '">'
        + (s.emoji ? esc(s.emoji) + ' ' : '') + esc(s.name) + '</a>'
        + (here ? ' <span class="small">(этот сайт)</span>' : '');
      var dd = document.createElement('dd');
      dd.innerHTML = long[s.path] || esc(s.desc || '');
      dl.appendChild(dt); dl.appendChild(dd);
    });
    host.innerHTML = '';
    host.appendChild(dl);
    var n = document.getElementById('sites-count');
    if (n) n.textContent = sites.length;
  }

  Promise.all([
    fetch('/hub.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }),
    fetch('api/tables/sites.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; }),
  ]).then(function (res) {
    var hub = res[0], long = res[1] || {};
    if (!hub || !Array.isArray(hub.sites)) {
      /* Запасной текст читают обычные посетители, поэтому без внутренней кухни. */
      host.innerHTML = '<p class="small">Список сайтов сейчас недоступен. '
        + 'Откройте <a href="https://shadeswd.duckdns.org/">главную кластера</a> — '
        + 'оттуда открываются все курсы.</p>';
      return;
    }
    render(hub.sites.slice(), long);
  });
})();
