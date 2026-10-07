import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('open-for-trade', 'Open for Trade', key='F', mode='major', tempo=104, beats=4, bars=52, seed=111)
v = orchestra(p, ['piano', 'pizz', 'clarinet', 'flute', 'oboe', 'vln', 'bassoon', 'harp', 'glock', 'kit', 'accordion'])
A_ch, B_ch = '1 6m 2m 5 1 4 2m 5', '4 5 3m 6m 2m 5 1 1'
A = ["3:1 5:1 1':1 5:1", "6:1 1':1 3':1 1':1", "2':1 6:1 4:1 6:1", "5:1 7:1 2':2", "3:1 5:1 1':1 3':1", "4:1 6:1 1':1 4':1", "2':1.5 1':.5 6:1 4:1", "5:2 7:1 5:1"]
B = ["6:1 1':1 4':2", "5:1 7:1 2':1 5':1", "3:1 5:1 7:1 5:1", "6:1 1':1 3':1 6:1", "2:1 4:1 6:1 4:1", "5:1 7:1 2':1 7:1", "3:1 5:1 1':2", "1':4"]
prog = p.prog(1, '1 5')
for bar, ch in ((3, A_ch), (11, A_ch), (19, B_ch), (27, A_ch), (35, B_ch), (43, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(51, '4 1')
# friendly walking groove: plucked bass, piano comping on the off-beats, a ticking hi-hat
p.bassline('pizz', prog, octave=2, pattern='R 5 8 5', rate=1.0, vel=80)
p.stab('piano', prog, 52, 72, pattern='. x . x', rate=1.0, vel=60, dur=.5)
p.hits('kit', 3, 48, {HAT: 'x.xxx.xx', RIM: '....x...', TRI: 'o.......'}, rate=.5, vel=44)
tune(p, 'clarinet', 3, A, vel=86)
tune(p, 'flute', 11, A, octave=1, vel=76); tune(p, 'vln', 11, A, vel=68)
tune(p, 'oboe', 19, B, vel=84); p.pad('accordion', p.prog(19, B_ch), 52, 72, vel=52, n=3); p.arp('harp', p.prog(19, B_ch), 55, 84, pattern='0 1 2 1', rate=1.0, vel=58)
tune(p, 'clarinet', 27, A, vel=88); tune(p, 'vln', 27, A, vel=76); tune(p, 'glock', 27, A, octave=1, vel=56)
tune(p, 'flute', 35, B, octave=1, vel=80); tune(p, 'clarinet', 35, B, vel=70); p.pad('accordion', p.prog(35, B_ch), 52, 72, vel=56, n=3)
tune(p, 'clarinet', 43, A, vel=92); tune(p, 'flute', 43, A, octave=1, vel=78); tune(p, 'vln', 43, A, vel=82); tune(p, 'glock', 43, A, octave=1, vel=60)
p.bassline('bassoon', p.prog(19, B_ch) + p.prog(35, B_ch), octave=2, pattern='R . 5 .', rate=1.0, vel=64)
tune(p, 'flute', 51, ["4':2 6:2", "1':4"], vel=70)
tune(p, 'flute', 1, ["r:4", "5:1 7:1 2':2"], vel=60)
curves(p, {'clarinet': [(3, 100), (27, 100), (43, 106)], 'flute': [(11, 100), (35, 104), (43, 108)], 'vln': [(11, 90), (43, 104)], 'piano': [(3, 96)], 'oboe': [(19, 100)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
