/* Банк судов-прототипов: таблица с фильтром по типу, карточка судна,
 * график кривых элементов теоретического чертежа и передача выбранного
 * судна в решатели кластера (проектирование, статика).
 * Данные: api/tables/ships.json (те же данные отдаются по HTTP всем сайтам). */
'use strict';
(function () {
  const DESIGN = 'https://shadeswd.duckdns.org/design/solver';
  const STAT = 'https://shadeswd.duckdns.org/shipstat/solver';
  const NS = 'http://www.w3.org/2000/svg';

  let DOC = null, TYPE = '', Q = '', CUR = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function fmt(v, d) {
    if (v == null || !isFinite(v)) return '—';
    const n = (d === undefined) ? (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 3) : d;
    return v.toLocaleString('ru-RU', { minimumFractionDigits: n, maximumFractionDigits: n });
  }
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const name = (s) => s.project || s.type_name || ('вариант ' + s.variant);
  const beam = (s) => s.B_eff || s.B;

  /* ---------- таблица ---------- */
  const COLS = [
    ['№', (s) => s.variant, 'l'],
    ['тип', (s) => esc(s.type_name || s.type), 'l'],
    ['проект', (s) => esc(s.project || '—'), 'l'],
    ['L<sub>пп</sub>, м', (s) => fmt(s.L_pp, 2)],
    ['L<sub>нб</sub>, м', (s) => fmt(s.L_max, 2)],
    ['B, м', (s) => fmt(beam(s), 2)],
    ['T, м', (s) => fmt(s.T, 2)],
    ['H*, м', (s) => fmt(s.H_est, 2)],
    ['V, м³', (s) => fmt(s.design && s.design.V, 0)],
    ['D, т', (s) => fmt(s.design && s.design.D, 0)],
    ['δ', (s) => fmt(s.design && s.design.Cb, 3)],
    ['α', (s) => fmt(s.design && s.design.Cw, 3)],
    ['β', (s) => fmt(s.design && s.design.Cm, 3)],
    ['φ', (s) => fmt(s.design && s.design.Cp, 3)],
  ];

  function buildTable() {
    const t = $('ships-table');
    t.innerHTML = '<thead><tr>' + COLS.map(
      (c) => `<th class="${c[2] || ''}">${c[0]}</th>`).join('') + '</tr></thead><tbody>'
      + DOC.ships.map((s) => `<tr id="row-${s.id}" data-id="${s.id}" data-type="${s.type}"
        data-search="${esc([s.variant, s.type, s.type_name, s.project, s.designer, s.tag].join(' ').toLowerCase())}">`
        + COLS.map((c) => `<td class="${c[2] || ''}">${c[1](s)}</td>`).join('') + '</tr>').join('')
      + '</tbody>';
    t.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => select(tr.dataset.id, true));
    });
  }

  function buildChips() {
    const used = [...new Set(DOC.ships.map((s) => s.type))];
    const host = $('type-chips');
    host.innerHTML = `<button data-t="">все типы (${DOC.ships.length})</button>` + used.map((t) => {
      const n = DOC.ships.filter((s) => s.type === t).length;
      return `<button data-t="${t}">${esc(DOC.types[t] || t)} (${n})</button>`;
    }).join('');
    host.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      TYPE = b.dataset.t; applyFilter();
    }));
  }

  function applyFilter() {
    let n = 0;
    document.querySelectorAll('#ships-table tbody tr').forEach((tr) => {
      const okT = !TYPE || tr.dataset.type === TYPE;
      const okQ = !Q || tr.dataset.search.includes(Q);
      const vis = okT && okQ;
      tr.style.display = vis ? '' : 'none';
      if (vis) n++;
    });
    $('ship-count').textContent = `показано ${n} из ${DOC.ships.length}`;
    document.querySelectorAll('#type-chips button').forEach((b) => {
      b.classList.toggle('on', b.dataset.t === TYPE);
    });
  }

  /* ---------- график кривых элементов ---------- */
  function chart(host, s) {
    const rows = s.kech || [];
    const ix = {};
    DOC.kech_columns.forEach((c, i) => { ix[c] = i; });
    const W = 640, H = 320, padL = 62, padR = 62, padT = 26, padB = 42;
    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`, class: 'geo-board', role: 'img',
      'aria-label': 'Кривые элементов: водоизмещение и площадь ватерлинии по осадке',
    });
    svg.style.maxWidth = '640px';
    host.innerHTML = '';
    host.appendChild(svg);
    if (rows.length < 2) {
      const t = el('text', { x: 12, y: 24 }, svg);
      t.style.cssText = 'font:13px system-ui;fill:#6b6b74';
      t.textContent = 'таблица КЭТЧ для этого варианта отсутствует';
      return;
    }
    const ts = rows.map((r) => r[ix.T]);
    const vs = rows.map((r) => r[ix.V]);
    const as = rows.map((r) => r[ix.Aw]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const v1 = Math.max(...vs), a0 = Math.min(...as) * 0.9, a1 = Math.max(...as);
    const X = (t) => padL + (t - t0) / (t1 - t0 || 1) * (W - padL - padR);
    const YV = (v) => H - padB - v / (v1 || 1) * (H - padT - padB);
    const YA = (a) => H - padB - (a - a0) / ((a1 - a0) || 1) * (H - padT - padB);

    // сетка и оси
    for (let k = 0; k <= 4; k++) {
      const y = H - padB - k / 4 * (H - padT - padB);
      el('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: '#e7e5de', 'stroke-width': 1 }, svg);
      const lv = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end' }, svg);
      lv.style.cssText = 'font:10px system-ui;fill:#155e75';
      lv.textContent = fmt(v1 * k / 4, 0);
      const la = el('text', { x: W - padR + 6, y: y + 4 }, svg);
      la.style.cssText = 'font:10px system-ui;fill:#1a7f37';
      la.textContent = fmt(a0 + (a1 - a0) * k / 4, 0);
    }
    el('line', { x1: padL, y1: H - padB, x2: W - padR, y2: H - padB, stroke: '#16161a', 'stroke-width': 1.4 }, svg);
    for (const t of ts) {
      el('line', { x1: X(t), y1: H - padB, x2: X(t), y2: H - padB + 4, stroke: '#6b6b74' }, svg);
    }
    for (const t of [t0, (t0 + t1) / 2, t1]) {
      const lt = el('text', { x: X(t), y: H - padB + 17, 'text-anchor': 'middle' }, svg);
      lt.style.cssText = 'font:10.5px system-ui;fill:#6b6b74';
      lt.textContent = fmt(t, 1);
    }
    const cap = el('text', { x: (padL + W - padR) / 2, y: H - 8, 'text-anchor': 'middle' }, svg);
    cap.style.cssText = 'font:11px system-ui;fill:#6b6b74';
    cap.textContent = 'осадка T, м';
    const ttl = el('text', { x: padL, y: 15 }, svg);
    ttl.style.cssText = 'font:600 12px system-ui;fill:#16161a';
    ttl.textContent = 'Кривые элементов: V(T), м³ · A(T), м²';

    // проектная осадка
    if (s.T >= t0 && s.T <= t1) {
      el('line', {
        x1: X(s.T), y1: padT, x2: X(s.T), y2: H - padB,
        stroke: '#b3382e', 'stroke-width': 1.2, 'stroke-dasharray': '4 4',
      }, svg);
      const lt = el('text', { x: X(s.T) + 4, y: padT + 10 }, svg);
      lt.style.cssText = 'font:10.5px system-ui;fill:#b3382e';
      lt.textContent = 'T = ' + fmt(s.T, 2) + ' м';
    }
    // серии
    el('polyline', {
      points: rows.map((r) => X(r[ix.T]).toFixed(1) + ',' + YV(r[ix.V]).toFixed(1)).join(' '),
      fill: 'none', stroke: '#155e75', 'stroke-width': 2.2, 'stroke-linejoin': 'round',
    }, svg);
    el('polyline', {
      points: rows.map((r) => X(r[ix.T]).toFixed(1) + ',' + YA(r[ix.Aw]).toFixed(1)).join(' '),
      fill: 'none', stroke: '#1a7f37', 'stroke-width': 2.2, 'stroke-dasharray': '7 4',
      'stroke-linejoin': 'round',
    }, svg);
    for (const r of rows) {
      el('circle', { cx: X(r[ix.T]), cy: YV(r[ix.V]), r: 2.6, fill: '#155e75' }, svg);
      el('circle', { cx: X(r[ix.T]), cy: YA(r[ix.Aw]), r: 2.6, fill: '#1a7f37' }, svg);
    }
    const l1 = el('text', { x: padL + 4, y: padT + 24 }, svg);
    l1.style.cssText = 'font:600 11px system-ui;fill:#155e75';
    l1.textContent = 'V — объёмное водоизмещение (левая шкала)';
    const l2 = el('text', { x: padL + 4, y: padT + 39 }, svg);
    l2.style.cssText = 'font:600 11px system-ui;fill:#1a7f37';
    l2.textContent = 'A — площадь ватерлинии (правая шкала)';

    // считывание значений курсором
    const ln = el('line', { y1: padT, y2: H - padB, stroke: '#6b6b74', 'stroke-width': 1, opacity: 0 }, svg);
    const dv = el('circle', { r: 4, fill: '#155e75', opacity: 0 }, svg);
    const da = el('circle', { r: 4, fill: '#1a7f37', opacity: 0 }, svg);
    const tx = el('text', { opacity: 0 }, svg);
    tx.style.cssText = 'font:600 11px system-ui;fill:#16161a;paint-order:stroke;stroke:#ffffffdd;stroke-width:3px';
    svg.addEventListener('pointermove', (ev) => {
      const b = svg.getBoundingClientRect();
      const vx = t0 + ((ev.clientX - b.left) / b.width * W - padL) / (W - padL - padR) * (t1 - t0);
      let best = rows[0];
      for (const r of rows) if (Math.abs(r[ix.T] - vx) < Math.abs(best[ix.T] - vx)) best = r;
      ln.setAttribute('x1', X(best[ix.T])); ln.setAttribute('x2', X(best[ix.T]));
      dv.setAttribute('cx', X(best[ix.T])); dv.setAttribute('cy', YV(best[ix.V]));
      da.setAttribute('cx', X(best[ix.T])); da.setAttribute('cy', YA(best[ix.Aw]));
      tx.setAttribute('x', Math.min(X(best[ix.T]) + 7, W - padR - 150));
      tx.setAttribute('y', Math.max(YV(best[ix.V]) - 9, padT + 12));
      tx.textContent = `T=${fmt(best[ix.T], 2)}  V=${fmt(best[ix.V], 0)}  A=${fmt(best[ix.Aw], 0)}`;
      [ln, dv, da, tx].forEach((e) => e.setAttribute('opacity', 1));
    });
    svg.addEventListener('pointerleave', () => {
      [ln, dv, da, tx].forEach((e) => e.setAttribute('opacity', 0));
    });
  }

  /* ---------- карточка ---------- */
  function kv(caption, pairs) {
    const rows = pairs.filter((p) => p[1] !== undefined && p[1] !== null && p[1] !== '—');
    if (!rows.length) return '';
    return `<table class="kv"><caption>${caption}</caption><tbody>`
      + rows.map((p) => `<tr><td>${p[0]}</td><td class="v">${p[1]}</td></tr>`).join('')
      + '</tbody></table>';
  }
  const u = (k) => {
    const un = DOC.units[k];
    return (!un || un === '—') ? '' : ' ' + un.split(' ')[0];
  };
  const val = (o, k, d) => (o && o[k] != null ? fmt(o[k], d) + u(k) : null);

  function protoLinks(s) {
    const d = s.design || {};
    const qs = new URLSearchParams({
      ship: s.id, name: name(s), type: s.type,
      L: String(s.L_pp), B: String(beam(s)), T: String(s.T),
      Cb: d.Cb != null ? d.Cb.toFixed(4) : '',
    });
    if (s.H_est) qs.set('H', String(s.H_est));
    if (d.D != null) qs.set('D', String(Math.round(d.D)));
    if (d.V != null) qs.set('V', String(Math.round(d.V)));
    return { design: DESIGN + '?' + qs.toString(), stat: STAT + '?' + qs.toString() };
  }

  function card(s) {
    const h = s.hydro || {}, d = s.design || {}, b = s.bulb || {};
    const xm = (v) => (v == null || s.L_pp == null ? null : fmt(v - s.L_pp / 2, 2) + ' м');
    const links = protoLinks(s);
    const cols = DOC.kech_columns;
    const kechRows = s.kech || [];
    const host = $('ship-card');
    host.innerHTML = `
      <div class="panel">
        <h3 style="margin:0 0 2px">Вариант ${s.variant} · ${esc(s.type_name)}${s.project ? ' · ' + esc(s.project) : ''}</h3>
        <p class="small" style="margin:0 0 10px">Элементы при проектной осадке взяты
          ${d.from === 'hydrostat' ? 'из сводки гидростатики варианта'
            : 'интерполяцией таблицы кривых элементов на проектную осадку'}${
            s.designer ? '; подпись в задании — «' + esc(s.designer) + '»' : ''}.
          ${s.B_note ? '<b>Примечание:</b> ' + esc(s.B_note) + '; в расчёты идёт ширина по ватерлинии.' : ''}</p>
        <div class="boards">
          <div>${kv('Главные размерения', [
            ['Длина между перпендикулярами L<sub>пп</sub>', val(s, 'L_pp', 2)],
            ['Длина наибольшая L<sub>нб</sub>', val(s, 'L_max', 2)],
            ['Длина по ватерлинии L<sub>вл</sub>', val(d, 'Lwl', 2)],
            ['Ширина на миделе B', val(s, 'B', 3)],
            ['Ширина наибольшая B<sub>нб</sub>', val(s, 'B_max', 3)],
            ['Ширина по ватерлинии (расчётная) B', val(s, 'B_eff', 3)],
            ['Проектная осадка T', val(s, 'T', 3)],
            ['Высота борта H (оценка T + надводный борт)', val(s, 'H_est', 2)],
            ['Минимальный надводный борт f', val(h, 'freeboard', 2)],
            ['Абсцисса миделя', val(s, 'x_mid', 2)],
            ['Плотность воды ρ', val(s, 'rho', 3)],
            ['Дополнительный коэффициент k', val(s, 'k_add', 4)],
          ])}</div>
          <div>${kv('Водоизмещение и полнота', [
            ['Объёмное водоизмещение V', val(d, 'V', 0)],
            ['Весовое водоизмещение D = ρkV', val(d, 'D', 0)],
            ['Коэффициент общей полноты δ', val(d, 'Cb', 4)],
            ['δ по L<sub>пп</sub> и расчётной ширине', val(s, 'Cb_pp', 4)],
            ['Призматический коэффициент φ', val(d, 'Cp', 4)],
            ['Коэффициент полноты миделя β', val(d, 'Cm', 4)],
            ['Коэффициент полноты ватерлинии α', val(d, 'Cw', 4)],
            ['Коэффициент вертикальной полноты χ', val(h, 'Cvp', 4)],
            ['Площадь миделя A<sub>м</sub>', val(d, 'Am', 1)],
            ['Площадь ватерлинии A<sub>вл</sub>', val(d, 'Aw', 1)],
            ['Смоченная поверхность Ω', val(d, 'S', 1)],
            ['Число тонн на 1 см осадки q = ρA/100',
              d.Aw && s.rho ? fmt(s.rho * d.Aw / 100, 2) + ' т/см' : null],
          ])}</div>
          <div>${kv('Центры величины и остойчивость', [
            ['Абсцисса центра величины x<sub>c</sub> (от КП)', val(d, 'xc', 2)],
            ['То же от миделя', xm(d.xc)],
            ['Аппликата центра величины z<sub>c</sub>', val(d, 'zc', 3)],
            ['Абсцисса ЦТ площади ВЛ x<sub>f</sub> (от КП)', val(d, 'xf', 2)],
            ['То же от миделя', xm(d.xf)],
            ['Поперечный метацентрический радиус r', val(d, 'r', 3)],
            ['Продольный метацентрический радиус R', val(d, 'R', 2)],
            ['Аппликата поперечного метацентра z<sub>m</sub>', val(d, 'KMt', 3)],
            ['Аппликата продольного метацентра z<sub>M</sub>', val(d, 'KMl', 2)],
            ['Момент инерции площади ВЛ I<sub>x</sub>', val(h, 'Ix', 0)],
            ['Момент инерции площади ВЛ I<sub>f</sub>', val(h, 'If', 0)],
            ['Половина угла носового заострения', val(h, 'half_angle', 2)],
          ])}
          ${kv('Надводная часть, ДП, бульб', [
            ['Площадь парусности A<sub>п</sub>', val(h, 'A_wind', 1)],
            ['Аппликата ЦТ площади парусности', val(h, 'z_wind', 2)],
            ['Возвышение ЦТ парусности над КВЛ', val(h, 'z_wind_above_wl', 2)],
            ['Площадь погруженной части ДП', val(h, 'A_cl', 1)],
            ['Площадь бульба на НП', val(b, 'A_bulb', 2)],
            ['Коэффициент бульбообразности', val(b, 'C_bulb', 3)],
          ])}</div>
        </div>
        <h3>Кривые элементов теоретического чертежа</h3>
        <div id="kech-chart"></div>
        <div class="caption">Сплошная линия — объёмное водоизмещение V (левая
        шкала), пунктир — площадь ватерлинии A<sub>вл</sub> (правая шкала);
        красный пунктир — проектная осадка. Наведите курсор, чтобы снять
        значения. Всего в таблице ${kechRows.length} осадок.</div>
        <div class="scrollx" style="margin-top:10px"><table class="sh">
          <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${kechRows.map((r) => '<tr>' + r.map(
            (v, i) => `<td>${fmt(v, i < 2 ? 3 : (Math.abs(v) >= 1000 ? 0
              : Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 2 : 3))}</td>`).join('') + '</tr>').join('')}
          </tbody></table></div>
        <div class="caption">Обозначения колонок: T — осадка, trim — дифферент,
        Lwl/Bwl — длина и ширина по ватерлинии, V — объёмное водоизмещение,
        D — весовое, xc/zc — координаты центра величины, xf — абсцисса ЦТ
        площади ватерлинии, Cb/Cm/Cw/Cp — коэффициенты полноты, Am/Aw — площади
        миделя и ватерлинии, S — смоченная поверхность, KMt/KMl — аппликаты
        поперечного и продольного метацентров.</div>
        <h3>Взять как прототип</h3>
        <p class="small" style="margin:0 0 8px">Уйдут: L = ${fmt(s.L_pp, 2)} м,
          B = ${fmt(beam(s), 2)} м, T = ${fmt(s.T, 2)} м${s.H_est ? ', H = ' + fmt(s.H_est, 2) + ' м' : ''},
          δ = ${fmt(d.Cb, 4)}${d.D != null ? ', D = ' + fmt(d.D, 0) + ' т' : ''}, тип — ${esc(s.type_name)}.</p>
        <div class="controls">
          <a class="btn primary" href="${links.design}">взять как прототип в расчёт главных элементов →</a>
          <a class="btn" href="${links.stat}">взять в расчёт посадки и остойчивости →</a>
          <button type="button" class="btn" id="copy-link">ссылка на карточку</button>
        </div>
        <p class="small" style="margin-top:8px">Источник данных:
          варианты заданий кафедры проектирования судов СПбГМТУ.</p>
      </div>`;
    chart($('kech-chart'), s);
    const cb = $('copy-link');
    if (cb) {
      cb.addEventListener('click', () => {
        const url = location.origin + location.pathname + '#' + s.id;
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        cb.textContent = 'ссылка скопирована';
        setTimeout(() => { cb.textContent = 'ссылка на карточку'; }, 1800);
      });
    }
  }

  function select(id, scroll) {
    const s = DOC.ships.find((x) => x.id === id);
    if (!s) return;
    CUR = s;
    document.querySelectorAll('#ships-table tbody tr').forEach((tr) => {
      tr.classList.toggle('on', tr.dataset.id === id);
    });
    card(s);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    if (scroll) $('ship-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  fetch('api/tables/ships.json').then((r) => r.json()).then((doc) => {
    DOC = doc;
    buildChips();
    buildTable();
    applyFilter();
    const q = $('ship-q');
    q.addEventListener('input', () => { Q = q.value.trim().toLowerCase(); applyFilter(); });
    const want = location.hash.replace('#', '');
    select(DOC.ships.some((s) => s.id === want) ? want : DOC.ships[0].id, false);
    window.addEventListener('hashchange', () => {
      const id = location.hash.replace('#', '');
      if (id && CUR && id !== CUR.id) select(id, false);
    });
  }).catch((e) => {
    $('ship-card').innerHTML = '<div class="note warn">не удалось загрузить банк судов: '
      + esc(e.message) + '</div>';
  });
})();
