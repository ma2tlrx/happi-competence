"""Musique originale de la vidéo HAPPI, générée par synthèse (aucun échantillon externe).

120 BPM, 4/4 : une mesure = 2 s, un temps = 0,5 s. Les effets (impacts, whooshes, clics…)
sont placés aux instants de ../cues.json, la même grille que celle des animations :
l'image et le son restent synchronisés par construction.

Sortie : ../out/music.wav (48 kHz, stéréo, 24 bits).
"""

import json
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CUES = json.load(open(os.path.join(ROOT, 'cues.json'), encoding='utf-8'))

SR = 48000
DUR = float(CUES['duration'])
N = int(SR * DUR)
BEAT = 60.0 / CUES['bpm']
BAR = 4 * BEAT
RNG = np.random.default_rng(20261117)


def hz(midi):
    return 440.0 * 2 ** ((np.asarray(midi, dtype=float) - 69) / 12)


def secs(n):
    return np.arange(n) / SR


def stereo(mono, pan=0.0):
    """Panoramique à puissance constante (pan de -1 à 1)."""
    angle = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(angle), mono * np.sin(angle)])


class Bus:
    def __init__(self):
        self.buf = np.zeros((2, N))

    def add(self, sound, at):
        """Ajoute un son (mono ou stéréo) à l'instant `at` (s)."""
        if sound.ndim == 1:
            sound = stereo(sound)
        start = int(round(at * SR))
        if start >= N:
            return
        if start < 0:
            sound = sound[:, -start:]
            start = 0
        end = min(N, start + sound.shape[1])
        self.buf[:, start:end] += sound[:, : end - start]


def sos(kind, freq, order=2):
    nyq = SR / 2
    if isinstance(freq, (list, tuple)):
        wn = [min(max(f / nyq, 1e-4), 0.999) for f in freq]
    else:
        wn = min(max(freq / nyq, 1e-4), 0.999)
    return signal.butter(order, wn, btype=kind, output='sos')


def shelf(x, freq, gain_db, kind='low', slope=0.8):
    """Filtre en plateau (RBJ cookbook)."""
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * freq / SR
    alpha = np.sin(w0) / 2 * np.sqrt((a + 1 / a) * (1 / slope - 1) + 2)
    cw = np.cos(w0)
    if kind == 'low':
        b = [a * ((a + 1) - (a - 1) * cw + 2 * np.sqrt(a) * alpha), 2 * a * ((a - 1) - (a + 1) * cw),
             a * ((a + 1) - (a - 1) * cw - 2 * np.sqrt(a) * alpha)]
        den = [(a + 1) + (a - 1) * cw + 2 * np.sqrt(a) * alpha, -2 * ((a - 1) + (a + 1) * cw),
               (a + 1) + (a - 1) * cw - 2 * np.sqrt(a) * alpha]
    else:
        b = [a * ((a + 1) + (a - 1) * cw + 2 * np.sqrt(a) * alpha), -2 * a * ((a - 1) + (a + 1) * cw),
             a * ((a + 1) + (a - 1) * cw - 2 * np.sqrt(a) * alpha)]
        den = [(a + 1) - (a - 1) * cw + 2 * np.sqrt(a) * alpha, 2 * ((a - 1) - (a + 1) * cw),
               (a + 1) - (a - 1) * cw - 2 * np.sqrt(a) * alpha]
    return signal.lfilter(np.array(b) / den[0], np.array(den) / den[0], x, axis=-1)


def filt(x, kind, freq, order=2):
    return signal.sosfilt(sos(kind, freq, order), x, axis=-1)


def sweep(x, kind, freqs, block=256, q_band=None):
    """Filtre dont la fréquence varie dans le temps (freqs : une valeur par échantillon)."""
    x = np.atleast_2d(x)
    out = np.zeros_like(x)
    zi = None
    for start in range(0, x.shape[1], block):
        f = float(freqs[min(start + block // 2, len(freqs) - 1)])
        if kind == 'band':
            bw = q_band or 0.5
            s = sos('bandpass', [max(30, f * (1 - bw)), min(SR / 2 - 100, f * (1 + bw))], 2)
        else:
            s = sos(kind, f, 2)
        if zi is None:
            zi = np.zeros((x.shape[0], s.shape[0], 2))
        for c in range(x.shape[0]):
            out[c, start : start + block], zi[c] = signal.sosfilt(s, x[c, start : start + block], zi=zi[c])
    return out


def envelope(n, attack, release, total=None):
    t = secs(n)
    total = total if total is not None else n / SR
    env = np.minimum(1.0, t / max(attack, 1e-4))
    tail = np.clip((total - t) / max(release, 1e-4), 0, 1)
    return env * tail


def saw(freq, n, phase=0.0):
    ph = (phase + np.cumsum(np.broadcast_to(freq, (n,)) / SR)) % 1.0
    return 2 * ph - 1


def noise(n):
    return RNG.standard_normal(n)


# ── Réverbération à convolution (réponse impulsionnelle synthétique) ────────────────
def make_ir(seconds=2.4, decay=0.55, predelay=0.018):
    n = int(SR * seconds)
    t = secs(n)
    ir = RNG.standard_normal((2, n)) * np.exp(-t / decay)
    ir = filt(ir, 'lowpass', 6500)
    ir[:, : int(predelay * SR)] = 0
    early = [0.011, 0.019, 0.027, 0.041]
    for i, d in enumerate(early):
        ir[i % 2, int((predelay + d) * SR)] += 0.6
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


IR = make_ir()


def reverb(x, wet=0.3):
    out = np.stack([signal.fftconvolve(x[c], IR[c])[: x.shape[1]] for c in range(2)])
    return x * (1 - wet) + out * wet * 0.35


def delay(x, seconds, feedback=0.35, taps=5, pingpong=True):
    out = x.copy()
    d = int(seconds * SR)
    for k in range(1, taps + 1):
        g = feedback ** k
        shifted = np.zeros_like(x)
        shifted[:, d * k :] = x[:, : -d * k] if d * k < x.shape[1] else 0
        if pingpong and k % 2 == 1:
            shifted = shifted[::-1]
        out += g * shifted
    return out


# ── Instruments ─────────────────────────────────────────────────────────────────────
def kick(gain=1.0):
    n = int(0.42 * SR)
    t = secs(n)
    f = 46 + (150 - 46) * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = filt(noise(n), 'highpass', 2500) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.8 * (body + click)) * 0.7 * gain


def clap(gain=1.0):
    n = int(0.35 * SR)
    t = secs(n)
    env = np.zeros(n)
    for off in (0.0, 0.009, 0.019):
        env += np.where(t >= off, np.exp(-(t - off) / 0.006), 0)
    env += np.where(t >= 0.025, 0.6 * np.exp(-(t - 0.025) / 0.11), 0)
    x = filt(noise(n), 'bandpass', [900, 4200]) * env
    return x * 0.55 * gain


def snare(gain=1.0):
    n = int(0.25 * SR)
    t = secs(n)
    body = np.sin(2 * np.pi * 188 * t) * np.exp(-t / 0.05) * 0.5
    nz = filt(noise(n), 'bandpass', [1500, 7500]) * np.exp(-t / 0.07)
    return (body + nz) * 0.45 * gain


def hat(open_=False, gain=1.0):
    n = int((0.22 if open_ else 0.06) * SR)
    t = secs(n)
    x = filt(noise(n), 'highpass', 7200) * np.exp(-t / (0.09 if open_ else 0.018))
    return x * 0.13 * gain


def shaker(gain=1.0):
    n = int(0.08 * SR)
    t = secs(n)
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.03)
    return filt(noise(n), 'bandpass', [5000, 11000]) * env * 0.1 * gain


def pluck(midi, length=0.32, bright=1.0, gain=1.0):
    n = int(length * SR)
    t = secs(n)
    f0 = float(hz(midi))
    out = np.zeros(n)
    for k in range(1, 14):
        if f0 * k > 15000:
            break
        out += (1 / k) * np.sin(2 * np.pi * f0 * k * t + RNG.uniform(0, 6.28)) * np.exp(-t * (9 + 5.5 * k / bright))
    out *= np.minimum(1, t / 0.002)
    return out * 0.22 * gain


def bell(midi, length=1.6, gain=1.0, ratio=3.5, index=2.2):
    n = int(length * SR)
    t = secs(n)
    f = float(hz(midi))
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / 0.25)
    car = np.sin(2 * np.pi * f * t + mod)
    return car * np.exp(-t / (length / 3.2)) * np.minimum(1, t / 0.003) * 0.18 * gain


def lead_note(midi, length, gain=1.0):
    n = int((length + 0.25) * SR)
    t = secs(n)
    f = float(hz(midi))
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.4)
    ph = np.cumsum(f * vib) / SR
    tone = 0.6 * np.sin(2 * np.pi * ph) + 0.25 * np.sin(4 * np.pi * ph) + 0.12 * (2 * (ph % 1) - 1)
    env = np.minimum(1, t / 0.012) * np.where(t < length, 1.0, np.exp(-(t - length) / 0.08)) * (0.75 + 0.25 * np.exp(-t / 0.2))
    return tone * env * 0.16 * gain


# ── Harmonie ────────────────────────────────────────────────────────────────────────
CHORDS = {
    'Am': {'bass': 45, 'pad': [57, 60, 64, 71], 'arp': [69, 72, 76, 81]},
    'F': {'bass': 41, 'pad': [53, 57, 60, 67], 'arp': [65, 69, 72, 77]},
    'C': {'bass': 48, 'pad': [55, 60, 64, 74], 'arp': [67, 72, 76, 79]},
    'G': {'bass': 43, 'pad': [55, 59, 62, 69], 'arp': [67, 71, 74, 79]},
    'Cfin': {'bass': 36, 'pad': [48, 55, 60, 64, 67, 74], 'arp': [72, 76, 79, 84]},
}
LOOP = ['Am', 'F', 'C', 'G']
BARS = int(round(DUR / BAR))
PROG = [LOOP[i % 4] for i in range(25)] + ['F', 'G', 'Cfin', 'Cfin']
PROG = PROG[:BARS]


def section_of(t):
    for s in CUES['sections']:
        if s['start'] <= t < s['end']:
            return s['name']
    return 'logo'


FULL = {'methode', 'mesure', 'passeport'}

drums = Bus()
bass = Bus()
music = Bus()
fx = Bus()

# Batterie
for b in range(BARS):
    for beat in range(4):
        t0 = b * BAR + beat * BEAT
        sec = section_of(t0)
        if sec == 'reseau' and t0 < 17.0:
            drums.add(kick(0.95), t0)
        elif sec in FULL:
            drums.add(kick(1.0), t0)
        elif sec == 'pre-drop' and beat == 0:
            drums.add(kick(0.9), t0)
        elif sec == 'logo' and beat == 0 and t0 < 54:
            drums.add(kick(0.7), t0)
        if beat in (1, 3) and ((sec == 'reseau' and t0 >= 10 and t0 < 17) or sec in FULL):
            drums.add(stereo(clap(), 0.05), t0)
        if sec == 'pre-drop' and beat == 2:
            drums.add(stereo(clap(1.1), 0.0), t0)
        # charleston
        for sub in range(4):
            ts = t0 + sub * BEAT / 4
            if sec in FULL:
                g = 1.0 if sub == 2 else 0.55
                drums.add(stereo(hat(gain=g), 0.25), ts)
                if sub == 2 and beat % 2 == 1:
                    drums.add(stereo(hat(True, 0.6), -0.2), ts)
                if sec == 'passeport':
                    drums.add(stereo(shaker(0.8 if sub % 2 else 0.5), -0.45), ts)
            elif sec == 'reseau' and sub == 2:
                drums.add(stereo(hat(gain=0.9), 0.25), ts)
            elif sec == 'logo' and sub == 2 and t0 < 54:
                drums.add(stereo(hat(gain=0.5), 0.25), ts)

# Roulements de caisse claire avant les montées
for start, end in [(19.0, 20.0), (33.5, 34.0), (37.0, 38.0), (48.0, 50.0)]:
    t = start
    while t < end - 1e-6:
        prog = (t - start) / (end - start)
        step = BEAT / (2 if prog < 0.4 else 4 if prog < 0.75 else 8)
        drums.add(stereo(snare(0.35 + 0.65 * prog), 0.1), t)
        t += step

# Basse (croches, compressée par le kick)
for b in range(BARS):
    t0 = b * BAR
    sec = section_of(t0)
    if sec not in FULL | {'reseau'} or (sec == 'reseau' and t0 >= 16):
        continue
    root = CHORDS[PROG[b]]['bass']
    for e in range(8):
        n = int(BEAT / 2 * SR)
        t = secs(n)
        midi = root + (12 if (sec in FULL and e % 4 == 3) else 0)
        f = float(hz(midi))
        x = 0.6 * saw(f, n) + 0.5 * np.sin(2 * np.pi * f * t)
        x *= np.minimum(1, t / 0.004) * np.exp(-t / 0.22)
        bass.add(x * 0.2, t0 + e * BEAT / 2)
bass.buf = filt(bass.buf, 'lowpass', 520)

# Nappes (supersaw), ouverture du filtre selon les sections
pad = np.zeros((2, N))
for b, name in enumerate(PROG):
    t0 = b * BAR
    length = BAR + 0.9
    n = int(length * SR)
    env = envelope(n, 0.35 if b else 1.6, 0.8)
    voices = CHORDS[name]['pad']
    for c in range(2):
        acc = np.zeros(n)
        for m in voices:
            for d in (-11, -4, 3, 9) if c == 0 else (-9, -2, 5, 12):
                f = float(hz(m)) * 2 ** (d / 1200)
                acc += saw(f, n, RNG.uniform())
        acc *= env / (len(voices) * 4)
        start = int(t0 * SR)
        end = min(N, start + n)
        pad[c, start:end] += acc[: end - start]
cut = np.zeros(N)
tt = secs(N)
for s in CUES['sections']:
    a, b_ = int(s['start'] * SR), int(s['end'] * SR)
    base = {'accroche': (380, 1300), 'reseau': (1500, 2000), 'pre-drop': (900, 5200), 'methode': (2600, 2600),
            'mesure': (2600, 2600), 'respiration': (900, 1600), 'passeport': (3000, 3000), 'montee': (1200, 6500),
            'logo': (3200, 1400)}[s['name']]
    cut[a:b_] = np.geomspace(base[0], base[1], b_ - a)
pad = sweep(pad, 'lowpass', cut, block=512)
music.buf += pad * 0.55

# Arpège (doubles croches) avec écho ping-pong
arp = Bus()
pattern = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 3, 1, 2]
for b, name in enumerate(PROG):
    t0 = b * BAR
    sec = section_of(t0)
    if sec in ('pre-drop',) or t0 < 4:
        continue
    gain = {'accroche': 0.35, 'reseau': 0.7, 'respiration': 0.55, 'montee': 0.6, 'logo': 0.55}.get(sec, 0.9)
    bright = 0.5 if sec in ('accroche', 'respiration') else 1.0
    tones = CHORDS[name]['arp']
    for i, p in enumerate(pattern):
        accent = 1.0 if i % 4 == 0 else 0.7
        arp.add(stereo(pluck(tones[p], bright=bright, gain=gain * accent), 0.3 if i % 2 else -0.3), t0 + i * BEAT / 4)
music.buf += delay(arp.buf, 0.375, 0.32, 4) * 0.8

# Mélodie (sections pleines)
MOTIF = {
    'Am': [(0, 76, 1), (1.5, 74, 0.5), (2, 72, 1), (3, 69, 1)],
    'F': [(0, 72, 1.5), (1.5, 69, 0.5), (2, 72, 0.5), (2.5, 74, 1.5)],
    'C': [(0, 76, 1), (1, 79, 1), (2, 76, 1), (3, 74, 1)],
    'G': [(0, 74, 1.5), (1.5, 71, 0.5), (2, 74, 2)],
}
lead = Bus()
for b, name in enumerate(PROG):
    t0 = b * BAR
    if not ((24 <= t0 < 32) or (38 <= t0 < 48)):
        continue
    for beat, midi, length in MOTIF.get(name, []):
        lead.add(stereo(lead_note(midi, length * BEAT), -0.1), t0 + beat * BEAT)
        if t0 >= 38:
            lead.add(stereo(lead_note(midi + 12, length * BEAT, 0.35), 0.25), t0 + beat * BEAT)
music.buf += delay(lead.buf, 0.375, 0.25, 3) * 1.0

# Battement de cœur de l'accroche
for t0 in CUES['heartbeat']:
    for off, g in ((0, 1.0), (0.17, 0.6)):
        n = int(0.3 * SR)
        t = secs(n)
        x = np.tanh(2.2 * np.sin(2 * np.pi * (68 + 40 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.08)) * g * 0.32
        x += filt(noise(n), 'bandpass', [600, 2400]) * np.exp(-t / 0.006) * g * 0.08
        drums.add(x, t0 + off)

# Accord final
fin = np.zeros((2, int(4.2 * SR)))
for c in range(2):
    acc = np.zeros(fin.shape[1])
    for m in CHORDS['Cfin']['pad']:
        for d in (-8, 0, 7):
            acc += saw(float(hz(m)) * 2 ** ((d + (3 if c else -3)) / 1200), fin.shape[1], RNG.uniform())
    fin[c] = acc * envelope(fin.shape[1], 0.05, 3.2) / 18
fin = filt(fin, 'lowpass', 2600)
music.add(fin * 0.6, 54.0)


# ── Effets synchronisés sur la cue sheet ────────────────────────────────────────────
def impact(big=True):
    n = int(3.2 * SR)
    t = secs(n)
    boom = np.sin(2 * np.pi * np.cumsum(30 + 55 * np.exp(-t / 0.18)) / SR) * np.exp(-t / (1.1 if big else 0.5))
    crash = filt(noise(n), 'bandpass', [400, 9000]) * np.exp(-t / (0.9 if big else 0.35)) * 0.35
    hit = filt(noise(n), 'lowpass', 1800) * np.exp(-t / 0.03) * 0.6
    return np.tanh(1.5 * (boom * 0.95 + crash + hit)) * (0.9 if big else 0.55)


def whoosh(d, pan):
    n = int(d * SR * 1.6)
    t = secs(n)
    center = d * 0.65
    env = np.exp(-((t - center) / (d * 0.32)) ** 2)
    freqs = 300 + 3200 * np.exp(-((t - center) / (d * 0.45)) ** 2)
    x = sweep(noise(n)[None, :], 'band', freqs, q_band=0.6)[0] * env
    pans = np.linspace(-pan, pan, n)
    angle = (pans + 1) * np.pi / 4
    return np.stack([x * np.cos(angle), x * np.sin(angle)]) * 0.5


def suck(d):
    n = int(d * SR)
    t = secs(n)
    env = (t / d) ** 2.2
    freqs = np.geomspace(5500, 260, n)
    x = sweep(noise(n)[None, :], 'band', freqs, q_band=0.5)[0] * env
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(900, 110, n)) / SR) * env * 0.25
    return stereo((x + tone) * 0.6)


def riser(d):
    n = int(d * SR)
    t = secs(n)
    prog = t / d
    env = prog ** 1.8
    freqs = np.geomspace(350, 9000, n)
    nz = sweep(np.stack([noise(n), noise(n)]), 'band', freqs, q_band=0.35) * env
    f = np.geomspace(hz(57), hz(81), n)
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(np.geomspace(4, 16, n)) / SR)
    tone = (0.5 * saw(f, n) + 0.5 * saw(f * 1.006, n)) * env * trem * 0.18
    tone = filt(tone, 'lowpass', 4000)
    return nz * 0.5 + stereo(tone)


def reverse_cymbal(d=1.6):
    n = int(d * SR)
    t = secs(n)
    env = np.exp((t - d) / 0.35)
    x = filt(np.stack([noise(n), noise(n)]), 'highpass', 3500) * env
    return x * 0.28


def pop(i):
    n = int(0.16 * SR)
    t = secs(n)
    scale = [81, 84, 86, 88, 91, 93, 96]
    f = float(hz(scale[i % len(scale)]))
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.045)
    return x * 0.18


def click():
    n = int(0.03 * SR)
    t = secs(n)
    x = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.006) + filt(noise(n), 'highpass', 6000) * np.exp(-t / 0.002) * 0.5
    return x * 0.16


def sparkle(d):
    out = Bus()
    scale = [81, 84, 86, 88, 91, 93, 96, 98, 100]
    t = 0.0
    i = 0
    while t < d:
        out.add(stereo(bell(scale[RNG.integers(len(scale))], 0.9, 0.55), RNG.uniform(-0.8, 0.8)), t)
        t += BEAT / 4 * RNG.choice([1, 1, 2])
        i += 1
    return out


hitbus = Bus()
for t0 in CUES['impact']:
    fx.add(stereo(impact(True)), t0)
for t0 in CUES['hit']:
    hitbus.add(stereo(impact(False) * 0.75), t0)
for w in CUES['whoosh']:
    fx.add(whoosh(w['d'], w['pan']) * w['gain'] * 1.4, w['t'] - w['d'] * 0.1)
for s in CUES['suck']:
    fx.add(suck(s['d']), s['t'])
for r in CUES['riser']:
    fx.add(riser(r['d']), r['t'])
for t0 in CUES['reverse']:
    fx.add(reverse_cymbal(), t0 - 1.6)
for i, t0 in enumerate(CUES['pop']):
    fx.add(stereo(pop(i), 0.35 if i % 2 else -0.35), t0)
for t0 in CUES['click']:
    fx.add(stereo(click(), 0.15), t0)
for t0 in CUES['ding']:
    fx.add(stereo(bell(91, 1.4, 0.9, ratio=2.0, index=1.2) + bell(95, 1.4, 0.6, ratio=2.0, index=1.0)), t0)
for s in CUES['sparkle']:
    sp = sparkle(s['d'])
    fx.add(sp.buf[:, : int((s['d'] + 1.5) * SR)], s['t'])

# ── Mixage ──────────────────────────────────────────────────────────────────────────
kick_times = [b * BAR + k * BEAT for b in range(BARS) for k in range(4)
              if section_of(b * BAR + k * BEAT) in FULL or (section_of(b * BAR) == 'reseau' and b * BAR + k * BEAT < 17)]
duck = np.ones(N)
for kt in kick_times:
    s = int(kt * SR)
    n = int(0.35 * SR)
    t = secs(min(n, N - s))
    duck[s : s + len(t)] = np.minimum(duck[s : s + len(t)], 1 - 0.7 * np.exp(-t / 0.11))

mix = (
    drums.buf * 0.95
    + bass.buf * duck * 1.0
    + reverb(music.buf, 0.32) * (0.55 + 0.45 * duck)
    + reverb(fx.buf, 0.38) * 0.95
    + reverb(hitbus.buf, 0.3) * 0.8
)
mix = filt(mix, 'highpass', 32)
mix = shelf(mix, 110, -6.0, 'low')
mix = shelf(mix, 8500, -5.0, 'high')
mix = shelf(mix, 2800, 1.5, 'high')

# Bus : compression douce puis limiteur à saturation légère
rms = np.sqrt(np.convolve(np.mean(mix ** 2, axis=0), np.ones(2400) / 2400, mode='same')) + 1e-9
target = 10 ** (-17 / 20)
gain = np.clip((target / rms) ** 0.35, 0.5, 1.6)
gain = np.convolve(gain, np.ones(4800) / 4800, mode='same')
mix *= gain
mix *= 10 ** (-15.5 / 20) / np.sqrt(np.mean(mix ** 2))
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
mix *= 0.93 / np.max(np.abs(mix))

fade_in = np.minimum(1, secs(N) / 0.03)
fade_out = np.clip((DUR - secs(N)) / 2.4, 0, 1) ** 1.5
mix *= fade_in * fade_out

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
pcm = np.clip(mix.T, -1, 1)
wavfile.write(os.path.join(ROOT, 'out', 'music.wav'), SR, (pcm * 2147483000).astype(np.int32))
print(f'music.wav : {DUR:.1f} s, crête {np.max(np.abs(pcm)):.3f}, RMS {20 * np.log10(np.sqrt(np.mean(pcm ** 2))):.1f} dBFS')
