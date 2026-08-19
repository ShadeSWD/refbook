/* Данные каркаса страниц инженерного справочника. Машинерия — assets/shell.js.
 * Универсальный подвал кластера (hub.js) инжектится nginx-ом на проде. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Инженерный справочник',
    home: 'index',
    logo: `<span style="font-size:22px">📚</span>`,
    nav: [
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
        { h: 'ships', k: 'ships', t: 'Суда-прототипы' },
      ] },
      { t: 'Расчёты по Правилам', h: 'rmrs', drop: [
        { h: 'rmrs', k: 'rmrs', t: 'Формулы Правил РМРС' },
        { h: 'ship', k: 'rmrs', t: 'Каскад расчётов' },
        { h: 'api', k: 'api', t: 'Библиотеки и API' },
      ] },
      { h: 'formulas', k: 'formulas', t: 'Банк формул' },
      { h: 'terms', k: 'terms', t: 'Словарь' },
      { h: 'sites', k: 'sites', t: 'Сайты кластера' },
      { h: 'sources', k: 'sources', t: 'Источники' },
    ],
    footer: `<div>Оцифрованные сортаменты и нормативы с указанием методикаов ·
    данные и формулы доступны как <a href="${root}api">библиотеки и API</a></div>`,
  });
})();
