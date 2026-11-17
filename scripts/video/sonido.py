"""El sonido del video, sintetizado. Nada de muestras ni música ajena: todo sale
de senos y ruido con numpy.

La idea: una base tranquila y moderna (bombo, caja, platillos cortos, bajo y un
piano eléctrico) que va a 100 pulsos por minuto, el mismo pulso sobre el que
está montada la imagen. Cada materia aprobada es una nota punteada que cae justo
en una corchea, así que la carrera "toca" encima de la base.

Cómo acompaña a la historia, compás por compás (ver PLAN más abajo):

  · 1° año        entra de a poco: primero solo teclas, después el pulso
  · 2° año        la base completa
  · 3° año        la base se apaga. Quedan un acorde menor y un reloj
  · febrero       casi nada: un bajo cada tanto
  · 4° año        vuelve la base; un acento en el título de Analista
  · 5° año        bombo en cada tiempo y un redoble que crece: "ya casi"
  · la última     se corta todo. Latidos. Silencio
  · la revelación la base vuelve entera, más fuerte, con melodía
  · la libreta    solo el piano eléctrico, despacio, y el lápiz

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

B = M["compas"]  # un compás
Q = B / 4  # un tiempo
S = B / 16  # una semicorchea
R = M["revelacion"]
COMPASES = round(DUR / B)


def T(compas, paso=0):
    """El instante de un compás y de una de sus 16 semicorcheas."""
    return compas * B + paso * S


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
    """La melodía de las materias: un zigzag que trepa a medida que se llena el mapa."""
    g = int(n * 0.19) + [0, 2, 1, 3][n % 4]
    return g - 5 if grave else g


# La cuenta regresiva (las últimas 12 notas) va escrita a mano: cuatro escaleras
# que suben y un final en Mi–Re, que queda pidiendo el Do. El Do llega con el golpe.
CUENTA = [7, 8, 9, 10, 8, 9, 10, 11, 10, 11, 12, 11]

# Los acordes: el bajo y las notas del piano eléctrico (con séptimas: más aire).
ACORDES = {
    "C": ("C2", ["E3", "G3", "B3", "E4"]),
    "Am": ("A2", ["G3", "C4", "E4", "G4"]),
    "F": ("F2", ["A3", "C4", "E4", "A4"]),
    "G": ("G2", ["B3", "D4", "E4", "G4"]),
    "G/B": ("B2", ["D4", "G4", "B4"]),
    "Dm": ("D3", ["F3", "A3", "C4", "E4"]),
    "Gsus": ("G2", ["C4", "D4", "G4", "A4"]),
}


# ── La mesa de mezcla ────────────────────────────────────────────────────────
class Capa:
    """Una pista: señal seca en estéreo más lo que se manda a la reverb."""

    def __init__(self):
        self.seco = np.zeros((N, 2))
        self.envio = np.zeros((N, 2))

    def poner(self, s, t, gan=1.0, pan=0.0, rev=0.15):
        i = int(round(t * SR))
        if i >= N or i < 0:
            return
        s = s[: N - i]
        if s.ndim == 1:  # mono: se ubica con el paneo
            izq, der = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            s = np.stack([s * izq, s * der], axis=1)
        self.seco[i : i + len(s)] += s * gan
        self.envio[i : i + len(s)] += s * gan * rev


def tiempo(dur):
    return np.arange(int(dur * SR)) / SR


def ruido(dur, f_min, f_max):
    """Ruido blanco al que se le deja solo una franja de frecuencias."""
    n = int(dur * SR)
    espectro = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    espectro[(f < f_min) | (f > f_max)] = 0
    s = np.fft.irfft(espectro, n)
    return s / np.max(np.abs(s))


def suavizar_inicio(s, ms=3):
    n = int(ms / 1000 * SR)
    s[:n] *= np.linspace(0, 1, n)
    return s


# ── La batería ───────────────────────────────────────────────────────────────
def hacer_bombo(f0=140, f1=46, tau=0.17, dur=0.5):
    """Grave, pero con armónicos: un parlante de celular no reproduce los 46 Hz."""
    t = tiempo(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    fase = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(fase) + 0.45 * np.sin(2 * fase) + 0.25 * np.sin(3 * fase) + 0.12 * np.sin(5 * fase)) * np.exp(-t / tau)
    s += 0.3 * ruido(dur, 1500, 6000) * np.exp(-t / 0.006)
    return suavizar_inicio(np.tanh(1.4 * s), 1.5)


def hacer_caja():
    t = tiempo(0.3)
    cuerpo = np.sin(2 * np.pi * 195 * t) * np.exp(-t / 0.045)
    return suavizar_inicio(0.55 * cuerpo + ruido(0.3, 1400, 8500) * np.exp(-t / 0.075), 1)


def hacer_palmas():
    t = tiempo(0.35)
    env = sum(np.where(t >= d, np.exp(-(t - d) / 0.012), 0) for d in (0, 0.011, 0.023)) * 0.6 + np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.09), 0)
    return ruido(0.35, 900, 5000) * env


def hacer_platillo(abierto=False):
    dur = 0.4 if abierto else 0.08
    t = tiempo(dur)
    return ruido(dur, 6500, 14000) * np.exp(-t / (0.11 if abierto else 0.02))


BOMBO, CAJA, PALMAS = hacer_bombo(), hacer_caja(), hacer_palmas()
PLATILLO, PLATILLO_ABIERTO = hacer_platillo(), hacer_platillo(True)


# ── Los instrumentos con nota ────────────────────────────────────────────────
def teclas(f, dur=2.6):
    """Piano eléctrico: un seno modulado por otro (FM). Cálido, sin campanilleo."""
    t = tiempo(dur)
    indice = 1.3 * np.exp(-t / 0.3) + 0.2
    s = np.sin(2 * np.pi * f * t + indice * np.sin(2 * np.pi * f * t)) * np.exp(-t / 1.3)
    s *= 1 + 0.06 * np.sin(2 * np.pi * 4.5 * t)  # un vibrato de volumen muy leve
    return suavizar_inicio(s, 6) * np.clip((dur - t) / 0.15, 0, 1)


def punteo(f, brillo=1.0, dur=0.9):
    """Una nota punteada: los armónicos agudos se apagan primero (suena a cuerda, no a campana)."""
    t = tiempo(dur)
    s = np.zeros(len(t))
    k = 1
    while k * f < 7000 and k <= 14:
        s += np.sin(2 * np.pi * k * f * t) / k * np.exp(-t * (2.6 + k * 2.8 / brillo))
        k += 1
    return suavizar_inicio(s, 2)


def bajo(f, dur):
    t = tiempo(dur)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) + 0.28 * np.sin(2 * np.pi * 3 * f * t) + 0.1 * np.sin(2 * np.pi * 4 * f * t)
    env = np.clip(t / 0.012, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.25)) * np.clip((dur - t) / 0.06, 0, 1)
    return np.tanh(1.3 * s * env)


def colchon(notas, dur, ataque=0.6, suelta=0.6, curva=None):
    """Un fondo de cuerdas sintéticas: tres voces apenas desafinadas por nota."""
    n = int((dur + suelta) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for nombre in notas:
        f = hz(nombre)
        for desaf, pan in ((-0.004, -0.7), (0.0, 0.0), (0.0045, 0.7)):
            s = np.zeros(n)
            k = 1
            while k * f < 4200 and k <= 6:
                s += np.sin(2 * np.pi * k * f * (1 + desaf) * t + rng.uniform(0, 6.28)) / k**1.4
                k += 1
            out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    env = np.clip(t / ataque, 0, 1) ** 1.5 * np.clip((dur + suelta - t) / suelta, 0, 1) ** 1.5
    if curva is not None:
        env = env * curva(t)
    return out * env[:, None] / np.sqrt(len(notas))


# ── Los efectos ──────────────────────────────────────────────────────────────
def toquecito(f0, f1, tau=0.03, dur=0.12):
    t = tiempo(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.02)
    fase = 2 * np.pi * np.cumsum(f) / SR
    return suavizar_inicio((np.sin(fase) + 0.3 * np.sin(2 * fase)) * np.exp(-t / tau), 2)


def aire(dur=0.5):
    """Un cambio de plano: ruido grave que pasa. Corto y discreto."""
    t = tiempo(dur)
    return ruido(dur, 300, 2400) * np.sin(np.pi * t / dur) ** 2


def lapiz(largo=False):
    """El lápiz sobre el papel: trazos cortos de ruido, con el raspado adentro."""
    trazos = [0.34, 0.3] if largo else [0.13, 0.1, 0.16]
    partes = []
    for d in trazos:
        t = tiempo(d)
        raspa = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(38, 60) * t) ** 2
        partes.append(ruido(d, 1800, 7000) * np.sin(np.pi * t / d) ** 0.6 * raspa)
        partes.append(np.zeros(int(rng.uniform(0.03, 0.06) * SR)))
    return np.concatenate(partes)


antes, despues = Capa(), Capa()  # antes y después del silencio
t_corte = M["corte"] + 0.12


def capa_de(t):
    return antes if t < t_corte else despues


# ── 1. El plan: qué suena en cada compás ─────────────────────────────────────
# bateria:  None · "plato" (solo platillos) · "suave" · "base" · "cuatro" (bombo
#           en los cuatro tiempos) · "fuerte" (la de la revelación)
def compas(acorde, bateria=None, bajo_=0.0, teclas_=0.2, lento=False):
    return dict(acorde=acorde, bateria=bateria, bajo=bajo_, teclas=teclas_, lento=lento)


PLAN = {}
VUELTA = ["C", "Am", "F", "G"]
for c in range(0, 2):  #          la pregunta: solo teclas
    PLAN[c] = compas(VUELTA[c % 4])
PLAN[2] = compas("F", "plato")  #  marzo de 1°
for c in range(3, 6):  #          diciembre de 1°: entra el pulso
    PLAN[c] = compas(VUELTA[c % 4], "suave", 0.5 if c > 3 else 0.0)
PLAN[6] = compas("F", "plato", 0.4)  # marzo de 2°
for c in range(7, 10):  #         diciembre de 2°: la base completa
    PLAN[c] = compas(VUELTA[c % 4], "base", 0.6)
PLAN[10] = compas("F", "plato", 0.0)  # marzo de 3°: algo se apaga
for c, ac in zip(range(11, 15), ["Am", "Am", "Dm", "Dm"]):  # 3° año: sin base
    PLAN[c] = compas(ac, None, 0.0, 0.17, lento=True)
for c, ac in zip(range(15, 19), ["Dm", "Dm", "F", "Gsus"]):  # el nudo: casi nada
    PLAN[c] = compas(ac, None, 0.35, 0.15, lento=True)
PLAN[19] = compas("G", "plato", 0.45)  # rinde los finales: aire
for c, ac in zip(range(20, 26), ["C", "Am", "F", "G", "C", "Am"]):  # 4° año: vuelve
    PLAN[c] = compas(ac, "plato" if c == 20 else "base", 0.6)
PLAN[26] = compas("F", "plato", 0.5)  # marzo de 5°
for c in range(27, 30):  #        la cuenta regresiva
    PLAN[c] = compas("Gsus", "cuatro", 0.6, 0.16)
for c in range(30, 32):  #        la última: nada
    PLAN[c] = compas("Gsus", None, 0.0, 0.0)
for c, ac in zip(range(32, 39), ["C", "G/B", "Am", "F", "C", "G/B", "Am"]):  # la revelación y la vuelta
    PLAN[c] = compas(ac, "fuerte", 0.75, 0.24)
for c, ac in zip(range(39, 41), ["F", "Gsus"]):  # la última pregunta: se calma
    PLAN[c] = compas(ac, None, 0.0, 0.2, lento=True)
for c, ac in zip(range(41, 44), ["C", "Am", "F"]):  # la libreta: solo teclas
    PLAN[c] = compas(ac, None, 0.0, 0.22, lento=True)
for c in range(44, COMPASES):  #  la invitación
    PLAN[c] = compas("C", None, 0.3, 0.22, lento=True)

# Los patrones de batería, sobre las 16 semicorcheas del compás.
PATRON = {
    "plato": dict(bombo=[], caja=[], plato=range(0, 16, 2)),
    "suave": dict(bombo=[0, 10], caja=[], plato=range(0, 16, 2), aro=[4, 12]),
    "base": dict(bombo=[0, 6, 10], caja=[4, 12], plato=range(0, 16, 2), abierto=[14]),
    "cuatro": dict(bombo=[0, 4, 8, 12], caja=[], plato=range(16)),
    "fuerte": dict(bombo=[0, 6, 10, 13], caja=[4, 12], palmas=[4, 12], plato=range(16), abierto=[14]),
}

golpes_de_bombo = []  # para que el colchón y el bajo "respiren" con el bombo
for c, p in PLAN.items():
    t0 = T(c)
    capa = capa_de(t0)
    bajo_nota, notas = ACORDES[p["acorde"]]
    fuerte = p["bateria"] == "fuerte"

    # Batería.
    pat = PATRON.get(p["bateria"])
    if pat:
        for paso in pat["bombo"]:
            capa.poner(BOMBO, T(c, paso), 0.62 if fuerte else 0.5, rev=0.03)
            golpes_de_bombo.append(T(c, paso))
        for paso in pat.get("caja", []):
            capa.poner(CAJA, T(c, paso), 0.42 if fuerte else 0.35, rev=0.18)
        for paso in pat.get("palmas", []):
            capa.poner(PALMAS, T(c, paso), 0.26, pan=0.15, rev=0.25)
        for paso in pat.get("aro", []):
            capa.poner(toquecito(820, 760, 0.012, 0.06), T(c, paso), 0.16, pan=0.2, rev=0.2)
        for paso in pat["plato"]:
            acento = 1.0 if paso % 4 == 2 else 0.6 if paso % 2 == 0 else 0.35
            capa.poner(PLATILLO, T(c, paso), 0.13 * acento * (1.15 if fuerte else 1), pan=0.3, rev=0.08)
        for paso in pat.get("abierto", []):
            capa.poner(PLATILLO_ABIERTO, T(c, paso), 0.1, pan=0.3, rev=0.1)

    # Bajo.
    if p["bajo"]:
        f = hz(bajo_nota)
        if p["lento"] or p["bateria"] in ("plato", "suave"):
            capa.poner(bajo(f, B * 0.9), t0, 0.3 * p["bajo"], rev=0.03)
        elif p["bateria"] == "cuatro":  # un pedal: la misma nota en cada tiempo
            for paso in (0, 4, 8, 12):
                capa.poner(bajo(f, Q * 0.8), T(c, paso), 0.34 * p["bajo"], rev=0.03)
        else:
            for paso, dur, k in ((0, 5, 1), (6, 3, 1), (10, 2, 1), (13, 2, 2 if c % 2 else 1.5)):
                capa.poner(bajo(f * k, dur * S * 0.95), T(c, paso), 0.36 * p["bajo"], rev=0.03)

    # Teclas: el acorde, apenas arpegiado, como lo tocaría una mano.
    if p["teclas"]:
        golpes = [(0, 1.0)] if p["lento"] else [(0, 1.0), (10, 0.6)]
        for paso, fuerza in golpes:
            for i, nota in enumerate(notas):
                capa.poner(teclas(hz(nota), 3.2 if p["lento"] else 2.2), T(c, paso) + i * 0.018, p["teclas"] * fuerza, pan=-0.3 + 0.2 * i, rev=0.3)

# Un redoble de caja que empuja hacia 4° año, y otro —largo, creciendo— al final
# de la cuenta regresiva.
for i, paso in enumerate([12, 13, 14, 15]):
    antes.poner(CAJA, T(19, paso), 0.14 + 0.05 * i, rev=0.15)
for c in (28, 29):
    pasos = range(8, 16) if c == 28 else range(16)
    for paso in pasos:
        avance = ((c - 28) * 16 + paso - 8) / 24
        if c == 28 and paso % 2:
            continue
        antes.poner(CAJA, T(c, paso), 0.08 + 0.26 * avance**1.5, rev=0.15)

# El colchón: solo donde hace falta sostener algo.
d_cuenta = M["m6"] - M["cuenta"]
antes.poner(colchon(["G3", "C4", "D4", "G4"], d_cuenta, 1.0, 0.2, curva=lambda t: 0.25 + 0.75 * np.clip(t / d_cuenta, 0, 1) ** 1.7), M["cuenta"], 0.16, rev=0.4)
d_ultima = t_corte - M["m6"]
antes.poner(colchon(["G4", "D5"], d_ultima, 0.3, 0.05), M["m6"], 0.05, rev=0.5)  # una nota colgada
antes.poner(ruido(M["m6"] - M["uno"], 2000, 9000) * (tiempo(M["m6"] - M["uno"]) / (M["m6"] - M["uno"])) ** 2.5, M["uno"], 0.09, rev=0.2)

# ── 2. La revelación y la vuelta: la melodía ─────────────────────────────────
MELODIA = [  # un compás por renglón: (semicorchea, nota)
    [(0, "E5"), (4, "G5"), (8, "C6"), (14, "A5")],
    [(0, "B5"), (6, "G5"), (10, "D5"), (12, "G5")],
    [(0, "A5"), (4, "C6"), (8, "E6"), (14, "C6")],
    [(0, "A5"), (6, "G5"), (10, "E5"), (12, "D5")],
    [(0, "E5"), (4, "G5"), (8, "C6"), (10, "D6"), (14, "E6")],
    [(0, "D6"), (6, "B5"), (10, "G5"), (12, "A5")],
    [(0, "C6"), (4, "A5"), (8, "E5"), (12, "G5")],
]
ECO = 3 * S  # la melodía se repite, más bajita, tres semicorcheas después
for i, frase in enumerate(MELODIA):
    for paso, nota in frase:
        s = punteo(hz(nota), 1.6, 1.1)
        despues.poner(s, T(32 + i, paso), 0.42, pan=-0.15, rev=0.3)
        despues.poner(s, T(32 + i, paso) + ECO, 0.15, pan=0.5, rev=0.4)
        despues.poner(s, T(32 + i, paso) + 2 * ECO, 0.06, pan=-0.5, rev=0.4)
    acorde = PLAN[32 + i]["acorde"]
    notas = [n[0] + str(int(n[1:]) + (1 if n[1:] == "3" else 0)) for n in ACORDES[acorde][1]]
    despues.poner(colchon(notas, B, 0.08 if i == 0 else 0.3, 0.5), T(32 + i), 0.12, rev=0.4)
# El golpe de la revelación: aire que se junta, un bombo enorme y un platillo.
for e in guion["sonido"]:
    if e["tipo"] == "inversa":
        d = e["dur"]
        despues.poner(ruido(d, 1200, 9000) * (tiempo(d) / d) ** 3, e["t"], 0.2, rev=0.1)
    elif e["tipo"] == "boom":
        despues.poner(hacer_bombo(120, 40, 0.5, 1.8), e["t"], 0.85, rev=0.2)
        despues.poner(ruido(2.6, 3500, 12000) * np.exp(-tiempo(2.6) / 0.7), e["t"], 0.13, rev=0.4)
# Redobles cortos que anuncian el cambio de plano dentro de la vuelta.
for c in (34, 35, 37):
    for i, paso in enumerate([13, 14, 15]):
        despues.poner(CAJA, T(c - 1, paso), 0.12 + 0.05 * i, rev=0.15)
# El último acorde: uno solo, que se queda.
for i, nota in enumerate(["C3", "G3", "E4", "B4", "D5"]):
    despues.poner(teclas(hz(nota), 5.0), M["tarjeta"] + i * 0.03, 0.2, pan=-0.4 + 0.2 * i, rev=0.4)

# ── 3. Lo que pasa en pantalla ───────────────────────────────────────────────
ultimas = guion["notas"] - len(CUENTA)
for e in guion["sonido"]:
    t, tipo = e["t"], e["tipo"]
    capa = capa_de(t)
    if tipo == "nota":  # una materia aprobada
        n = e["n"]
        g = CUENTA[n - ultimas] if n >= ultimas else grado_de(n, e.get("grave", False))
        fuerza = 0.5 + 0.08 * ((n * 7) % 5) / 4
        capa.poner(punteo(frec(g), 0.9 if e.get("grave") else 1.3, 1.2 if e.get("grave") else 0.8), t, fuerza, pan=0.35 * np.sin(n * 1.7), rev=0.4 if e.get("grave") else 0.22)
    elif tipo == "cursa":  # se anota en una materia: un punteo sordo, que va subiendo
        capa.poner(punteo(frec(e["i"]) / 2, 0.5, 0.25), t, 0.3, pan=-0.4 + 0.07 * e["i"], rev=0.12)
    elif tipo == "marca":  # final pendiente: un golpe apagado
        capa.poner(toquecito(170, 120, 0.05, 0.2), t, 0.3, rev=0.15)
    elif tipo == "trabada":  # una materia trabada: nota sorda, cada una más abajo
        capa.poner(punteo(hz(["A4", "G4", "E4"][e["i"]]), 0.7, 0.9), t, 0.34, pan=-0.3 + 0.3 * e["i"], rev=0.4)
    elif tipo == "pop_abu":
        capa.poner(toquecito(330, 250), t, 0.34 * (1.5 if capa is despues else 1), pan=-0.3, rev=0.1)
    elif tipo == "pop_yo":
        capa.poner(toquecito(560, 680), t, 0.28 * (1.5 if capa is despues else 1), pan=0.3, rev=0.1)
    elif tipo == "lapiz":
        capa.poner(lapiz(e.get("largo", False)), t, 0.11, pan=-0.2, rev=0.05)
    elif tipo == "toque":
        capa.poner(toquecito(700, 620, 0.012, 0.08), t, 0.16, rev=0.0)
    elif tipo == "reloj":
        capa.poner(toquecito(2300 if int(round(t / Q * 2)) % 4 == 0 else 1750, 1700, 0.008, 0.06), t, 0.09, pan=0.25, rev=0.35)
    elif tipo == "latido":  # dos golpes: pum-pum
        capa.poner(hacer_bombo(95, 50, 0.09, 0.4), t, 0.42, rev=0.03)
        capa.poner(hacer_bombo(110, 58, 0.07, 0.4), t + 0.17, 0.3, rev=0.03)
    elif tipo == "impacto":  # cada golpe de la cuenta regresiva
        capa.poner(hacer_bombo(160, 55, 0.22, 0.6), t, 0.5 * e["fuerza"], rev=0.2)
    elif tipo == "titulo":  # el primer título: un acento, no una fanfarria
        capa.poner(PLATILLO_ABIERTO, t, 0.12, rev=0.3)
        for i, nota in enumerate(["C4", "E4", "G4", "C5"]):
            capa.poner(punteo(hz(nota), 1.6, 1.4), t + i * 0.02, 0.36, pan=-0.3 + 0.2 * i, rev=0.35)
    elif tipo == "whoosh":
        capa.poner(aire(), t, 0.05, rev=0.2)


# ── Mezcla ───────────────────────────────────────────────────────────────────
def reverb(x):
    """Una sala chica: ruido que se apaga rápido, pasado por un filtro suave."""
    largo = int(1.2 * SR)
    t = np.arange(largo) / SR
    canales = []
    for c in range(2):
        ir = rng.standard_normal(largo) * np.exp(-t / 0.2)
        ir[: int(0.01 * SR)] = 0
        ir = np.convolve(ir, np.ones(12) / 12, mode="same")
        ir /= np.sqrt(np.sum(ir**2))
        m = len(x) + largo
        canales.append(np.fft.irfft(np.fft.rfft(x[:, c], m) * np.fft.rfft(ir, m), m)[: len(x)])
    return np.stack(canales, axis=1)


def mezclar(capa):
    return capa.seco + 0.45 * reverb(capa.envio)


a, d = mezclar(antes), mezclar(despues)
# Silencio total: lo anterior se apaga en 60 ms y no vuelve.
i0, i1 = int(t_corte * SR), int((t_corte + 0.06) * SR)
a[i0:i1] *= np.linspace(1, 0, i1 - i0)[:, None]
a[i1:] = 0
mix = a + d

# El último acorde se apaga solo.
cola = int(2.4 * SR)
mix[-cola:] *= (np.linspace(1, 0, cola) ** 1.5)[:, None]

# Limitador suave: redondea los picos para que el resto no quede bajo.
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
print(f"  silencio {t_corte + 0.06:.2f}–{R - 0.55:.2f} s: {rms(t_corte + 0.06, R - 0.56):.0f} dB")
partes = [("la pregunta", 0, T(2)), ("1° año", T(2), T(6)), ("2° año", T(6), T(10)), ("3° año", T(11), T(15)), ("el nudo", T(15), T(19)), ("4° año", T(20), T(26)), ("cuenta regresiva", T(27), T(30)), ("la última", T(30), t_corte), ("revelación", R, T(34)), ("la vuelta", T(34), T(39)), ("la libreta", T(39), T(44)), ("la invitación", T(44), DUR)]
for nombre, t0, t1 in partes:
    print(f"  {nombre}: {rms(t0, t1):.1f} dB RMS")
