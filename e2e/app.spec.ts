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
