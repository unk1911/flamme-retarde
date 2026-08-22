import json, sys, math
p = sys.argv[1]
txt = open(p).read()
i = txt.index('{"found')
j = txt.rindex('}]}') + 3
d = json.loads(txt[i:j])
print('found', d['found'], 'floor', round(d['floor'], 3))
o0 = d['out'][0]
print('glass  ', o0['glass'], ' pourAt', o0['pourAt'], ' rest', o0['rest'])
print('%5s %5s | %-20s %-20s | %-20s | %-20s %s' %
      ('u', 'held', 'hand f/r/up', 'bottleBase', 'axis f/r/up', 'elbow', 'tiltdeg'))
for r in d['out']:
    ax = r['axis']
    tilt = math.degrees(math.acos(max(-1, min(1, ax[2])))) if ax else 0
    print('%5.2f %5.2f | %-20s %-20s | %-20s | %-20s %5.1f' %
          (r['u'], r['held'], r['hand'], r['bot'], ax, r['elbow'], tilt))
