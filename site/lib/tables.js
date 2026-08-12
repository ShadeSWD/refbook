/* REFTAB.js — доступ к оцифрованным таблицам справочника (ГОСТ-сортаменты,
 * материалы). Подключение:
 *   <script src="https://shadeswd.duckdns.org/ref/lib/tables.js"></script>
 *   const pb = await REFTAB.row('gost-21937', '20а');  // строка-объект
 * Данные тянутся с /ref/api/tables/<имя>.json (CORS открыт). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.REFTAB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BASE = (typeof REFTAB_BASE !== 'undefined') ? REFTAB_BASE
    : 'https://shadeswd.duckdns.org/ref/api/tables/';
  const cache = {};
  async function load(name) {
    if (cache[name]) return cache[name];
    const r = await fetch(BASE + name + '.json');
    if (!r.ok) throw new Error('таблица недоступна: ' + name);
    cache[name] = await r.json();
    return cache[name];
  }
  /* строка по значению первого столбца (например «20а», «180×7», «20У») */
  async function row(name, key) {
    const t = await load(name);
    const kk = String(key).toLowerCase().replace('x', '×');
    const r = (t.rows || []).find(r => String(r[0]).toLowerCase() === kk ||
      String(r[0]).toLowerCase() === String(key).toLowerCase());
    if (!r) return null;
    const o = {};
    t.columns.forEach((c, i) => { o[c] = r[i]; });
    return o;
  }
  return { load, row, tables: ['gost-21937', 'gost-8509', 'gost-8239', 'gost-8240', 'gost-8732', 'gost-19903', 'materials'] };
});
