import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('moors-at-dusk', 'Moors at Dusk', key='D', mode='minor', tempo=66, beats=3, bars=48, seed=51)
v = orchestra(p, ['harp', 'oboe', 'solocello', 'solovln', 'flute', 'vln', 'vla', 'cello', 'bass', 'horn', 'timp'])
A_ch, B_ch = '1m 6 3 7 4m 6 5m 1m', '3 7 4m 1m 6 3 5M 5M'
A = ["1':2 7:1", "6:2 5:1", "3:2 5:1", "7:3", "4:2 6:1", "1':2 6:1", "5:2 7:1", "1':3"]
B = ["5:1 1':1 3':1", "2':2 7:1", "1':2 6:1", "5:2 3:1", "6:1 1':1 3':1", "5':2 3':1", "7#:1 2':1 5':1", "2':3"]
prog = p.prog(1, '1m 6')
for bar, ch in ((3, A_ch), (11, A_ch), (19, B_ch), (27, B_ch), (35, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(43, '4m 6 5M 1m 1m 1m')
p.arp('harp', prog, 48, 80, pattern='0 1 2', rate=1.0, vel=60, n=3)
p.pad('vla', prog[2:], 50, 69, vel=44, n=3)
p.bassline('cello', prog[2:], octave=2, pattern='R - -', rate=1.0, vel=64)
tune(p, 'flute', 1, ["r:3", "5:1 1':1 3':1"], vel=60)
tune(p, 'oboe', 3, A, vel=82)
tune(p, 'solocello', 11, A, octave=0, vel=84); tune(p, 'oboe', 11, A, octave=1, vel=60)
tune(p, 'solovln', 19, B, vel=80); tune(p, 'flute', 19, B, octave=1, vel=58)
p.pad('horn', p.prog(19, B_ch), 46, 65, vel=48, n=3)
tune(p, 'vln', 27, B, vel=88); tune(p, 'oboe', 27, B, vel=72); p.pad('horn', p.prog(27, B_ch), 46, 65, vel=60, n=3)
p.bassline('bass', p.prog(27, B_ch), octave=1, pattern='R - -', rate=1.0, vel=66)
tune(p, 'vln', 35, A, vel=92); tune(p, 'flute', 35, A, octave=1, vel=72); tune(p, 'solocello', 35, A, octave=-1, vel=76); p.pad('horn', p.prog(35, A_ch), 46, 65, vel=62, n=3)
p.bassline('bass', p.prog(35, A_ch), octave=1, pattern='R - -', rate=1.0, vel=70)
tune(p, 'oboe', 43, ["4:2 6:1", "5:3", "7:1 2':1 5':1", "1':3", "1':3", "r:3"], vel=66)
p.roll('timp', pitch('D2'), 34, 0, 3, 24, 70, rate=.25)
p.roll('timp', pitch('D2'), 36, 0, 0.5, 70, 70, rate=.5)
curves(p, {'oboe': [(3, 92), (27, 104), (43, 84)], 'solocello': [(11, 96), (35, 100)], 'solovln': [(19, 96)], 'vln': [(27, 100), (35, 112), (43, 80)], 'horn': [(19, 70), (35, 100), (43, 60)],
           'harp': [(1, 80), (35, 96), (48, 70)], 'vla': [(3, 70), (27, 96), (35, 106), (43, 66)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
