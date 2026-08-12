/* calc-API справочника: тонкая HTTP-обёртка над той же lib/rmrs.js,
 * что подключается на страницах — единый источник формул. */
'use strict';
const http = require('http');
const RMRS = require('/lib/rmrs.js');
const RMRSG = require('/lib/rmrs-graph.js');
const NACA = require('/lib/naca.js');
const fs = require('fs');
let TERMS = null;
function terms() {
  if (!TERMS) TERMS = JSON.parse(fs.readFileSync('/data/terms.json', 'utf8')).terms;
  return TERMS;
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(obj, null, 1));
  };
  if (u.pathname === '/terms') {
    const q = (u.searchParams.get('q') || '').toLowerCase();
    const topic = (u.searchParams.get('topic') || '').toLowerCase();
    const all = terms();
    const defOf = v => typeof v === 'string' ? v : v.def;
    const topicsOf = v => typeof v === 'string' ? [] : (v.t || []);
    let hit = Object.entries(all);
    if (topic) hit = hit.filter(([, v]) => topicsOf(v).some(t => t.toLowerCase() === topic));
    if (q) hit = hit.filter(([t, v]) => t.toLowerCase().includes(q) || defOf(v).toLowerCase().includes(q));
    if (!q && !topic) return send(200, { count: hit.length, terms: all });
    return send(200, Object.fromEntries(hit));
  }
  if (u.pathname === '/naca') {
    const code = u.searchParams.get('code') || '0020';
    const n = Math.min(+(u.searchParams.get('n') || 60), 400);
    try {
      return send(200, { code, noseRadius: NACA.noseRadius(code),
        table: NACA.table(code), points: NACA.points(code, n) });
    } catch (e) { return send(400, { error: String(e.message || e) }); }
  }
  if (u.pathname === '/ship/quantities')
    return send(200, { inputs: RMRSG.inputs(), quantities: RMRSG.quantities() });
  if (u.pathname === '/ship/calc') {
    const target = u.searchParams.get('target');
    if (!target) return send(400, { error: 'нужен параметр target', quantities: RMRSG.quantities().map(q => q.id) });
    const ctx = {};
    for (const [k, v] of u.searchParams) if (k !== 'target') ctx[k] = +v;
    try { return send(200, RMRSG.compute(target, ctx)); }
    catch (e) { return send(400, { error: String(e.message || e) }); }
  }
  const m = u.pathname.match(/^\/calc\/?([A-Za-z]*)$/);
  if (!m) return send(404, { error: 'not found' });
  const fn = m[1];
  if (!fn) return send(200, { functions: RMRS.functions, version: RMRS.version });
  if (!RMRS.functions.includes(fn)) return send(400, { error: 'нет такой функции', functions: RMRS.functions });
  const params = Object.fromEntries(u.searchParams);
  try { send(200, RMRS[fn](params)); }
  catch (e) { send(400, { error: String(e.message || e) }); }
}).listen(8080, () => console.log('refbook calc-api on :8080'));
