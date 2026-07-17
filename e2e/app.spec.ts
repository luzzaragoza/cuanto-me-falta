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
  await expect(page.locator('.counts')).toContainText('52 en total')
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

  await expect(page.locator('.react-flow')).toBeVisible()
})

test('el árbol de correlativas se abre desde el dashboard y cierra con Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Árbol de correlativas' }).click()
  await expect(page.locator('.react-flow')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.react-flow')).toHaveCount(0)
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

  // 2) abrir Notas y cargarle un 8
  await page.getByRole('button', { name: 'Notas' }).click()
  const fila = page.locator('.nota-row').filter({ hasText: 'Fundamentos de Informática' })
  await fila.locator('input').fill('8')

  // 3) el promedio refleja el 8
  await expect(page.locator('.drawer-prom .np-num')).toHaveText('8')
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

  // paso 1 (intro) → paso 2: el botón .w-next es "Continuar" (sin backend) o
  // "Seguir sin cuenta" (con backend configurado en .env.local)
  await welcome.locator('.w-next').click()

  await page.getByPlaceholder('Tu nombre').fill('Luz')
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
  await page.locator('.welcome .w-next').click() // intro → carrera/nombre

  await page.locator('.welcome .cselect-btn').click()
  await page.locator('.welcome .cselect-opt').filter({ hasText: 'Gestión de Tecnología' }).click()
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

  // bienvenida → entrar (paso 1: intro → paso 2: nombre)
  await page.locator('.welcome .w-next').click()
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
