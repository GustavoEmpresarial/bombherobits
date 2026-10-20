"""Render the original Hero Bits loop, 'Lanterns in the Vault'.

Requires numpy and ffmpeg. Deterministic synthesis, no borrowed samples.
Run: python3 apps/web/scripts/generate-soundtrack.py
"""
from pathlib import Path
import math
import subprocess
import tempfile
import wave
import numpy as np

RATE = 44100
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 16
FRAMES = round(BARS * BAR * RATE)
LOOP = np.zeros((FRAMES, 2), dtype=np.float32)
RNG = np.random.default_rng(72411)


def pitch(name):
    notes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    key = name[:2] if len(name) > 2 and name[1] == '#' else name[:1]
    octave = int(name[len(key):])
    return 440 * 2 ** ((12 * (octave + 1) + notes[key] - 69) / 12)


def place(start, signal, gain=1, pan=0):
    first = round(start * RATE) % FRAMES
    mono = np.asarray(signal, dtype=np.float32) * gain
    stereo = np.stack((mono * math.sqrt((1 - pan) / 2), mono * math.sqrt((1 + pan) / 2)), axis=1)
    for offset in range(0, len(stereo), FRAMES):
        part = stereo[offset:offset + FRAMES]
        end = first + len(part)
        if end <= FRAMES:
            LOOP[first:end] += part
        else:
            split = FRAMES - first
            LOOP[first:] += part[:split]
            LOOP[:len(part) - split] += part[split:]
        first = (first + len(part)) % FRAMES


def tone(note, duration, instrument):
    n = round(duration * RATE)
    t = np.arange(n) / RATE
    f = pitch(note)
    phase = 2 * np.pi * f * t
    if instrument == 'lead':
        sound = .54 * np.sign(np.sin(phase)) + .27 * np.sin(phase) + .19 * np.sign(np.sin(phase * 2))
        env = np.minimum(1, t / .012) * np.minimum(1, (duration - t) / .11) * np.exp(-t * .65)
    elif instrument == 'bell':
        sound = np.sin(phase) + .36 * np.sin(phase * 2.01) + .13 * np.sin(phase * 3.98)
        env = np.minimum(1, t / .003) * np.exp(-t * 5.2) * np.minimum(1, (duration - t) / .025)
    elif instrument == 'pluck':
        sound = .48 * np.sign(np.sin(phase)) + .36 * (2 / np.pi) * np.arcsin(np.sin(phase)) + .16 * np.sin(phase * 2)
        env = np.minimum(1, t / .004) * np.exp(-t * 3.6) * np.minimum(1, (duration - t) / .035)
    elif instrument == 'bass':
        sound = .7 * np.sin(phase) + .24 * np.sign(np.sin(phase)) + .06 * np.sin(phase * 2)
        env = np.minimum(1, t / .008) * np.minimum(1, (duration - t) / .08) * np.exp(-t * .48)
    else:  # warm organ under the melody
        sound = .75 * np.sin(phase) + .15 * np.sin(phase * 2) + .1 * np.sin(phase * 3)
        env = np.minimum(1, t / .18) * np.minimum(1, (duration - t) / .3)
    return sound * np.clip(env, 0, 1)


def note(at, name, beats, instrument, gain, pan=0):
    place(at * BEAT, tone(name, beats * BEAT, instrument), gain, pan)


# D minor, with a brighter F-major lift and a final A-major turnaround.
chords = [
    ('D3', ['D4', 'F4', 'A4'], ['D5', 'F5', 'A5']),
    ('A#2', ['A#3', 'D4', 'F4'], ['A#4', 'D5', 'F5']),
    ('F3', ['F4', 'A4', 'C5'], ['F5', 'A5', 'C6']),
    ('C3', ['C4', 'E4', 'G4'], ['C5', 'E5', 'G5']),
    ('D3', ['D4', 'F4', 'A4'], ['D5', 'F5', 'A5']),
    ('A#2', ['A#3', 'D4', 'F4'], ['A#4', 'D5', 'F5']),
    ('G2', ['G3', 'A#3', 'D4'], ['G4', 'A#4', 'D5']),
    ('A2', ['A3', 'C#4', 'E4'], ['A4', 'C#5', 'E5']),
]
melody = [
    [('A4', 0, .5), ('D5', .5, .5), ('F5', 1, 1), ('E5', 2, .5), ('D5', 2.5, .5), ('A4', 3, 1)],
    [('A4', 0, .5), ('A#4', .5, .5), ('D5', 1, 1), ('F5', 2, .75), ('D5', 3, 1)],
    [('C5', 0, .5), ('F5', .5, .5), ('A5', 1, 1), ('G5', 2, .5), ('F5', 2.5, .5), ('C5', 3, 1)],
    [('G4', 0, .5), ('C5', .5, .5), ('E5', 1, 1), ('D5', 2, 1), ('C5', 3, 1)],
    [('D5', 0, .5), ('F5', .5, .5), ('A5', 1, 1), ('G5', 2, .5), ('F5', 2.5, .5), ('D5', 3, 1)],
    [('F5', 0, .5), ('D5', .5, .5), ('A#4', 1, 1), ('D5', 2, 1), ('F5', 3, 1)],
    [('G5', 0, 1), ('D5', 1, .5), ('A#4', 1.5, .5), ('A4', 2, 1), ('G4', 3, 1)],
    [('A4', 0, .5), ('C#5', .5, .5), ('E5', 1, 1), ('C#5', 2, .5), ('A4', 2.5, .5), ('E5', 3, 1)],
]
for bar in range(BARS):
    root, harmony, arpeggio = chords[bar % 8]
    beginning = bar * 4
    for j, harmony_note in enumerate(harmony):
        note(beginning, harmony_note, 3.95, 'pad', .018, (j - 1) * .38)
    bass_root = root
    fifth = arpeggio[2][:-1] + str(int(arpeggio[2][-1]) - 2)
    for beat, bass_note, length in [(0, bass_root, .9), (1.5, fifth, .45), (2, bass_root, .9), (3.5, fifth, .4)]:
        note(beginning + beat, bass_note, length, 'bass', .17, -.12)
    for eighth in range(8):
        note(beginning + eighth * .5, arpeggio[(eighth + bar) % 3], .38, 'pluck', .052, -.43 if eighth % 2 else .43)
    for name, beat, length in melody[bar % 8]:
        note(beginning + beat, name, length * .91, 'lead', .073 if bar < 8 else .086, .08)
    if bar in [3, 7, 11, 15]:
        note(beginning + 3.5, arpeggio[1], .45, 'bell', .055, .48)

# Soft, game-friendly rhythm rather than a loud drum kit.
for bar in range(BARS):
    at = bar * BAR
    for beat in (0, 2):
        n = round(.25 * RATE)
        t = np.arange(n) / RATE
        sweep = np.sin(2 * np.pi * (61 * t + 54 * (.085 / (2 * np.pi)) * (1 - np.exp(-t / .085)) * 2 * np.pi))
        place(at + beat * BEAT, sweep * np.exp(-t * 18), .14)
    for beat in (1, 3):
        n = round(.15 * RATE)
        t = np.arange(n) / RATE
        noise = RNG.standard_normal(n)
        noise = noise - np.convolve(noise, np.ones(21) / 21, mode='same')
        place(at + beat * BEAT, noise * np.exp(-t * 36), .022, -.08)
    for eighth in range(8):
        n = round(.045 * RATE)
        t = np.arange(n) / RATE
        noise = RNG.standard_normal(n)
        noise = noise - np.convolve(noise, np.ones(8) / 8, mode='same')
        place(at + eighth * .5 * BEAT, noise * np.exp(-t * 105), .008, .28 if eighth % 2 else -.28)

# Circular echoes preserve reverb tails across the seam of the looping file.
dry = LOOP.copy()
for delay, gain in [(.19, .13), (.31, .08), (.47, .045)]:
    LOOP += np.roll(dry, round(delay * RATE), axis=0) * gain
LOOP = np.tanh(LOOP * 1.35)
peak = float(np.max(np.abs(LOOP)))
LOOP *= .72 / peak
pcm = (LOOP * 32767).astype('<i2')
output = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'lanterns-in-the-vault.ogg'
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as directory:
    raw = Path(directory) / 'soundtrack.wav'
    with wave.open(str(raw), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-c:a', 'libvorbis', '-q:a', '4', str(output)], check=True)
print(f'{output}: {BARS} bars, {FRAMES / RATE:.2f}s, peak {peak:.3f}')
