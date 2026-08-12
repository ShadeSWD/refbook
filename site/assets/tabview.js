/* Рендер оцифрованной таблицы из /api/tables/<name>.json.
 * На странице: <div class="gtable" data-table="gost-21937" data-prefix="p"></div>
 * Каждая строка получает якорь #<prefix><ключ> — на него можно ссылаться
 * из любой задачи любого сайта кластера. */
'use strict';
function slugRow(prefix, key) {
  return prefix + String(key).toLowerCase()
    .replace('×', 'x').replace(',', '_').replace(/\s+/g, '')
    .replace(/а/g, 'a').replace(/б/g, 'b').replace(/у/g, 'u');
}
async function renderGTable(host) {
  const name = host.dataset.table, prefix = host.dataset.prefix || 'r';
  const d = await (await fetch(`api/tables/${name}.json`)).json();
  const cols = d.columns || [];
  let html = `<p class="small">${d.title || ''} — <b>${d.gost || ''}</b>.
    Источник: <a href="${d.source_url}" rel="noopener">${(d.source_url || '').replace(/^https?:\/\//, '').split('/')[0]}</a>,
    проверено ${d.checked || ''}.${d.notes ? ' ' + d.notes : ''}</p>
    <p><input type="search" placeholder="фильтр…" style="padding:6px 10px;width:220px" class="gt-filter"></p>
    <div style="overflow-x:auto"><table class="data" style="width:100%;border-collapse:collapse;font:13.5px system-ui">
    <thead><tr>${cols.map(c => `<th style="text-align:left;border-bottom:1.5px solid #d8d6cf;padding:4px 8px">${c}</th>`).join('')}<th></th></tr></thead><tbody>`;
  for (let i = 0; i < d.rows.length; i++) {
    const row = d.rows[i];
    // Явные машинные ключи строк (row_ids в JSON) — для таблиц с русскими
    // наименованиями в первой колонке; иначе якорь из первой ячейки.
    const id = (d.row_ids && d.row_ids[i]) ? `${prefix}-${d.row_ids[i]}` : slugRow(prefix, row[0]);
    html += `<tr id="${id}">${row.map(v => `<td style="border-bottom:1px solid #eceae3;padding:4px 8px">${v ?? ''}</td>`).join('')}
      <td style="border-bottom:1px solid #eceae3"><a href="#${id}" class="gt-link" title="ссылка на строку">#</a></td></tr>`;
  }
  html += '</tbody></table></div>';
  host.innerHTML = html;
  host.querySelector('.gt-filter').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    host.querySelectorAll('tbody tr').forEach(tr => {
      tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  host.querySelectorAll('.gt-link').forEach(a => a.addEventListener('click', () => {
    navigator.clipboard?.writeText(location.origin + location.pathname + a.getAttribute('href'));
  }));
}
/* Все таблицы страницы рендерятся асинхронно; переход по якорю выполняем один раз
 * после отрисовки ВСЕХ таблиц, иначе позже отрисованные таблицы выше по странице
 * сдвигают уже проскролленную цель. Работает и для якорей секций (#water и т.п.). */
const gtHosts = Array.from(document.querySelectorAll('.gtable'));
Promise.all(gtHosts.map(h => renderGTable(h).catch(e => console.error('gtable', h.dataset.table, e)))).then(() => {
  if (!location.hash) return;
  let id = '';
  try { id = decodeURIComponent(location.hash).slice(1); } catch (e) { id = location.hash.slice(1); }
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'TR') el.style.background = '#fdf3d7';
  el.scrollIntoView({ block: el.tagName === 'TR' ? 'center' : 'start' });
});
