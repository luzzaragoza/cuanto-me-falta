# Supabase — migraciones de datos académicos

Los archivos `.sql` de esta carpeta se corren **a mano** desde el proyecto de Supabase:
**Dashboard → SQL Editor → New query → pegar todo → Run**. No hay CLI ni migraciones
automáticas: son pocas, se corren de a una y conviene ver el resultado de cada una.

## Orden

| # | Archivo | Qué hace | ¿Cuándo? |
|---|---|---|---|
| 1 | `001-datos-academicos.sql` | Crea `universidad`, `plan`, `materia`, `correlativa`, `titulo`, los triggers de "última edición", el RLS de **solo lectura** y la vista `plan_publicado` | una vez |
| 2 | `seed-planes.sql` | Carga los 4 planes del repo (152 materias, 89 correlativas) | cada vez que cambien los planes del repo |

Los dos son **re-ejecutables**: correrlos dos veces deja la base igual.

## Verificar que quedó bien

```sql
select id, carrera, jsonb_array_length(materias) as materias,
       jsonb_array_length(correlativas) as correlativas
  from public.plan_publicado
 order by orden;
```

Tiene que devolver 4 filas:

| carrera | materias | correlativas |
|---|---|---|
| Ingeniería en Informática | 52 | 35 |
| Lic. en Gestión de Tecnología de la Información | 41 | 20 |
| Tecnicatura en Desarrollo de Software | 20 | 11 |
| Lic. en Inteligencia Artificial y Ciencia de Datos | 39 | 23 |

Y en la app, con la consola abierta en `localhost:5173`, el mensaje del refresco pasa de
`[planes] error: Could not find the table 'public.plan_publicado'` a nada (silencio =
`sin-cambios`, o sea que el backend dice exactamente lo mismo que el bundle: es el
resultado esperado el primer día).

## Regenerar el seed

```bash
node scripts/gen-seed-planes.mjs
```

Lo genera desde `src/data/planes/*.ts` y **se niega a emitir un plan que no pase
`validarPlan()`**. No editar `seed-planes.sql` a mano.

## Lo que NO está acá

- **La tabla `progreso`** (el avance del alumno: 1 fila JSON por usuario, RLS
  `user_id = auth.uid()`). Se creó a mano en jul-2026 y **no se toca**: ningún rol nuevo
  la alcanza, y el panel agregado del futuro no va a leerla — va a leer vistas agregadas.
- **Los perfiles y las políticas de escritura** (superadmin · admin de universidad con
  límite de planes · estudiante). Van en `002`, que es el paso 2 del sprint. Hoy las
  tablas académicas son de **solo lectura** vía API: solo se escriben desde el SQL Editor.
