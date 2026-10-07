import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('steel-and-starlight', 'Steel and Starlight', key='E', mode='minor', tempo=156, beats=4, bars=60, seed=81)
v = orchestra(p, ['piano', 'vln', 'vla', 'cello', 'bass', 'trem', 'trumpet', 'horn', 'trombone', 'flute', 'choir', 'timp', 'kit'])
A_ch, B_ch, Br_ch = '1m 6 3 7 1m 6 7 5M', '6 3 1m 7 6 3 7 5M', '6 7 6 7 1m 3 4m 5M'
A = ["5:.5 1':.5 5:.5 1':.5 2':1 3':1", "6:.5 1':.5 6:.5 1':.5 3':1 1':1", "7:.5 2':.5 7:.5 2':.5 4':1 2':1", "2':2 4':1 2':1",
     "5':1 3':1 1':1 5:1", "3':1 1':1 6:1 1':1", "2':1 7:1 4:1 7:1", "5:1 7#:1 2':1 5':1"]
B = ["3':2 1':1 6:1", "7:2 2':1 4':1", "5:2 1':1 3':1", "2':2 7:2", "3':1 5':1 3':1 1':1", "4':1 2':1 7:1 2':1", "2':2 4':1 2':1", "5':4"]
Br = ["3':2 1':2", "2':2 7:2", "3':2 5':2", "4':2 2':2", "5':4", "7':2 5':2", "6':2 4':2", "5':2 7#':2"]
sec = [(3, A_ch), (11, A_ch), (19, B_ch), (27, A_ch), (35, Br_ch), (43, B_ch), (51, A_ch)]
prog = p.prog(1, '1m 5M')
for bar, ch in sec:
    prog += p.prog(bar, ch)
prog += p.prog(59, '1m 1m')
# engine room: piano sixteenths, staccato strings, low root drive
p.arp('piano', prog[2:], 52, 76, pattern='0 1 2 1', rate=.25, vel=64, n=3, legato=1.0, accent=10)
p.arp('vla', prog[2:], 50, 69, pattern='0 1 2 1 0 1 2 1', rate=.5, vel=64, n=3, legato=.5, accent=10)
p.bassline('cello', prog, octave=2, pattern='R R . R R . R .', rate=.5, vel=82)
p.bassline('bass', prog, octave=1, pattern='R . . R . . R .', rate=.5, vel=76)
p.bassline('timp', prog[2:], octave=2, pattern='R . . R . . R .', rate=.5, vel=82)
p.hits('kit', 3, 56, {KICK: 'x..xx...', SNARE: '..x...x.', HAT: 'XxxxXxxx'}, rate=.5, vel=70)
# intro fanfare
p.stab('brass', p.prog(1, '1m 5M'), 52, 72, pattern='X . x . X . . .', rate=.5, vel=96, n=3, dur=.4) if 'brass' in p.voices else None
p.hits('kit', 1, 2, {CRASH: 'X.......'}, rate=.5, vel=96)
tune(p, 'trumpet', 3, A, vel=88)
tune(p, 'vln', 11, A, vel=92); tune(p, 'trumpet', 11, A, vel=80); tune(p, 'flute', 11, A, octave=1, vel=70)
p.pad('horn', p.prog(11, A_ch), 46, 65, vel=66, n=3)
tune(p, 'horn', 19, B, vel=92); tune(p, 'vln', 19, B, octave=0, vel=82); p.pad('trombone', p.prog(19, B_ch), 38, 58, vel=62, n=3)
tune(p, 'vln', 27, A, vel=98); tune(p, 'trumpet', 27, A, vel=88); tune(p, 'flute', 27, A, octave=1, vel=76); tune(p, 'horn', 27, A, octave=-1, vel=78)
p.pad('trombone', p.prog(27, A_ch), 38, 58, vel=66, n=3)
p.pad('trem', p.prog(35, Br_ch), 46, 70, vel=60, n=3)
tune(p, 'vln', 35, Br, vel=96); tune(p, 'trumpet', 35, Br, vel=84)
p.roll('timp', pitch('E2'), 35, 0, 32, 40, 110, rate=.25)
tune(p, 'horn', 43, B, vel=94); tune(p, 'vln', 43, B, vel=88); tune(p, 'flute', 43, B, octave=1, vel=74); p.pad('choir', p.prog(43, B_ch), 52, 72, vel=58, n=3)
tune(p, 'vln', 51, A, vel=100); tune(p, 'trumpet', 51, A, vel=92); tune(p, 'flute', 51, A, octave=1, vel=80); tune(p, 'horn', 51, A, octave=-1, vel=82)
p.pad('choir', p.prog(51, A_ch), 52, 72, vel=66, n=3); p.pad('trombone', p.prog(51, A_ch), 38, 58, vel=70, n=3)
tune(p, 'trumpet', 59, ["5':2 3':2", "1':4"], vel=84)
p.hits('kit', 35, 8, {CRASH: 'X...............', RIDE: '..x...x.'}, rate=.25, vel=76)
for bar in (3, 19, 27, 43, 51):
    p.hits('kit', bar, 1, {CRASH: 'X.......'}, rate=.5, vel=90)
curves(p, {'piano': [(3, 90), (35, 100), (51, 108), (59, 80)], 'vla': [(3, 84), (27, 100), (51, 110)], 'vln': [(11, 96), (27, 108), (35, 116), (51, 120), (59, 90)],
           'trumpet': [(3, 100), (27, 110), (51, 116)], 'horn': [(11, 84), (19, 108), (43, 110), (51, 112)], 'cello': [(3, 90), (35, 100), (51, 112)], 'timp': [(3, 90), (35, 110), (51, 112)],
           'choir': [(43, 80), (51, 100), (59, 60)], 'trombone': [(19, 84), (51, 108)], 'flute': [(11, 90), (51, 108)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
