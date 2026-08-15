// Genera `supabase/seed-planes.sql` a partir de los planes del repo.
//
//   node scripts/gen-seed-planes.mjs
//
// Los planes viven en TypeScript (`src/data/planes/*.ts`) y son la fuente de verdad
// HASTA que el editor exista. Este script los pasa a SQL para cargarlos en la base.
// Después del editor, el camino se invierte: la base es la fuente y el bundle es un
// snapshot — este script queda solo para reconstruir un entorno desde cero.
//
// Los importa con el propio pipeline de Vite (`ssrLoadModule`), así resuelve TS y los
// imports sin extensión con la config del proyecto: cero dependencias nuevas.
//
// El SQL es re-ejecutable: por cada plan borra sus hijas y las vuelve a insertar, y
// hace upsert del plan. Correrlo dos veces deja la base igual.

import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const SALIDA = 'supabase/seed-planes.sql'

/** Literal SQL: escapa comillas simples. `null` para lo ausente. */
const s = (v) => (v === undefined || v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === undefined || v === null ? 'null' : String(Number(v)))
const b = (v) => (v ? 'true' : 'false')

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true } })
let planes, universidades, Validacion
try {
  const reg = await server.ssrLoadModule('/src/data/planes/index.ts')
  const val = await server.ssrLoadModule('/src/lib/validarPlan.ts')
  planes = reg.PLANES
  universidades = reg.UNIVERSIDADES
  Validacion = val.Validacion
} finally {
  await server.close()
}

// Ningún plan roto entra al seed: es el mismo validador que usan CI y el editor.
const roto = planes.find((p) => !new Validacion(p).esPublicable)
if (roto) {
  console.error(`✗ ${roto.carrera} no pasa el validador:`)
  for (const e of new Validacion(roto).errores) console.error(`   [${e.regla}] ${e.mensaje}`)
  process.exit(1)
}

const L = []
L.push('-- Seed de datos académicos — GENERADO por scripts/gen-seed-planes.mjs')
L.push('-- No editar a mano: se regenera desde src/data/planes/*.ts')
L.push(`-- ${planes.length} planes · ${universidades.length} universidad(es)`)
L.push('--')
L.push('-- Requiere 001-datos-academicos.sql corrido antes.')
L.push('')
L.push('begin;')
L.push('')

for (const u of universidades) {
  L.push(`insert into public.universidad (id, nombre) values (${s(u.id)}, ${s(u.nombre)})`)
  L.push('  on conflict (id) do update set nombre = excluded.nombre, activa = true;')
}
L.push('')

for (const [orden, p] of planes.entries()) {
  const materias = p.materias.length
  const correlativas = p.correlativas.length
  L.push(`-- ── ${p.carrera} (${p.codigo}) · ${materias} materias · ${correlativas} correlativas`)
  L.push(
    `insert into public.plan (id, universidad_id, codigo, anio, carrera, estado, publicado_at, orden)`,
  )
  L.push(
    `values (${s(p.id)}, ${s(p.universidad)}, ${s(p.codigo)}, ${n(p.anio)}, ${s(p.carrera)}, 'publicado', now(), ${orden})`,
  )
  L.push('  on conflict (id) do update set')
  L.push('    universidad_id = excluded.universidad_id, codigo = excluded.codigo,')
  L.push('    anio = excluded.anio, carrera = excluded.carrera, orden = excluded.orden,')
  L.push("    estado = 'publicado', publicado_at = coalesce(public.plan.publicado_at, now());")
  L.push('')
  // orden de borrado: primero las que referencian materias
  L.push(`delete from public.correlativa where plan_id = ${s(p.id)};`)
  L.push(`delete from public.materia     where plan_id = ${s(p.id)};`)
  L.push(`delete from public.titulo      where plan_id = ${s(p.id)};`)
  L.push('')

  L.push('insert into public.materia (plan_id, cod, nom, anio, cuatri, opt, especial, orden) values')
  L.push(
    p.materias
      .map(
        (m, i) =>
          `  (${s(p.id)}, ${s(m.cod)}, ${s(m.nom)}, ${n(m.anio)}, ${n(m.cuatri)}, ${b(m.opt)}, ${b(m.especial)}, ${i})`,
      )
      .join(',\n') + ';',
  )
  L.push('')

  if (correlativas) {
    L.push('insert into public.correlativa (plan_id, cod, requiere, orden) values')
    L.push(
      p.correlativas
        .map((c, i) => `  (${s(p.id)}, ${s(c.cod)}, ${s(c.requiere)}, ${i})`)
        .join(',\n') + ';',
    )
    L.push('')
  }

  if (p.titulos.length) {
    L.push('insert into public.titulo (plan_id, nombre, hasta_anio, hasta_cuatri, orden) values')
    L.push(
      p.titulos
        .map(
          (t, i) =>
            `  (${s(p.id)}, ${s(t.nombre)}, ${n(t.hastaAnio)}, ${n(t.hastaCuatri)}, ${i})`,
        )
        .join(',\n') + ';',
    )
    L.push('')
  }
}

L.push('commit;')
L.push('')
L.push('-- Verificación:')
L.push('-- select id, carrera, jsonb_array_length(materias) as materias,')
L.push('--        jsonb_array_length(correlativas) as correlativas')
L.push('--   from public.plan_publicado order by carrera;')
L.push('')

writeFileSync(SALIDA, L.join('\n'), 'utf8')

const totalMat = planes.reduce((a, p) => a + p.materias.length, 0)
const totalCor = planes.reduce((a, p) => a + p.correlativas.length, 0)
console.log(`✓ ${SALIDA}`)
console.log(
  `  ${planes.length} planes · ${totalMat} materias · ${totalCor} correlativas · validador OK`,
)
