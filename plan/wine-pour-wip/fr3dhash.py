"""Split an fr3d v4 skin blob into its sections and hash each one.

Format, from export_skin() in tools/blender/human_mh.py:
  header  <4sIII6fI>   magic, ver, nv, ni, bbox(6f), shed
  pos     nv*3 f32
  nrm     nv*3 f32
  cols    nv*3 u8
  bidx    nv*4 u8
  bwgt    nv*4 u8
  pad to 4
  idx     ni u32
  <I> nbones, then per bone <H name i 7f>
  <I> nclips, then per clip <H name f I B 3x> then nframes * (3f + nbones*4h)
"""
import gzip, hashlib, struct, sys

def parse(path):
    b = gzip.open(path, 'rb').read()
    o = 0
    magic, ver, nv, ni = struct.unpack_from('<4sIII', b, o)
    hdr = struct.calcsize('<4sIII6fI')
    o = hdr
    secs = []
    def take(n, name):
        nonlocal o
        s = b[o:o + n]; o += n
        secs.append((name, s))
        return s
    take(nv * 12, 'pos')
    take(nv * 12, 'nrm')
    take(nv * 3, 'cols')
    take(nv * 4, 'bidx')
    take(nv * 4, 'bwgt')
    pad = (-o) % 4
    o += pad
    take(ni * 4, 'idx')
    nb, = struct.unpack_from('<I', b, o); o += 4
    bstart = o
    for _ in range(nb):
        ln, = struct.unpack_from('<H', b, o)
        o += 2 + ln + struct.calcsize('<i7f')
    secs.append(('bones', b[bstart:o]))
    nc, = struct.unpack_from('<I', b, o); o += 4
    clips = []
    for _ in range(nc):
        st = o
        ln, = struct.unpack_from('<H', b, o); o += 2
        name = b[o:o + ln].decode(); o += ln
        dur, nf, loop = struct.unpack_from('<fIB3x', b, o)
        o += struct.calcsize('<fIB3x')
        o += nf * (12 + nb * 8)
        clips.append((name, dur, nf, b[st:o]))
    return dict(nv=nv, ni=ni, ver=ver, nb=nb, secs=secs, clips=clips, size=len(b))

def digest(s):
    return hashlib.sha256(s).hexdigest()[:16]

def report(path):
    d = parse(path)
    out = {}
    for name, s in d['secs']:
        out['mesh:' + name] = digest(s)
    for name, dur, nf, s in d['clips']:
        out['clip:' + name] = digest(s)
    return d, out

if __name__ == '__main__':
    a, ra = report(sys.argv[1])
    if len(sys.argv) > 2:
        bd, rb = report(sys.argv[2])
        keys = list(dict.fromkeys(list(ra) + list(rb)))
        same = diff = 0
        for k in keys:
            x, y = ra.get(k), rb.get(k)
            if x == y:
                same += 1
            else:
                diff += 1
                print('DIFF  %-22s %s -> %s' % (k, x, y))
        print('--- %d sections identical, %d differ' % (same, diff))
    else:
        for k, v in ra.items():
            print('%-22s %s' % (k, v))
