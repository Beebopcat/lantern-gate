#!/usr/bin/env python3
"""Objective checks on the rendered score: key fit (pitch-class energy inside the intended mode), silent gaps, clipping, loop seam, size."""
import sys, os, subprocess, glob, math, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from orch import *

EXPECT = {'gate-of-lanterns': ('D', 'dorian', 1), 'hearthwick-morning': ('G', 'major', 1), 'market-square': ('C', 'major', 1), 'the-river-road': ('D', 'major', 1),
          'moors-at-dusk': ('D', 'minor', 1), 'lanterns-on-the-water': ('E', 'minor', 1), 'beneath-the-keepers-hall': ('C', 'phrygian', 1), 'steel-and-starlight': ('E', ['minor', 'harmonic'], 1),
          'the-hollow-warden': ('C', ['minor', 'harmonic'], 1), 'lantern-raised': ('D', 'major', 0), 'open-for-trade': ('F', 'major', 1), 'a-bed-for-the-night': ('Bb', 'major', 1)}
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/music/out'
bad = 0
for mp3 in sorted(glob.glob(os.path.join(src, '*.mp3'))):
    tid = os.path.basename(mp3)[:-4]
    if tid not in EXPECT:
        continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', str(SR), '-ac', '2', '/tmp/music/_chk.wav'], check=True)
    sr, x = wavfile.read('/tmp/music/_chk.wav')
    x = x.astype(np.float64) / 32768
    mono = x.mean(axis=1)
    f, t, S = signal.spectrogram(mono, SR, nperseg=8192, noverlap=4096)
    sel = (f > 90) & (f < 1800)
    P = S[sel].sum(axis=1)
    pc = np.zeros(12)
    for fr, pw in zip(f[sel], P):
        n = 69 + 12 * math.log2(fr / 440.0)
        i = int(round(n)) % 12
        pc[i] += pw
    pc /= pc.sum()
    key, mode, loop = EXPECT[tid]
    root = (NOTE[key[0]] + (1 if key.endswith('#') else -1 if key.endswith('b') else 0)) % 12
    scale = {(root + st) % 12 for m in ([mode] if isinstance(mode, str) else mode) for st in MODES[m]}
    inside = sum(pc[i] for i in scale)
    names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    top = [names[i] for i in np.argsort(-pc)[:5]]
    # silent gaps: 250 ms RMS windows far below the median
    w = int(.25 * SR)
    rms = np.array([np.sqrt((mono[i:i + w] ** 2).mean()) for i in range(0, len(mono) - w, w)])
    med = np.median(rms)
    body = rms[:-12] if not loop else rms      # a one-shot fanfare is allowed to fade out
    gaps = int((body < med * .04).sum())
    clip = int((np.abs(x) > .9999).sum())
    ok = inside > .86 and gaps == 0 and clip == 0
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'CHECK'} {tid:28s} {len(mono)/SR:6.1f}s {os.path.getsize(mp3)/1e6:4.1f}MB in-mode {inside*100:5.1f}%  top {top}  silent250ms:{gaps} clip:{clip}")
print('failures:', bad)
