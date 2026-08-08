-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 005 · Que se pueda corregir un código de materia sin perder el grafo     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cómo correrlo: Supabase → SQL Editor (Role: postgres) → pegar TODO → Run.
-- Idempotente. Requiere 001. Devuelve una tabla al final con las FKs resultantes.
--
-- EL PROBLEMA (encontrado escribiendo el editor, antes de que existiera la pantalla):
-- `correlativa` referencia a `materia` por (plan_id, cod). Esas FKs se crearon con
-- `on delete cascade` pero SIN `on update`, así que corregir un código mal tipeado
-- —lo más común del mundo cargando un plan a mano— fallaba con violación de FK.
-- El editor podía renombrar en su borrador, pero al guardar la base lo rechazaba.
--
-- LA DECISIÓN: `on update cascade`. Corregir el código de una materia arrastra sus
-- correlativas, que es exactamente lo que hace la función `renombrarCodigo` del
-- editor: la base y el cliente ahora dicen lo mismo.
--
-- Lo que NO se toca: el `id` del PLAN. Ese id es la clave con la que cada alumno tiene
-- guardado su progreso en su dispositivo (`plan-<id>-v3`), así que renombrarlo dejaría
-- huérfano el avance de todos. El editor no lo ofrece y acá tampoco cascadea.

do $$
declare c record;
begin
  -- se borran TODAS las FKs de correlativa y se vuelven a crear con la regla nueva
  -- (buscarlas por catálogo evita depender de los nombres que autogeneró Postgres)
  for c in
    select conname from pg_constraint
     where conrelid = 'public.correlativa'::regclass and contype = 'f'
  loop
    execute format('alter table public.correlativa drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.correlativa
  add constraint correlativa_plan_fk
    foreign key (plan_id) references public.plan(id) on delete cascade,
  add constraint correlativa_materia_fk
    foreign key (plan_id, cod) references public.materia(plan_id, cod)
    on delete cascade on update cascade,
  add constraint correlativa_requiere_fk
    foreign key (plan_id, requiere) references public.materia(plan_id, cod)
    on delete cascade on update cascade;

-- Verificación: las dos que apuntan a materia tienen que decir CASCADE en update.
select
  conname                                  as restriccion,
  confupdtype = 'c'                        as cascada_al_renombrar,
  confdeltype = 'c'                        as cascada_al_borrar,
  pg_get_constraintdef(oid)                as definicion
from pg_constraint
where conrelid = 'public.correlativa'::regclass and contype = 'f'
order by conname;
