# Supabase — migraciones de datos académicos

Los archivos `.sql` de esta carpeta se corren **a mano** desde el proyecto de Supabase:
**Dashboard → SQL Editor → New query → pegar todo → Run**. No hay CLI ni migraciones
automáticas: son pocas, se corren de a una y conviene ver el resultado de cada una.

## Orden

| # | Archivo | Qué hace | ¿Cuándo? |
|---|---|---|---|
| 1 | `001-datos-academicos.sql` | Crea `universidad`, `plan`, `materia`, `correlativa`, `titulo`, los triggers de "última edición", el RLS de **solo lectura** y la vista `plan_publicado` | una vez |
| 2 | `seed-planes.sql` | Carga los 4 planes del repo (152 materias, 89 correlativas) | cada vez que cambien los planes del repo |
| 3 | `002-perfiles-y-permisos.sql` | Crea `perfil`, `admin_uni` y `auditoria`, las funciones que deciden permisos y las políticas de **escritura** (con límite de planes por universidad) | una vez |
| 4 | `003-verificar-permisos.sql` | **Prueba** las 17 reglas de permisos simulando tres usuarios. Termina en `ROLLBACK`: no deja nada | después de 002, y cada vez que se toque una política |
| 5 | `004-versiones-de-plan.sql` | `plan_version` (las fotos), `publicar_plan()`, `revertir_plan()`, y la vista pasa a leer la foto publicada. Publica la versión 1 de los 4 planes ya cargados | una vez |
| 6 | `005-renombrar-codigos.sql` | `on update cascade` en las FKs de `correlativa`, para poder corregir un código mal tipeado sin perder el grafo | una vez |
| 7 | `006-correcciones-de-esquema.sql` | Las 5 correcciones de la auditoría del 11-ago: el límite de planes pasa a `universidad`, se va `plan.version`, entra el índice de `correlativa (plan_id, requiere)`, sale el índice redundante de `plan_version`, y `auditar()` deja de duplicar filas | una vez · **se puede correr cuando quieras** |
| 8 | `007-sacar-limite-de-admin-uni.sql` | Borra `admin_uni.limite_planes` (el paso "contraer") | una vez · **DESPUÉS de deployar el código nuevo** |
| 9 | `008-habilitar-admins.sql` | `admins_de()`, `habilitar_admin()` y `revocar_admin()`: el superadmin da y saca permisos desde `#admin`, sin tocar el SQL Editor | una vez |

### Por qué la 006 y la 007 están separadas

Patrón **expandir → contraer**. La 006 solo agrega: deja conviviendo `universidad.limite_planes`
(nueva) y `admin_uni.limite_planes` (vieja), así que se puede correr con el código viejo todavía
en producción sin romper nada. Una vez que el código nuevo está deployado y `#admin` muestra bien
el cupo, la 007 borra la vieja. Si se hiciera todo junto habría una ventana —entre la migración y
el deploy— en la que la base y el código no se entienden.

Todos son **re-ejecutables**: correrlos dos veces deja la base igual.

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

## Los permisos (002) en una tabla

| Acción | Estudiante | Admin de universidad | Superadmin |
|---|---|---|---|
| Ver planes publicados | ✓ | ✓ | ✓ |
| Ver los borradores de su universidad | — | ✓ | ✓ |
| Crear un plan | — | ✓ con permiso `crear` y por debajo de `limite_planes` | ✓ en cualquiera |
| Editar materias / correlativas / títulos | — | ✓ con permiso `editar`, solo en planes de su universidad | ✓ |
| Eliminar un plan | — | ✓ solo con permiso `eliminar` | ✓ |
| Mudar un plan a otra universidad | — | **✕** | ✓ |
| Repartir roles y límites | — | — | ✓ |
| **Ver el avance de un alumno** | **✕** | **✕** | **✕** |

Los permisos se guardan en la base, **no en el token**: revocar es un `UPDATE` con efecto
inmediato (un claim en el JWT quedaría cacheado hasta que se refresque la sesión).

Cómo convertirte en superadmin: está comentado al pie de `002-perfiles-y-permisos.sql`.
**Habilitar a alguien ya no necesita SQL**: se hace desde `#admin` → *Permisos* (008).

## Correr la verificación de permisos (003)

Se puede correr sobre producción: todo lo que hace lo deshace. En el panel de resultados
tiene que aparecer, en los avisos (`NOTICE`):

```
✓ 17/17 chequeos de permisos PASARON
```

Si alguno falla, el script termina con `EXCEPTION` y lista cuáles. Necesita **al menos 3
cuentas** en `auth.users` (hay 47, así que alcanza) porque se hace pasar por tres usuarios
distintos en vez de abrir tres sesiones de Google.

## Cómo se publica un plan (004)

Las filas de `materia` / `correlativa` / `titulo` son el **borrador**: el admin las edita
y los alumnos no ven nada. Al publicar se guarda una **foto** (el plan entero en JSON) en
`plan_version`, y `plan.version_publicada` apunta a ella — eso es lo único que ve el alumno.

```sql
select public.publicar_plan('uade-ing-informatica', 'Arreglo de correlativas de 3° año');
-- devuelve el número de versión nueva

select public.revertir_plan('uade-ing-informatica', 2);   -- volver a la foto 2
```

`publicar_plan` se niega a publicar un plan estructuralmente roto: sin materias, con
materias sin nombre, con una correlativa que no apunte a un cuatrimestre anterior (lo cual
además hace **imposible** un ciclo), con optativas metidas en las correlativas, o con
títulos que apunten a un año que el plan no tiene. El resto de las reglas las hace cumplir
el editor con `validarPlan()`, y el arranque de la app descarta igual cualquier plan roto.

Ver el historial de un plan:

```sql
select version, publicado_at, nota, jsonb_array_length(data->'materias') as materias
  from public.plan_version where plan_id = 'uade-ing-informatica' order by version desc;
```

## Lo que NO está acá

- **La tabla `progreso`** (el avance del alumno: 1 fila JSON por usuario, RLS
  `user_id = auth.uid()`). Se creó a mano en jul-2026 y **no se toca**: ningún rol nuevo
  la alcanza, y el panel agregado del futuro no va a leerla — va a leer vistas agregadas.
- **La lista de cuentas.** `admins_de()` (008) devuelve el mail solo de quien YA está
  habilitado en esa universidad. No hay forma de listar ni de buscar el padrón de
  `auth.users` desde el cliente, y así queda.
