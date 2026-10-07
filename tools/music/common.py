"""Shared orchestra layout and small helpers for the Lantern Gate score."""
import os, sys, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from orch import *

# alias: (instrument, group, pan, channel volume).  Pans follow a concert seating plan seen from the hall.
KIT = {
    'harp': ('harp', 'plucked', -.50, 98), 'piano': ('piano', 'keys', -.12, 96), 'celesta': ('celesta', 'keys', .30, 90), 'glock': ('glock', 'keys', .38, 80),
    'guitar': ('guitar', 'plucked', -.30, 92), 'dulcimer': ('dulcimer', 'plucked', .30, 90),
    'vln': ('strings', 'strings', -.45, 94), 'vln2': ('strings2', 'strings', -.28, 92), 'vla': ('strings', 'strings', -.10, 90),
    'cello': ('cello', 'strings', .26, 98), 'bass': ('bass', 'strings', .42, 100), 'pizz': ('pizz', 'strings', -.2, 98), 'trem': ('tremolo', 'strings', -.3, 88),
    'solovln': ('violin', 'strings', -.2, 100), 'solocello': ('cello', 'strings', .1, 104),
    'flute': ('flute', 'winds', -.12, 104), 'piccolo': ('piccolo', 'winds', -.05, 90), 'oboe': ('oboe', 'winds', .08, 104), 'eh': ('eh', 'winds', .16, 104),
    'clarinet': ('clarinet', 'winds', .22, 102), 'bassoon': ('bassoon', 'winds', .32, 100), 'recorder': ('recorder', 'winds', -.1, 96),
    'horn': ('horn', 'brass', .38, 96), 'trumpet': ('trumpet', 'brass', -.05, 92), 'trombone': ('trombone', 'brass', .18, 92), 'tuba': ('tuba', 'brass', .1, 96),
    'brass': ('brass', 'brass', .0, 90), 'choir': ('choir', 'choir', .0, 92), 'oohs': ('oohs', 'choir', .0, 92),
    'organ': ('organ', 'keys', .0, 80), 'accordion': ('accordion', 'winds', .3, 90), 'timp': ('timp', 'perc', .0, 100), 'marimba': ('marimba', 'keys', .25, 90),
}


def orchestra(p, names):
    out = {}
    for n in names:
        if n == 'kit':
            out[n] = p.voice('kit', 48, 'perc', drums=True, vol=100)
        else:
            inst, grp, pan, vol = KIT[n]
            out[n] = p.voice(n, inst, grp, pan=pan, vol=vol)
    return out


def build(p, sections):
    """sections: list of (start_bar, chord_text). Returns concatenated progression + per-section lists."""
    out = []
    for bar, text in sections:
        out += p.prog(bar, text)
    return out


# GM drum map used in the score (MuseScore General orchestra kit)
KICK, SNARE, RIM, HAT, CRASH, RIDE, TAMB, TRI, TOMH, TOMM, TOML, SHAKER = 36, 38, 37, 42, 49, 51, 54, 81, 50, 47, 43, 70


def _bar_len(text):
    total, last = 0.0, 1.0
    for tok in text.split():
        ds = None
        for part in tok.split('+'):
            m = Piece.TOK.match(part)
            if m and m.group('dur'):
                ds = m.group('dur')
        d = (eval(ds) if ds and '/' in ds else float(ds)) if ds else last
        total += d
        last = d
    return total


def tune(p, voice, bar, lines, octave=0, vel=84, end=None, check=True):
    """Write one text line per bar and verify every bar adds up to the meter (catches arithmetic slips)."""
    for i, ln in enumerate(lines + ([end] if end else [])):
        if check and abs(_bar_len(ln) - p.beats) > 1e-6:
            raise ValueError(f'{p.id}: {voice} bar {bar + i} has {_bar_len(ln)} beats, expected {p.beats}: {ln!r}')
        p.line(voice, bar + i, ln, octave=octave, vel=vel)
    return bar + len(lines) + (1 if end else 0)


def curves(p, spec):
    for name, pts in spec.items():
        p.dyn(name, pts)


def OUTDIR():
    return os.environ.get('OUT', os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../game/audio/orchestra')))
