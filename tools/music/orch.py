#!/usr/bin/env python3
"""Lantern Gate orchestral score toolkit.

Original music is composed in code (scale degrees, chord symbols, patterns), written as MIDI stems, rendered with FluidSynth using the
MuseScore General SoundFont (MIT licence, CC0 string and drum samples), given a synthetic concert-hall reverb, mastered and encoded to MP3.
Nothing here copies any existing score.  Run a track module:  python3 tools/music/tracks/<name>.py  (writes audio/orchestra/<id>.mp3).
"""
import math, os, random, re, shutil, subprocess, tempfile
import numpy as np
import mido
from scipy import signal
from scipy.io import wavfile
import pyloudnorm as pyln

SF = '/usr/share/sounds/sf3/MuseScore_General.sf3'
SR = 48000
PPQ = 480
LEVELER = 0.55      # 0 = leave the dynamics alone, 1 = flatten completely
MODES = {
    'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10], 'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10], 'harmonic': [0, 2, 3, 5, 7, 8, 11],
}
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pitch(name):
    """'D4' / 'Bb3' / 'F#5' -> MIDI number."""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    return 12 * (int(m.group(3)) + 1) + NOTE[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]


# GM programs used (MuseScore General follows GM)
PROG = dict(piano=0, celesta=8, glock=9, music_box=10, vibes=11, harp=46, guitar=24, steel=25, accordion=21, harmonica=22, organ=19, church=19,
            violin=40, viola=41, cello=42, bass=43, tremolo=44, pizz=45, strings=48, strings2=49, synstr=50, choir=52, oohs=53, voice=54,
            trumpet=56, trombone=57, tuba=58, mute=59, horn=60, brass=61, oboe=68, eh=69, clarinet=71, bassoon=70, flute=73, recorder=74, pan=75,
            piccolo=72, timp=47, taiko=116, bells=14, marimba=12, dulcimer=15, kalimba=108, ocarina=79, whistle=78, bagpipe=109, fiddle=110)
GROUP_WET_DB = {'strings': -8.5, 'winds': -8.0, 'brass': -10.0, 'choir': -6.0, 'perc': -12.0, 'keys': -9.0, 'plucked': -9.0}
GROUP_GAIN = {'strings': 1.0, 'winds': 1.0, 'brass': .95, 'choir': .9, 'perc': .95, 'keys': 1.0, 'plucked': 1.0}


class Voice:
    def __init__(s, name, program, group, pan=0.0, vol=100, channel=0, drums=False):
        s.name, s.program, s.group, s.pan, s.vol, s.channel, s.drums = name, program, group, pan, vol, channel, drums
        s.notes = []      # (start_beat, dur_beats, midi, velocity)
        s.cc = []         # (beat, controller, value)


class Piece:
    def __init__(s, id, title, key='C', mode='major', tempo=100, beats=4, bars=32, seed=1, tail=5.0, loop=True, bar_unit=1.0):
        s.id, s.title, s.mode, s.tempo, s.beats, s.bars, s.tail, s.loop = id, title, mode, tempo, beats, bars, tail, loop
        s.tonic = pitch(key + '4')         # degree 1 in octave 4
        s.scale = MODES[mode]
        s.voices = {}
        s.rng = random.Random(seed)
        s.tempo_map = [(0.0, tempo)]
        s.free = [c for c in range(16) if c != 9]
        s.wet_offset = 0.0     # dB added to every stem's reverb level for this piece
        s.rt60 = 2.6

    # ---- structure helpers
    def at(s, bar, beat=0.0):
        """absolute beat of bar (1-based) + beat offset"""
        return (bar - 1) * s.beats + beat

    def voice(s, name, inst, group, pan=0.0, vol=100, drums=False):
        ch = 9 if drums else s.free.pop(0)
        prog = PROG[inst] if isinstance(inst, str) else inst
        v = Voice(name, prog, group, pan, vol, ch, drums)
        s.voices[name] = v
        return v

    # ---- pitches
    def deg(s, d, octave=0, acc=0):
        i = d - 1
        return s.tonic + s.scale[i % 7] + 12 * (i // 7) + 12 * octave + acc

    # ---- melody lines in scale degrees
    TOK = re.compile(r"^(?P<d>[1-9]|r)(?P<acc>[#b]?)(?P<oct>['\,]*)(?::(?P<dur>[0-9./]+))?(?P<mod>[\^_.]*)$")

    def line(s, voice, bar, text, octave=0, vel=84, legato=.96, beat=0.0):
        """Write a melody.  Tokens: degree[#|b][' up|, down][:beats][^ accent|_ soft|. staccato]; r = rest; a+b+c = stacked degrees."""
        v = s.voices[voice]
        t = s.at(bar, beat)
        last = 1.0
        for tok in text.split():
            if tok == '|':
                continue
            parts = []
            for part in tok.split('+'):
                m = s.TOK.match(part)
                if not m:
                    raise ValueError(f'{s.id}: bad token {part!r} in {voice} bar {bar}')
                parts.append(m)
            ds = next((m.group('dur') for m in parts if m.group('dur')), None)
            dur = (eval(ds) if '/' in ds else float(ds)) if ds else last
            for m in parts:
                if m.group('d') == 'r':
                    continue
                d = int(m.group('d'))
                acc = {'#': 1, 'b': -1, '': 0}[m.group('acc')]
                o = m.group('oct').count("'") - m.group('oct').count(',')
                mod = m.group('mod')
                n = s.deg(d, octave + o, acc)
                vv = vel + (14 if '^' in mod else 0) - (16 if '_' in mod else 0)
                length = dur * (.5 if '.' in mod else legato)
                v.notes.append((t, length, n, max(1, min(127, vv))))
            t += dur
            last = dur
        return t

    # ---- chords
    def chord(s, sym):
        """'1' '4' '6m' '5s' '2m7' 'b7' '1/5' -> dict(root, tones[semitone offsets], bass)"""
        m = re.fullmatch(r"([#b]?)([1-7])(M7|m7|dim|aug|sus|add9|maj7|m|M|s|7|9)?(?:/([#b]?[1-7]))?", sym)
        if not m:
            raise ValueError(f'bad chord {sym!r}')
        acc, d, q, bass = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        root = s.deg(d, 0, {'#': 1, 'b': -1, '': 0}[acc]) - 12
        diat = [s.deg(d + k, 0) - 12 - root for k in (0, 2, 4, 6, 8)]
        if acc or q in ('M', 'm', 'dim', 'aug', 'sus', 's', 'M7', 'm7', 'maj7'):
            third = {'m': 3, 'm7': 3, 'dim': 3}.get(q, 4)
            fifth = {'dim': 6, 'aug': 8}.get(q, 7)
            tones = [0, third, fifth]
            if q in ('sus', 's'):
                tones = [0, 5, 7]
            if q in ('M7', 'maj7'):
                tones.append(11)
            if q == 'm7':
                tones.append(10)
        else:
            tones = diat[:3]
            if q == '7':
                tones.append(diat[3])
            if q == '9':
                tones += [diat[3], diat[4]]
            if q == 'add9':
                tones.append(diat[4])
        if q == '7' and (acc or q in ('M', 'm')):
            tones.append(10)
        bpc = s.deg(int(bass[-1]), 0, {'#': 1, 'b': -1, '': 0}[bass[0]] if bass[0] in '#b' else 0) - 12 if bass else root
        return dict(root=root, tones=tones, bass=bpc, sym=sym)

    def prog(s, bar, text, per=None):
        """Chord progression: tokens 'sym[:beats]' (default one bar each).  Returns [(start_beat, dur_beats, chord)]."""
        out, t = [], s.at(bar)
        for tok in text.split():
            sym, _, d = tok.partition(':')
            dur = float(d) if d else (per or s.beats)
            out.append((t, dur, s.chord(sym)))
            t += dur
        return out

    @staticmethod
    def close(ch, lo, hi, prev=None, n=3):
        """Voice-lead chord tones within [lo, hi]."""
        pcs = [(ch['root'] + tn) % 12 for tn in ch['tones']][:max(n, 3)]
        cand = [p for p in range(lo, hi + 1) if p % 12 in pcs]
        if prev:
            out = []
            for p in prev:
                best = min((c for c in cand if c not in out), key=lambda c: abs(c - p), default=None)
                if best is not None:
                    out.append(best)
            have = {x % 12 for x in out}
            for pc in pcs:                   # make sure every chord tone is present
                if pc not in have and len(out) < n:
                    out.append(min((c for c in cand if c % 12 == pc and c not in out), key=lambda c: abs(c - (sum(prev) / len(prev))), default=cand[0]))
            return sorted(out)[:max(n, 3)]
        out, p = [], lo - 1
        order = (pcs * 2)[:n]
        for pc in order:
            c = min((x for x in cand if x % 12 == pc and x > p), default=min(cand, key=lambda x: abs(x - p)))
            out.append(c)
            p = c
        return sorted(set(out))

    # ---- accompaniment patterns
    def pad(s, voice, prog, lo, hi, vel=64, n=3, legato=1.0, split=None, rel=.04):
        v, prev = s.voices[voice], None
        for t, d, ch in prog:
            ps = s.close(ch, lo, hi, prev, n)
            prev = ps
            for p in ps:
                v.notes.append((t, max(.1, d * legato - rel), p, vel))
        return prev

    def arp(s, voice, prog, lo, hi, pattern='0 1 2 1', rate=.5, vel=70, n=3, legato=1.1, accent=6, octs=1):
        """pattern = indices into the voiced chord (0 = lowest); index >= len wraps an octave up."""
        v, prev = s.voices[voice], None
        idx = [int(x) for x in pattern.split()]
        for t, d, ch in prog:
            ps = s.close(ch, lo, hi, prev, n)
            prev = ps
            steps = int(round(d / rate))
            for k in range(steps):
                i = idx[k % len(idx)]
                p = ps[i % len(ps)] + 12 * (i // len(ps))
                v.notes.append((t + k * rate, rate * legato, p, vel + (accent if k % len(idx) == 0 else 0)))
        return prev

    def bassline(s, voice, prog, octave=2, pattern='R', rate=1.0, vel=80, legato=.92):
        """pattern tokens: R root, 5 fifth, 8 octave, 3 third, . rest, - hold (extend previous)."""
        v = s.voices[voice]
        toks = pattern.split()
        for t, d, ch in prog:
            root = ch['bass']
            base = pitch('C2') + ((root - pitch('C2')) % 12) + 12 * (octave - 2)
            steps = int(round(d / rate))
            last = None
            for k in range(steps):
                tk = toks[k % len(toks)]
                if tk == '.':
                    last = None
                    continue
                if tk == '-' and last is not None:
                    n = v.notes[last]
                    v.notes[last] = (n[0], n[1] + rate, n[2], n[3])
                    continue
                p = {'R': base, '5': base + 7, '8': base + 12, '3': base + ch['tones'][1] if len(ch['tones']) > 1 else base + 4, '6': base + 9}.get(tk, base)
                v.notes.append((t + k * rate, rate * legato, p, vel + (6 if k % len(toks) == 0 else 0)))
                last = len(v.notes) - 1

    def stab(s, voice, prog, lo, hi, pattern='x . . . x . . .', rate=.5, vel=84, n=3, dur=.4):
        v, prev = s.voices[voice], None
        toks = pattern.split()
        for t, d, ch in prog:
            ps = s.close(ch, lo, hi, prev, n)
            prev = ps
            for k in range(int(round(d / rate))):
                tk = toks[k % len(toks)]
                if tk == '.':
                    continue
                for p in ps:
                    v.notes.append((t + k * rate, dur, p, vel + (12 if tk == 'X' else 0)))

    def hits(s, voice, bar, bars, patterns, rate=.5, vel=80):
        """Drums: patterns = {midi_note: 'x...x...'} steps of `rate` beats, repeated for `bars` bars.  x normal, X accent, o ghost."""
        v = s.voices[voice]
        for note, pat in patterns.items():
            per_bar = int(round(s.beats / rate))
            for b in range(bars):
                for k in range(per_bar):
                    ch = pat[(b * per_bar + k) % len(pat)]
                    if ch in '.- ':
                        continue
                    vv = {'x': vel, 'X': vel + 22, 'o': vel - 34, 'c': vel + 8}[ch]
                    v.notes.append((s.at(bar + b, k * rate), .2, note, max(1, min(127, vv))))

    def roll(s, voice, note, bar, beat, dur, vel0=40, vel1=100, rate=.125):
        v = s.voices[voice]
        n = int(dur / rate)
        for k in range(n):
            v.notes.append((s.at(bar, beat) + k * rate, rate * 1.4, note, int(vel0 + (vel1 - vel0) * k / max(1, n - 1))))

    def dyn(s, voice, points, ctrl=11, step=.5):
        """CC11 expression curve through (bar, value) points (bars may be fractional)."""
        v = s.voices[voice]
        pts = sorted(points)
        for (b0, v0), (b1, v1) in zip(pts, pts[1:]):
            t0, t1 = s.at(1) + (b0 - 1) * s.beats, s.at(1) + (b1 - 1) * s.beats
            k = 0
            while t0 + k * step <= t1:
                f = (k * step) / max(1e-9, t1 - t0)
                v.cc.append((t0 + k * step, ctrl, int(round(v0 + (v1 - v0) * min(1, f)))))
                k += 1

    def tempo_at(s, bar, bpm):
        s.tempo_map.append((s.at(bar), bpm))

    # ---- MIDI + audio
    def _beat_to_seconds(s, beat):
        t, last_b, bpm = 0.0, 0.0, s.tempo_map[0][1]
        for b, tp in s.tempo_map[1:]:
            if b >= beat:
                break
            t += (b - last_b) * 60.0 / bpm
            last_b, bpm = b, tp
        return t + (beat - last_b) * 60.0 / bpm

    def total_beats(s):
        return s.bars * s.beats

    def _midi(s, groups, path, humanize=True):
        mid = mido.MidiFile(ticks_per_beat=PPQ)
        meta = mido.MidiTrack()
        meta.append(mido.MetaMessage('time_signature', numerator=s.beats, denominator=4, time=0))
        mid.tracks.append(meta)
        events = []
        for b, bpm in s.tempo_map:
            events.append((int(b * PPQ), 0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm))))
        rng = random.Random(7)
        for v in s.voices.values():
            if v.group not in groups:
                continue
            ch = v.channel
            if v.drums:
                events.append((0, 1, mido.Message('control_change', channel=ch, control=0, value=0)))
                events.append((0, 1, mido.Message('program_change', channel=ch, program=v.program)))
            else:
                events.append((0, 1, mido.Message('program_change', channel=ch, program=v.program)))
            for cc, val in ((7, v.vol), (10, int(64 + v.pan * 63)), (91, 0), (93, 0), (11, 100)):
                events.append((0, 1, mido.Message('control_change', channel=ch, control=cc, value=max(0, min(127, val)))))
            for b, c, val in v.cc:
                events.append((max(0, int(b * PPQ)), 1, mido.Message('control_change', channel=ch, control=c, value=max(0, min(127, val)))))
            for (t, d, p, vel) in sorted(v.notes):
                jt = rng.gauss(0, .010) * (s.tempo / 60.0) if humanize and not v.drums else 0.0   # about 10 ms of looseness
                if humanize and v.group in ('strings', 'brass', 'choir', 'winds'):
                    jt += .012 * (s.tempo / 60.0)                                            # slow-attack sections speak a touch late
                t0 = max(0.0, t + jt)
                vv = int(max(1, min(127, vel + (rng.randint(-5, 5) if humanize else 0))))
                events.append((int(t0 * PPQ), 3, mido.Message('note_on', channel=ch, note=int(p), velocity=vv)))
                events.append((int((t0 + max(.05, d)) * PPQ), 2, mido.Message('note_off', channel=ch, note=int(p), velocity=0)))
        events.sort(key=lambda e: (e[0], e[1]))
        last = 0
        for tick, _, msg in events:
            msg.time = tick - last
            last = tick
            meta.append(msg)
        meta.append(mido.MetaMessage('end_of_track', time=PPQ * s.beats))
        mid.save(path)

    def _fluid(s, mid, wav):
        cmd = ['fluidsynth', '-ni', '-a', 'file', '-T', 'wav', '-O', 'float', '-r', str(SR), '-g', '0.8', '-F', wav,
               '-o', 'synth.reverb.active=0', '-o', 'synth.chorus.active=0', '-o', 'synth.polyphony=1024', '-o', 'synth.threadsafe-api=0',
               SF, mid]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if not os.path.exists(wav) or os.path.getsize(wav) < 1000:
            raise RuntimeError('fluidsynth failed: ' + r.stderr[-400:])

    def stems(s, work):
        out = {}
        groups = sorted({v.group for v in s.voices.values()})
        for g in groups:
            mid, wav = os.path.join(work, f'{s.id}-{g}.mid'), os.path.join(work, f'{s.id}-{g}.wav')
            s._midi({g}, mid)
            s._fluid(mid, wav)
            sr, x = wavfile.read(wav)
            assert sr == SR
            x = x.astype(np.float32)
            if x.ndim == 1:
                x = np.stack([x, x], 1)
            out[g] = x
        return out

    def render(s, outdir, work=None, keep_wav=False, report=True):
        work = work or tempfile.mkdtemp(prefix='lg-music-')
        st = s.stems(work)
        n_music = int(s._beat_to_seconds(s.total_beats()) * SR)
        n_total = n_music + int(s.tail * SR)
        mix = np.zeros((n_total, 2), np.float32)
        for g, x in st.items():
            x = x[:n_total]
            if len(x) < n_total:
                x = np.pad(x, ((0, n_total - len(x)), (0, 0)))
            dry = st[g][:n_total]
            if len(dry) < n_total:
                dry = np.pad(dry, ((0, n_total - len(dry)), (0, 0)))
            wet = reverb(hp(x, 90), rt60=s.rt60, seed=sum(map(ord, g)))
            rd, rw = float(np.sqrt((dry ** 2).mean()) + 1e-9), float(np.sqrt((wet ** 2).mean()) + 1e-9)
            wet *= rd / rw * 10 ** ((GROUP_WET_DB.get(g, -9.0) + s.wet_offset) / 20)
            mix += GROUP_GAIN.get(g, 1.0) * (dry + wet)
        if s.loop:                                           # fold the reverb tail onto the start so the loop is seamless
            body = mix[:n_music].copy()
            tail = mix[n_music:n_music + int(s.tail * SR)]
            body[:len(tail)] += tail
            mix = body
        else:
            fade = int(.8 * SR)
            mix = mix[:n_music + int(s.tail * SR * .6)]
            mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
        mix = master(mix, loop=s.loop)
        os.makedirs(outdir, exist_ok=True)
        wav = os.path.join(work, s.id + '-master.wav')
        write_wav16(wav, mix)
        mp3 = os.path.join(outdir, s.id + '.mp3')
        encode_mp3(wav, mp3, s.title)
        info = analyse(mix) if report else {}
        info.update(seconds=len(mix) / SR, mp3=mp3, bytes=os.path.getsize(mp3))
        if not keep_wav:
            shutil.rmtree(work, ignore_errors=True)
        return info


# ---------------------------------------------------------------- signal processing
def hp(x, f):
    sos = signal.butter(2, f, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def lp(x, f):
    sos = signal.butter(2, f, 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


_IR = {}


def hall_ir(seed=3, rt60=2.6, predelay=.024):
    """Synthetic concert-hall impulse response: sparse early reflections + a diffuse tail that darkens as it decays."""
    key = (seed, rt60)
    if key in _IR:
        return _IR[key]
    rng = np.random.default_rng(seed)
    n = int(SR * (rt60 * 1.15))
    t = np.arange(n) / SR
    ir = np.zeros((n, 2), np.float64)
    for ch in range(2):
        bands = []
        for lo, hi, scale in ((None, 250, 1.25), (250, 2500, 1.0), (2500, 9000, .62), (9000, 16000, .3)):
            noise = rng.standard_normal(n)
            if lo is None:
                sos = signal.butter(2, hi, 'low', fs=SR, output='sos')
            elif hi >= 16000:
                sos = signal.butter(2, lo, 'high', fs=SR, output='sos')
            else:
                sos = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
            env = np.exp(-6.9 * t / (rt60 * scale))
            bands.append(signal.sosfilt(sos, noise) * env)
        ir[:, ch] = sum(bands)
        # onset ramp, so the tail blooms rather than clicks
        ir[:, ch] *= np.minimum(1, t / .035)
    # early reflections
    for k in range(14):
        d = int((.008 + rng.random() * .075) * SR)
        g = (.5 - k * .025) * (.6 + .4 * rng.random())
        pan = rng.random()
        if d < n:
            ir[d, 0] += g * (1 - pan)
            ir[d, 1] += g * pan
    pre = int(predelay * SR)
    ir = np.concatenate([np.zeros((pre, 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0).mean())
    _IR[key] = ir.astype(np.float32)
    return _IR[key]


def reverb(x, seed=3, rt60=2.6):
    ir = hall_ir(seed % 5 + 1, rt60)
    wet = np.zeros_like(x)
    for ch in range(2):
        a = signal.oaconvolve(x[:, 0], ir[:, ch])[:len(x)] * .5
        b = signal.oaconvolve(x[:, 1], ir[:, ch])[:len(x)] * .5
        wet[:, ch] = (a + b)
    return wet


def master(x, loop=True):
    x = hp(x, 40)
    # gentle presence + air tilt
    b, a = signal.iirpeak(3200 / (SR / 2), 1.1)
    x = (x + .10 * (signal.lfilter(b, a, x, axis=0))).astype(np.float32)
    # bus compressor (feed-forward, stereo-linked)
    thr, ratio, att, rel = 10 ** (-20 / 20), 2.2, math.exp(-1 / (.02 * SR)), math.exp(-1 / (.28 * SR))
    lvl = np.abs(x).max(axis=1)
    # vectorised smoothing using lfilter on the rectified signal (attack/release approximated by one pole each)
    env_att = signal.lfilter([1 - att], [1, -att], lvl)
    env_rel = signal.lfilter([1 - rel], [1, -rel], lvl)
    env = np.maximum(env_att, env_rel)
    gain = np.where(env > thr, (env / thr) ** (1 / ratio - 1), 1.0)
    x = x * gain[:, None].astype(np.float32)
    # air: a soft high shelf, because sampled orchestras read dark once the reverb has smoothed them
    b, a = signal.butter(1, 7000 / (SR / 2), 'high')
    x = (x + .22 * signal.lfilter(b, a, x, axis=0)).astype(np.float32)
    # slow leveler: pull each 3-second stretch about halfway towards the target loudness, so quiet passages stay audible under play and
    # climaxes do not jump out (the fold-around keeps loops seamless)
    meter = pyln.Meter(SR)
    win = int(3 * SR)
    marks, lev = [], []
    for i in range(0, len(x) - win + 1, win // 2):
        seg = x[i:i + win].astype(np.float64)
        try:
            l = meter.integrated_loudness(seg)
        except Exception:
            l = -40.0
        marks.append(i + win // 2)
        lev.append(max(-45.0, l))
    lev = np.array(lev)
    target = float(np.median(lev))
    adj = np.clip((target - lev) * LEVELER, -7.0, 9.0)
    gain_db = np.interp(np.arange(len(x)), marks, adj)
    gain_db = signal.sosfiltfilt(signal.butter(1, .6, 'low', fs=SR, output='sos'), gain_db)
    x = (x * (10 ** (gain_db / 20))[:, None]).astype(np.float32)
    # loudness to about -16 LUFS (music bed that sits under speech and effects)
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(x.astype(np.float64))
    x = x * 10 ** ((-16.0 - lufs) / 20)
    # look-ahead limiter at -1 dBFS
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = 10 ** (-1 / 20)
    look = int(.004 * SR)
    peak = np.abs(x).max(axis=1)
    need = minimum_filter1d(np.minimum(1.0, ceil / np.maximum(peak, 1e-9)), size=look * 2 + 1, mode='nearest')
    need = uniform_filter1d(need, size=look * 2 + 1, mode='nearest')
    x = x * need[:, None].astype(np.float32)
    return np.clip(x, -ceil, ceil).astype(np.float32)


def write_wav16(path, x):
    d = (np.random.default_rng(1).random(x.shape) - np.random.default_rng(2).random(x.shape)) / 32768.0   # TPDF dither
    pcm = np.clip((x + d) * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(path, SR, pcm)


def encode_mp3(wav, mp3, title):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-q:a', '2', '-ar', str(SR),
           '-metadata', f'title={title}', '-metadata', 'artist=Lantern Gate (original score)', '-metadata', 'album=Lantern Gate Orchestra',
           '-id3v2_version', '3', '-write_xing', '1', mp3]
    subprocess.run(cmd, check=True, timeout=300)


def analyse(x):
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(x.astype(np.float64))
    peak = 20 * math.log10(max(1e-9, float(np.abs(x).max())))
    mono = x.mean(axis=1)
    f, pxx = signal.welch(mono, SR, nperseg=8192)
    centroid = float((f * pxx).sum() / pxx.sum())
    bands = {}
    for name, lo, hi in (('sub<60', 0, 60), ('bass60-250', 60, 250), ('mid250-2k', 250, 2000), ('pres2k-6k', 2000, 6000), ('air6k+', 6000, 24000)):
        bands[name] = round(10 * math.log10(max(1e-12, float(pxx[(f >= lo) & (f < hi)].sum() / pxx.sum()))), 1)
    win = int(.05 * SR)
    rms0 = float(np.sqrt((x[:win] ** 2).mean())); rms1 = float(np.sqrt((x[-win:] ** 2).mean()))
    clip = int((np.abs(x) >= .9999).sum())
    return dict(lufs=round(lufs, 1), peak_db=round(peak, 1), centroid_hz=round(centroid), bands_db=bands, head_rms=round(rms0, 4), tail_rms=round(rms1, 4), clipped=clip)


def spectrogram_png(x, path, secs=None):
    from PIL import Image
    mono = x.mean(axis=1) if x.ndim == 2 else x
    if secs:
        mono = mono[:int(secs * SR)]
    f, t, S = signal.spectrogram(mono, SR, nperseg=2048, noverlap=1536)
    S = 10 * np.log10(S + 1e-10)
    S = np.clip((S - (S.max() - 80)) / 80, 0, 1)
    keep = f <= 12000
    img = (S[keep][::-1] * 255).astype(np.uint8)
    Image.fromarray(img).resize((min(1400, img.shape[1]), 360)).save(path)
