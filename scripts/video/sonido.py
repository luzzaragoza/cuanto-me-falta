"""El sonido del video, sintetizado: la carrera suena.

Lee guion.json (los mismos tiempos que usa la imagen) y escribe un WAV estéreo.
No hay ninguna muestra ni música ajena: todo sale de senos y ruido con numpy.

Tiene dos capas:

  LO QUE PASA EN PANTALLA
  · cada materia aprobada → una nota tipo kalimba, que sube por una pentatónica
  · burbuja de la abuela  → un "pop" grave;  respuesta → un "pop" más agudo
  · título de Analista    → un acorde corto de tres notas

  LA MÚSICA QUE CUENTA LA HISTORIA (un colchón de cuerdas por debajo)
  · 1° y 2° año   Do, luego Fa: tranquilo, va creciendo
  · 3° año        La menor, oscuro y casi vacío: el año que costó
  · 4° año        Fa → Do en el título → Sol suspendido: vuelve la esperanza
  · 5° año        Sol suspendido con un pulso que crece: la tensión de "ya casi"
  · la última     el pulso se frena, queda una nota aguda colgada… y silencio
  · "Ya no te falta nada"
                  la resolución: Do mayor con todo, y después Do–Sol–La m–Fa–Do,
                  un compás por cada cosa que aparece hasta el cierre

En armonía, Sol suspendido "pide" volver a Do. Sostenerlo todo 5° año y cortarlo
con un silencio es lo que hace que el acorde final se sienta como llegar.

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
M = guion["marcas"]
N = int(DUR * SR)
rng = np.random.default_rng(1621)  # semilla fija: el mismo guion suena siempre igual

# ── Notas ────────────────────────────────────────────────────────────────────
SEMITONO = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
ESCALA = [0, 2, 4, 7, 9]  # Do mayor pentatónica


def hz(nombre):
    """'C4' → 261,63 Hz (notación inglesa: C = Do, A = La)."""
    return 261.63 * 2 ** ((SEMITONO[nombre[0]] + 12 * (int(nombre[1:]) - 4)) / 12)


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


# ── Instrumentos ─────────────────────────────────────────────────────────────
class Capa:
    """Una pista: señal seca en estéreo más lo que se manda a la reverb."""

    def __init__(self):
        self.seco = np.zeros((N, 2))
        self.envio = np.zeros((N, 2))

    def poner(self, s, t, gan=1.0, pan=0.0, rev=0.25):
        i = int(t * SR)
        if i >= N:
            return
        s = s[: N - i]
        if s.ndim == 1:  # mono: se ubica con el paneo
            izq, der = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            s = np.stack([s * izq, s * der], axis=1)
        self.seco[i : i + len(s)] += s * gan
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


def campana(f, dur=3.0):
    """Para la melodía del final: más larga y más brillante que la kalimba."""
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9)
    s += 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.5)
    s += 0.18 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.25)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s


def pop(f0, f1, tau, dur=0.22):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    fase = 2 * np.pi * np.cumsum(f) / SR
    # Con armónicos: un parlante de celular no reproduce el grave puro.
    s = (np.sin(fase) + 0.35 * np.sin(2 * fase) + 0.15 * np.sin(3 * fase)) * np.exp(-t / tau)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s


def cuerdas(notas, dur, ataque=1.0, suelta=1.4, oscuro=1.5, curva=None):
    """El colchón: cada nota son tres voces apenas desafinadas, con armónicos.

    `oscuro` más alto = menos brillo. `curva(t)` permite que crezca o se apague.
    """
    n = int((dur + suelta) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for nombre in notas:
        f = hz(nombre)
        for desaf, pan in ((-0.003, -0.6), (0.0, 0.0), (0.0035, 0.6)):
            s = np.zeros(n)
            k = 1
            while k * f < 5200 and k <= 7:
                s += np.sin(2 * np.pi * k * f * (1 + desaf) * t + rng.uniform(0, 6.28)) / k**oscuro
                k += 1
            out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    env = np.clip(t / ataque, 0, 1) ** 1.5 * np.clip((dur + suelta - t) / suelta, 0, 1) ** 1.5
    env *= 1 + 0.06 * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 6.28))
    if curva is not None:
        env *= curva(t)
    return out * env[:, None] / np.sqrt(len(notas))


def bajo(nombre, dur):
    t = np.arange(int(dur * SR)) / SR
    f = hz(nombre)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) + 0.25 * np.sin(2 * np.pi * 3 * f * t)
    return s * np.clip(t / 0.04, 0, 1) * np.exp(-t / (dur * 0.6)) * np.clip((dur - t) / 0.3, 0, 1)


def aire(dur, f_min, f_max, forma):
    """Ruido filtrado: el "shhh" de un platillo suave o de algo que se acerca."""
    n = int(dur * SR)
    espectro = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    espectro[(f < f_min) | (f > f_max)] = 0
    s = np.fft.irfft(espectro, n)
    return s / np.max(np.abs(s)) * forma(np.arange(n) / SR)


def bandas(n):
    """Ruido partido en cuatro franjas, de grave a aguda, para armar un whoosh."""
    espectro = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    cortes = [(250, 600), (600, 1400), (1400, 3200), (3200, 8000)]
    out = []
    for lo, hi in cortes:
        e = espectro.copy()
        e[(f < lo) | (f > hi)] = 0
        b = np.fft.irfft(e, n)
        out.append(b / np.max(np.abs(b)))
    return out


def whoosh(dur=0.5, sube=True):
    """Aire que pasa: el ruido "barre" de grave a agudo (o al revés) mientras crece y se va."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    pos = (t / dur if sube else 1 - t / dur) * 3  # por cuál de las cuatro franjas va
    s = np.zeros(n)
    for i, b in enumerate(bandas(n)):
        s += b * np.exp(-((pos - i) ** 2) / 0.6)
    return s * np.sin(np.pi * t / dur) ** 2


def tambor(f0=150, f1=60, tau=0.22, dur=0.9):
    """Un golpe grave. Los armónicos están para que se oiga en un celular."""
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    fase = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(fase) + 0.5 * np.sin(2 * fase) + 0.3 * np.sin(3 * fase) + 0.15 * np.sin(5 * fase)) * np.exp(-t / tau)
    chas = rng.standard_normal(len(t)) * np.exp(-t / 0.012)
    s += 0.35 * np.convolve(chas, np.ones(16) / 16, mode="same")
    s[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return s


def tic(f):
    t = np.arange(int(0.06 * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2.7 * f * t)) * np.exp(-t / 0.007)


antes, despues = Capa(), Capa()  # antes y después del silencio
t_corte = M["corte"] + 0.12

# ── 1. Lo que pasa en pantalla ───────────────────────────────────────────────
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
        capa.poner(kalimba(frec(g), 1.6 if e.get("grave") else 1.0), t, fuerza, pan=0.45 * np.sin(n * 1.7), rev=0.5 if e.get("grave") else 0.28)
    elif tipo == "cursa":  # se anota en una materia: un punteo suave que va subiendo
        capa.poner(kalimba(frec(e["i"]) / 2, 0.32) + 0.4 * kalimba(frec(e["i"]), 0.25), t, 0.2, pan=-0.4 + 0.07 * e["i"], rev=0.35)
    elif tipo == "marca":  # final pendiente o cursando: casi nada
        capa.poner(pop(150, 120, 0.03), t, 0.1, rev=0.2)
    elif tipo == "pop_abu":  # en el cierre suenan sobre la música: van más fuertes
        capa.poner(pop(290, 205, 0.05), t, 0.5 * (1.7 if capa is despues else 1), pan=-0.3, rev=0.12)
    elif tipo == "pop_yo":
        capa.poner(pop(520, 690, 0.04), t, 0.4 * (1.7 if capa is despues else 1), pan=0.3, rev=0.12)
    elif tipo == "toque":
        capa.poner(pop(700, 620, 0.012, 0.08), t, 0.16, rev=0.0)
    elif tipo == "acorde_analista":  # Do–Mi–Sol, rasgueado, con una campana arriba
        for i, g in enumerate([5, 7, 8]):
            capa.poner(kalimba(frec(g), 1.6), t + i * 0.05, 0.62, pan=-0.3 + 0.3 * i, rev=0.45)
        capa.poner(kalimba(frec(0), 1.6), t, 0.42, rev=0.4)
        capa.poner(campana(hz("C6")), t + 0.15, 0.16, rev=0.6)
    elif tipo == "trabada":  # una materia trabada: nota sorda, cada una más abajo
        capa.poner(kalimba(hz(["A4", "G4", "E4"][e["i"]]), 0.4), t, 0.34, pan=-0.3 + 0.3 * e["i"], rev=0.45)
    elif tipo == "escalera":  # una corrida hacia arriba que desemboca en el acorde
        for i, g in enumerate([2, 3, 4, 5, 7, 8]):
            capa.poner(kalimba(frec(g), 0.5), t + i * 0.05, 0.22 + 0.05 * i, pan=-0.5 + 0.2 * i, rev=0.3)
    elif tipo == "destello":  # brillo: campanitas y un platillo chico
        for i, nota in enumerate(["G6", "C7", "E7"]):
            capa.poner(campana(hz(nota), 1.6), t + 0.08 + i * 0.07, 0.1, pan=-0.3 + 0.3 * i, rev=0.7)
        capa.poner(aire(1.4, 4000, 11000, lambda t: np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.35)), t, 0.07, rev=0.4)
        capa.poner(tambor(140, 70, 0.14), t, 0.3, rev=0.15)
    elif tipo == "impacto":  # cada golpe de la cuenta regresiva
        capa.poner(tambor(165, 62, 0.2), t, 0.5 * e["fuerza"], rev=0.25)
        capa.poner(aire(0.5, 1800, 7000, lambda t: np.exp(-t / 0.08)), t, 0.06 * e["fuerza"], rev=0.3)
    elif tipo == "latido":  # dos golpes: pum-pum
        capa.poner(tambor(95, 52, 0.09, 0.4), t, 0.42, rev=0.05)
        capa.poner(tambor(110, 60, 0.07, 0.4), t + 0.17, 0.3, rev=0.05)
    elif tipo == "reloj":
        capa.poner(tic(2300 if round(t * 2) % 2 == 0 else 1750), t, 0.07, pan=0.25, rev=0.35)
    elif tipo == "whoosh":
        capa.poner(whoosh(0.55 if e["sube"] else 0.75, e["sube"]), t, 0.1 * e["fuerza"], pan=0.0, rev=0.25)
    elif tipo == "inversa":  # aire que se junta antes del golpe
        d = e["dur"]
        capa.poner(aire(d, 1500, 10000, lambda t: (t / d) ** 3), t, 0.2, rev=0.1)
        capa.poner(cuerdas(["G4", "D5", "G5"], d - 0.02, d * 0.95, 0.02, 1.5), t, 0.08, rev=0.1)
    elif tipo == "boom":  # el golpe de la revelación
        capa.poner(tambor(110, 42, 0.55, 2.2), t, 0.85, rev=0.3)
        capa.poner(aire(0.6, 300, 6000, lambda t: np.exp(-t / 0.07)), t, 0.22, rev=0.3)
        for lado in (-0.7, 0.7):  # los cañones de papel picado
            capa.poner(aire(0.4, 900, 9000, lambda t: np.exp(-t / 0.035)), t + 0.02 + 0.03 * (lado > 0), 0.2, pan=lado, rev=0.3)

# ── 2. La música que cuenta la historia ──────────────────────────────────────
# El colchón de cada parte: (desde, hasta, notas, volumen, oscuro, ataque)
COLCHON = [
    (0, M["m1"], ["C3", "G3", "D4"], 0.045, 1.7, 1.6),  # apenas: recién empieza
    (M["m1"], M["dic1"], ["C3", "G3", "D4", "G4"], 0.05, 1.6, 0.8),  # marzo: suspendido, a la espera
    (M["dic1"], M["m2"], ["C3", "G3", "E4", "G4"], 0.06, 1.6, 0.8),  # diciembre: se resuelve
    (M["m2"], M["dic2"], ["F3", "C4", "G4"], 0.055, 1.6, 0.8),
    (M["dic2"], M["m3"], ["F3", "C4", "G4", "A4"], 0.07, 1.6, 0.8),
    (M["m3"], M["dic3"], ["A2", "E3", "B3", "E4"], 0.06, 1.8, 0.9),
    (M["dic3"], M["nudo"], ["A2", "E3", "A3", "C4", "E4"], 0.085, 1.9, 1.4),  # La menor
    (M["nudo"], M["feb"], ["D3", "A3", "D4", "F4"], 0.075, 1.8, 0.8),  # Re menor: el nudo
    (M["feb"], M["m4"], ["G3", "C4", "E4", "G4"], 0.08, 1.5, 0.4),  # rindió: aire
    (M["m4"], M["dic4"], ["F3", "C4", "G4", "A4"], 0.065, 1.6, 0.8),
    (M["dic4"], M["analista"], ["F3", "C4", "F4", "A4"], 0.07, 1.6, 0.6),
    (M["analista"], M["vuelta"], ["C3", "G3", "E4", "G4", "C5"], 0.1, 1.5, 0.3),
    (M["vuelta"], M["m5"], ["G3", "D4", "G4", "A4", "D5"], 0.075, 1.5, 0.8),  # Sol sus
    (M["m5"], M["cuenta"], ["G3", "D4", "A4"], 0.065, 1.5, 0.6),
]
for t0, t1, notas, vol, oscuro, ataque in COLCHON:
    antes.poner(cuerdas(notas, t1 - t0, ataque, 1.3, oscuro), t0, vol, rev=0.5)

# 5° año: Sol suspendido que crece sin parar, con un pulso debajo.
d5 = M["m6"] - M["cuenta"]
antes.poner(cuerdas(["G3", "C4", "D4", "G4", "D5"], d5, 1.0, 0.25, 1.35, curva=lambda t: 0.3 + 0.7 * np.clip(t / d5, 0, 1) ** 1.6), M["cuenta"], 0.2, rev=0.5)
PULSO = 0.3
i = 0
t = M["cuenta"] + 0.3
while t < M["m6"] - 0.05:
    avance = (t - M["cuenta"]) / d5
    f = hz("G3") if i % 2 == 0 else hz("D4")
    fuerza = (0.07 + 0.3 * avance**1.4) * (1.0 if i % 4 == 0 else 0.7)
    antes.poner(kalimba(f, 0.3) + 0.5 * kalimba(2 * f, 0.25), t, fuerza, pan=0.2 * (-1) ** i, rev=0.2)
    t += PULSO
    i += 1
# El "1" se queda en pantalla: algo se acerca.
d_sube = M["m6"] - M["uno"]
antes.poner(aire(d_sube, 1500, 9000, lambda t: (t / d_sube) ** 2.5), M["uno"], 0.11, rev=0.3)

# La última materia: todo se frena. Una nota aguda colgada y el pulso a la mitad,
# cada vez más bajito, como quien contiene la respiración.
d6 = t_corte - M["m6"]
antes.poner(cuerdas(["G5", "D6"], d6, 0.2, 0.1, 1.8, curva=lambda t: 1 + 0.25 * np.sin(2 * np.pi * 5.5 * t)), M["m6"], 0.05, rev=0.6)
antes.poner(cuerdas(["G3", "D4"], d6, 0.3, 0.1, 1.6), M["m6"], 0.05, rev=0.4)
t, i = M["m6"] + 0.3, 0
while t < M["corte"] - 0.2:
    antes.poner(kalimba(hz("G3"), 0.35) + 0.5 * kalimba(hz("G4"), 0.3), t, 0.2 * 0.8**i, rev=0.3)
    t += PULSO * 2
    i += 1

# ── 3. La resolución ─────────────────────────────────────────────────────────
R, B = M["revelacion"], M["compas"]
TIEMPO = B / 4  # cuatro tiempos por compás
# Los acordes: (bajo, cuerdas, notas del arpegio)
DO = ("C2", ["C3", "G3", "C4", "E4", "G4", "C5", "E5"], ["C4", "G4", "C5", "E5", "G5"])
SOL_SI = ("B2", ["B2", "G3", "D4", "G4", "B4", "D5"], ["B3", "G4", "B4", "D5", "G5"])
LA_M = ("A2", ["A2", "E3", "A3", "C4", "E4", "A4"], ["A3", "E4", "A4", "C5", "E5"])
FA = ("F2", ["F3", "C4", "F4", "A4", "C5"], ["F3", "C4", "F4", "A4", "C5"])
SOL = ("G2", ["G2", "D3", "G3", "B3", "D4", "G4"], ["G3", "D4", "G4", "B4", "D5"])
# Un compás por renglón: acorde, melodía (tiempo, nota), fuerza y batería.
#   Do–Sol–La m–Fa dos veces (la vuelta olímpica) y Fa–Sol–Do para el cierre.
PARTITURA = [
    (DO, [(0, "E5"), (1, "G5"), (2, "C6")], 1.0, 1.0),  # Ya no te falta nada
    (SOL_SI, [(0, "D6"), (2, "B5"), (3, "G5")], 0.9, 0.9),  # …
    (LA_M, [(0, "C6"), (2, "A5"), (3, "E5")], 0.85, 0.9),  # el título de Ingeniero
    (FA, [(0, "A5"), (2, "C6"), (3, "D6")], 0.85, 0.9),  # el árbol entero, aprobado
    (DO, [(0, "E6"), (2, "C6"), (3, "G5")], 0.9, 0.9),  # …
    (SOL_SI, [(0, "D6"), (2, "B5"), (3, "D6")], 0.85, 0.85),  # las notas y el promedio
    (LA_M, [(0, "C6"), (2, "A5"), (3, "E5")], 0.8, 0.8),  # …
    (FA, [(0, "A5"), (2, "F5")], 0.5, 0.3),  # ¿Y? ¿Cuánto te falta?
    (SOL, [(0, "B5"), (2, "D6")], 0.58, 0.4),  # Nada, abu. Me recibí.
    (DO, [(0, "C6"), (1, "E6"), (2, "G6")], 0.8, 0.0),  # cuantomefalta.app
]
COMPASES = [(ac[0], ac[1], ac[2], mel, fuerza) for ac, mel, fuerza, _ in PARTITURA]
BATERIA = [b for *_, b in PARTITURA]
FIN = R + (len(COMPASES) - 1) * B  # donde cae el último acorde
ORDEN = [0, 1, 2, 3, 4, 3, 2, 1]  # el arpegio sube y baja, en corcheas
for c, (nb, notas, arp, melodia, fuerza) in enumerate(COMPASES):
    t0 = R + c * B
    ultimo = c == len(COMPASES) - 1
    largo = DUR - t0 if ultimo else B
    despues.poner(cuerdas(notas, largo, 0.12 if c == 0 else 0.5, 1.2, 1.45), t0, 0.21 * fuerza, rev=0.55)
    for octava in (0, 1):  # el bajo doblado una octava arriba: se oye en un celular
        despues.poner(bajo(nb[0] + str(int(nb[1]) + octava), largo), t0, (0.34 if octava == 0 else 0.2) * fuerza, rev=0.1)
    if ultimo:  # el último compás no corre: un rasgueo y se queda
        for i, nota in enumerate(arp):
            despues.poner(kalimba(hz(nota), 2.6, 4.5), t0 + i * 0.07, 0.5 * fuerza, pan=-0.4 + 0.2 * i, rev=0.5)
    else:
        for i, j in enumerate(ORDEN):
            acento = 1.0 if i % 4 == 0 else 0.72
            despues.poner(kalimba(hz(arp[j]), 1.3), t0 + i * TIEMPO / 2, 0.42 * fuerza * acento, pan=0.5 * np.sin(i * 1.3), rev=0.35)
    for tiempo, nota in melodia:
        despues.poner(campana(hz(nota)), t0 + tiempo * TIEMPO, 0.3 * fuerza, pan=0.15, rev=0.6)
        despues.poner(campana(hz(nota) / 2), t0 + tiempo * TIEMPO, 0.16 * fuerza, pan=-0.15, rev=0.5)

# Batería: bombo en cada tiempo y un shaker en el medio. Fuerte en la revelación y
# en el título; en el cierre baja para dejar hablar a las burbujas.
for c, nivel in enumerate(BATERIA):
    for tiempo in range(4):
        t0 = R + c * B + tiempo * TIEMPO
        if nivel and not (c == 0 and tiempo == 0):  # el primer golpe ya es el boom
            despues.poner(tambor(125, 50, 0.16, 0.6), t0, 0.42 * nivel * (1.0 if tiempo % 2 == 0 else 0.8), rev=0.12)
        for medio in (0, 0.5):
            fuerza = 0.035 * nivel * (0.6 if medio == 0 else 1.0)
            if fuerza:
                despues.poner(aire(0.09, 5000, 12000, lambda t: np.exp(-t / 0.02)), t0 + medio * TIEMPO, fuerza, pan=0.3, rev=0.2)
# Un redoble corto que empuja hacia el título y otro hacia el último acorde.
for c in (1, len(COMPASES) - 1):
    for i in range(4):
        despues.poner(tambor(180 + 25 * i, 90, 0.08, 0.3), R + c * B - (4 - i) * 0.075, 0.16 + 0.05 * i, pan=-0.3 + 0.2 * i, rev=0.2)
despues.poner(tambor(110, 45, 0.4, 1.6), FIN, 0.5, rev=0.3)
despues.poner(aire(2.6, 3500, 11000, lambda t: np.clip(t / 0.05, 0, 1) * np.exp(-t / 0.7)), FIN, 0.07, rev=0.5)

# El golpe de la revelación: rasgueo de Do abierto, un brillo que sube y un platillo suave.
for i, g in enumerate([0, 3, 5, 7, 8, 10]):
    despues.poner(kalimba(frec(g), 2.6, 5.0), R + i * 0.045, 0.6, pan=-0.5 + 0.2 * i, rev=0.5)
for i, nota in enumerate(["C6", "E6", "G6", "C7", "E7"]):
    despues.poner(campana(hz(nota), 2.5), R + 0.25 + i * 0.085, 0.13, pan=-0.4 + 0.2 * i, rev=0.7)
despues.poner(aire(3.2, 3500, 11000, lambda t: np.clip(t / 0.05, 0, 1) * np.exp(-t / 0.8)), R, 0.12, rev=0.5)
# Y un último destello, ya con la dirección de la app en pantalla.
for i, nota in enumerate(["G6", "C7"]):
    despues.poner(campana(hz(nota), 2.5), FIN + 1.8 + i * 0.3, 0.1, rev=0.7)


# ── Mezcla ───────────────────────────────────────────────────────────────────
def reverb(x):
    """Sala chica y oscura: ruido que se apaga, pasado por un filtro suave."""
    largo = int(1.8 * SR)
    t = np.arange(largo) / SR
    canales = []
    for c in range(2):
        ir = rng.standard_normal(largo) * np.exp(-t / 0.27)
        ir[: int(0.012 * SR)] = 0  # un instante de aire antes de la sala
        ir = np.convolve(ir, np.ones(10) / 10, mode="same")
        ir /= np.sqrt(np.sum(ir**2))
        m = len(x) + largo
        canales.append(np.fft.irfft(np.fft.rfft(x[:, c], m) * np.fft.rfft(ir, m), m)[: len(x)])
    return np.stack(canales, axis=1)


def mezclar(capa):
    return capa.seco + 0.5 * reverb(capa.envio)


a, d = mezclar(antes), mezclar(despues)
# Silencio total: lo anterior se apaga en 60 ms y no vuelve.
i0, i1 = int(t_corte * SR), int((t_corte + 0.06) * SR)
a[i0:i1] *= np.linspace(1, 0, i1 - i0)[:, None]
a[i1:] = 0
mix = a + d

# El acorde se apaga al final.
cola = int(2.0 * SR)
mix[-cola:] *= (np.linspace(1, 0, cola) ** 1.5)[:, None]

# Limitador suave: redondea los picos del final para que el resto no quede bajo.
mix /= np.percentile(np.abs(mix), 99.9)
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
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
print(f"  silencio {t_corte + 0.06:.2f}–{R:.2f} s: {rms(t_corte + 0.06, R):.0f} dB")
partes = [("1° año", M["m1"], M["m2"]), ("3° año", M["dic3"], M["nudo"]), ("el nudo", M["nudo"], M["feb"]), ("cuenta regresiva", M["cuenta"], M["m6"]), ("la última", M["m6"], t_corte), ("revelación", R, R + B), ("vuelta olímpica", R + 2 * B, M["cierre"]), ("cierre", M["cierre"], FIN), ("final", FIN, DUR)]
for nombre, t0, t1 in partes:
    print(f"  {nombre}: {rms(t0, t1):.1f} dB RMS")
