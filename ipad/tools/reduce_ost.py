"""Turn orchestral 'Once Upon a Time in the West' MIDI sequences into two-hand piano versions.

Keeps each source's own timeline (bars, pauses, key changes); only the instruments change.
Right hand = whichever instrument carries the tune; left hand = bass line plus one chord note.

    python3 reduce_ost.py <sources-dir> <output-dir>
"""
import os
import struct
import sys


def read_midi(path):
    src = open(path, 'rb').read()
    _, ntr, div = struct.unpack('>HHH', src[8:14])
    pos = 14

    def vlq(p):
        v = 0
        while True:
            b = src[p]; p += 1; v = (v << 7) | (b & 0x7F)
            if b < 0x80:
                return v, p

    tracks = {}
    for t in range(ntr):
        ln = struct.unpack('>I', src[pos + 4:pos + 8])[0]
        p = pos + 8; end = p + ln; pos = end; tick = 0; rs = 0; on = {}; out = []
        while p < end:
            dt, p = vlq(p); tick += dt; s = src[p]
            if s < 0x80:
                s = rs
            else:
                p += 1
            if s == 0xFF:
                p += 1; l, p = vlq(p); p += l
            elif s in (0xF0, 0xF7):
                l, p = vlq(p); p += l
            else:
                rs = s; k = s & 0xF0; c = s & 15
                if k in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                    a, b = src[p], src[p + 1]; p += 2
                else:
                    a = src[p]; p += 1
                if c == 9:
                    continue
                if k == 0x90 and b > 0:
                    on[(c, a)] = (tick, b)
                elif k in (0x80, 0x90) and (c, a) in on:
                    st, v = on.pop((c, a)); out.append((st, tick, a, v))
        tracks[t] = sorted(out)
    return div, tracks


def reduce(path, lead, bass, fill, grid, tempo, meter, transpose_lead=0, beats_per_bar=None, max_rest_bars=None):
    """lead: function(bar) -> track numbers carrying the tune; grid: fraction of a beat to snap to."""
    div, tracks = read_midi(path)
    q = max(1, int(div * grid))
    snap = lambda x: int(round(x / q)) * q
    bar_len = div * (beats_per_bar or meter[0])
    bar_of = lambda tick: tick // bar_len + 1

    rh = []
    onsets = {}
    for t in {t for b in range(1, 400) for t in lead(b)}:
        for st, en, a, v in tracks.get(t, []):
            if v < 20 or t not in lead(bar_of(st)):
                continue
            onsets.setdefault(snap(st), []).append((a + transpose_lead, max(snap(en), snap(st) + q)))
    for st, ns in onsets.items():
        ns = sorted(set(ns), reverse=True)[:2]
        if len(ns) == 2 and ns[0][0] - ns[1][0] > 9:
            ns = ns[:1]
        rh += [(st, en, a) for a, en in ns]

    lh = []
    lows = {}
    for t in bass:
        for st, en, a, v in tracks.get(t, []):
            if v < 20 or a > 55:
                continue
            k = snap(st)
            if k not in lows or a < lows[k][0]:
                lows[k] = (a, max(snap(en), k + q))
    for k, (a, en) in lows.items():
        while a < 36:
            a += 12
        lh.append((k, en, a))
        near = [n for t in fill for n in tracks.get(t, []) if abs(snap(n[0]) - k) <= q and n[3] >= 20]
        cand = sorted({n[2] % 12 + 12 * (a // 12 + o) for n in near for o in (0, 1)} & set(range(a + 3, a + 13)))
        if cand:
            lh.append((k, en, cand[0]))

    def tidy(ns):
        ns = sorted(set(ns))
        starts = sorted({s for s, e, a in ns})
        nxt = dict(zip(starts, starts[1:]))
        out = []
        for s, e, a in ns:
            e = min(e, nxt.get(s, e))   # each chord lasts until the next one in the same hand
            if e > s and 21 <= a <= 108:
                out.append((s, e, a))
        return out

    rh, lh = tidy(rh), tidy(lh)
    # A piano note fades anyway; cap held notes at two bars so the falling notes stay readable.
    rh = [(s, min(e, s + 2 * bar_len), a) for s, e, a in rh]
    lh = [(s, min(e, s + 2 * bar_len), a) for s, e, a in lh]
    if max_rest_bars is not None:
        rh, lh = close_gaps(rh, lh, bar_len, max_rest_bars)
    return div, rh, lh, tempo, meter


def close_gaps(rh, lh, bar_len, max_rest_bars):
    """Where the tune rests longer than max_rest_bars, cut out whole empty bars so the next phrase
    comes in sooner. Whole bars only, so the beat and bar lines stay even."""
    starts = sorted({s for s, e, a in rh})
    cuts = []   # (from_tick, length) removed from the timeline
    for a, b in zip(starts, starts[1:]):
        # Only bars strictly between the last note's bar and the next note's bar can go.
        spare = (b // bar_len) - (a // bar_len) - 1 - max_rest_bars
        if spare > 0:
            # Keep the first max_rest_bars after the last melody note, drop the bars after that.
            from_bar = (a // bar_len) + max_rest_bars + 1
            cuts.append((from_bar * bar_len, spare * bar_len))

    def move(t):
        shift = 0
        for start, length in cuts:
            if t >= start + length:
                shift += length
            elif t >= start:
                return None   # inside a removed stretch
        return t - shift

    def apply(ns):
        out = []
        for s, e, a in ns:
            s2 = move(s)
            if s2 is None:
                continue
            e2 = move(e)
            if e2 is None:   # note ran into a removed stretch: end it where the cut starts
                e2 = move(max(c[0] for c in cuts if c[0] <= e)) or s2 + 1
            out.append((s2, max(e2, s2 + 1), a))
        return out

    return apply(rh), apply(lh)


def write_midi(path, div, rh, lh, tempo, meter):
    def vlq(v):
        b = [v & 0x7F]; v >>= 7
        while v:
            b.insert(0, (v & 0x7F) | 0x80); v >>= 7
        return bytes(b)

    def track(name, ns, vel, meta=b''):
        ev = sorted([(s, 1, a) for s, e, a in ns] + [(e - 6, 0, a) for s, e, a in ns], key=lambda x: (x[0], x[1]))
        d = b'\x00\xff\x03' + vlq(len(name)) + name.encode() + meta + b'\x00\xc0\x00'
        last = 0
        for t, on, a in ev:
            d += vlq(t - last) + bytes([0x90 if on else 0x80, a, vel if on else 0]); last = t
        d += b'\x00\xff\x2f\x00'
        return b'MTrk' + struct.pack('>I', len(d)) + d

    den = {2: 1, 4: 2, 8: 3}[meter[1]]
    meta = (b'\x00\xff\x51\x03' + struct.pack('>I', int(60e6 / tempo))[1:]
            + b'\x00\xff\x58\x04' + bytes([meter[0], den, 0x18, 0x08]))
    data = (b'MThd' + struct.pack('>IHHH', 6, 1, 2, div)
            + track('Right hand', rh, 82, meta) + track('Left hand', lh, 56))
    open(path, 'wb').write(data)


def main_theme_lead(b):
    if b <= 34: return [13]      # vibraphone/harpsichord thirds (the opening figure)
    if b <= 46: return [3]       # sung melody
    if b <= 51: return [5]       # horn line
    if b <= 55: return [3]       # sung melody returns
    if b <= 74: return [8, 5]    # choir chords
    if b <= 86: return [3]       # theme in E-flat
    return [8, 5]                # closing chords


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    pieces = [
        # Same sequence found three times; two copies say 121 bpm.
        ('once-upon-a-time-in-the-west-main-theme.mid', 'main-theme__midis101__4827.mid',
         dict(lead=main_theme_lead, bass=[1, 10, 4], fill=[8, 12, 2, 4], grid=1 / 4, tempo=121, meter=(3, 4), max_rest_bars=0)),
        # Harmonica wail + brass riff on top, bass guitar and piano chords below.
        ('man-with-a-harmonica.mid', 'man-with-harmonica__bitmidi__102588.mid',
         dict(lead=lambda b: [1, 7], bass=[2], fill=[10, 3], grid=1 / 4, tempo=57, meter=(4, 4), max_rest_bars=0)),
        # Whistle melody (an octave down) on a swung triplet grid; both sources agree on the notes.
        ('farewell-to-cheyenne.mid', 'cheyenne__midis101__4830.mid',
         dict(lead=lambda b: [1], bass=[7], fill=[3, 4, 2], grid=1 / 3, tempo=88, meter=(4, 4), transpose_lead=-12)),
    ]
    for name, source, cfg in pieces:
        div, rh, lh, tempo, meter = reduce(os.path.join(src, source), **cfg)
        write_midi(os.path.join(out, name), div, rh, lh, tempo, meter)
        print(f'{name}: right hand {len(rh)} notes, left hand {len(lh)} notes')
