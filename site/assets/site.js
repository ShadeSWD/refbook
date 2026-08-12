/* Шапка/навигация справочника. Универсальный подвал (hub.js) инжектится
 * nginx-ом на проде — здесь ничего дублировать не надо. */
'use strict';
(function () {
  const root = document.currentScript.dataset.root || './';
  const page = document.currentScript.dataset.page || '';
  const nav = [
    { href: 'index', key: 'index', title: 'Обзор' },
    { href: 'sites', key: 'sites', title: 'Сайты' },
    { href: 'sortament', key: 'sortament', title: 'Сортаменты' },
    { href: 'materials', key: 'materials', title: 'Материалы' },
    { href: 'naca', key: 'naca', title: 'NACA' },
    { href: 'rmrs', key: 'rmrs', title: 'РМРС' },
    { href: 'ship', key: 'ship', title: 'Каскад' },
    { href: 'terms', key: 'terms', title: 'Словарь' },
    { href: 'api', key: 'api', title: 'Библиотеки и API' },
    { href: 'sources', key: 'sources', title: 'Источники' },
  ];
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}index"><span style="font-size:22px">📚</span>
      <span>Инженерный справочник</span></a>
    <nav class="top">${nav.map(n => `<a href="${root}${n.href}"${n.key === page ? ' class="on"' : ''}>${n.title}</a>`).join('')}</nav>
  </div>`;
  document.body.prepend(header);
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Оцифрованные сортаменты и нормативы с указанием первоисточников ·
    данные и формулы доступны как <a href="${root}api">библиотеки и API</a></div>
  </div>`;
  document.body.appendChild(footer);
})();
