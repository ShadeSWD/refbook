/* calc-API справочника: тонкая HTTP-обёртка над той же lib/rmrs.js,
 * что подключается на страницах — единый источник формул. */
'use strict';
const http = require('http');
const RMRS = require('/lib/rmrs.js');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(obj, null, 1));
  };
  const m = u.pathname.match(/^\/calc\/?([A-Za-z]*)$/);
  if (!m) return send(404, { error: 'not found' });
  const fn = m[1];
  if (!fn) return send(200, { functions: RMRS.functions, version: RMRS.version });
  if (!RMRS.functions.includes(fn)) return send(400, { error: 'нет такой функции', functions: RMRS.functions });
  const params = Object.fromEntries(u.searchParams);
  try { send(200, RMRS[fn](params)); }
  catch (e) { send(400, { error: String(e.message || e) }); }
}).listen(8080, () => console.log('refbook calc-api on :8080'));
