import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

OUT = os.environ.get('OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../game/audio/orchestra'))
p = Piece('gate-of-lanterns', 'Gate of Lanterns', key='D', mode='dorian', tempo=76, beats=4, bars=44, seed=11)
v = orchestra(p, ['harp', 'vln', 'vla', 'cello', 'bass', 'flute', 'oboe', 'horn', 'trumpet', 'oohs', 'timp', 'kit', 'piano'])

# harmony ---------------------------------------------------------------------
intro = p.prog(1, '1m 3 7 4')
A = p.prog(5, '1m 3 7 4 1m 3 4 5M')
A2 = p.prog(13, '1m 3 7 4 1m 3 4 1m')
B = p.prog(21, '4 5m 3 7 4 5m 1m 5M')
A3 = p.prog(29, '1m 3 7 4 1m 3 4 1M')
out = p.prog(37, '1m 3 7 4 1m 3 4 1m')
allp = intro + A + A2 + B + A3 + out

# tunes -----------------------------------------------------------------------
THEME = ["5:1 1':2 2':1", "3':3 2':1", "1':2 7:1 6:1", "6:3 5:1", "5:1 1':2 2':1", "3':2 5':2", "4':3 3':1"]
BTUNE = ["6:1 1':1 4':2", "5':2 2':1 7:1", "3':2 2':1 1':1", "7:2 2':1 4':1", "6:1 1':1 4':1 6':1", "5':2 7':1 5':1", "1':2 3':1 5':1", "2':4"]
HORNB = ["1':4", "7:4", "5:4", "4:4", "6:4", "7:4", "5:4", "7#:4"]


def tune(voice, bar, lines, octave=0, vel=84, end=None):
    for i, ln in enumerate(lines):
        p.line(voice, bar + i, ln, octave=octave, vel=vel)
    if end:
        p.line(voice, bar + len(lines), end, octave=octave, vel=vel)

# intro: harp and a soft pad, flute states the call -------------------------------
p.arp('harp', allp, 50, 83, pattern='0 1 2 1 2 1 0 1', rate=.5, vel=62, n=3)
p.pad('vla', intro[1:] + A + A2, 50, 69, vel=54, n=3)
tune('flute', 3, ["5:1 1':2 2':1", "3':4"], octave=0, vel=78)
# A: oboe sings the theme over pizzicato-soft strings -----------------------------
tune('oboe', 5, THEME, vel=80, end="2':4")
p.bassline('cello', A, octave=2, pattern='R . . . 5 . . .', rate=.5, vel=66)
# A': violins and flute take it, horns warm the harmony ---------------------------
tune('vln', 13, THEME, octave=0, vel=84, end="1':4")
tune('flute', 13, THEME, octave=1, vel=72, end="1':4")
p.pad('horn', A2, 48, 67, vel=56, n=3)
p.bassline('cello', A2, octave=2, pattern='R . 5 . R . 5 .', rate=.5, vel=72)
p.bassline('bass', A2, octave=1, pattern='R - - - ', rate=1.0, vel=64)
p.roll('timp', pitch('D2'), 19, 0, 4, 0, 30, 70) if False else None
p.roll('timp', pitch('A2'), 20, 0, 4, 28, 80, rate=.125)
# B: the bridge swells, voices and brass join -------------------------------------
tune('vln', 21, BTUNE, octave=0, vel=88)
tune('horn', 21, HORNB, octave=0, vel=70)
p.pad('vla', B, 48, 69, vel=62, n=3)
p.pad('oohs', B, 55, 74, vel=58, n=3)
p.bassline('cello', B, octave=2, pattern='R . 5 . R . 5 .', rate=.5, vel=76)
p.bassline('bass', B, octave=1, pattern='R - - - ', rate=1.0, vel=70)
p.roll('timp', pitch('A2'), 27, 0, 8, 30, 105, rate=.125)
# A'': the full orchestra --------------------------------------------------------
tune('vln', 29, THEME, octave=0, vel=96, end="1':4")
tune('flute', 29, THEME, octave=1, vel=80, end="1':4")
tune('trumpet', 29, THEME, octave=0, vel=78, end="1':4")
tune('oboe', 29, THEME, octave=1, vel=70, end="1':4")
p.pad('horn', A3, 48, 67, vel=72, n=3)
p.pad('vla', A3, 50, 69, vel=70, n=3)
p.pad('oohs', A3, 55, 74, vel=64, n=3)
p.bassline('cello', A3, octave=2, pattern='R . R . 5 . R .', rate=.5, vel=84)
p.bassline('bass', A3, octave=1, pattern='R - - - ', rate=1.0, vel=78)
p.hits('kit', 29, 8, {CRASH: 'X...............'}, rate=.25, vel=88)
p.roll('timp', pitch('D2'), 29, 0, 4, 60, 100, rate=.25)
p.roll('timp', pitch('A2'), 33, 0, 1, 50, 90, rate=.25)
p.roll('timp', pitch('D2'), 35, 0, 8, 40, 110, rate=.125)
# outro: back to harp and flute ---------------------------------------------------
tune('flute', 37, ["5:1 1':2 2':1", "3':3 2':1", "1':2 7:2", "6:4", "5:1 1':2 2':1", "3':2 1':2", "4':2 2':2", "1':4"], vel=70)
p.pad('vla', out, 50, 69, vel=44, n=3)
p.bassline('cello', out, octave=2, pattern='R . . . . . . .', rate=.5, vel=56)
p.hits('kit', 37, 1, {RIDE: 'c...............'}, rate=.25, vel=40) if False else None

# dynamics --------------------------------------------------------------------
curve = {'harp': [(1, 78), (21, 92), (29, 98), (37, 80), (45, 70)],
         'vla': [(1, 55), (5, 80), (13, 92), (21, 104), (28.5, 118), (29, 116), (36, 120), (37, 76), (45, 58)],
         'vln': [(13, 96), (21, 104), (28, 118), (29, 124), (36.5, 124), (37, 80), (45, 60)],
         'flute': [(1, 88), (13, 96), (29, 110), (37, 84), (45, 76)],
         'oboe': [(5, 100), (13, 100), (29, 110)],
         'horn': [(13, 88), (21, 98), (28, 118), (29, 112), (36.5, 112), (37, 70)],
         'oohs': [(21, 70), (28, 112), (29, 116), (36.5, 116), (37, 40)],
         'cello': [(5, 84), (21, 100), (29, 116), (37, 70), (45, 55)],
         'bass': [(13, 80), (29, 112), (37, 60)],
         'trumpet': [(29, 100), (36.5, 106), (37, 40)]}
for name, pts in curve.items():
    p.dyn(name, pts)

if __name__ == '__main__':
    info = p.render(os.path.abspath(OUT))
    print(info)
