/* RMRS.js — расчётная библиотека кластера: формулы Правил РМРС / IACS / Кодекса
 * ОСНС, каждая функция возвращает { value|values, steps } — где steps это
 * массив {f: формула, sub: числовая подстановка, res: результат} для
 * пошагового отображения. Подключение на любом сайте:
 *   <script src="https://shadeswd.duckdns.org/ref/lib/rmrs.js"></script>
 * или как модуль Node (его использует calc-API справочника). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.RMRS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = v => Math.round(v * 100) / 100;
  const r3 = v => Math.round(v * 1000) / 1000;

  /* волновой коэффициент c_w — РМРС ч. II 1.4.4.1 / IACS UR S11 */
  function waveCoef(L) {
    if (L <= 90) return { v: 0.0856 * L, f: 'c_w = 0,0856·L', sub: `0,0856·${L}` };
    if (L <= 300) return { v: 10.75 - Math.pow((300 - L) / 100, 1.5), f: 'c_w = 10,75 − ((300−L)/100)^1,5', sub: `10,75 − ((300−${L})/100)^1,5` };
    return { v: 10.75, f: 'c_w = 10,75 (300 ≤ L ≤ 350)', sub: '10,75' };
  }

  /* волновые изгибающие моменты, кН·м — РМРС ч. II 1.4.4.1 / IACS UR S11 */
  function waveMoments(p) {
    const L = +p.L, B = +p.B, Cb = Math.max(+p.Cb, 0.6);
    const cw = waveCoef(L);
    const hog = 190 * cw.v * B * L * L * Cb * 1e-3;
    const sag = -110 * cw.v * B * L * L * (Cb + 0.7) * 1e-3;
    return {
      values: { cw: r2(cw.v), Mw_hog: Math.round(hog), Mw_sag: Math.round(sag) },
      units: { Mw_hog: 'кН·м', Mw_sag: 'кН·м' },
      rule: 'РМРС ч. II, 1.4.4.1 (= IACS UR S11)',
      steps: [
        { f: cw.f, sub: cw.sub, res: r2(cw.v) },
        { f: 'M_w,пер = 190·c_w·B·L²·C_b·10⁻³', sub: `190·${r2(cw.v)}·${B}·${L}²·${Cb}·10⁻³`, res: Math.round(hog) + ' кН·м' },
        { f: 'M_w,прог = −110·c_w·B·L²·(C_b+0,7)·10⁻³', sub: `−110·${r2(cw.v)}·${B}·${L}²·${r2(Cb + 0.7)}·10⁻³`, res: Math.round(sag) + ' кН·м' },
      ],
    };
  }

  /* минимальный момент сопротивления, м³ — РМРС ч. II 1.4.6.7 */
  function minSectionModulus(p) {
    const L = +p.L, B = +p.B, Cb = Math.max(+p.Cb, 0.6), k = +(p.k || 1);
    const cw = waveCoef(L);
    const W = cw.v * B * L * L * (Cb + 0.7) * k * 1e-6;
    return {
      values: { cw: r2(cw.v), Wmin: r3(W) }, units: { Wmin: 'м³' },
      rule: 'РМРС ч. II, 1.4.6.7',
      steps: [
        { f: cw.f, sub: cw.sub, res: r2(cw.v) },
        { f: 'W_min = c_w·B·L²·(C_b+0,7)·k·10⁻⁶', sub: `${r2(cw.v)}·${B}·${L}²·${r2(Cb + 0.7)}·${k}·10⁻⁶`, res: r3(W) + ' м³' },
      ],
    };
  }

  /* допускаемые нормальные напряжения общего изгиба, МПа — РМРС ч. II 1.4.6 */
  function allowableStress(p) {
    const k = +((p && p.k) || 1);
    return {
      values: { sigma: r2(175 / k) }, units: { sigma: 'МПа' },
      rule: 'РМРС ч. II, 1.4.6 (k — коэффициент материала: 1 / 0,78 / 0,72)',
      steps: [{ f: 'σ_доп = 175/k', sub: `175/${k}`, res: r2(175 / k) + ' МПа' }],
    };
  }

  /* период бортовой качки, с — Кодекс ОСНС 2008 (MSC.267(85)) */
  function rollPeriod(p) {
    const B = +p.B, d = +p.d, L = +p.L, h = +p.h;
    const C = 0.373 + 0.023 * B / d - 0.043 * L / 100;
    const T = 2 * C * B / Math.sqrt(h);
    return {
      values: { C: r3(C), T: r2(T) }, units: { T: 'с' },
      rule: 'Кодекс ОСНС 2008, п. 2.3 (MSC.267(85))',
      steps: [
        { f: 'C = 0,373 + 0,023·B/d − 0,043·L/100', sub: `0,373 + 0,023·${r2(B / d)} − 0,043·${r2(L / 100)}`, res: r3(C) },
        { f: 'T_θ = 2·C·B/√h', sub: `2·${r3(C)}·${B}/√${h}`, res: r2(T) + ' с' },
      ],
    };
  }

  /* площадь пера руля, м² — РМРС ч. III 2.2 */
  function rudderArea(p) {
    const L = +p.L, d = +p.d, B = +p.B, Cb = +p.Cb;
    const A = (L * d / 100) * (1 + 50 * Cb * Cb * Math.pow(B / L, 2));
    return {
      values: { A: r2(A) }, units: { A: 'м²' },
      rule: 'РМРС ч. III «Устройства, оборудование и снабжение», 2.2',
      steps: [{ f: 'A = (L·d/100)·(1 + 50·C_b²·(B/L)²)', sub: `(${L}·${d}/100)·(1 + 50·${Cb}²·(${r3(B / L)})²)`, res: r2(A) + ' м²' }],
    };
  }

  /* коэффициент трения ИТТС-57 (модель) и Прандтля–Шлихтинга (натура) */
  function frictionCoef(p) {
    const Re = +p.Re, scheme = p.scheme || 'ittc57';
    let v, f, sub;
    if (scheme === 'prandtl') {
      v = 0.455 / Math.pow(Math.log10(Re), 2.58);
      f = 'C_f0 = 0,455/(lg Re)^2,58'; sub = `0,455/(lg ${Re.toExponential(2)})^2,58`;
    } else {
      v = 0.075 / Math.pow(Math.log10(Re) - 2, 2);
      f = 'C_f0 = 0,075/(lg Re − 2)²'; sub = `0,075/(lg ${Re.toExponential(2)} − 2)²`;
    }
    return {
      values: { Cf0: +v.toExponential(3) }, rule: 'ИТТС-57 / Прандтль–Шлихтинг',
      steps: [{ f, sub, res: v.toExponential(3) }],
    };
  }

  return {
    version: '1.0',
    functions: ['waveMoments', 'minSectionModulus', 'allowableStress', 'rollPeriod', 'rudderArea', 'frictionCoef'],
    waveMoments, minSectionModulus, allowableStress, rollPeriod, rudderArea, frictionCoef,
  };
});
