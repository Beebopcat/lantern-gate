import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

# 6/8 lilt written in quarter-note beats: one bar = 3 beats = six eighths.
p = Piece('hearthwick-morning', 'Hearthwick Morning', key='G', mode='major', tempo=116, beats=3, bars=77, seed=21)
v = orchestra(p, ['guitar', 'harp', 'pizz', 'clarinet', 'flute', 'oboe', 'vln', 'vla', 'cello', 'accordion', 'glock', 'kit', 'bassoon'])

A_ch = '1 4 1 5 6m 4 5 1'
B_ch = '4 1 4 1 6m 2m 5 5'
C_ch = '6m 6m 4 4 2m 5 6m 5'
A = ["5:.5 3:.5 5:.5 1':1.5", "6:.5 5:.5 6:.5 1':1.5", "5:1 3:.5 5:.5 4:.5 3:.5", "2:1.5 3:.5 4:.5 5:.5",
     "6:.5 5:.5 6:.5 3':1.5", "1':.5 6:.5 5:.5 4:1.5", "3:.5 5:.5 7:.5 2':1.5", "1':3"]
B = ["1':1 6:.5 4:1.5", "3:.5 5:.5 1':.5 3':1.5", "6:1 1':.5 6:.5 5:.5 4:.5", "5:1.5 3:1.5",
     "6:1 5:.5 3:1.5", "2:.5 4:.5 6:.5 2':1.5", "7:1 5:.5 4:.5 3:.5 2:.5", "5:3"]
C = ["3:1.5 5:1.5", "6:1 5:.5 3:1.5", "1:1.5 3:1.5", "4:1 3:.5 1:1.5", "2:1.5 4:1.5", "5:1 4:.5 2:1.5", "3:1 6:1 5:1", "5:3"]

# bar map: intro 1-2 | A 3-10 | A 11-18 | B 19-26 | C 27-34 | A 35-42 | B 43-50 | A 51-58 | C 59-66 | A 67-74 | tag 75-77
sec = {'intro': 1, 'A1': 3, 'A2': 11, 'B1': 19, 'C1': 27, 'A3': 35, 'B2': 43, 'A4': 51, 'C2': 59, 'A5': 67, 'tag': 75}
prog = p.prog(1, '1 5')
for k, ch in (('A1', A_ch), ('A2', A_ch), ('B1', B_ch), ('C1', C_ch), ('A3', A_ch), ('B2', B_ch), ('A4', A_ch), ('C2', C_ch), ('A5', A_ch)):
    prog += p.prog(sec[k], ch)
prog += p.prog(75, '4 5 1')

# the rolling guitar figure and a pizzicato bass carry the whole piece
p.arp('guitar', prog, 55, 79, pattern='0 1 2 1 2 1', rate=.5, vel=64, n=3, accent=8)
p.bassline('pizz', prog, octave=2, pattern='R . . 5 . .', rate=.5, vel=70)
p.hits('kit', 3, 72, {TAMB: 'X.xX.x', TRI: 'o.....'}, rate=.5, vel=52)
# A1: clarinet leads
tune(p, 'clarinet', 3, A, vel=82)
# A2: flute with strings
tune(p, 'flute', 11, A, octave=1, vel=78)
tune(p, 'vln', 11, A, vel=70)
p.pad('vla', p.prog(11, A_ch), 50, 69, vel=48, n=3)
# B1: oboe over accordion
tune(p, 'oboe', 19, B, vel=82)
p.pad('accordion', p.prog(19, B_ch), 52, 72, vel=56, n=3)
p.arp('harp', p.prog(19, B_ch), 55, 84, pattern='0 1 2 1 2 1', rate=.5, vel=58)
# C1: minor-key middle strain, cello and clarinet
tune(p, 'cello', 27, C, octave=0, vel=84)
tune(p, 'clarinet', 27, C, octave=0, vel=66)
p.pad('vla', p.prog(27, C_ch), 50, 69, vel=52, n=3)
# A3: violins and flute sing it together
tune(p, 'vln', 35, A, vel=86)
tune(p, 'flute', 35, A, octave=1, vel=74)
p.pad('accordion', p.prog(35, A_ch), 52, 72, vel=50, n=3)
# B2: flute and clarinet, harp sparkles
tune(p, 'flute', 43, B, octave=1, vel=80)
tune(p, 'clarinet', 43, B, vel=70)
p.arp('harp', p.prog(43, B_ch), 55, 84, pattern='0 1 2 1 2 1', rate=.5, vel=60)
p.pad('vla', p.prog(43, B_ch), 50, 69, vel=50, n=3)
# A4: full band, glockenspiel doubles the tune
tune(p, 'vln', 51, A, vel=90)
tune(p, 'oboe', 51, A, octave=1, vel=74)
tune(p, 'glock', 51, A, octave=1, vel=60)
p.pad('accordion', p.prog(51, A_ch), 52, 72, vel=56, n=3)
p.bassline('cello', p.prog(51, A_ch), octave=2, pattern='R . . . . .', rate=.5, vel=70)
# C2: bassoon and cello take the minor strain, strings above
tune(p, 'bassoon', 59, C, octave=-1, vel=76)
tune(p, 'vln', 59, C, octave=0, vel=70)
p.pad('vla', p.prog(59, C_ch), 50, 69, vel=54, n=3)
# A5: final statement, everyone
tune(p, 'vln', 67, A, vel=92)
tune(p, 'flute', 67, A, octave=1, vel=82)
tune(p, 'clarinet', 67, A, vel=72)
tune(p, 'glock', 67, A, octave=1, vel=58)
p.pad('accordion', p.prog(67, A_ch), 52, 72, vel=58, n=3)
p.bassline('cello', p.prog(67, A_ch), octave=2, pattern='R . . 5 . .', rate=.5, vel=76)
# tag leads back to the opening chord
tune(p, 'flute', 75, ["4':1.5 2':1.5", "2':1 7:.5 5:1.5", "1':3"], octave=0, vel=70)
p.pad('vla', p.prog(75, '4 5 1'), 50, 69, vel=52, n=3)
# intro
tune(p, 'flute', 1, ["r:3", "5:1 7:1 2':1"], octave=0, vel=62)

curves(p, {'clarinet': [(3, 96), (11, 90), (27, 100), (35, 90), (59, 96), (67, 100)], 'flute': [(1, 90), (11, 100), (35, 104), (43, 108), (67, 112), (75, 96), (78, 80)],
           'vln': [(11, 84), (35, 100), (51, 108), (59, 94), (67, 116), (74.5, 112), (75, 80), (78, 60)],
           'harp': [(1, 80), (19, 92), (43, 96), (78, 80)], 'guitar': [(1, 86), (51, 96), (78, 80)], 'oboe': [(19, 96), (51, 100)],
           'accordion': [(19, 80), (35, 84), (67, 100), (75, 80)], 'cello': [(27, 96), (51, 90), (67, 100), (75, 70)]})

if __name__ == '__main__':
    print(p.render(OUTDIR()))
