/* naca.js — библиотека профилей NACA четырёхзначной серии.
 * Стандартные формулы серии (Abbott & von Doenhoff, Theory of Wing Sections):
 *   полутолщина y_t(x) = 5·t·(0,2969√x − 0,1260x − 0,3516x² + 0,2843x³ − k4·x⁴),
 *   k4 = 0,1015 (открытая задняя кромка) или 0,1036 (закрытая);
 *   средняя линия y_c(x) — по m (кривизна) и p (её положение);
 *   радиус носика r = 1,1019·t².
 * Всё в долях хорды. Подключение:
 *   <script src="https://shadeswd.duckdns.org/ref/lib/naca.js"></script>
 *   NACA.points('0020', 60) → [{x, yu, yl}]  (верхняя и нижняя ординаты) */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NACA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function parse(code) {
    const s = String(code).replace(/^naca/i, '').trim();
    if (!/^\d{4}$/.test(s)) throw new Error('поддерживается четырёхзначная серия, например 0020 или 2412');
    return { m: +s[0] / 100, p: +s[1] / 10, t: +s.slice(2) / 100, code: s };
  }
  function halfThickness(t, x, closedTE) {
    const k4 = closedTE ? 0.1036 : 0.1015;
    return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x
      + 0.2843 * x ** 3 - k4 * x ** 4);
  }
  function camber(m, p, x) {
    if (m === 0 || p === 0) return { yc: 0, slope: 0 };
    if (x < p) return { yc: m / p ** 2 * (2 * p * x - x * x), slope: 2 * m / p ** 2 * (p - x) };
    return { yc: m / (1 - p) ** 2 * (1 - 2 * p + 2 * p * x - x * x), slope: 2 * m / (1 - p) ** 2 * (p - x) };
  }
  /* точки профиля: x по косинусному распределению (гуще у носика) */
  function points(code, n = 60, closedTE = true) {
    const { m, p, t } = parse(code);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const x = (1 - Math.cos(Math.PI * i / n)) / 2;
      const yt = halfThickness(t, x, closedTE);
      const { yc, slope } = camber(m, p, x);
      const th = Math.atan(slope);
      out.push({
        x: +x.toFixed(5),
        yu: +(yc + yt * Math.cos(th)).toFixed(5), xu: +(x - yt * Math.sin(th)).toFixed(5),
        yl: +(yc - yt * Math.cos(th)).toFixed(5), xl: +(x + yt * Math.sin(th)).toFixed(5),
        yc: +yc.toFixed(5), yt: +yt.toFixed(5),
      });
    }
    return out;
  }
  /* классическая таблица ординат по стандартным станциям, в % хорды */
  const STATIONS = [0, 1.25, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 100];
  function table(code, closedTE = true) {
    const { t } = parse(code);
    return STATIONS.map(st => ({
      'x, % хорды': st,
      'y_t, % хорды': +(halfThickness(t, st / 100, closedTE) * 100).toFixed(3),
    }));
  }
  const noseRadius = code => +(1.1019 * parse(code).t ** 2).toFixed(5);
  return { version: '1.0', parse, halfThickness, camber, points, table, noseRadius, STATIONS };
});
