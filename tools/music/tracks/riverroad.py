import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('the-river-road', 'The River Road', key='D', mode='major', tempo=104, beats=4, bars=56, seed=41)
v = orchestra(p, ['vln', 'vla', 'cello', 'bass', 'horn', 'trumpet', 'flute', 'oboe', 'harp', 'timp', 'kit', 'trombone'])
A_ch, B_ch = '1 5 6m 4 1 5 4 5', '6m 4 1 5 6m 4 5 5'
A = ["5:1.5 1':.5 3':2", "2':1.5 1':.5 7:2", "6:1 1':1 3':1 1':1", "4':1.5 3':.5 2':1 1':1", "5:1.5 1':.5 3':1 5':1", "5':2 2':1 7:1", "4':1 3':.5 2':.5 1':2", "7:1 2':1 5:2"]
B = ["6:1 3':1 1':1 6:1", "4:1 6:1 1':1 4':1", "3':1.5 1':.5 5:2", "7:1 2':1 5':2", "6:1 3':1 5':1 3':1", "4':1.5 2':.5 1':1 6:1", "5:1 7:1 2':1 5':1", "5':3 r:1"]
prog = p.prog(1, '1 5 6m 4')
for bar, ch in ((5, A_ch), (13, A_ch), (21, B_ch), (29, A_ch), (37, B_ch), (45, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(53, '4 5 1 1')
# the road never stops: eighth-note ostinato in the violins, roots below
p.arp('vln', prog, 62, 81, pattern='0 1 2 1 0 1 2 1', rate=.5, vel=58, n=3, legato=.55, accent=10)
p.arp('harp', prog[4:], 50, 83, pattern='0 2 1 2 0 2 1 2', rate=.5, vel=58)
p.bassline('cello', prog, octave=2, pattern='R . R . 5 . R .', rate=.5, vel=76)
p.bassline('bass', prog, octave=1, pattern='R - - - ', rate=1.0, vel=70)
p.hits('kit', 5, 48, {SHAKER: 'x.xxx.xx', SNARE: '....x...'}, rate=.5, vel=50)
p.hits('kit', 13, 40, {SNARE: '....x...', KICK: 'x...x...'}, rate=.5, vel=58)
# intro: the horn call
tune(p, 'horn', 1, ["r:4", "r:4", "5:1.5 1':.5 3':2", "2':4"], vel=84)
tune(p, 'horn', 5, A, vel=86)
tune(p, 'flute', 13, A, octave=1, vel=76); tune(p, 'trumpet', 13, A, vel=76)
tune(p, 'oboe', 21, B, vel=84); tune(p, 'vla', 21, B, vel=64)
p.pad('horn', p.prog(21, B_ch), 48, 67, vel=58, n=3)
tune(p, 'vln', 29, A, vel=94); tune(p, 'trumpet', 29, A, vel=82); tune(p, 'flute', 29, A, octave=1, vel=78)
p.pad('horn', p.prog(29, A_ch), 48, 67, vel=66, n=3); p.pad('trombone', p.prog(29, A_ch), 40, 58, vel=58, n=3)
tune(p, 'flute', 37, B, octave=1, vel=82); tune(p, 'oboe', 37, B, vel=72); p.pad('vla', p.prog(37, B_ch), 50, 69, vel=60, n=3)
tune(p, 'vln', 45, A, vel=98); tune(p, 'horn', 45, A, octave=0, vel=84); tune(p, 'trumpet', 45, A, vel=86); tune(p, 'flute', 45, A, octave=1, vel=80)
p.pad('trombone', p.prog(45, A_ch), 40, 58, vel=66, n=3); p.pad('vla', p.prog(45, A_ch), 50, 69, vel=64, n=3)
tune(p, 'flute', 53, ["4':2 2':2", "7:2 2':2", "1':4", "r:4"], vel=70)
p.hits('kit', 29, 8, {CRASH: 'X...............'}, rate=.25, vel=84)
p.hits('kit', 45, 8, {CRASH: 'X...............'}, rate=.25, vel=88)
p.hits('kit', 29, 16, {SNARE: '....x...'}, rate=.5, vel=62)
p.hits('kit', 45, 8, {SNARE: '....x...'}, rate=.5, vel=70)
for bar in (5, 13, 21, 29, 37, 45):
    p.roll('timp', pitch('D2'), bar, 0, .5, 70, 80, rate=.5) if False else None
p.roll('timp', pitch('A2'), 12, 0, 4, 30, 80); p.roll('timp', pitch('A2'), 28, 0, 4, 30, 90); p.roll('timp', pitch('D2'), 44, 0, 4, 40, 100)
for bar in (13, 29, 45):
    for b in range(0, 8, 2):
        p.voices['timp'].notes.append((p.at(bar + b, 0), 1.0, pitch('D2'), 82)); p.voices['timp'].notes.append((p.at(bar + b, 2), 1.0, pitch('A1') + 12, 70))
curves(p, {'vln': [(1, 70), (13, 86), (29, 108), (45, 118), (53, 70)], 'horn': [(1, 90), (13, 70), (29, 96), (45, 112), (53, 60)], 'trumpet': [(13, 90), (29, 108), (45, 114), (53, 50)],
           'flute': [(13, 96), (29, 108), (45, 110), (53, 90)], 'cello': [(5, 84), (29, 100), (45, 110), (53, 70)], 'harp': [(5, 80), (45, 100)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
