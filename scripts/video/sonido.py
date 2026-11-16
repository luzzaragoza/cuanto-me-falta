"""El sonido del video, sintetizado: la carrera suena.

Lee guion.json (los mismos tiempos que usa la imagen) y escribe un WAV estéreo.
No hay ninguna muestra ni música ajena: todo sale de senos y ruido con numpy.

  · cada materia aprobada  → una nota tipo kalimba, que sube por una pentatónica
  · burbuja de la abuela   → un "pop" grave;  respuesta → un "pop" más agudo
  · título de Analista     → un acorde corto de tres notas
  · la última materia      → silencio, y después el acorde que resuelve

Uso: python3 sonido.py guion.json salida.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
PICO_DB = -3.0

guion = json.load(open(sys.argv[1], encoding="utf-8"))
salida = sys.argv[2]
DUR = guion["dur"]
N = int(DUR * SR)
rng = np.random.default_rng(1621)  # semilla fija: el mismo guion suena siempre igual

# Do mayor pentatónica, desde el Do central.
ESCALA = [0, 2, 4, 7, 9]


def frec(grado):
    octava, paso = divmod(grado, 5)
    return 261.63 * 2 ** ((12 * octava + ESCALA[paso]) / 12)


def grado_de(n, grave=False):
    """La melodía: un zigzag que trepa despacio a medida que se llena el mapa."""
    g = int(n * 0.19) + [0, 2, 1, 3][n % 4]
    return g - 5 if grave else g


# La cuenta regresiva (las últimas 12 notas) va escrita a mano: cuatro escaleras
# que suben y un final en Mi–Re, que queda pidiendo el Do. El Do llega con el acorde.
CUENTA = [7, 8, 9, 10, 8, 9, 10, 11, 10, 11, 12, 11]


class Capa:
    """Una pista: señal seca en estéreo más lo que se manda a la reverb."""

    def __init__(self):
        self.seco = np.zeros((N, 2))
        self.envio = np.zeros(N)

    def poner(self, s, t, gan=1.0, pan=0.0, rev=0.25):
        i = int(t * SR)
        s = s[: max(0, N - i)]
        izq, der = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.seco[i : i + len(s), 0] += s * gan * izq
        self.seco[i : i + len(s), 1] += s * gan * der
        self.envio[i : i + len(s)] += s * gan * rev


def kalimba(f, largo=1.0, dur=2.2):
    t = np.arange(int(dur * SR)) / SR
    tau = 0.42 * (261.63 / f) ** 0.4 * largo  # las agudas se apagan antes
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    s += 0.16 * np.sin(2 * np.pi * 4.0 * f * t) * np.exp(-t / (tau * 0.16))
    s += 0.06 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t / (tau * 0.06))
    golpe = rng.standard_normal(len(t)) * np.exp(-t / 0.0025) * 0.05
    s += np.convolve(golpe, np.ones(24) / 24, mode="same")  # el dedo en la lengüeta
    s[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return s


def pop(f0, f1, tau, dur=0.22):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    fase = 2 * np.pi * np.cumsum(f) / SR
    # Con armónicos: un parlante de celular no reproduce el grave puro.
    s = (np.sin(fase) + 0.35 * np.sin(2 * fase) + 0.15 * np.sin(3 * fase)) * np.exp(-t / tau)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s


def colchon(dur, notas):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros(len(t))
    for f, a in notas:
        for desaf in (-0.0018, 0.0, 0.0021):  # tres voces apenas desafinadas: se mueve solo
            s += a * np.sin(2 * np.pi * f * (1 + desaf) * t + rng.uniform(0, 6.28))
    entra = np.clip(t / 0.7, 0, 1) ** 1.5
    return s * entra * (1 + 0.05 * np.sin(2 * np.pi * 0.35 * t))


antes, despues = Capa(), Capa()
corte = next((e for e in guion["sonido"] if e["tipo"] == "silencio"), None)
t_corte = corte["t"] if corte else DUR
ultimas = guion["notas"] - len(CUENTA)

for e in guion["sonido"]:
    t, tipo = e["t"], e["tipo"]
    capa = antes if t < t_corte else despues
    if tipo == "nota":
        n = e["n"]
        g = CUENTA[n - ultimas] if n >= ultimas else grado_de(n, e.get("grave", False))
        fuerza = 0.62 + 0.1 * ((n * 7) % 5) / 4
        if e.get("grave"):
            fuerza *= 0.8
        capa.poner(kalimba(frec(g), 1.5 if e.get("grave") else 1.0), t, fuerza, pan=0.45 * np.sin(n * 1.7), rev=0.45 if e.get("grave") else 0.28)
    elif tipo == "marca":  # final pendiente o cursando: casi nada
        capa.poner(pop(150, 120, 0.03), t, 0.1, rev=0.2)
    elif tipo == "pop_abu":
        capa.poner(pop(290, 205, 0.05), t, 0.5, pan=-0.3, rev=0.12)
    elif tipo == "pop_yo":
        capa.poner(pop(520, 690, 0.04), t, 0.4, pan=0.3, rev=0.12)
    elif tipo == "toque":
        capa.poner(pop(700, 620, 0.012, 0.08), t, 0.14, rev=0.0)
    elif tipo == "acorde_analista":  # Do–Mi–Sol, rasgueado
        for i, g in enumerate([5, 7, 8]):
            capa.poner(kalimba(frec(g), 1.4), t + i * 0.04, 0.6, pan=-0.3 + 0.3 * i, rev=0.4)
        capa.poner(kalimba(frec(0), 1.4), t, 0.4, rev=0.4)
    elif tipo == "acorde_final":  # Do mayor abierto, sostenido, con un colchón debajo
        for i, g in enumerate([0, 3, 5, 7, 8, 10]):
            capa.poner(kalimba(frec(g), 2.6, 5.0), t + i * 0.055, 0.55, pan=-0.5 + 0.2 * i, rev=0.5)
        pad = colchon(e["hasta"] - t, [(130.81, 0.4), (196.0, 0.35), (261.63, 0.38), (329.63, 0.3), (392.0, 0.22), (523.25, 0.1)])
        capa.poner(pad, t, 0.11, rev=0.5)


def reverb(x):
    """Sala chica y oscura: ruido que se apaga, pasado por un filtro suave."""
    largo = int(1.6 * SR)
    t = np.arange(largo) / SR
    canales = []
    for _ in range(2):
        ir = rng.standard_normal(largo) * np.exp(-t / 0.24)
        ir[: int(0.012 * SR)] = 0  # un instante de aire antes de la sala
        ir = np.convolve(ir, np.ones(10) / 10, mode="same")
        ir /= np.sqrt(np.sum(ir**2))
        m = len(x) + largo
        canales.append(np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)])
    return np.stack(canales, axis=1)


def mezclar(capa):
    return capa.seco + 0.5 * reverb(capa.envio)


a, d = mezclar(antes), mezclar(despues)
if corte:  # silencio total: lo anterior se apaga en 60 ms y no vuelve
    i0, i1 = int(t_corte * SR), int((t_corte + 0.06) * SR)
    a[i0:i1] *= np.linspace(1, 0, i1 - i0)[:, None]
    a[i1:] = 0
mix = a + d

# El acorde se apaga al final.
cola = int(1.3 * SR)
mix[-cola:] *= (np.linspace(1, 0, cola) ** 1.6)[:, None]

mix *= 10 ** (PICO_DB / 20) / np.max(np.abs(mix))
with wave.open(salida, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())


def db(x):
    return 20 * np.log10(max(float(x), 1e-9))


def rms(t0, t1):
    return db(np.sqrt(np.mean(mix[int(t0 * SR) : int(t1 * SR)] ** 2)))


print(f"✓ sonido: {DUR:.1f} s · pico {db(np.max(np.abs(mix))):.1f} dB")
if corte:
    print(f"  silencio {t_corte + 0.06:.2f}–{corte['hasta']:.2f} s: {rms(t_corte + 0.06, corte['hasta']):.0f} dB")
for nombre, t0, t1 in [("momento 1", 2.5, 6.5), ("momento 3", 10.5, 15), ("momento 5", 20, 24.5), ("acorde final", 26.4, 28), ("cierre", 28, DUR)]:
    print(f"  {nombre}: {rms(t0, t1):.1f} dB RMS")
