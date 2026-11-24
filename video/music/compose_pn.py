"""Musique originale de la vidéo « Passeport Numérique » (30 s), générée par synthèse (aucun échantillon externe).

Réutilise les instruments de compose.py (même son que la vidéo HAPPI) ; la grille rythmique est ../cues-pn.json
(120 BPM, une mesure = 2 s) : balayages, clics, « ding » tombent sur les mêmes instants que les animations.
Sortie : ../out/music-pn.wav (48 kHz, stéréo, 24 bits).
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, 'compose.py'), encoding='utf-8').read()
# Instruments partagés : tout ce qui précède l'arrangement de la vidéo HAPPI, puis ses effets (impact, whoosh, riser…).
_head = _src.split('CHORDS = {')[0].replace("'cues.json'", "'cues-pn.json'")
_fx = _src[_src.index('def impact'):_src.index('hitbus = Bus()')]
exec(compile(_head + '\n' + _fx, 'compose-partage', 'exec'), globals())  # noqa: S102

CHORDS = {
    'Am': {'bass': 45, 'pad': [57, 60, 64, 71], 'arp': [69, 72, 76, 81]},
    'F': {'bass': 41, 'pad': [53, 57, 60, 67], 'arp': [65, 69, 72, 77]},
    'C': {'bass': 48, 'pad': [55, 60, 64, 74], 'arp': [67, 72, 76, 79]},
    'G': {'bass': 43, 'pad': [55, 59, 62, 69], 'arp': [67, 71, 74, 79]},
    'Cfin': {'bass': 36, 'pad': [48, 55, 60, 64, 67, 74], 'arp': [72, 76, 79, 84]},
}
BARS = int(round(DUR / BAR))
PROG = (['Am', 'F', 'C', 'G'] * 3 + ['F', 'G', 'Cfin'])[:BARS]


def section_of(t):
    for s in CUES['sections']:
        if s['start'] <= t < s['end']:
            return s['name']
    return 'final'


FULL = {'mondes', 'demo', 'traces'}
drums, bass, music, fx, hitbus = Bus(), Bus(), Bus(), Bus(), Bus()

# Batterie
for b in range(BARS):
    for beat in range(4):
        t0 = b * BAR + beat * BEAT
        sec = section_of(t0)
        if sec in FULL:
            drums.add(kick(1.0), t0)
            if beat in (1, 3):
                drums.add(stereo(clap(), 0.05), t0)
        elif sec == 'question' and beat in (0, 2):
            drums.add(kick(0.8), t0)
        elif sec == 'intro' and beat == 0 and t0 >= 2.0:
            drums.add(kick(0.6), t0)
        elif sec == 'final' and beat == 0 and t0 < 28:
            drums.add(kick(0.8), t0)
        for sub in range(4):
            ts = t0 + sub * BEAT / 4
            if sec in FULL:
                drums.add(stereo(hat(gain=1.0 if sub == 2 else 0.5), 0.25), ts)
                if sec == 'traces':
                    drums.add(stereo(shaker(0.8 if sub % 2 else 0.5), -0.45), ts)
            elif sec == 'question' and sub == 2:
                drums.add(stereo(hat(gain=0.7), 0.25), ts)

# Basse
for b in range(BARS):
    t0 = b * BAR
    if section_of(t0) not in FULL | {'question'}:
        continue
    root = CHORDS[PROG[b]]['bass']
    for e in range(8):
        n = int(BEAT / 2 * SR)
        t = secs(n)
        f = float(hz(root + (12 if (e % 4 == 3) else 0)))
        x = (0.6 * saw(f, n) + 0.5 * np.sin(2 * np.pi * f * t)) * np.minimum(1, t / 0.004) * np.exp(-t / 0.22)
        bass.add(x * (0.12 if section_of(t0) == 'question' else 0.2), t0 + e * BEAT / 2)
bass.buf = filt(bass.buf, 'lowpass', 520)

# Nappes (supersaw) : filtre ouvert selon la séquence
pad = np.zeros((2, N))
for b, name in enumerate(PROG):
    t0 = b * BAR
    n = int((BAR + 0.9) * SR)
    env = envelope(n, 0.35 if b else 1.4, 0.8)
    voices = CHORDS[name]['pad']
    for c in range(2):
        acc = np.zeros(n)
        for m in voices:
            for d in (-11, -4, 3, 9) if c == 0 else (-9, -2, 5, 12):
                acc += saw(float(hz(m)) * 2 ** (d / 1200), n, RNG.uniform())
        acc *= env / (len(voices) * 4)
        start = int(t0 * SR)
        end = min(N, start + n)
        pad[c, start:end] += acc[: end - start]
cut = np.zeros(N)
base = {'intro': (400, 1400), 'question': (1400, 1800), 'mondes': (2400, 2600), 'demo': (2200, 2200), 'traces': (2800, 3000), 'final': (3000, 1200)}
for s in CUES['sections']:
    a, b_ = int(s['start'] * SR), int(s['end'] * SR)
    cut[a:b_] = np.geomspace(base[s['name']][0], base[s['name']][1], b_ - a)
pad = sweep(pad, 'lowpass', cut, block=512)
music.buf += pad * 0.55

# Arpège avec écho ping-pong
arp = Bus()
pattern = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 3, 1, 2]
for b, name in enumerate(PROG):
    t0 = b * BAR
    sec = section_of(t0)
    if t0 < 2.0 or name == 'Cfin':
        continue
    gain = {'intro': 0.4, 'question': 0.55, 'demo': 0.75, 'final': 0.5}.get(sec, 0.9)
    tones = CHORDS[name]['arp']
    for i, p in enumerate(pattern):
        arp.add(stereo(pluck(tones[p], bright=0.6 if sec in ('intro', 'question') else 1.0, gain=gain * (1.0 if i % 4 == 0 else 0.7)), 0.3 if i % 2 else -0.3), t0 + i * BEAT / 4)
music.buf += delay(arp.buf, 0.375, 0.32, 4) * 0.8

# Mélodie (mondes → certificat)
MOTIF = {
    'Am': [(0, 76, 1), (1.5, 74, 0.5), (2, 72, 1), (3, 69, 1)],
    'F': [(0, 72, 1.5), (1.5, 69, 0.5), (2, 72, 0.5), (2.5, 74, 1.5)],
    'C': [(0, 76, 1), (1, 79, 1), (2, 76, 1), (3, 74, 1)],
    'G': [(0, 74, 1.5), (1.5, 71, 0.5), (2, 74, 2)],
}
lead = Bus()
for b, name in enumerate(PROG):
    t0 = b * BAR
    if not (9 <= t0 < 14 or 20 <= t0 < 28):
        continue
    for beat, midi, length in MOTIF.get(name, []):
        lead.add(stereo(lead_note(midi, length * BEAT), -0.1), t0 + beat * BEAT)
music.buf += delay(lead.buf, 0.375, 0.25, 3)

# Accord final
fin = np.zeros((2, int(2.4 * SR)))
for c in range(2):
    acc = np.zeros(fin.shape[1])
    for m in CHORDS['Cfin']['pad']:
        for d in (-8, 0, 7):
            acc += saw(float(hz(m)) * 2 ** ((d + (3 if c else -3)) / 1200), fin.shape[1], RNG.uniform())
    fin[c] = acc * envelope(fin.shape[1], 0.05, 1.8) / 18
music.add(filt(fin, 'lowpass', 2600) * 0.6, 28.0)

# Effets sur la grille
for t0 in CUES['impact']:
    fx.add(stereo(impact(True)), t0)
for t0 in CUES['hit']:
    hitbus.add(stereo(impact(False) * 0.75), t0)
for w in CUES['whoosh']:
    fx.add(whoosh(w['d'], w['pan']) * w['gain'] * 1.4, w['t'] - w['d'] * 0.1)
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

# Mixage
kick_times = [b * BAR + k * BEAT for b in range(BARS) for k in range(4) if section_of(b * BAR + k * BEAT) in FULL]
duck = np.ones(N)
for kt in kick_times:
    s = int(kt * SR)
    t = secs(min(int(0.35 * SR), N - s))
    duck[s : s + len(t)] = np.minimum(duck[s : s + len(t)], 1 - 0.7 * np.exp(-t / 0.11))
mix = drums.buf * 0.95 + bass.buf * duck + reverb(music.buf, 0.32) * (0.55 + 0.45 * duck) + reverb(fx.buf, 0.38) * 0.95 + reverb(hitbus.buf, 0.3) * 0.8
mix = filt(mix, 'highpass', 32)
mix = shelf(mix, 110, -6.0, 'low')
mix = shelf(mix, 8500, -5.0, 'high')
mix = shelf(mix, 2800, 1.5, 'high')
rms = np.sqrt(np.convolve(np.mean(mix ** 2, axis=0), np.ones(2400) / 2400, mode='same')) + 1e-9
gain = np.convolve(np.clip(((10 ** (-17 / 20)) / rms) ** 0.35, 0.5, 1.6), np.ones(4800) / 4800, mode='same')
mix *= gain
mix *= 10 ** (-15.5 / 20) / np.sqrt(np.mean(mix ** 2))
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
mix *= 0.93 / np.max(np.abs(mix))
mix *= np.minimum(1, secs(N) / 0.03) * np.clip((DUR - secs(N)) / 1.4, 0, 1) ** 1.5

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
pcm = np.clip(mix.T, -1, 1)
wavfile.write(os.path.join(ROOT, 'out', 'music-pn.wav'), SR, (pcm * 2147483000).astype(np.int32))
print(f'music-pn.wav : {DUR:.1f} s, crête {np.max(np.abs(pcm)):.3f}, RMS {20 * np.log10(np.sqrt(np.mean(pcm ** 2))):.1f} dBFS')
