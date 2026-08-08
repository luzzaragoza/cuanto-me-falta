-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 003 · Verificación de permisos — los tests de seguridad del paso 2       │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Requiere 001 y 002. Devuelve UNA TABLA de 17 filas + un TOTAL: se lee de un vistazo,
-- sin buscar en ningún log. (La primera versión reportaba por `RAISE NOTICE`, que el
-- editor de Supabase no muestra: una verificación que no se ve no verifica nada.)
--
-- NO DEJA NADA. Todo lo que crea —una universidad de prueba, planes, roles, permisos—
-- vive dentro de un savepoint que se deshace antes de devolver el resultado. Los
-- resultados sobreviven porque se acumulan en una variable, y las variables de plpgsql
-- no se deshacen. Se puede correr sobre producción, las veces que sea.
--
-- CÓMO PRUEBA SIN TRES LOGINS DE GOOGLE: se hace pasar por cada usuario poniendo el
-- claim `sub` del JWT y cambiando al rol `authenticated` — exactamente lo que ve la base
-- cuando la app consulta. Más determinista que tres navegadores y sin OAuth. Usa tres
-- cuentas que YA existen (no inventa usuarios: las tablas de permisos apuntan a
-- auth.users).

create or replace function public.verificar_permisos()
returns table (n int, chequeo text, esperado text, obtenido text, estado text)
language plpgsql
as $fn$
declare
  v_super  uuid;
  v_admin  uuid;
  v_alumno uuid;
  v_planes int;
  casos    jsonb;
  caso     jsonb;
  actor    uuid;
  sent     text;
  filas    bigint;
  obt      text;
  res      jsonb := '[]'::jsonb;   -- sobrevive al deshacer: no es dato de la base
begin
  -- ── Tres cuentas reales y distintas ──────────────────────────────────────
  select id into v_super  from auth.users order by created_at, id limit 1;
  select id into v_admin  from auth.users order by created_at, id offset 1 limit 1;
  select id into v_alumno from auth.users order by created_at, id offset 2 limit 1;
  if v_alumno is null then
    raise exception 'Hacen falta 3 cuentas en auth.users para verificar (hay %)',
      (select count(*) from auth.users);
  end if;

  begin  -- ═══ savepoint: NADA de lo que pasa acá adentro queda ═══
    insert into public.universidad (id, nombre) values ('test-uni', 'Universidad de Prueba')
      on conflict (id) do nothing;

    update public.perfil set rol = 'superadmin' where user_id = v_super;
    update public.perfil set rol = 'admin_uni'  where user_id = v_admin;
    update public.perfil set rol = 'estudiante' where user_id = v_alumno;

    -- admin de UADE: crear ✓ · editar ✓ · eliminar ✗ · y lugar para UN plan más
    v_planes := public.planes_de('uade');
    insert into public.admin_uni (user_id, universidad_id, crear, editar, eliminar, limite_planes)
    values (v_admin, 'uade', true, true, false, v_planes + 1)
      on conflict (user_id, universidad_id) do update
        set crear = true, editar = true, eliminar = false, limite_planes = v_planes + 1;

    -- ── Los 17 chequeos, en orden (algunos usan lo que dejó el anterior) ────
    -- tipo 'cuenta' = cuántas filas ve · tipo 'exec' = qué pasa al escribir
    -- esperado: CUENTA:n · OK:n (filas afectadas) · ERROR (la política lo rechaza)
    casos := jsonb_build_array(
      -- ═══ ESTUDIANTE ═══
      jsonb_build_object('n', 1, 'actor', 'alumno', 'tipo', 'cuenta', 'esperado', 'CUENTA:4',
        'desc', 'el alumno ve los 4 planes publicados',
        'sql', 'select 1 from public.plan_publicado'),
      jsonb_build_object('n', 2, 'actor', 'alumno', 'tipo', 'exec', 'esperado', 'ERROR',
        'desc', 'el alumno NO puede crear un plan',
        'sql', $q$insert into public.plan (id, universidad_id, codigo, anio, carrera)
                  values ('test-alumno', 'uade', '9001', 2026, 'Colada')$q$),
      jsonb_build_object('n', 3, 'actor', 'alumno', 'tipo', 'exec', 'esperado', 'OK:0',
        'desc', 'el alumno NO puede editar materias',
        'sql', $q$update public.materia set nom = 'Hackeada'
                   where plan_id = 'uade-ing-informatica'$q$),
      jsonb_build_object('n', 4, 'actor', 'alumno', 'tipo', 'exec', 'esperado', 'OK:0',
        'desc', 'el alumno NO puede borrar un plan',
        'sql', $q$delete from public.plan where id = 'uade-ing-informatica'$q$),
      jsonb_build_object('n', 5, 'actor', 'alumno', 'tipo', 'cuenta', 'esperado', 'CUENTA:0',
        'desc', 'el alumno NO ve el progreso de otra cuenta',
        'sql', 'select 1 from public.progreso where user_id = ''{admin}'''),
      jsonb_build_object('n', 6, 'actor', 'alumno', 'tipo', 'exec', 'esperado', 'OK:0',
        'desc', 'el alumno NO puede ascenderse a superadmin',
        'sql', $q$update public.perfil set rol = 'superadmin' where user_id = '{alumno}'$q$),
      -- ═══ ADMIN DE UADE (crear ✓ · editar ✓ · eliminar ✗) ═══
      jsonb_build_object('n', 7, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'OK:1',
        'desc', 'el admin crea un plan en SU universidad',
        'sql', $q$insert into public.plan (id, universidad_id, codigo, anio, carrera)
                  values ('test-admin-1', 'uade', '9002', 2026, 'Plan de Prueba')$q$),
      jsonb_build_object('n', 8, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'ERROR',
        'desc', 'el admin NO puede crear en OTRA universidad (pasando el id a mano)',
        'sql', $q$insert into public.plan (id, universidad_id, codigo, anio, carrera)
                  values ('test-admin-2', 'test-uni', '9003', 2026, 'Ajena')$q$),
      jsonb_build_object('n', 9, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'OK:1',
        'desc', 'el admin edita una materia de su universidad',
        'sql', $q$update public.materia set nom = 'Editada por el admin'
                   where plan_id = 'uade-ing-informatica' and cod = '3.4.069'$q$),
      jsonb_build_object('n', 10, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'OK:0',
        'desc', 'el admin NO puede borrar (no tiene el permiso eliminar)',
        'sql', $q$delete from public.plan where id = 'test-admin-1'$q$),
      jsonb_build_object('n', 11, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'ERROR',
        'desc', 'el admin NO puede pasarse del límite de planes',
        'sql', $q$insert into public.plan (id, universidad_id, codigo, anio, carrera)
                  values ('test-admin-3', 'uade', '9004', 2026, 'Pasada de limite')$q$),
      jsonb_build_object('n', 12, 'actor', 'admin', 'tipo', 'exec', 'esperado', 'ERROR',
        'desc', 'el admin NO puede mudar su plan a otra universidad',
        'sql', $q$update public.plan set universidad_id = 'test-uni' where id = 'test-admin-1'$q$),
      jsonb_build_object('n', 13, 'actor', 'admin', 'tipo', 'cuenta', 'esperado', 'CUENTA:1',
        'desc', 'el admin SÍ ve el borrador que creó',
        'sql', $q$select 1 from public.plan where estado = 'borrador'$q$),
      jsonb_build_object('n', 14, 'actor', 'admin', 'tipo', 'cuenta', 'esperado', 'CUENTA:0',
        'desc', 'el admin NO ve el progreso de un alumno',
        'sql', 'select 1 from public.progreso where user_id = ''{alumno}'''),
      -- ═══ SUPERADMIN ═══
      jsonb_build_object('n', 15, 'actor', 'super', 'tipo', 'exec', 'esperado', 'OK:1',
        'desc', 'el superadmin crea en cualquier universidad',
        'sql', $q$insert into public.plan (id, universidad_id, codigo, anio, carrera)
                  values ('test-super-1', 'test-uni', '9005', 2026, 'De otra uni')$q$),
      jsonb_build_object('n', 16, 'actor', 'super', 'tipo', 'exec', 'esperado', 'OK:1',
        'desc', 'el superadmin puede borrar',
        'sql', $q$delete from public.plan where id = 'test-super-1'$q$),
      jsonb_build_object('n', 17, 'actor', 'super', 'tipo', 'cuenta', 'esperado', 'CUENTA:0',
        'desc', 'NI EL SUPERADMIN ve el progreso de un alumno',
        'sql', 'select 1 from public.progreso where user_id = ''{alumno}''')
    );

    for caso in select * from jsonb_array_elements(casos) loop
      actor := case caso->>'actor'
                 when 'super' then v_super
                 when 'admin' then v_admin
                 else v_alumno
               end;
      sent := replace(replace(caso->>'sql', '{alumno}', v_alumno::text), '{admin}', v_admin::text);

      -- hacerse pasar por el usuario: el claim `sub` es lo que lee auth.uid()
      perform set_config('request.jwt.claims',
                         json_build_object('sub', actor, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      begin
        if caso->>'tipo' = 'cuenta' then
          execute 'select count(*) from (' || sent || ') q' into filas;
          obt := 'CUENTA:' || filas;
        else
          execute sent;
          get diagnostics filas = row_count;
          obt := 'OK:' || filas;
        end if;
      exception when others then
        obt := 'ERROR';   -- la política lo rechazó
      end;
      execute 'set local role postgres';

      res := res || jsonb_build_object(
        'n', (caso->>'n')::int,
        'chequeo', caso->>'desc',
        'esperado', caso->>'esperado',
        'obtenido', obt,
        'estado', case when obt = caso->>'esperado' then '✓' else '✗  REVISAR' end);
    end loop;

    raise exception 'deshacer-verificacion';   -- ← fuerza el rollback del savepoint
  exception when others then
    execute 'set local role postgres';
    if sqlerrm <> 'deshacer-verificacion' then
      res := res || jsonb_build_object('n', 0, 'chequeo', 'ERROR INESPERADO en el armado',
                                       'esperado', '—', 'obtenido', sqlerrm, 'estado', '✗  REVISAR');
    end if;
  end;

  -- ── El resultado (la base ya quedó como estaba) ──────────────────────────
  return query
    select (x->>'n')::int, x->>'chequeo', x->>'esperado', x->>'obtenido', x->>'estado'
      from jsonb_array_elements(res) x
    union all
    select 99,
           'TOTAL',
           '17 ✓',
           (count(*) filter (where x->>'estado' = '✓'))::text || ' de ' || count(*)::text,
           case when count(*) filter (where x->>'estado' <> '✓') = 0
                then '✓✓✓  TODO BIEN'
                else '✗✗✗  HAY FALLAS' end
      from jsonb_array_elements(res) x
    order by 1;
end;
$fn$;

-- Que NO quede como un endpoint público: la función corre SQL armado y solo la usás vos
-- desde el editor. Sin esto, PostgREST la expondría como RPC a cualquier cuenta.
revoke all on function public.verificar_permisos() from public;
revoke all on function public.verificar_permisos() from anon, authenticated;

-- ↓↓↓ EL RESULTADO ↓↓↓  (mirá la última fila: TOTAL)
select * from public.verificar_permisos();
