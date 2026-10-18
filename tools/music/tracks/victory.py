import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('lantern-raised', 'Lantern Raised', key='D', mode='major', tempo=132, beats=4, bars=8, seed=101, tail=4.5, loop=False)
v = orchestra(p, ['trumpet', 'horn', 'vln', 'vla', 'flute', 'cello', 'bass', 'harp', 'timp', 'kit', 'trombone', 'glock'])
ch = p.prog(1, '1 4 5 1 4 5 1 1')
M = ["5:.5 5:.5 5:.5 1':1.5 5:.5 1':.5", "6:1 1':1 4':2", "5':2 7:1 2':1", "1':3 r:1", "6:.5 1':.5 4':1 6':2", "7:.5 2':.5 5':1 7':2", "1':1 3':1 5':2", "1':4"]
tune(p, 'trumpet', 1, M, vel=100)
tune(p, 'vln', 1, M, octave=0, vel=92); tune(p, 'flute', 1, M, octave=1, vel=84); tune(p, 'glock', 1, M, octave=1, vel=70)
p.pad('horn', ch, 50, 69, vel=84, n=3); p.pad('vla', ch, 50, 69, vel=78, n=3); p.pad('trombone', ch, 40, 58, vel=76, n=3)
p.bassline('cello', ch, octave=2, pattern='R . R . 5 . R .', rate=.5, vel=88); p.bassline('bass', ch, octave=1, pattern='R - - -', rate=1.0, vel=82)
p.arp('harp', ch, 55, 90, pattern='0 1 2 1 2 1 0 1', rate=.5, vel=70)
p.hits('kit', 1, 8, {SNARE: '..x...x.'}, rate=.5, vel=64)
p.hits('kit', 1, 1, {CRASH: 'X.......'}, rate=.5, vel=96); p.hits('kit', 4, 1, {CRASH: 'x.......'}, rate=.5, vel=84); p.hits('kit', 8, 1, {CRASH: 'X.......'}, rate=.5, vel=100)
p.roll('timp', pitch('A2'), 3, 2, 2, 50, 100, rate=.125); p.roll('timp', pitch('D2'), 7, 0, 4, 60, 110, rate=.125)
curves(p, {'trumpet': [(1, 110), (8, 118)], 'vln': [(1, 100), (8, 118)], 'horn': [(1, 96), (8, 112)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
