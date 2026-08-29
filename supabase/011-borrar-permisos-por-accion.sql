-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 011 · Borrar los permisos por acción de `admin_uni`  (CONTRAER)          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ ESTA VA **DESPUÉS DEL DEPLOY**, igual que la 007. Borra columnas que el código
-- publicado hoy en `main` todavía lee (`cargarPerfil` pedía `crear, editar, eliminar`).
-- Correrla antes deja la administración rota para todo el mundo.
--
-- La señal de que ya se puede: entrar a `#admin` con lo nuevo desplegado, ver el panel del
-- superadmin y que la pantalla de permisos liste bien a los habilitados.
--
-- Es la mitad "contraer" de la 010, que dejó las tres columnas en `true` y vestigiales
-- porque un admin habilitado puede todo en su universidad (decisión de Luz, 12-ago).
--
-- ORDEN, que importa: primero se saca todo lo que LEE o ESCRIBE las columnas
-- (`permiso_uni` las lee, `habilitar_admin` las inserta), y recién después se borran. Al
-- revés, PostgreSQL rechaza el `drop column` por las dependencias — o peor, habilitar a
-- alguien empieza a fallar en producción con un error de columna inexistente.

begin;

-- ── 1. El permiso deja de mirar las columnas ──────────────────────────────
-- La FIRMA se conserva a propósito. `permiso_uni(uni, accion)` se llama desde 6 políticas
-- de RLS y 2 funciones; cambiarla obligaría a borrar y recrear todas esas políticas, que
-- es mucho más riesgo del que vale ahorrarse un parámetro. `accion` queda ignorado: hoy
-- las tres respuestas son la misma.
create or replace function public.permiso_uni(uni text, accion text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_superadmin() or exists (
    select 1 from public.admin_uni a
     where a.user_id = auth.uid()
       and a.universidad_id = uni
  );
$$;

comment on function public.permiso_uni(text, text) is
  'Si estás habilitado en esa universidad podés TODO ahí adentro (010/011). El parámetro '
  '`accion` se ignora: se conserva para no tener que recrear las políticas que la llaman.';

-- ── 2. Habilitar deja de escribirlas ──────────────────────────────────────
create or replace function public.habilitar_admin(p_email text, p_uni text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede habilitar administradores';
  end if;
  if not exists (select 1 from public.universidad where id = p_uni) then
    raise exception 'No existe la universidad %', p_uni;
  end if;

  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No hay ninguna cuenta con el mail %. Tiene que entrar una vez con Google antes de habilitarla.', p_email;
  end if;

  insert into public.admin_uni (user_id, universidad_id, otorgado_por)
  values (v_id, p_uni, auth.uid())
  on conflict (user_id, universidad_id) do nothing;

  update public.perfil set rol = 'admin_uni'
   where user_id = v_id and rol = 'estudiante';

  return v_id;
end;
$$;

-- ── 3. Recién ahora, las columnas ─────────────────────────────────────────
alter table public.admin_uni drop column if exists crear;
alter table public.admin_uni drop column if exists editar;
alter table public.admin_uni drop column if exists eliminar;

commit;

-- ── Verificación ──────────────────────────────────────────────────────────
select 'las 3 columnas ya no están' as chequeo,
       case when not exists (select 1 from information_schema.columns
                              where table_schema = 'public' and table_name = 'admin_uni'
                                and column_name in ('crear', 'editar', 'eliminar'))
            then '✓' else '✗ FALTA' end as estado
union all
select 'habilitar_admin sigue existiendo con 2 parámetros',
       case when (select pronargs from pg_proc
                   where pronamespace = 'public'::regnamespace
                     and proname = 'habilitar_admin') = 2
            then '✓' else '✗ FALTA' end
union all
-- El que importa: que las políticas sigan de pie. Si `permiso_uni` quedó rota, esto
-- explota en vez de devolver una fila.
select 'permiso_uni responde sin las columnas',
       case when public.permiso_uni('uade', 'editar') is not null
            then '✓' else '✗ FALTA' end
order by 1;
