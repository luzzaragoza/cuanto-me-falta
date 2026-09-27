import { test, expect } from '@playwright/test'

// Códigos reales del Plan 1621 usados en los tests.
const FUNDAMENTOS = '3.4.069' // 1° año, sin previas
const PROG1 = '3.4.071' // necesita Fundamentos

// Cada test arranca con localStorage sembrado: un perfil (para saltar el modal
// de bienvenida) y estados vacíos, así los flujos son deterministas.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'plan-uade-v3',
      JSON.stringify({
        states: {},
        notas: {},
        optNames: {},
        custom: [],
        profile: { name: 'Test', photo: '' },
      }),
    )
    localStorage.setItem('cmf-tour-visto', '1') // sin tour en los tests salvo el dedicado
  })
  await page.goto('/')
})

test('la app carga y muestra el dashboard de avance', async ({ page }) => {
  await expect(page.locator('.hero')).toBeVisible()
  await expect(page.locator('.bignum .num')).toContainText('0')
  // el total del plan ya no es un chip suelto: vive en el titular del hero
  await expect(page.locator('.hero-tit')).toHaveText('Te faltan 52 materias')

  // la versión vive al pie del menú de Opciones (fecha del commit + hash corto)
  await page.locator('.tool-btn').click()
  await expect(page.locator('.menu-ver')).toHaveText(/^v\d{4}\.\d{2}\.\d{2}(·[0-9a-f]{7})?$/)
})

test('marcar una materia como aprobada actualiza el avance', async ({ page }) => {
  await page.locator(`[id="mat-${FUNDAMENTOS}"]`).click()
  const pop = page.locator('.spop')
  await expect(pop).toBeVisible()
  await pop.locator('.sp-opt').filter({ hasText: 'Aprobada' }).click()

  await expect(page.locator('.counts')).toContainText('1 aprobadas')
  await expect(page.locator('.bignum .num')).toContainText('2') // 1/52 ≈ 2%
})

test('marcar una materia sin las previas dispara el toast de correlativas', async ({ page }) => {
  await page.locator(`[id="mat-${PROG1}"]`).click()
  await page.locator('.spop .sp-opt').filter({ hasText: 'Cursando' }).click()

  const toast = page.locator('.toaster .toast.warn')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('Fundamentos de Informática')
  await expect(toast.locator('.toast-act')).toContainText('Ver árbol de correlativas')
})

test('el botón del toast abre el árbol de correlativas', async ({ page }) => {
  await page.locator(`[id="mat-${PROG1}"]`).click()
  await page.locator('.spop .sp-opt').filter({ hasText: 'Cursando' }).click()
  await page.locator('.toaster .toast.warn .toast-act').click()

  // el árbol abre con la materia fijada: su cadena queda resaltada y la barra la nombra
  await expect(page.locator('.treeview')).toBeVisible()
  await expect(page.locator('.tv-nodo.sel')).toHaveCount(1)
})

test('el árbol de correlativas se abre desde el dashboard y cierra con Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  const arbol = page.locator('.treeview')
  await expect(arbol).toBeVisible()
  // la línea de tiempo dibuja las 52 tarjetas y las correlativas en reposo
  await expect(page.locator('.tv-nodo')).toHaveCount(52)
  expect(await page.locator('.tv-aristas .ta').count()).toBeGreaterThan(30)

  // click en una materia = fijar su cadena; Esc la suelta ANTES de cerrar.
  // Ojo: el resaltado visual también lo produce el HOVER (así lo pide el diseño), y
  // el mouse queda sobre la tarjeta después del click — lo que distingue "fijada"
  // es el botón Soltar, así que se afirma sobre él.
  await page.getByRole('button', { name: 'Programación II', exact: true }).click()
  await expect(page.locator('.tv-nodo.sel')).toHaveCount(1)
  await expect(page.locator('.tv-status')).toContainText('Programación II')
  await expect(page.locator('.tv-soltar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.tv-soltar')).toHaveCount(0)
  await expect(arbol).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.treeview')).toHaveCount(0)
})

test('la barra del árbol no cambia de alto, y el clic en el fondo suelta la cadena', async ({
  page,
}) => {
  // 700 px de ancho a propósito: la barra tenía `min-height`, así que el contenido
  // decidía su alto. En una ventana angosta el renglón "primer año · 2° cuatrimestre"
  // envolvía y la barra pasaba de 62 a 98 px, EMPUJANDO el lienzo hacia abajo: pasar
  // el mouse por el plano hacía saltar el árbol entero. Se mide el alto de la barra y
  // el tope del lienzo, que es lo que se siente moverse.
  await page.setViewportSize({ width: 700, height: 800 })
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  await expect(page.locator('.treeview')).toBeVisible()
  // El árbol entra con un fundido Y una escala leve (0,985 → 1). Mientras dura, los
  // rectángulos que devuelve el navegador vienen escalados: 61,07 · 61,73 · 62. Se
  // espera a que la escala se vaya en vez de dormir un rato fijo — un test no puede
  // depender de ganarle a un reloj de la aplicación.
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('.treeview')!).transform),
    )
    .toBe('none')

  const caja = async (sel: string) => (await page.locator(sel).boundingBox())!
  const enReposo = await caja('.tv-status')
  const topeReposo = (await caja('.tv-marco')).y

  const materia = page.getByRole('button', { name: 'Programación II', exact: true })
  await materia.hover()
  await expect(page.locator('.tv-status')).toContainText('Programación II')
  expect((await caja('.tv-status')).height).toBe(enReposo.height)
  expect((await caja('.tv-marco')).y).toBe(topeReposo)

  await materia.click()
  await expect(page.locator('.tv-soltar')).toBeVisible() // fijada: el caso más ancho
  expect((await caja('.tv-status')).height).toBe(enReposo.height)
  expect((await caja('.tv-marco')).y).toBe(topeReposo)

  // clic en el fondo del lienzo = soltar. El punto se busca preguntándole al
  // navegador cuál es: las tarjetas se mueven con el zoom y el scroll.
  const libre = await page.evaluate(() => {
    const l = document.querySelector('.tv-lienzo')!.getBoundingClientRect()
    for (let y = l.top + 20; y < l.bottom - 20; y += 8)
      for (let x = l.left + 20; x < l.right - 20; x += 8) {
        const el = document.elementFromPoint(x, y)
        if (el && !el.closest('[data-nodo]') && el.closest('.tv-lienzo')) return { x, y }
      }
    return null
  })
  expect(libre).not.toBeNull()
  await page.mouse.click(libre!.x, libre!.y)
  await expect(page.locator('.tv-soltar')).toHaveCount(0)
  await expect(page.locator('.tv-nodo.sel')).toHaveCount(0)
})

test('en el teléfono, elegir una materia no achica el lienzo del árbol', async ({ page }) => {
  // El pie del teléfono muestra la pista (68 px) o la ficha de la materia (117, y
  // 136 con el nombre más largo en dos renglones). Con el pie en el flujo, tocar una
  // materia le comía 50 px al lienzo: el árbol saltaba abajo del dedo, en el gesto
  // más común de la pantalla. Ahora el pie FLOTA y el lienzo no se entera.
  await page.setViewportSize({ width: 390, height: 780 })
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  await expect(page.locator('.treeview')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('.treeview')!).transform),
    )
    .toBe('none')

  const alto = async () => (await page.locator('.tv-lienzo').boundingBox())!.height
  const enReposo = await alto()
  await expect(page.locator('.tv-hint-m')).toBeVisible()

  await page.locator('.tv-nodo').first().click()
  await expect(page.locator('.tv-ficha')).toBeVisible()
  expect(await alto()).toBe(enReposo)

  // y lo que la ficha tapa tiene que poder sacarse de abajo: sin aire al pie del
  // lienzo, la última fila del plan quedaría siempre debajo de la hoja.
  // Se acerca primero A PROPÓSITO: al zoom con el que abre, el plan entra entero en
  // la pantalla y el invariante se cumpliría solo, sin medir nada.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Acercar' }).click()
  expect(
    await page.evaluate(() => {
      const l = document.querySelector('.tv-lienzo')!
      const plano = document.querySelector('.tv-escala')!.getBoundingClientRect().height
      return plano > l.clientHeight
    }),
  ).toBe(true) // el plan ya no entra: recién ahí la pregunta tiene sentido

  const alcanzable = await page.evaluate(() => {
    const l = document.querySelector('.tv-lienzo')!
    l.scrollTop = l.scrollHeight
    const pie = document.querySelector('.tv-pie')!.getBoundingClientRect()
    let masBaja = -Infinity
    document.querySelectorAll('.tv-nodo').forEach((n) => {
      masBaja = Math.max(masBaja, n.getBoundingClientRect().bottom)
    })
    return masBaja < pie.top
  })
  expect(alcanzable).toBe(true)
})

test('los chips de año saltan de año, y están también en PC', async ({ page }) => {
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  await expect(page.locator('.treeview')).toBeVisible()

  // nacieron en el teléfono; el lienzo es igual de largo en PC y sin ellos la única
  // manera de llegar a 5° año era arrastrar
  await expect(page.locator('.tv-chips .tv-chip')).toHaveCount(5)
  await expect(page.locator('.tv-chip.on')).toHaveText('1° año')

  // `exact` porque el dashboard de atrás tiene su interruptor "Aprobar todas las
  // materias de 4° año", que matchea igual por rol y nombre
  await page.getByRole('button', { name: '4° año', exact: true }).click()
  await expect(page.locator('.tv-chip.on')).toHaveText('4° año')
  // el salto es con desplazamiento suave: se espera al lienzo, no a un reloj
  await expect
    .poll(() => page.evaluate(() => document.querySelector('.tv-lienzo')!.scrollLeft))
    .toBeGreaterThan(500)
})

test('en el teléfono el árbol abre lleno, no en vista de mapa', async ({ page }) => {
  // Abría con un 0,62 clavado: tarjetas de 129 px, chico y lejos. La regla ahora es
  // que el ancho lo llene el cuatrimestre COMPLETO y que del siguiente se vea la
  // mitad — entero se lee, el que asoma dice que la carrera sigue a la derecha.
  // Se afirma esa regla y no el número: con el 0,62 viejo entraban los dos enteros.
  await page.setViewportSize({ width: 390, height: 780 })
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  await expect(page.locator('.treeview')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('.treeview')!).transform),
    )
    .toBe('none')

  const encuadre = await page.evaluate(() => {
    const borde = document.querySelector('.tv-lienzo')!.getBoundingClientRect().right
    const cuatris = [...document.querySelectorAll('.tv-cuatri-kick')].map((k) =>
      k.getBoundingClientRect(),
    )
    return {
      primeroEntero: cuatris[0].right < borde,
      segundoAsoma: cuatris[1].left < borde,
      segundoCortado: cuatris[1].right > borde,
    }
  })
  expect(encuadre).toEqual({ primeroEntero: true, segundoAsoma: true, segundoCortado: true })
  // y las tarjetas conservan el nombre: por debajo del umbral serían teselas de color
  await expect(page.locator('.tv-plano.mapa')).toHaveCount(0)
})

test('el drawer de Notas abre, muestra el promedio y cierra', async ({ page }) => {
  await page.getByRole('button', { name: 'Notas' }).click()

  const drawer = page.locator('.drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('heading', { name: 'Notas' })).toBeVisible()
  await expect(drawer.locator('.np-num')).toHaveText('—') // sin notas aún

  await page.keyboard.press('Escape')
  await expect(page.locator('.drawer')).toHaveCount(0)
})

test('cargar una nota en el drawer actualiza el promedio', async ({ page }) => {
  // 1) aprobar Fundamentos (sin previas → sin toast)
  await page.locator(`[id="mat-${FUNDAMENTOS}"]`).click()
  await page.locator('.spop .sp-opt').filter({ hasText: 'Aprobada' }).click()

  // 2) abrir Notas y cargarle un 8. La nota ya no se escribe en un campo numérico:
  // se toca la pastilla de la fila y se elige del teclado de 1 a 10.
  await page.getByRole('button', { name: 'Notas' }).click()
  const fila = page.locator('.nota-row').filter({ hasText: 'Fundamentos de Informática' })
  await fila.locator('.nr-pill').click()
  await fila.locator('.nr-tecla').filter({ hasText: /^8$/ }).click()

  // 3) el promedio refleja el 8, y la pastilla de la fila lo muestra
  await expect(page.locator('.drawer-prom .np-num')).toHaveText('8,00')
  await expect(fila.locator('.nr-pill')).toHaveText('8')

  // 4) elegir una nota cierra el teclado (una materia a la vez)
  await expect(fila.locator('.nr-pad')).toHaveCount(0)

  // 5) y "quitar la nota" la borra: el promedio vuelve a no existir
  await fila.locator('.nr-pill').click()
  await fila.locator('.nr-quitar').click()
  await expect(page.locator('.drawer-prom .np-num')).toHaveText('—')
})

test('la bienvenida de primera visita pide el nombre y entra a la app', async ({ page }) => {
  // quitar el perfil sembrado (corre después del seed del beforeEach) → primera visita
  await page.addInitScript(() => {
    const raw = localStorage.getItem('plan-uade-v3')
    if (raw) {
      const d = JSON.parse(raw)
      delete d.profile
      localStorage.setItem('plan-uade-v3', JSON.stringify(d))
    }
  })
  await page.reload()

  const welcome = page.locator('.welcome')
  await expect(welcome).toBeVisible()
  await expect(welcome.getByRole('heading')).toContainText('Cuánto me falta')

  // El overlay tiene su PROPIO lock horizontal: es `position: fixed` con scroll propio,
  // así que el del documento no lo alcanza y en iPhone se arrastraba a los costados.
  // Si alguien saca estas tres líneas del CSS, esto se pone rojo.
  const lock = await welcome.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { x: cs.overflowX, over: cs.overscrollBehaviorX, touch: cs.touchAction }
  })
  expect(lock).toEqual({ x: 'hidden', over: 'none', touch: 'pan-y pinch-zoom' })
  // y sin desborde real: el eje X no tiene a dónde ir
  expect(await welcome.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0)

  // Tres pasos: marca → carrera → nombre. Las pastillas de arriba dicen en cuál va.
  await expect(welcome.locator('.w-paso.on')).toHaveCount(1)
  await welcome.getByRole('button', { name: 'Empezar' }).click()

  // la carrera elegida despliega de qué tamaño es el plan
  await expect(welcome.locator('.w-plan.sel')).toContainText('52 materias')
  await welcome.getByRole('button', { name: 'Seguir' }).click()

  await page.getByPlaceholder('Tu nombre').fill('Luz')
  // el botón saluda con el nombre que se acaba de escribir
  await expect(welcome.getByRole('button', { name: 'Empezá, Luz' })).toBeVisible()
  await page.getByRole('button', { name: /Empezá/ }).click()

  await expect(page.locator('.welcome')).toHaveCount(0)
  await expect(page.locator('.head h1')).toHaveText('Luz')
})

test('elegir otra carrera en la bienvenida carga ese plan', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = localStorage.getItem('plan-uade-v3')
    if (raw) {
      const d = JSON.parse(raw)
      delete d.profile
      localStorage.setItem('plan-uade-v3', JSON.stringify(d))
    }
  })
  await page.reload()
  await expect(page.locator('.welcome')).toBeVisible()
  await page.locator('.welcome').getByRole('button', { name: 'Empezar' }).click()

  // la carrera se elige de una lista de tarjetas (antes era un desplegable)
  await page.locator('.welcome .w-plan').filter({ hasText: 'Gestión de Tecnología' }).click()
  await expect(page.locator('.welcome .w-plan.sel')).toContainText('Gestión de Tecnología')
  await page.locator('.welcome').getByRole('button', { name: 'Seguir' }).click()

  await page.getByPlaceholder('Tu nombre').fill('Test')
  await page.getByRole('button', { name: /Empezá/ }).click()

  // recargó en el plan nuevo: subtítulo con la carrera Lic + una materia propia de ese plan
  await expect(page.locator('.head .sub')).toContainText('Gestión de Tecnología')
  await expect(page.locator('#plan')).toContainText('Testing de Aplicaciones')
})

test('una materia aprobada en una carrera figura aprobada en la otra (compartida)', async ({ page }) => {
  // 3.4.164 Sistemas de Información I existe en Ing. Informática y en Lic. Gestión TI.
  // La aprobamos en Informática y abrimos la app en Gestión TI. Va en un init
  // script (no un evaluate) porque el seed del beforeEach corre en CADA
  // navegación y pisaría la marca; este corre después, en orden de registro.
  await page.addInitScript(() => {
    const d = JSON.parse(localStorage.getItem('plan-uade-v3')!)
    d.states['3.4.164'] = 'aprobada'
    localStorage.setItem('plan-uade-v3', JSON.stringify(d))
    localStorage.setItem('cmf-plan-activo', 'uade-lic-gestion-ti')
    localStorage.setItem(
      'plan-uade-lic-gestion-ti-v3',
      JSON.stringify({ states: {}, notas: {}, optNames: {}, custom: [], profile: { name: 'Test', photo: '' } }),
    )
  })
  await page.reload()

  await expect(page.locator('.head .sub')).toContainText('Gestión de Tecnología')
  await expect(page.locator('.counts')).toContainText('1 aprobadas')
  // y la clave de Gestión TI sigue sin marcas propias: el avance heredado no se duplica
  const guardado = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('plan-uade-lic-gestion-ti-v3')!),
  )
  expect(guardado.states['3.4.164']).toBeUndefined()
})

test('el resumen PDF usa la carrera del plan activo (no hardcodeada)', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('cmf-plan-activo', 'uade-lic-gestion-ti')
    localStorage.setItem(
      'plan-uade-lic-gestion-ti-v3',
      JSON.stringify({ states: {}, notas: {}, optNames: {}, custom: [], profile: { name: 'Test', photo: '' } }),
    )
  })
  await page.reload()
  const resumen = page.locator('#print-summary')
  await expect(resumen).toContainText('Gestión de Tecnología')
  await expect(resumen).not.toContainText('Ingeniería en Informática')
})

test('la hoja del export es UNA carilla A4 exacta, con cualquier avance', async ({ page }) => {
  // La hoja es un documento, no una pantalla: 794×1123 px = 210×297 mm a 96 dpi. Si
  // alguien toca el padding, la tipografía o un bloque y se va de medida, el PDF sale a
  // dos carillas — y eso no se nota mirando la app, porque la hoja vive en @media print.
  const hoja = page.locator('#print-summary')
  const medir = async () => ({
    caja: (await hoja.boundingBox())!,
    desborde: await hoja.evaluate((e) => e.scrollWidth - e.clientWidth),
  })

  // ── 1. Plan vacío (alguien que recién entra) ──
  await page.emulateMedia({ media: 'print' })
  let m = await medir()
  expect(Math.round(m.caja.width)).toBe(794)
  expect(Math.round(m.caja.height)).toBe(1123)
  expect(m.desborde).toBe(0)

  // ── 2. Con TODO el plan en curso: el caso que más estira las listas ──
  // Los códigos se leen del DOM y se re-siembran con `addInitScript`, que corre DESPUÉS
  // del `beforeEach` (los init scripts se ejecutan en orden de registro). Con `evaluate`
  // + `reload` no alcanza: la recarga vuelve a correr el seed del beforeEach y borra las
  // marcas — y el test seguiría en verde midiendo una hoja vacía.
  const cods = await page.evaluate(() =>
    [...document.querySelectorAll('[id^="mat-"]')].map((e) => e.id.slice(4)),
  )
  expect(cods.length).toBeGreaterThan(40)
  await page.addInitScript((cods: string[]) => {
    const raw = JSON.parse(localStorage.getItem('plan-uade-v3') ?? '{}')
    raw.states = Object.fromEntries(cods.map((c) => [c, 'cursando']))
    localStorage.setItem('plan-uade-v3', JSON.stringify(raw))
  }, cods)
  await page.reload()
  await page.emulateMedia({ media: 'print' })

  m = await medir()
  expect(Math.round(m.caja.width)).toBe(794)
  expect(Math.round(m.caja.height)).toBe(1123)
  expect(m.desborde).toBe(0)

  // La lista está POBLADA de verdad (si no, lo de arriba mediría una hoja vacía).
  await expect(hoja.locator('.ps-lista').first()).toContainText('Cursando ahora')

  // Y que el CSS de la hoja EFECTIVAMENTE se aplique, no solo que esté escrito.
  // El prefijo `ps-` lo usan dos cosas distintas en global.css —la hoja y el panel del
  // superadmin— y `.ps-lista` estaba en las dos: ganaba la del panel (viene después en el
  // archivo) y las tarjetas salían con `padding: 0`, con el texto pegado al borde. Un
  // selector que no matchea no falla, no tipa mal y no rompe ningún test: hay que MEDIRLO.
  expect(
    await hoja.locator('.ps-lista').first().evaluate((e) => getComputedStyle(e).padding),
  ).toBe('18px')
})

test('el tutorial (coach marks) corre en la primera visita y no vuelve', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('cmf-tour-visto')
    const raw = localStorage.getItem('plan-uade-v3')
    if (raw) {
      const d = JSON.parse(raw)
      delete d.profile
      localStorage.setItem('plan-uade-v3', JSON.stringify(d))
    }
  })
  await page.reload()

  // bienvenida → entrar (marca → carrera → nombre)
  await page.locator('.welcome').getByRole('button', { name: 'Empezar' }).click()
  await page.locator('.welcome').getByRole('button', { name: 'Seguir' }).click()
  await page.getByPlaceholder('Tu nombre').fill('Luz')
  await page.getByRole('button', { name: /Empezá/ }).click()

  // aparece el tour, arranca en 1/6
  const tour = page.locator('.tour')
  await expect(tour).toBeVisible()
  await expect(tour).toContainText('1 / 6')

  // recorrerlo hasta el paso de cierre (con acción)
  for (let s = 0; s < 5; s++) await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(tour).toContainText('6 / 6')

  // en el cierre la materia resaltada se toca DIRECTO (el overlay deja pasar el
  // clic): se abre su selector de estado y el tour se despide solo
  await page.locator('#plan .mat').first().click()
  await expect(page.locator('.tour')).toHaveCount(0)
  await expect(page.locator('.spop')).toBeVisible()

  // quedó marcado como visto → no vuelve
  expect(await page.evaluate(() => localStorage.getItem('cmf-tour-visto'))).toBe('1')
})

test('el interruptor de año aprueba el año entero y se puede deshacer', async ({ page }) => {
  // ⏱ RELOJ CONGELADO, y no es capricho: este test fallaba ~1 de cada 3 corridas de
  // la suite completa y pasaba siempre aislado. La causa no era el producto sino una
  // CARRERA CONTRA UN RELOJ DE PARED — el aviso con acción se auto-descarta a los 6 s
  // (`ToastBus.show`), y entre el clic que lo crea y el clic en "Deshacer" hay tres
  // esperas. Con la suite en paralelo (fullyParallel + N workers) esas esperas se
  // comen los 6 s, el toast se desmonta y el clic falla. Con el reloj falso los
  // timeouts de la app no avanzan solos: el test mide lo que dice medir y no cuánto
  // estaba cargada la máquina. Va antes de navegar, que es lo que pide la API.
  await page.clock.install()
  await page.goto('/')

  const btn = page.locator('.year').first().locator('.ybtn')
  await expect(btn).toHaveText('Aprobar todo el año')

  await btn.click()

  // el año quedó aprobado: el avance subió y el botón cambió de sentido
  await expect(page.locator('.counts')).not.toContainText('0 aprobadas')
  await expect(btn).toHaveText('Desmarcar el año')

  // El aviso ofrece deshacer, y deshacer devuelve TODO a como estaba.
  //
  // Ojo con el locator: se filtra POR SU TEXTO, no `.toast` a secas. En una máquina
  // con credenciales de Supabase en `.env.local` (o sea, en local y no en CI) el
  // refresco de planes puede levantar el aviso "hay una versión nueva de tu plan"
  // encima de este, y entonces `.toast` matchea dos elementos y el modo estricto de
  // Playwright falla. El test no tiene por qué asumir que hay un solo aviso en
  // pantalla: tiene que apuntar al SUYO.
  const toast = page.locator('.toast').filter({ hasText: '1° año' })
  await expect(toast).toContainText('1° año')
  await toast.locator('.toast-act').click()

  await expect(page.locator('.counts')).toContainText('0 aprobadas')
  await expect(btn).toHaveText('Aprobar todo el año')
})

test('la administración vive en #admin, en su propio chunk, y no deja entrar sin permiso', async ({
  page,
}) => {
  await page.goto('/#admin')

  // se montó la pantalla de administración, no la del alumno
  await expect(page.locator('.adm-head')).toContainText('Administración')
  await expect(page.locator('.hero')).toHaveCount(0)
  await expect(page.locator('.adm-planes')).toHaveCount(0) // sin sesión no hay lista

  // Sin sesión no se entra. Cuál de los dos carteles aparece depende de si el entorno
  // tiene credenciales de Supabase (local sí, CI no), así que se acepta cualquiera:
  // lo que importa es que NO se vea la lista de planes.
  await expect(page.locator('.adm-vacio h2')).toHaveText(
    /Entrá con tu cuenta de administración|Sin backend configurado/,
  )

  // y se vuelve a la app del alumno
  await page.getByRole('button', { name: /Volver a la app/ }).click()
  await expect(page.locator('.hero')).toBeVisible()
  await expect(page.locator('.adm-head')).toHaveCount(0)
})

test('un plan bajado del backend (caché) reemplaza al del bundle', async ({ page }) => {
  // ADR-11: la app arranca con lo que haya en el caché de planes, y solo cae al bundle
  // si no hay o si está roto. Acá se siembra un caché con UN plan inventado (que no
  // existe en el repo) y se verifica que la app entera se dibuja con ESE plan.
  await page.addInitScript(() => {
    localStorage.setItem(
      'cmf-planes-cache',
      JSON.stringify({
        v: 1,
        at: new Date().toISOString(),
        universidades: [{ id: 'uade', nombre: 'UADE' }],
        planes: [
          {
            id: 'uade-ing-informatica', // mismo id: es el plan activo sembrado en beforeEach
            universidad: 'uade',
            codigo: '9999',
            anio: 2026,
            carrera: 'Carrera Del Backend',
            materias: [
              { cod: 'Z.1', nom: 'Materia Del Backend', anio: 1, cuatri: 1 },
              { cod: 'Z.2', nom: 'Otra Del Backend', anio: 1, cuatri: 2 },
            ],
            correlativas: [{ cod: 'Z.2', requiere: 'Z.1' }],
            titulos: [{ nombre: 'Título Del Backend', hastaAnio: 1 }],
          },
        ],
      }),
    )
  })
  await page.reload()

  await expect(page.locator('.head .sub')).toContainText('Carrera Del Backend')
  await expect(page.locator('.hero-tit')).toHaveText('Te faltan 2 materias') // no las 52 del bundle
  await expect(page.locator('#plan')).toContainText('Materia Del Backend')

  // y un caché ROTO (correlativa a una materia que no existe) se descarta: vuelve el bundle
  await page.addInitScript(() => {
    const raw = localStorage.getItem('cmf-planes-cache')!
    const c = JSON.parse(raw)
    c.planes[0].correlativas = [{ cod: 'Z.2', requiere: 'NO_EXISTE' }]
    localStorage.setItem('cmf-planes-cache', JSON.stringify(c))
  })
  await page.reload()

  // el total del plan ya no es un chip suelto: vive en el titular del hero
  await expect(page.locator('.hero-tit')).toHaveText('Te faltan 52 materias')
  await expect(page.locator('#plan')).toContainText('Fundamentos de Informática')
})
