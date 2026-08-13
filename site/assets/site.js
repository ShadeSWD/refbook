/* Шапка/навигация справочника. Универсальный подвал (hub.js) инжектится
 * nginx-ом на проде — здесь ничего дублировать не надо. */
'use strict';
(function () {
  const root = document.currentScript.dataset.root || './';
  const page = document.currentScript.dataset.page || '';
  const nav = [
    { h: 'index', k: 'index', t: 'Обзор' },
    { t: 'Таблицы', h: 'sortament', drop: [
      { h: 'sortament', k: 'sortament', t: 'Все сортаменты' },
      { h: 'gost-21937', k: 'sortament', t: 'Полособульб ГОСТ 21937' },
      { h: 'gost-8509', k: 'sortament', t: 'Уголки ГОСТ 8509' },
      { h: 'gost-8239', k: 'sortament', t: 'Двутавры ГОСТ 8239' },
      { h: 'gost-8240', k: 'sortament', t: 'Швеллеры ГОСТ 8240' },
      { h: 'gost-8732', k: 'sortament', t: 'Трубы ГОСТ 8732' },
      { h: 'gost-19903', k: 'sortament', t: 'Листовой прокат ГОСТ 19903' },
      { h: 'naca', k: 'sortament', t: 'Профили NACA' },
      { h: 'materials', k: 'materials', t: 'Материалы и среды' },
    ] },
    { t: 'Расчёты по Правилам', h: 'rmrs', drop: [
      { h: 'rmrs', k: 'rmrs', t: 'Формулы Правил РМРС' },
      { h: 'ship', k: 'rmrs', t: 'Каскад расчётов' },
      { h: 'api', k: 'api', t: 'Библиотеки и API' },
    ] },
    { h: 'terms', k: 'terms', t: 'Словарь' },
    { h: 'sites', k: 'sites', t: 'Сайты кластера' },
    { h: 'sources', k: 'sources', t: 'Источники' },
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}index"><span style="font-size:22px">📚</span>
      <span>Инженерный справочник</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Оцифрованные сортаменты и нормативы с указанием методикаов ·
    данные и формулы доступны как <a href="${root}api">библиотеки и API</a></div>
  </div>`;
  onReady(() => document.body.appendChild(footer));
})();
