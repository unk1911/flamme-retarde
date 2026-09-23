#!/usr/bin/env python3
"""Grade a line-beat probe run, sub-step by sub-step.

    python3 tools/coke_grade.py <probe.json> [--every 3] [--quiet]

Reads what tools/coke_probe.mjs wrote and prints a per-frame table of the
numbers the beat is judged by, then one line per SUB-STEP — the same windows
as `LINE` in src/43-jadrija.js, in clip seconds — with each of its checks and
whether it passed.

A check that is not about the window it sits in is not asked there: nobody
cares how far the straw is from her nose while it is still lying on the plate.

The numbers, all millimetres unless marked:

  dTop     straw's top end to the centre of her right nostril, skinned off the
           mesh. The top is meant to be 5 mm up it, so the target is ~5.
  dBot     straw's far end to the point on the line it is working.
  botPl    straw's far end above the plate's floor. The powder is 2.6 tall.
  nosPl    her nostril above the plate's floor.
  gripO    the pinch's grip point to the straw's axis — is it IN her fingers.
  padI/T   index pad / thumb pad to the straw's axis. A 3.4 mm straw between
           two pads 8 mm apart puts both at about 4.
  aTop     straw top's acceleration, m/s^2 at 30 Hz: a pop, if big.
"""
import json
import math
import sys

rows = json.load(open(sys.argv[1]))
if '--take' in sys.argv:
    k = int(sys.argv[sys.argv.index('--take') + 1])
    rows = [r for r in rows if r and r.get('take') == k]
every = int(sys.argv[sys.argv.index('--every') + 1]) if '--every' in sys.argv else 3
quiet = '--quiet' in sys.argv
rows = [r for r in rows if r and r.get('phase') == 'line']
if not rows:
    sys.exit('no frames in phase line')
DT = 1 / 30


def mm(v):
    return None if v is None else v * 1000


def norm(v):
    return math.sqrt(sum(x * x for x in v))


for key in ('wrist', 'top', 'head', 'pinch'):
    for i, r in enumerate(rows):
        r['v_' + key] = r['a_' + key] = None
        if 0 < i < len(rows) - 1 and all(x.get(key) for x in (r, rows[i - 1], rows[i + 1])):
            a, b, c = rows[i - 1][key], r[key], rows[i + 1][key]
            r['v_' + key] = norm([c[k] - a[k] for k in range(3)]) / (2 * DT)
            r['a_' + key] = norm([c[k] - 2 * b[k] + a[k] for k in range(3)]) / (DT * DT)

if not quiet:
    print('%4s %5s %4s | %6s %6s %6s %6s | %6s %5s %5s %5s | %5s %6s | %5s %5s'
          % ('i', 'clipT', 'alg', 'dTop', 'dBot', 'botPl', 'nosPl', 'gripO', 'gripT',
             'padI', 'padT', 'elbow', 'elbDn', 'vTop', 'aTop'))
    for r in rows[::every]:
        f = lambda v, w=6, p=1: (('%' + str(w) + '.' + str(p) + 'f') % v) if v is not None else ' ' * (w - 1) + '-'
        print('%4d %5.2f %4.2f | %s %s %s %s | %s %s %s %s | %s %s | %s %s'
              % (r['i'], r['clipT'] or 0, r['along'],
                 f(mm(r['dTopNostril'])), f(mm(r['dBotAim'])), f(mm(r['botAbovePlate'])),
                 f(mm(r['nostrilAbovePlate'])), f(mm(r['gripOff'])), f(r['gripT'], 5, 2),
                 f(mm(r.get('padOffI')), 5), f(mm(r.get('padOffT')), 5),
                 f(r['elbowDeg'], 5, 0), f(mm(r['elbowBelowShoulder'])),
                 f(r['v_top'], 5, 2), f(r['a_top'], 5, 0)))

# (label, window in clip seconds, [(key, op, limits)])
HELD = [('gripOff', 'max', 0.0020), ('gripT', 'in', (0.60, 0.64)), ('handFace', 'min', 0.008),
        ('padOffI', 'in', (0.0030, 0.0060)), ('padOffT', 'in', (0.0030, 0.0060)),
        ('fingerFace', 'min', -0.0015), ('handLow', 'min', -0.001), ('wristBend', 'maxdeg', 75)]
NOSE = [('dTopNostril', 'in', (0.0025, 0.0075)), ('strawFace', 'min', 0.0)]
# Everywhere the hand is working: no fingertip or pad inside her face, no part
# of the hand through the plate, and a wrist inside what a wrist does.
BODY = [('fingerFace', 'min', -0.0015), ('handFace', 'min', 0.008), ('handLow', 'min', -0.001),
        ('wristBend', 'maxdeg', 75)]
STEPS = [
    ('1 reach for it',      (0.55, 1.00), BODY),
    ('2 fingers close',     (1.00, 1.21), BODY + [('gripOffEnd', 'max', 0.0010)]),
    ('3 lift off the plate', (1.22, 1.70), HELD + [('botAbovePlate', 'min', 0.0)]),
    ('4 to her nose',       (1.70, 1.95), HELD),
    ('5 in the nostril',    (1.92, 1.97), HELD + NOSE),
    ('6 down to the line',  (1.97, 3.05), HELD + NOSE),
    ('7 on the line',       (3.05, 3.15), HELD + NOSE + [('dBotAim', 'max', 0.006)]),
    ('8 along the line',    (3.15, 3.85), HELD + NOSE + [('dBotAim', 'max', 0.006),
                                                         ('botAbovePlate', 'in', (0.0015, 0.0090))]),
    ('9 held there',        (3.85, 4.05), HELD + NOSE),
    ('10 head off it',      (4.05, 4.30), HELD),
    ('11 back on the plate', (4.30, 4.93), HELD + [('botAbovePlate', 'min', 0.0)]),
    ('12 let go',           (4.95, 5.10), BODY),
    ('13 arm back, rise',   (5.10, 6.29), []),
]
POP = 60.0
print()
allok = True
for name, (a, b), checks in STEPS:
    win = [r for r in rows if r['clipT'] is not None and a <= r['clipT'] < b]
    if not win:
        print('%-22s  (no frames)' % name)
        continue
    parts, ok = [], True
    if win:
        win[-1]['gripOffEnd'] = win[-1].get('gripOff')
    for key, op, lim in checks:
        src = [win[-1]] if key.endswith('End') else win
        vals = [r[key] for r in src if r.get(key) is not None]
        if not vals:
            parts.append('%s: -' % key)
            continue
        sc = 1 if key == 'gripT' else 1000
        if op == 'maxdeg':
            worst = max(vals)
            good = worst <= lim
            parts.append('%s<=%g: %.0f %s' % (key, lim, worst, 'ok' if good else 'FAIL'))
        elif op == 'max':
            worst = max(abs(v) for v in vals)
            good = worst <= lim
            parts.append('%s<=%.3g: %.3g %s' % (key, lim * sc, worst * sc, 'ok' if good else 'FAIL'))
        elif op == 'min':
            worst = min(vals)
            good = worst >= lim
            parts.append('%s>=%.3g: %.3g %s' % (key, lim * sc, worst * sc, 'ok' if good else 'FAIL'))
        else:
            lo, hi = lim
            good = all(lo <= v <= hi for v in vals)
            parts.append('%s %.3g..%.3g: %.3g..%.3g %s' % (key, lo * sc, hi * sc, min(vals) * sc,
                                                         max(vals) * sc, 'ok' if good else 'FAIL'))
        ok = ok and good
    for key in ('a_top', 'a_pinch'):
        vals = [r[key] for r in win if r.get(key) is not None]
        if vals:
            worst = max(vals)
            good = worst <= POP
            parts.append('%s %.0f %s' % (key, worst, 'ok' if good else 'POP'))
            ok = ok and good
    allok = allok and ok
    print('%-22s %s  %s' % (name, 'PASS' if ok else 'FAIL', ' | '.join(parts)))
print()
print('ALL PASS' if allok else 'NOT YET')
