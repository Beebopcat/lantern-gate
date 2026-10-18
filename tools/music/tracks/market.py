import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('market-square', 'Market Square', key='C', mode='major', tempo=118, beats=4, bars=52, seed=31)
v = orchestra(p, ['pizz', 'harp', 'clarinet', 'flute', 'oboe', 'vln', 'vla', 'cello', 'bass', 'accordion', 'glock', 'kit', 'bassoon'])
A_ch, B_ch = '1 6m 4 5 1 6m 2m 5', '4 1/3 5 6m 2m 5 1 1'
A = ["3':.5 2':.5 1':1 5:1 3:1", "6:1 1':1 3':1 1':1", "4':1 3':.5 2':.5 1':1 6:1", "5:.5 6:.5 7:1 2':2",
     "3':.5 2':.5 1':1 5:1 3:1", "6:1 1':1 3':1 5':1", "4':1 2':1 6:1 4:1", "5:2 7:1 2':1"]
B = ["6:.5 1':.5 4':1 6':2", "3':1 5':1 3':1 1':1", "2':1 4':1 7:1 5:1", "6:1 7:.5 1':.5 3':2",
     "4':1 2':1 4':1 6':1", "5':1 4':1 2':1 7:1", "1':2 3':1 5':1", "1':2 r:2"]
sec = [('A1', 3, A_ch), ('A2', 11, A_ch), ('B1', 19, B_ch), ('A3', 27, A_ch), ('B2', 35, B_ch), ('A4', 43, A_ch)]
prog = p.prog(1, '1 5')
for _, bar, ch in sec:
    prog += p.prog(bar, ch)
prog += p.prog(51, '4 1')
# oom-pah: pizzicato bass on 1 and 3, chord pops on 2 and 4
p.bassline('pizz', prog, octave=2, pattern='R . 5 .', rate=1.0, vel=78)
p.stab('vla', prog, 55, 72, pattern='. x . x', rate=1.0, vel=62, dur=.35)
p.hits('kit', 3, 48, {TAMB: 'x.x.x.x.', HAT: 'o.o.o.o.', RIM: '....x...'}, rate=.5, vel=54)
tune(p, 'clarinet', 3, A, vel=84)
tune(p, 'flute', 11, A, octave=1, vel=76); tune(p, 'vln', 11, A, vel=70)
tune(p, 'oboe', 19, B, vel=84); p.pad('accordion', p.prog(19, B_ch), 52, 72, vel=56, n=3)
p.arp('harp', p.prog(19, B_ch), 55, 84, pattern='0 1 2 1', rate=1.0, vel=60)
tune(p, 'vln', 27, A, vel=88); tune(p, 'clarinet', 27, A, octave=0, vel=66); tune(p, 'glock', 27, A, octave=1, vel=54)
tune(p, 'flute', 35, B, octave=1, vel=82); tune(p, 'clarinet', 35, B, vel=70)
p.pad('accordion', p.prog(35, B_ch), 52, 72, vel=56, n=3); p.bassline('cello', p.prog(35, B_ch), octave=2, pattern='R . . . 5 . . .', rate=.5, vel=70)
tune(p, 'vln', 43, A, vel=92); tune(p, 'oboe', 43, A, octave=1, vel=76); tune(p, 'flute', 43, A, octave=1, vel=72); tune(p, 'glock', 43, A, octave=1, vel=58)
p.pad('accordion', p.prog(43, A_ch), 52, 72, vel=60, n=3); p.bassline('cello', p.prog(43, A_ch), octave=2, pattern='R . . . 5 . . .', rate=.5, vel=76)
p.bassline('bassoon', p.prog(11, A_ch), octave=2, pattern='R . . . 5 . . .', rate=.5, vel=60)
tune(p, 'flute', 51, ["4':2 6:2", "1':4"], octave=0, vel=72)
tune(p, 'flute', 1, ["r:4", "5:1 7:1 2':2"], vel=62)
curves(p, {'clarinet': [(3, 98), (27, 92)], 'flute': [(11, 100), (35, 108), (43, 112), (51, 90)], 'vln': [(11, 90), (27, 104), (43, 116), (51, 70)],
           'accordion': [(19, 88), (43, 104)], 'glock': [(27, 90)], 'harp': [(19, 92)], 'cello': [(35, 90), (43, 102)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
