import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('lanterns-on-the-water', 'Lanterns on the Water', key='E', mode='minor', tempo=58, beats=4, bars=44, seed=61)
v = orchestra(p, ['piano', 'celesta', 'harp', 'flute', 'vln2', 'vla', 'cello', 'bass', 'horn', 'glock'])
A_ch, B_ch = '1m 6 3 7 1m 6 4m 5m', '6 7 1m 3 4m 6 7 5M'
A = ["5:2 1':1 3':1", "3':2 1':1 6:1", "7:1 5:1 7:1 3':1", "2':2 7:1 4:1", "5:1 1':1 3':1 1':1", "6:1 1':1 3':2", "6:1 4:1 6:1 1':1", "5:2 2:2"]
B = ["3':1 1':1 6:2", "2':2 4:1 7:1", "1':1 3':1 5':2", "3':2 7:1 5:1", "6:2 4:1 6:1", "5:1 1':1 3':2", "2':1.5 7:.5 4:2", "5:2 7#:1 5:1"]
prog = p.prog(1, '1m 5m')
for bar, ch in ((3, A_ch), (11, B_ch), (19, A_ch), (27, B_ch), (35, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(43, '4m 1m')
p.arp('harp', prog, 52, 83, pattern='0 1 2 1 2 1 0 1', rate=.5, vel=46, n=3)
p.arp('piano', prog[2:], 40, 64, pattern='0 1 2 1', rate=1.0, vel=44, n=3, legato=2.2, accent=4)
p.pad('vla', prog, 48, 67, vel=40, n=3)
p.pad('vln2', prog[2:], 55, 74, vel=36, n=3)
p.bassline('cello', prog, octave=2, pattern='R - - -', rate=1.0, vel=54)
tune(p, 'flute', 1, ["r:4", "5:2 1':1 3':1"], vel=58)
tune(p, 'piano', 3, A, vel=72)
tune(p, 'celesta', 11, B, octave=1, vel=62); tune(p, 'piano', 11, B, vel=70)
p.pad('horn', p.prog(11, B_ch), 46, 63, vel=40, n=3)
tune(p, 'flute', 19, A, octave=1, vel=66); tune(p, 'piano', 19, A, vel=64); tune(p, 'celesta', 19, A, octave=1, vel=40)
tune(p, 'vln2', 27, B, vel=74); tune(p, 'celesta', 27, B, octave=1, vel=62); tune(p, 'flute', 27, B, octave=1, vel=58)
p.pad('horn', p.prog(27, B_ch), 46, 63, vel=50, n=3); p.bassline('bass', p.prog(27, B_ch), octave=1, pattern='R - - -', rate=1.0, vel=60)
tune(p, 'piano', 35, A, vel=62); tune(p, 'flute', 35, A, octave=1, vel=58)
tune(p, 'flute', 43, ["4:2 6:2", "5:4"], octave=0, vel=52)
for bar in (3, 11, 19, 27, 35):
    p.voices['glock'].notes.append((p.at(bar), 3.0, pitch('E6'), 58))
curves(p, {'piano': [(3, 96), (19, 90), (35, 90), (43, 70)], 'celesta': [(11, 90), (27, 100)], 'vln2': [(3, 80), (27, 106), (35, 90), (43, 60)], 'vla': [(3, 80), (27, 102), (43, 60)],
           'flute': [(1, 90), (19, 96), (27, 100), (43, 80)], 'harp': [(1, 84), (27, 100), (44, 76)], 'horn': [(11, 80), (27, 100)], 'cello': [(3, 80), (27, 100), (43, 70)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
