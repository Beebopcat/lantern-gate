import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('a-bed-for-the-night', 'A Bed for the Night', key='Bb', mode='major', tempo=56, beats=3, bars=34, seed=121)
v = orchestra(p, ['harp', 'flute', 'oboe', 'vln2', 'vla', 'cello', 'piano', 'horn', 'celesta'])
A_ch, B_ch = '1 4 1/3 5 6m 2m 5 1', '4 1 2m 5 6m 4 5 1'
A = ["5:2 3:1", "4:2 3:1", "3:3", "5:2 4:1", "3:2 5:1", "4:2 2:1", "5:2 3:1", "1:3"]
B = ["6:2 5:1", "5:2 3:1", "4:2 2:1", "5:3", "3:1 5:1 3:1", "6:2 4:1", "5:2 7:1", "1:3"]
prog = p.prog(1, '1 5')
for bar, ch in ((3, A_ch), (11, B_ch), (19, A_ch), (27, B_ch)):
    prog += p.prog(bar, ch)
p.arp('harp', prog, 46, 79, pattern='0 1 2 1 2 1', rate=.5, vel=58, n=3)
p.pad('vla', prog[2:], 50, 69, vel=40, n=3); p.bassline('cello', prog[2:], octave=2, pattern='R - -', rate=1.0, vel=54)
tune(p, 'flute', 1, ["r:3", "5:1 7:1 2':1"], vel=58)
tune(p, 'flute', 3, A, vel=70)
tune(p, 'vln2', 11, B, vel=70); tune(p, 'oboe', 11, B, octave=0, vel=52); p.pad('horn', p.prog(11, B_ch), 46, 65, vel=42, n=3)
tune(p, 'oboe', 19, A, vel=72); tune(p, 'celesta', 19, A, octave=1, vel=52)
tune(p, 'flute', 27, B, octave=0, vel=70); tune(p, 'piano', 27, B, octave=0, vel=60); tune(p, 'vln2', 27, B, vel=60)
p.pad('horn', p.prog(27, B_ch), 46, 65, vel=44, n=3)
curves(p, {'flute': [(1, 90), (3, 96), (27, 96), (35, 70)], 'vln2': [(11, 90), (27, 96), (35, 60)], 'harp': [(1, 84), (35, 70)], 'vla': [(3, 80), (11, 96), (35, 56)], 'oboe': [(11, 80), (19, 100)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
