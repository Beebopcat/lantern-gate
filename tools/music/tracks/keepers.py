import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from common import *

p = Piece('beneath-the-keepers-hall', "Beneath the Keeper's Hall", key='C', mode='phrygian', tempo=66, beats=4, bars=48, seed=71)
v = orchestra(p, ['trem', 'vla', 'cello', 'bass', 'eh', 'oboe', 'oohs', 'choir', 'piano', 'glock', 'timp', 'horn', 'harp'])
A_ch, B_ch = '1m 2 1m 7 1m 6 2 1m', '4m 2 4m 1m 6 7 2 1m'
A = ["5:3 3:1", "2:2 4:2", "3:1 5:1 3:2", "7:3 6:1", "5:3 3:1", "6:2 1':2", "2':3 1':1", "1:4"]
B = ["4:2 6:2", "2:2 6:2", "1':2 6:2", "5:3 3:1", "6:2 1':2", "7:2 2':2", "2':2 4':2", "1':4"]
prog = p.prog(1, '1m 1m 2 1m')
for bar, ch in ((5, A_ch), (13, B_ch), (21, A_ch), (29, B_ch), (37, A_ch)):
    prog += p.prog(bar, ch)
prog += p.prog(45, '2 1m 1m 1m')
p.pad('trem', prog, 40, 63, vel=46, n=3)
p.pad('vla', prog[4:], 46, 65, vel=44, n=3)
p.bassline('bass', prog, octave=1, pattern='R - - -', rate=1.0, vel=70)
p.bassline('cello', prog, octave=2, pattern='R . . . R . . .', rate=1.0, vel=60)
p.arp('harp', prog[4:], 40, 70, pattern='0 2 1 2', rate=2.0, vel=44, n=3)
tune(p, 'eh', 5, A, vel=76)
tune(p, 'oboe', 13, B, vel=78); p.pad('oohs', p.prog(13, B_ch), 52, 70, vel=44, n=3)
tune(p, 'eh', 21, A, vel=80); tune(p, 'oboe', 21, A, octave=1, vel=58); p.pad('oohs', p.prog(21, A_ch), 52, 70, vel=48, n=3)
tune(p, 'oboe', 29, B, vel=84); tune(p, 'eh', 29, B, octave=-1, vel=70); p.pad('choir', p.prog(29, B_ch), 52, 72, vel=56, n=3); p.pad('horn', p.prog(29, B_ch), 44, 62, vel=54, n=3)
tune(p, 'eh', 37, A, vel=82); tune(p, 'oboe', 37, A, octave=1, vel=60); p.pad('choir', p.prog(37, A_ch), 52, 72, vel=60, n=3); p.pad('horn', p.prog(37, A_ch), 44, 62, vel=52, n=3)
tune(p, 'eh', 45, ["5:3 3:1", "2:4", "3:2 1:2", "1:4"], vel=60)
# heartbeat of the hall: soft timpani on one and three, a slow piano pedal note, and scattered bell tones
for bar in range(5, 45):
    p.voices['timp'].notes.append((p.at(bar), 2.0, pitch('C2'), 54 if bar < 21 else 66)); p.voices['timp'].notes.append((p.at(bar, 2), 1.0, pitch('C2'), 40 if bar < 21 else 52))
    if bar % 2 == 1:
        p.voices['piano'].notes.append((p.at(bar), 4.0, pitch('C2'), 58)); p.voices['piano'].notes.append((p.at(bar), 4.0, pitch('G2'), 46))
bells = [pitch(n) for n in ('C6', 'Eb6', 'G6', 'Bb5', 'Db6', 'F6')]
for bar in range(7, 46, 3):
    p.voices['glock'].notes.append((p.at(bar, p.rng.choice([1, 2, 3]) + p.rng.choice([0, .5])), 2.5, p.rng.choice(bells), p.rng.randint(38, 52)))
curves(p, {'trem': [(1, 70), (13, 90), (29, 108), (37, 112), (45, 70)], 'vla': [(5, 80), (29, 100), (45, 60)], 'eh': [(5, 98), (29, 100), (37, 104), (45, 70)], 'oboe': [(13, 98), (29, 104)],
           'oohs': [(13, 70), (21, 90)], 'choir': [(29, 80), (37, 100), (45, 40)], 'horn': [(29, 80), (37, 96), (45, 50)], 'cello': [(1, 80), (29, 100)], 'bass': [(1, 90), (37, 110)]})
if __name__ == '__main__':
    print(p.render(OUTDIR()))
