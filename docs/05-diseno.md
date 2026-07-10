# 5 · Diseño visual y UX

## 5.1 Identidad

El nombre es la pregunta que todo estudiante se hace — **¿Cuánto me falta?** — y la aplicación entera está diseñada para responderla de un vistazo. La identidad visual acompaña esa idea con una estética de **papel y tinta**: fondo cálido, tarjetas blancas, tipografía serif expresiva para los títulos y un dorado institucional como color de marca. El tono de la interfaz es rioplatense e informal ("Marcá tus materias", "¿Cuánto me falta?"), porque le habla a estudiantes, de igual a igual.

![Pantalla principal](captura-app.png)

## 5.2 Tipografías

| Fuente | Rol | Uso |
|---|---|---|
| **Fraunces** (serif) | Voz de la marca | Títulos, números grandes del tablero, hitos |
| **Inter** (sans) | Texto de trabajo | Cuerpo, listados, botones, formularios |
| **JetBrains Mono** (mono) | Datos técnicos | Códigos de materia (ej. `3.4.069`) |

Las tres se cargan desde Google Fonts con `display=swap` para no bloquear el renderizado.

## 5.3 Design tokens

Toda la paleta vive como variables CSS en `src/styles/global.css`, la única fuente de verdad del color. Ningún componente usa colores sueltos.

**Base**

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#f5f3ee` | Fondo general (papel cálido); también `theme-color` de la PWA |
| `--card` | `#ffffff` | Tarjetas y superficies |
| `--ink` | `#232019` | Tinta: texto principal, bordes fuertes |
| `--soft` | `#6b655b` | Texto secundario |
| `--line` | `#e4dfd4` | Líneas y bordes suaves |
| `--gold` | `#c39200` | Color de marca: acentos, foco, hitos |

**Estados y relaciones** — cada concepto tiene una terna `color / fondo / texto` para usarse en chips, fondos y tipografía con contraste correcto:

| Concepto | Terna | Valores |
|---|---|---|
| Aprobada | `--ap` / `--ap-bg` / `--ap-tx` | `#2f7d5a` / `#e4efe9` / `#1e5a3f` |
| Cursando | `--cu` / `--cu-bg` / `--cu-tx` | `#c2620f` / `#f8e7d6` / `#8e450a` |
| Pendiente de final | `--fi` / `--fi-bg` / `--fi-tx` | `#3d6bb3` / `#e2eaf6` / `#284e86` |
| Necesitás (prerrequisito) | `--lk` / `--lk-bg` / `--lk-tx` | `#6b4fcf` / `#ece7fa` / `#4a35a0` |
| Habilita (dependiente) | `--hb` / `--hb-bg` / `--hb-tx` | `#0e8c8c` / `#dbf0ee` / `#0a5f5c` |

## 5.4 El color como lenguaje

La decisión de diseño central: **el color codifica significado de manera consistente en toda la aplicación**. Verde siempre es aprobada; naranja, cursando; azul, pendiente de final; violeta, lo que una materia *necesita*; teal, lo que *habilita*. El mismo código rige en el listado del plan, en los paneles de correlativas, en el árbol y en el resumen imprimible — una vez aprendido, se lee sin leyenda.

![Árbol de correlativas: violeta = necesitás, teal = habilita](captura-arbol.png)

## 5.5 Decisiones de interfaz

- **Selector de estado con lenguaje de estudiante.** Las opciones no son solo etiquetas: cada una se explica en primera persona ("La estoy cursando ahora", "Aprobé la cursada, me falta rendir"). Elimina ambigüedad sin manual.
- **Avisos que proponen el paso siguiente.** El aviso de correlativas no es un error: dice exactamente qué falta y ofrece un botón para ver el árbol con foco en esa materia. Informar + accionar en el mismo gesto.
- **Paneles de correlativas múltiples.** Se pueden abrir varios a la vez para comparar materias — la consulta real nunca es de a una.
- **El tablero responde la pregunta del título.** Porcentaje grande, hitos de título con cuántas materias faltan y avance por año: la respuesta a "¿cuánto me falta?" está arriba de todo, siempre.
- **Onboarding guiado, una sola vez.** Tour de coach marks en la primera visita, repetible a demanda desde Opciones; nunca vuelve a interrumpir solo.
- **Acciones peligrosas, visualmente peligrosas.** Reiniciar el progreso está separado, marcado en rojo y pide confirmación.
- **Resumen pensado para papel.** La vista de impresión no es la pantalla "como salga": es un documento propio, diseñado con `@media print`, con identidad, métricas y materias por estado.

## 5.6 Responsive y accesibilidad

- Diseño mobile-first: el uso típico es en el teléfono, entre clases. En pantallas angostas el encabezado se compacta (los botones conservan solo el ícono) para priorizar el nombre y la carrera.
- Contenedor de lectura acotado (`max-width: 980px`) para líneas cómodas en escritorio.
- Menús con roles ARIA (`role="menuitem"`), cierre con `Escape` en superficies modales (árbol) y foco visible con el dorado de marca.
- Las ternas de color de estado incluyen una variante de texto oscurecida (`-tx`) para asegurar contraste sobre los fondos suaves.

## 5.7 Extensión de la identidad

La identidad visual trasciende la app: el formulario de feedback (Tally) está personalizado con `--paper`, `--ink` y `--gold`, y esta misma documentación en PDF usa la paleta y las tipografías del producto. Una sola voz visual en todos los puntos de contacto.
