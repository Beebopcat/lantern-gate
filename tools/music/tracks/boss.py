import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('the-hollow-warden', 'The Hollow Warden', key='C', mode='harmonic', tempo=144, beats=4, bars=56, seed=91)
v = orchestra(p, ['cello', 'bass', 'trem', 'vln', 'vla', 'horn', 'trumpet', 'trombone', 'tuba', 'choir', 'oohs', 'organ', 'timp', 'kit', 'piano'])
A_ch, B_ch = '1m 6 b7 1m 1m 6 b7 5M', '4m 6 5M 1m 4m 6 b7 5M'
A = ["1':1.5 7b:.5 6:1 5:1", "6:1.5 5:.5 3:1 1:1", "7b:1.5 6:.5 5:1 2:1", "1:2 5:1 1':1", "3':1 1':1 5:1 3:1", "3':1 1':1 6:1 3:1", "2':1 7b:1 5:1 2:1", "7:1 5:1 2:1 7:1"]
B = ["4:2 6:1 1':1", "3':2 1':2", "2':2 7:2", "1':2 5:2", "6:1 1':1 4':2", "3':1 5':1 3':2", "2':1.5 7b:.5 5:2", "7:3 r:1"]
prog = p.prog(1, '1m 1m 6 b7')
for bar, ch in ((5, A_ch), (13, A_ch), (21, B_ch), (29, A_ch), (37, B_ch), (45, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(53, '1m 6 b7 1m')
# 3+3+2 ostinato in the lowest strings and timpani
pat = 'R . R . R . R R'
p.bassline('cello', prog, octave=2, pattern='R R . R R . R .', rate=.5, vel=84)
p.bassline('bass', prog, octave=1, pattern='R . . R . . R .', rate=.5, vel=80)
p.bassline('timp', prog[2:], octave=2, pattern='R . . R . . R .', rate=.5, vel=84)
p.arp('vla', prog[4:], 46, 67, pattern='0 1 2 1 0 1 2 1', rate=.5, vel=60, n=3, legato=.5, accent=10)
p.hits('kit', 5, 48, {KICK: 'x..xx...', SNARE: '..x...x.'}, rate=.5, vel=76)
p.pad('organ', prog[2:], 36, 60, vel=44, n=3)
tune(p, 'horn', 1, ["r:4", "r:4", "1':2 7b:1 6:1", "5:4"], vel=96)
p.hits('kit', 1, 4, {CRASH: 'X...............'}, rate=.25, vel=92)
tune(p, 'horn', 5, A, vel=96); tune(p, 'trombone', 5, A, octave=-1, vel=84); p.pad('trem', p.prog(5, A_ch), 48, 70, vel=58, n=3)
tune(p, 'vln', 13, A, vel=98); tune(p, 'trumpet', 13, A, vel=88); tune(p, 'horn', 13, A, octave=-1, vel=84); p.pad('oohs', p.prog(13, A_ch), 50, 70, vel=58, n=3)
tune(p, 'trumpet', 21, B, vel=94); tune(p, 'vln', 21, B, vel=88); p.pad('choir', p.prog(21, B_ch), 50, 72, vel=64, n=3); p.pad('trombone', p.prog(21, B_ch), 38, 58, vel=64, n=3)
tune(p, 'vln', 29, A, vel=102); tune(p, 'trumpet', 29, A, vel=94); tune(p, 'horn', 29, A, octave=-1, vel=90); tune(p, 'trombone', 29, A, octave=-1, vel=84)
p.pad('choir', p.prog(29, A_ch), 50, 72, vel=68, n=3); p.pad('tuba', p.prog(29, A_ch), 30, 50, vel=70, n=2)
tune(p, 'horn', 37, B, vel=98); tune(p, 'trumpet', 37, B, vel=92); tune(p, 'vln', 37, B, octave=1, vel=84); p.pad('choir', p.prog(37, B_ch), 50, 72, vel=70, n=3)
tune(p, 'vln', 45, A, vel=106); tune(p, 'trumpet', 45, A, vel=98); tune(p, 'horn', 45, A, octave=-1, vel=94); tune(p, 'trombone', 45, A, octave=-1, vel=88)
p.pad('choir', p.prog(45, A_ch), 50, 72, vel=76, n=3); p.pad('tuba', p.prog(45, A_ch), 30, 50, vel=76, n=2); p.pad('oohs', p.prog(45, A_ch), 58, 77, vel=60, n=3)
tune(p, 'trumpet', 53, ["5':2 3':2", "1':2 7b:2", "6:2 5:2", "1':4"], vel=84)
for bar in (5, 13, 21, 29, 37, 45):
    p.hits('kit', bar, 1, {CRASH: 'X.......'}, rate=.5, vel=96)
p.roll('timp', pitch('C2'), 12, 0, 4, 30, 100, rate=.125); p.roll('timp', pitch('G2'), 28, 0, 4, 30, 108, rate=.125); p.roll('timp', pitch('C2'), 44, 0, 4, 40, 116, rate=.125)
curves(p, {'horn': [(1, 100), (13, 90), (37, 108), (45, 112), (53, 80)], 'trumpet': [(13, 96), (29, 108), (45, 116), (53, 70)], 'vln': [(13, 100), (29, 112), (45, 120), (53, 80)],
           'choir': [(21, 76), (37, 108), (45, 118), (53, 50)], 'cello': [(1, 90), (29, 104), (45, 112)], 'timp': [(5, 90), (29, 104), (45, 116)], 'trombone': [(5, 88), (45, 110)], 'tuba': [(29, 96), (45, 112)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
