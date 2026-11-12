"""Bake MakeHuman's head into one data file for the face lab (mockups/faces3/).

MakeHuman's base mesh, targets and expressions are CC0 1.0 (public domain): github.com/makehumancommunity/makehuman,
LICENSE.md § C and LICENSE.ASSETS.md. This script reads a checkout of that repository's `makehuman/data` folder and
writes `mh-head.js` beside itself: the head and neck of the base mesh, the eyeballs, and every
target that shapes the head (feature sliders, the sex / age / population / weight macros, 33 expression units),
cut down to the head's vertices.

    python bake_mh.py <path to makehuman/makehuman/data>

Units in the output: head heights (chin = 0, crown = 1), x to the figure's left, z forward, the nose tip at z = .515
(the same frame as faces2). Deltas are int16 in steps of 1/20000.
"""
import sys, os, json, re, struct, base64, gzip, collections

D = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
Q = 20000.0

V, F, G = [], [], []
g = ''
for l in open(os.path.join(D, '3dobjs', 'base.obj')):
    if l.startswith('v '): V.append(tuple(map(float, l.split()[1:4])))
    elif l.startswith('g '): g = l.split()[1]
    elif l.startswith('f '): F.append([int(x.split('/')[0]) - 1 for x in l.split()[1:]]); G.append(g)

MAT = {'body': 0, 'helper-l-eye': 2, 'helper-r-eye': 2}
CUT_Y, CUT_X = 5.62, .95          # the neck's base; keeps the shoulders out
faces, fmat = [], []
for f, g in zip(F, G):
    if g not in MAT: continue
    if g == 'body' and not all(V[i][1] > CUT_Y and abs(V[i][0]) < CUT_X for i in f): continue
    faces.append(f); fmat.append(MAT[g])
used = sorted(set(i for f in faces for i in f)); remap = {v: i for i, v in enumerate(used)}
skin = set(i for f, m in zip(faces, fmat) if m == 0 for i in f)
chin = min(V[i][1] for i in skin if abs(V[i][0]) < .06 and V[i][2] > 1.0 and V[i][1] > 6.0)
crown = max(V[i][1] for i in skin); S = 1 / (crown - chin); z0 = max(V[i][2] for i in skin) - .515 / S
norm = lambda p: (p[0] * S, (p[1] - chin) * S, (p[2] - z0) * S)
P = [norm(V[i]) for i in used]
print('head: %d vertices, %d faces; chin y %.3f crown y %.3f scale %.4f' % (len(used), len(faces), chin, crown, S))

def read_target(path):
    out = {}
    for l in open(path):
        if not l[:1].isdigit(): continue
        a = l.split(); i = int(a[0])
        if i in remap:
            d = (float(a[1]) * S, float(a[2]) * S, float(a[3]) * S)
            if max(abs(d[0]), abs(d[1]), abs(d[2])) > 2e-4: out[remap[i]] = d
    return out

T = collections.OrderedDict()   # name -> {vertex: delta}
def add(name, rel):
    p = os.path.join(D, 'targets', rel)
    if name in T or not os.path.exists(p): return name in T
    t = read_target(p)
    if len(t) < 4: return False
    T[name] = t; return True

# the feature sliders, as MakeHuman defines them; left and right merge into one
sliders = []
mods = json.load(open(os.path.join(D, 'modifiers', 'modeling_modifiers.json')))
for grp in mods:
    if grp['group'] not in ('head', 'forehead', 'eyebrows', 'neck', 'eyes', 'nose', 'mouth', 'ears', 'chin', 'cheek'): continue
    seen = {}
    for m in grp['modifiers']:
        t = m.get('target')
        if not t: continue
        side = re.match(r'^([lr])-(.*)$', t); base = side.group(2) if side else t
        folder = grp['group']
        key = base + ('-' + m['min'] + '-' + m['max'] if m.get('min') else '')
        s = seen.get(key)
        if not s: s = seen[key] = {'key': key, 'group': folder, 'neg': [], 'pos': []}; sliders.append(s)
        for end, lst in (('min', s['neg']), ('max', s['pos'])):
            nm = t + ('-' + m[end] if m.get(end) else '')
            if end == 'min' and not m.get('min'): continue
            if add(nm, folder + '/' + nm + '.target'): lst.append(nm)
sliders = [s for s in sliders if s['pos'] or s['neg']]

# macros: population x sex x age, and weight
for e in ('african', 'asian', 'caucasian'):
    for s in ('female', 'male'):
        for a in ('young', 'old'):
            add('%s-%s-%s' % (e, s, a), 'macrodetails/%s-%s-%s.target' % (e, s, a))
for s in ('female', 'male'):
    for a in ('young', 'old'):
        for w in ('minweight', 'maxweight'):
            add('weight-%s-%s-%s' % (s, a, w), 'macrodetails/universal-%s-%s-averagemuscle-%s.target' % (s, a, w))
# expression units (the caucasian set; the three sets differ little)
units = []
ud = os.path.join(D, 'targets', 'expression', 'units', 'caucasian')
for f in sorted(os.listdir(ud)):
    if f.endswith('.target') and add('x-' + f[:-7], 'expression/units/caucasian/' + f): units.append('x-' + f[:-7])

# paint and landmarks, found from the targets themselves
def mag(name): return {i: (d[0] ** 2 + d[1] ** 2 + d[2] ** 2) ** .5 for i, d in T.get(name, {}).items()}
lip = collections.Counter()
for n in ('mouth-upperlip-volume-incr', 'mouth-lowerlip-volume-incr'):
    m = mag(n); top = max(m.values()) if m else 1
    for i, x in m.items(): lip[i] = max(lip[i], x / top)
lipmask = bytes(int(min(1, lip.get(i, 0)) * 255) for i in range(len(P)))
sk = [remap[v] for v in skin]
eyeL = sorted(set(remap[i] for f, g in zip(F, G) if g == 'helper-l-eye' for i in f))
ecx = sum(P[i][0] for i in eyeL) / len(eyeL); ecy = sum(P[i][1] for i in eyeL) / len(eyeL)
# the eyebrow's line: the skin points nearest four places above the eye
brow = [[min((i for i in sk if P[i][2] > .15), key=lambda i: (P[i][0] - ecx - dx) ** 2 + (P[i][1] - ecy - dy) ** 2)] for dx, dy in ((-.07, .05), (-.02, .062), (.04, .062), (.085, .04))]
chin_i = min((i for i in sk if abs(P[i][0]) < .026 and P[i][2] > .2 and P[i][1] > -.05), key=lambda i: P[i][1]); crown_i = max(sk, key=lambda i: P[i][1])
tip = max((i for i in sk if abs(P[i][0]) < .01), key=lambda i: P[i][2])
cheek = min(sk, key=lambda i: (P[i][0] - .2) ** 2 + (P[i][1] - .40) ** 2 + (0 if P[i][2] > .2 else 9))

idx = bytearray(); dl = bytearray(); table = {}
for name, t in T.items():
    table[name] = [len(idx) // 2, len(t)]
    for i in sorted(t):
        d = t[i]; idx += struct.pack('<H', i); dl += struct.pack('<hhh', *[max(-32767, min(32767, int(round(x * Q)))) for x in d])
b64 = lambda b: base64.b64encode(gzip.compress(bytes(b), 9)).decode()
out = {
    'source': 'MakeHuman base mesh, targets and expression units, CC0 1.0 (github.com/makehumancommunity/makehuman); baked by bake_mh.py',
    'nV': len(P), 'q': Q,
    'v': b64(struct.pack('<%df' % (len(P) * 3), *[c for p in P for c in p])),
    'faces': b64(struct.pack('<%dH' % (len(faces) * 4), *[remap[i] for f in faces for i in f])),
    'fmat': b64(bytes(fmat)), 'lip': b64(lipmask), 'idx': b64(idx), 'd': b64(dl),
    'targets': table, 'sliders': sliders, 'units': units, 'brow': brow, 'tip': tip, 'cheek': cheek, 'eye': eyeL, 'chin': chin_i, 'crown': crown_i,
}
js = 'window.MH=' + json.dumps(out, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, 'mh-head.js'), 'w', newline='\n').write(js)
print('%d targets, %d sliders, %d expression units, %d delta entries; mh-head.js %.2f MB' % (len(T), len(sliders), len(units), len(idx) // 2, len(js) / 1e6))
print('brow groups', [len(b) for b in brow], 'tip', P[tip], 'cheek', P[cheek])
for s in sliders[:6]: print(s)
