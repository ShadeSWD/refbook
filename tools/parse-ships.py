# -*- coding: utf-8 -*-
"""Разбор учебных вариантов судов (Гидрост + КЭТЧ, cp1251) в ships.json."""
import glob
import json
import os
import re

SRC = '/root/smtu-archive/x/SMTU/Проектирование судов'
OUT = '/root/refbook/site/api/tables/ships.json'

TYPES = {
    'OT': ('OT', 'нефтеналивной танкер'),
    'ОТ': ('OT', 'нефтеналивной танкер'),
    'BC': ('BC', 'навалочное судно (балкер)'),
    'ВС': ('BC', 'навалочное судно (балкер)'),
    'ChT': ('ChT', 'танкер-химовоз'),
    'КВЗ': ('KVZ', 'контейнеровоз'),
    'УСС': ('USS', 'универсальное сухогрузное судно'),
    'УСК': ('USK', 'универсальный сухогруз-контейнеровоз'),
}

# шапка файла (одинакова у обоих типов файлов)
HEAD = [
    ('Длина между перпенд.', 'L_pp'),
    ('Длина максимальная', 'L_max'),
    ('Ширина на миделе', 'B'),
    ('Ширина максимальная', 'B_max'),
    ('Проектная осадка', 'T'),
    ('Абсцисса миделя', 'x_mid'),
    ('Плотность воды', 'rho'),
    ('Дополн. коэффициент', 'k_add'),
]

# сводка гидростатики
HYD = [
    ('Объемное водоизмещение', 'V'),
    ('Водоизмещение', 'D'),
    ('Полная длина погруженного тела', 'L_sub'),
    ('Полная ширина погруженного тела', 'B_sub'),
    ('Коэффициент общей полноты', 'Cb'),
    ('Призматический коэффициент', 'Cp'),
    ('Коэффициент вертикальной полноты', 'Cvp'),
    ('Смоченная площадь поверхности', 'S'),
    ('Ордината Ц.В.', 'yc'),
    ('Аппликата Ц.В.', 'zc'),
    ('Площадь миделя', 'Am'),
    ('Коэффициент полноты миделя', 'Cm'),
    ('Длина по ватерлинии', 'Lwl'),
    ('Ширина по ватерлинии', 'Bwl'),
    ('Площадь ватерлинии', 'Aw'),
    ('Коэффициент полноты ВЛ', 'Cw'),
    ('Абсцисса Ц.Т. площади ватерлинии', 'xf'),
    ('Половина угла носового заострения', 'half_angle'),
    ('Поперечный момент инерции', 'Ix'),
    ('Продольный момент инерции', 'If'),
    ('Аппликата поперечного метацентра', 'KMt'),
    ('Поперечный метацентрический радиус', 'r'),
    ('Аппликата продольного метацентра', 'KMl'),
    ('Продольный метацентрический радиус', 'R'),
    ('Площадь погруженной части ДП', 'A_cl'),
    ('Абсцисса центра тяжести площади ДП', 'x_cl'),
    ('Аппликата центра тяжести площади ДП', 'z_cl'),
    ('Проекция на ДП площади парусности', 'A_wind'),
    ('Аппликата Ц.Т. площади парусности', 'z_wind'),
    ('Абсцисса  Ц.Т. площади парусности', 'x_wind'),
    ('Возвышение Ц.Т. площади парусности над КВЛ', 'z_wind_above_wl'),
    ('Проверочный коэффициент остойчивости', 'stab_check'),
]

BULB = [
    ('Площадь бульба на носовом перпендикул.', 'A_bulb'),
    ('Аппликата Ц.Т. площади бульба', 'z_bulb'),
    ('Коэффициент бульбообразности', 'C_bulb'),
]

KECH_COLS = ['T', 'trim', 'Lwl', 'Bwl', 'V', 'D', 'xc', 'zc', 'Cb', 'Am', 'Cm',
             'Aw', 'Cw', 'xf', 'Cp', 'S', 'KMt', 'KMl']

NUM = r'([-+]?\d+(?:[.,]\d+)?)'


def read(path):
    return open(path, 'rb').read().decode('cp1251')


def num(s):
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


def grab(text, label):
    """Значение по подписи «Подпись : число ед.» (первое вхождение)."""
    pat = re.escape(label) + r'\s*:\s*' + NUM
    m = re.search(pat, text)
    return num(m.group(1)) if m else None


def parse_head(text):
    out = {}
    for label, key in HEAD:
        v = grab(text, label)
        if v is not None:
            out[key] = v
    return out


def parse_hydro(text):
    """Сводка гидростатики. Отдельно — две строки «Абсцисса Ц.В.» (м и %)."""
    out = {}
    for label, key in HYD:
        v = grab(text, label)
        if v is not None:
            out[key] = v
    xc = re.findall(r'Абсцисса Ц\.В\.\s*:\s*' + NUM + r'\s*(м|%)', text)
    for val, unit in xc:
        out['xc' if unit == 'м' else 'xc_pct'] = num(val)
    fb = re.findall(r'Минимальный надводный борт\s*:\s*' + NUM + r'\s*(м|%Lmax)', text)
    for val, unit in fb:
        out['freeboard' if unit == 'м' else 'freeboard_pct'] = num(val)
    bulb = {}
    for label, key in BULB:
        v = grab(text, label)
        if v is not None:
            bulb[key] = v
    return out, bulb


def parse_sac(text):
    """Площади шпангоутов (строевая по шпангоутам): [[x, ω], …]."""
    m = re.search(r'Площади шпангоутов.*?\n(.*?)(?:\n\s*\n|\Z)', text, re.S)
    if not m:
        return []
    rows = []
    for line in m.group(1).splitlines():
        mm = re.match(r'\s*\|\s*' + NUM + r'\s*\|\s*' + NUM + r'\s*\|', line)
        if mm:
            rows.append([num(mm.group(1)), num(mm.group(2))])
    return rows


def parse_kech(text):
    """Таблица КЭТЧ: 18 числовых колонок, шапка начинается со слова Draft."""
    lines = text.splitlines()
    start = None
    for i, ln in enumerate(lines):
        if ln.strip().startswith('Draft') and 'Volume' in ln:
            start = i + 2          # +1 шапка, +1 строка единиц
    if start is None:
        return []
    rows, seen = [], set()
    for ln in lines[start:]:
        vals = ln.split()
        if len(vals) != len(KECH_COLS):
            if rows:
                break
            continue
        nums = [num(v) for v in vals]
        if any(v is None for v in nums):
            if rows:
                break
            continue
        key = tuple(nums)
        if key in seen:            # у части файлов последняя строка задвоена
            continue
        seen.add(key)
        rows.append(nums)
    rows.sort(key=lambda r: r[0])
    return rows


def interp_kech(rows, T):
    """Линейная интерполяция строки КЭТЧ на проектную осадку T."""
    if not rows or T is None:
        return None
    ts = [r[0] for r in rows]
    if T < ts[0] - 1e-9 or T > ts[-1] + 1e-9:
        return None
    for i in range(len(rows) - 1):
        t0, t1 = ts[i], ts[i + 1]
        if t0 - 1e-9 <= T <= t1 + 1e-9 and t1 > t0:
            f = (T - t0) / (t1 - t0)
            vals = [rows[i][k] + f * (rows[i + 1][k] - rows[i][k])
                    for k in range(len(KECH_COLS))]
            return dict(zip(KECH_COLS, [round(v, 4) for v in vals]))
    if abs(ts[0] - T) < 1e-9:
        return dict(zip(KECH_COLS, rows[0]))
    return None


def main():
    files = {}
    for p in glob.glob(os.path.join(SRC, 'Вариант-*.txt')):
        name = os.path.basename(p)
        m = re.match(r'Вариант-(\d+)-(.+?)-(.+)-(Гидрост|КЭТЧ)\.txt$', name)
        if not m:
            print('пропуск (имя не разобрано):', name)
            continue
        var = int(m.group(1))
        files.setdefault(var, {})[m.group(4)] = (p, m.group(2), m.group(3))

    ships, missing = [], {}
    for var in sorted(files):
        f = files[var]
        src_kind = 'Гидрост' if 'Гидрост' in f else 'КЭТЧ'
        _p, tcode, size = f[src_kind][1], f[src_kind][2], None
        tcode = f[src_kind][1]
        tag = f[src_kind][2]
        code, tname = TYPES.get(tcode, (tcode, ''))
        ship = {'id': 'v%d' % var, 'variant': var, 'type': code,
                'type_name': tname, 'tag': tag}

        head_from = None
        if 'Гидрост' in f:
            th = read(f['Гидрост'][0])
            ship.update(parse_head(th))
            head_from = 'Гидрост'
            hyd, bulb = parse_hydro(th)
            sac = parse_sac(th)
            pr = re.search(r'Проект[ \t]*:[ \t]*(.*)', th)
            if pr and pr.group(1).strip():
                ship['project'] = pr.group(1).strip().strip(':').strip()
            if hyd:
                ship['hydro'] = hyd
            if bulb:
                ship['bulb'] = bulb
            if sac:
                ship['sac'] = sac

        if 'КЭТЧ' in f:
            tk = read(f['КЭТЧ'][0])
            hk = parse_head(tk)
            if head_from is None:
                ship.update(hk)
                head_from = 'КЭТЧ'
            else:
                diff = {k: v for k, v in hk.items()
                        if ship.get(k) is not None and abs(v - ship[k]) > 1e-6}
                if diff:
                    ship['kech_head'] = hk
            if 'project' not in ship:
                pr = re.search(r'Проект[ \t]*:[ \t]*(.*)', tk)
                if pr and pr.group(1).strip():
                    ship['project'] = pr.group(1).strip().strip(':').strip()
            des = re.search(r'Проектант[ \t]*:[ \t]*(.*)', tk)
            if des and des.group(1).strip():
                ship['designer'] = des.group(1).strip()
            rows = parse_kech(tk)
            if rows:
                ship['kech'] = rows

        ship['head_from'] = head_from
        ship['has'] = {'hydro': 'hydro' in ship, 'kech': 'kech' in ship}

        # характеристики при проектной осадке: из сводки либо интерполяцией КЭТЧ
        d = {}
        h = ship.get('hydro', {})
        if h:
            d = {k: h[k] for k in ('V', 'D', 'Cb', 'Cp', 'Cm', 'Cw', 'xc', 'zc',
                                   'xf', 'r', 'R', 'KMt', 'KMl', 'Aw', 'Am', 'S', 'Lwl', 'Bwl')
                 if k in h}
            d['from'] = 'hydrostat'
        elif 'kech' in ship:
            iv = interp_kech(ship['kech'], ship.get('T'))
            if iv:
                d = {k: v for k, v in iv.items() if k not in ('T', 'trim')}
                d['r'] = round(iv['KMt'] - iv['zc'], 3)
                d['R'] = round(iv['KMl'] - iv['zc'], 3)
                d['from'] = 'kech-interp'
        if d:
            ship['design'] = d

        # расчётная ширина: в части вариантов «ширина на миделе» снята не по
        # мидель-шпангоуту (у варианта 20 — 16,1 м при ширине по ВЛ 26,36 м),
        # поэтому для расчётов берём ширину по ватерлинии при проектной осадке.
        b_eff = d.get('Bwl') or ship.get('B_max') or ship.get('B')
        if b_eff:
            ship['B_eff'] = round(b_eff, 3)
            if ship.get('B') and abs(ship['B'] - b_eff) / b_eff > 0.02:
                ship['B_note'] = ('ширина на миделе в шапке файла (%.3f м) '
                                  'расходится с шириной по ватерлинии при '
                                  'проектной осадке (%.3f м)' % (ship['B'], b_eff))
        # высота борта в исходных данных не задана; там, где есть минимальный
        # надводный борт, она восстанавливается как H = T + f (помечено как оценка)
        fb = h.get('freeboard')
        if fb and ship.get('T'):
            ship['H_est'] = round(ship['T'] + fb, 3)
        # коэффициент общей полноты по L между перпендикулярами и B по ВЛ
        if d.get('V') and ship.get('L_pp') and ship.get('B_eff') and ship.get('T'):
            ship['Cb_pp'] = round(d['V'] / (ship['L_pp'] * ship['B_eff'] * ship['T']), 4)

        miss = [k for k in ('L_pp', 'L_max', 'B', 'T', 'rho') if k not in ship]
        for k in ('V', 'D', 'Cb', 'Cp', 'Cw', 'Cm', 'xc', 'r', 'R'):
            if k not in d:
                miss.append('design.' + k)
        if miss:
            missing[ship['id']] = miss
        ships.append(ship)

    doc = {
        'title': 'Банк судов-прототипов (учебные варианты)',
        'source': 'варианты заданий кафедры проектирования судов СПбГМТУ',
        'source_note': 'Публикуются только извлечённые числовые данные: '
                       'главные размерения, характеристики гидростатики и '
                       'кривые элементов теоретического чертежа. Исходные '
                       'файлы вариантов не публикуются.',
        'checked': '2026-08-13',
        'count': len(ships),
        'types': {c: n for c, n in TYPES.values()},
        'kech_columns': KECH_COLS,
        'units': {
            'L_pp': 'м', 'L_max': 'м', 'B': 'м', 'B_max': 'м', 'T': 'м',
            'x_mid': 'м', 'rho': 'т/м³', 'k_add': '—',
            'V': 'м³', 'D': 'т', 'L_sub': 'м', 'B_sub': 'м',
            'Cb': '—', 'Cp': '—', 'Cvp': '—', 'Cm': '—', 'Cw': '—',
            'S': 'м²', 'Am': 'м²', 'Aw': 'м²',
            'xc': 'м от кормового перпендикуляра', 'xc_pct': '% L',
            'yc': 'м', 'zc': 'м', 'xf': 'м от кормового перпендикуляра',
            'Lwl': 'м', 'Bwl': 'м', 'half_angle': 'град',
            'Ix': 'м⁴', 'If': 'м⁴', 'r': 'м', 'R': 'м', 'KMt': 'м', 'KMl': 'м',
            'A_cl': 'м²', 'x_cl': 'м', 'z_cl': 'м',
            'A_wind': 'м²', 'x_wind': 'м', 'z_wind': 'м',
            'z_wind_above_wl': 'м', 'freeboard': 'м', 'freeboard_pct': '% L_max',
            'B_eff': 'м', 'Cb_pp': '—', 'H_est': 'м',
            'stab_check': '—', 'A_bulb': 'м²', 'z_bulb': 'м', 'C_bulb': '—',
            'trim': 'м', 'sac': 'x, м → ω, м²',
        },
        'labels': {
            'L_pp': 'длина между перпендикулярами',
            'L_max': 'длина наибольшая', 'B': 'ширина на миделе',
            'B_max': 'ширина наибольшая', 'T': 'проектная осадка',
            'x_mid': 'абсцисса миделя', 'rho': 'плотность воды',
            'k_add': 'дополнительный коэффициент (обшивка и выступающие части)',
            'V': 'объёмное водоизмещение', 'D': 'весовое водоизмещение',
            'L_sub': 'полная длина погруженного тела',
            'B_sub': 'полная ширина погруженного тела',
            'Cb': 'коэффициент общей полноты δ',
            'Cp': 'призматический коэффициент φ',
            'Cvp': 'коэффициент вертикальной полноты χ',
            'Cm': 'коэффициент полноты миделя β',
            'Cw': 'коэффициент полноты ватерлинии α',
            'S': 'смоченная поверхность', 'Am': 'площадь миделя',
            'Aw': 'площадь ватерлинии', 'xc': 'абсцисса центра величины',
            'xc_pct': 'абсцисса центра величины в долях длины',
            'yc': 'ордината центра величины', 'zc': 'аппликата центра величины',
            'xf': 'абсцисса центра тяжести площади ватерлинии',
            'Lwl': 'длина по ватерлинии', 'Bwl': 'ширина по ватерлинии',
            'half_angle': 'половина угла носового заострения',
            'Ix': 'поперечный момент инерции площади ВЛ',
            'If': 'продольный момент инерции площади ВЛ',
            'r': 'поперечный метацентрический радиус',
            'R': 'продольный метацентрический радиус',
            'KMt': 'аппликата поперечного метацентра',
            'KMl': 'аппликата продольного метацентра',
            'A_cl': 'площадь погруженной части ДП',
            'x_cl': 'абсцисса ЦТ площади ДП', 'z_cl': 'аппликата ЦТ площади ДП',
            'A_wind': 'площадь парусности',
            'x_wind': 'абсцисса ЦТ площади парусности',
            'z_wind': 'аппликата ЦТ площади парусности',
            'z_wind_above_wl': 'возвышение ЦТ площади парусности над КВЛ',
            'freeboard': 'минимальный надводный борт',
            'freeboard_pct': 'минимальный надводный борт в долях L_max',
            'stab_check': 'проверочный коэффициент остойчивости',
            'A_bulb': 'площадь бульба на носовом перпендикуляре',
            'z_bulb': 'аппликата ЦТ площади бульба',
            'C_bulb': 'коэффициент бульбообразности',
            'trim': 'дифферент',
            'B_eff': 'расчётная ширина (по ватерлинии при проектной осадке)',
            'H_est': 'высота борта (оценка: T + минимальный надводный борт)',
            'designer': 'подпись «Проектант» в исходном файле варианта',
            'tag': 'метка варианта в имени файла задания',
            'project': 'название проекта (судна-прототипа) в исходном файле',
            'Cb_pp': 'коэффициент общей полноты по L между перпендикулярами и расчётной ширине',
        },
        'ships': ships,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print('судов:', len(ships), '→', OUT, os.path.getsize(OUT), 'байт')
    for s in ships:
        print(' %-4s %-4s L=%-7s B=%-6s T=%-5s hydro=%-5s kech=%-3s design=%s' % (
            s['id'], s['type'], s.get('L_pp'), s.get('B'), s.get('T'),
            s['has']['hydro'], len(s.get('kech', [])),
            s.get('design', {}).get('from')))
    print('\nне извлечено:')
    for k, v in missing.items():
        print(' ', k, v)


main()
