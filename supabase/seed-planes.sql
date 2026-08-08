-- Seed de datos académicos — GENERADO por scripts/gen-seed-planes.mjs
-- No editar a mano: se regenera desde src/data/planes/*.ts
-- 4 planes · 1 universidad(es)
--
-- Requiere 001-datos-academicos.sql corrido antes.

begin;

insert into public.universidad (id, nombre) values ('uade', 'UADE')
  on conflict (id) do update set nombre = excluded.nombre, activa = true;

-- ── Ingeniería en Informática (1621) · 52 materias · 35 correlativas
insert into public.plan (id, universidad_id, codigo, anio, carrera, estado, publicado_at, orden)
values ('uade-ing-informatica', 'uade', '1621', 2021, 'Ingeniería en Informática', 'publicado', now(), 0)
  on conflict (id) do update set
    universidad_id = excluded.universidad_id, codigo = excluded.codigo,
    anio = excluded.anio, carrera = excluded.carrera, orden = excluded.orden,
    estado = 'publicado', publicado_at = coalesce(public.plan.publicado_at, now());

delete from public.correlativa where plan_id = 'uade-ing-informatica';
delete from public.materia     where plan_id = 'uade-ing-informatica';
delete from public.titulo      where plan_id = 'uade-ing-informatica';

insert into public.materia (plan_id, cod, nom, anio, cuatri, opt, especial, orden) values
  ('uade-ing-informatica', '3.4.069', 'Fundamentos de Informática', 1, 1, false, false, 0),
  ('uade-ing-informatica', '3.4.164', 'Sistemas de Información I', 1, 1, false, false, 1),
  ('uade-ing-informatica', '2.1.002', 'Pensamiento Crítico y Comunicación', 1, 1, false, false, 2),
  ('uade-ing-informatica', '3.4.043', 'Teoría de Sistemas', 1, 1, false, false, 3),
  ('uade-ing-informatica', '3.1.050', 'Elementos de Álgebra y Geometría', 1, 1, false, false, 4),
  ('uade-ing-informatica', '3.4.071', 'Programación I', 1, 2, false, false, 5),
  ('uade-ing-informatica', '3.3.121', 'Sistemas de Representación', 1, 2, false, false, 6),
  ('uade-ing-informatica', '3.2.178', 'Fundamentos de Química', 1, 2, false, false, 7),
  ('uade-ing-informatica', '3.4.072', 'Arquitectura de Computadores', 1, 2, false, false, 8),
  ('uade-ing-informatica', '3.1.024', 'Matemática Discreta', 1, 2, false, false, 9),
  ('uade-ing-informatica', '3.1.051', 'Álgebra', 1, 2, false, false, 10),
  ('uade-ing-informatica', '3.4.074', 'Programación II', 2, 1, false, false, 11),
  ('uade-ing-informatica', '3.4.207', 'Sistemas de Información II', 2, 1, false, false, 12),
  ('uade-ing-informatica', '3.4.075', 'Sistemas Operativos', 2, 1, false, false, 13),
  ('uade-ing-informatica', '3.1.052', 'Física I', 2, 1, false, false, 14),
  ('uade-ing-informatica', '3.1.053', 'Cálculo I', 2, 1, false, false, 15),
  ('uade-ing-informatica', '3.4.077', 'Programación III', 2, 2, false, false, 16),
  ('uade-ing-informatica', '3.4.208', 'Paradigma Orientado a Objetos', 2, 2, false, false, 17),
  ('uade-ing-informatica', '3.4.078', 'Fundamentos de Telecomunicaciones', 2, 2, false, false, 18),
  ('uade-ing-informatica', '3.4.209', 'Ingeniería de Datos I', 2, 2, false, false, 19),
  ('uade-ing-informatica', '3.1.054', 'Cálculo II', 2, 2, false, false, 20),
  ('uade-ing-informatica', '3.4.210', 'Proceso de Desarrollo de Software', 3, 1, false, false, 21),
  ('uade-ing-informatica', '3.4.211', 'Seminario de Integración Profesional', 3, 1, false, false, 22),
  ('uade-ing-informatica', '3.4.212', 'Teleinformática y Redes', 3, 1, false, false, 23),
  ('uade-ing-informatica', '3.4.213', 'Ingeniería de Datos II', 3, 1, false, false, 24),
  ('uade-ing-informatica', '3.1.049', 'Probabilidad y Estadística', 3, 1, false, false, 25),
  ('uade-ing-informatica', '2.4.216', 'Examen de Inglés', 3, 1, false, false, 26),
  ('uade-ing-informatica', '3.4.082', 'Aplicaciones Interactivas', 3, 2, false, false, 27),
  ('uade-ing-informatica', '3.4.214', 'Ingeniería de Software', 3, 2, false, false, 28),
  ('uade-ing-informatica', '3.1.055', 'Física II', 3, 2, false, false, 29),
  ('uade-ing-informatica', '3.4.215', 'Teoría de la Computación', 3, 2, false, false, 30),
  ('uade-ing-informatica', '3.1.056', 'Estadística Avanzada', 3, 2, false, false, 31),
  ('uade-ing-informatica', '3.4.216', 'Desarrollo de Aplicaciones I', 4, 1, false, false, 32),
  ('uade-ing-informatica', '3.4.089', 'Dirección de Proyectos Informáticos', 4, 1, false, false, 33),
  ('uade-ing-informatica', '3.4.217', 'Ciencia de Datos', 4, 1, false, false, 34),
  ('uade-ing-informatica', '3.4.092', 'Seguridad e Integridad de la Información', 4, 1, false, false, 35),
  ('uade-ing-informatica', '3.1.025', 'Modelado y Simulación', 4, 1, false, false, 36),
  ('uade-ing-informatica', 'OPT1', 'Optativa I', 4, 2, true, false, 37),
  ('uade-ing-informatica', '3.4.218', 'Desarrollo de Aplicaciones II', 4, 2, false, false, 38),
  ('uade-ing-informatica', '3.4.086', 'Evaluación de Proyectos Informáticos', 4, 2, false, false, 39),
  ('uade-ing-informatica', '3.4.096', 'Inteligencia Artificial', 4, 2, false, false, 40),
  ('uade-ing-informatica', '3.4.219', 'Tecnología y Medio Ambiente', 4, 2, false, false, 41),
  ('uade-ing-informatica', 'PPS06', 'Práctica Profesional Supervisada', 4, 2, false, true, 42),
  ('uade-ing-informatica', 'OPT2', 'Optativa II', 5, 1, true, false, 43),
  ('uade-ing-informatica', '3.4.094', 'Arquitectura de Aplicaciones', 5, 1, false, false, 44),
  ('uade-ing-informatica', '3.4.220', 'Tendencias Tecnológicas', 5, 1, false, false, 45),
  ('uade-ing-informatica', '3.4.100', 'Proyecto Final de Ingeniería en Informática', 5, 1, false, true, 46),
  ('uade-ing-informatica', '3.4.098', 'Calidad de Software', 5, 1, false, false, 47),
  ('uade-ing-informatica', 'OPT3', 'Optativa III', 5, 2, true, false, 48),
  ('uade-ing-informatica', '3.4.221', 'Negocios Tecnológicos', 5, 2, false, false, 49),
  ('uade-ing-informatica', '3.4.135', 'Tecnología e Innovación', 5, 2, false, false, 50),
  ('uade-ing-informatica', '2.3.056', 'Derecho Informático', 5, 2, false, false, 51);

insert into public.correlativa (plan_id, cod, requiere, orden) values
  ('uade-ing-informatica', '3.4.071', '3.4.069', 0),
  ('uade-ing-informatica', '3.1.051', '3.1.050', 1),
  ('uade-ing-informatica', '3.4.074', '3.4.071', 2),
  ('uade-ing-informatica', '3.4.207', '3.4.164', 3),
  ('uade-ing-informatica', '3.4.075', '3.4.072', 4),
  ('uade-ing-informatica', '3.1.052', '3.1.051', 5),
  ('uade-ing-informatica', '3.4.077', '3.4.074', 6),
  ('uade-ing-informatica', '3.4.208', '3.4.071', 7),
  ('uade-ing-informatica', '3.4.209', '3.1.024', 8),
  ('uade-ing-informatica', '3.1.054', '3.1.053', 9),
  ('uade-ing-informatica', '3.4.210', '3.4.208', 10),
  ('uade-ing-informatica', '3.4.211', '3.4.074', 11),
  ('uade-ing-informatica', '3.4.211', '3.4.207', 12),
  ('uade-ing-informatica', '3.4.211', '3.4.209', 13),
  ('uade-ing-informatica', '3.4.212', '3.4.078', 14),
  ('uade-ing-informatica', '3.4.213', '3.4.209', 15),
  ('uade-ing-informatica', '3.1.049', '3.1.053', 16),
  ('uade-ing-informatica', '3.4.082', '3.4.208', 17),
  ('uade-ing-informatica', '3.4.214', '3.4.207', 18),
  ('uade-ing-informatica', '3.1.055', '3.1.052', 19),
  ('uade-ing-informatica', '3.4.215', '3.4.077', 20),
  ('uade-ing-informatica', '3.4.215', '3.1.024', 21),
  ('uade-ing-informatica', '3.1.056', '3.1.049', 22),
  ('uade-ing-informatica', '3.4.216', '3.4.210', 23),
  ('uade-ing-informatica', '3.4.089', '3.4.207', 24),
  ('uade-ing-informatica', '3.4.217', '3.4.213', 25),
  ('uade-ing-informatica', '3.4.217', '3.1.049', 26),
  ('uade-ing-informatica', '3.4.092', '3.4.212', 27),
  ('uade-ing-informatica', '3.1.025', '3.1.054', 28),
  ('uade-ing-informatica', '3.4.218', '3.4.210', 29),
  ('uade-ing-informatica', '3.4.218', '3.4.082', 30),
  ('uade-ing-informatica', '3.4.086', '3.1.049', 31),
  ('uade-ing-informatica', '3.4.096', '3.1.056', 32),
  ('uade-ing-informatica', '3.4.094', '3.4.207', 33),
  ('uade-ing-informatica', '3.4.098', '3.4.214', 34);

insert into public.titulo (plan_id, nombre, hasta_anio, hasta_cuatri, orden) values
  ('uade-ing-informatica', 'Analista en Informática', 3, null, 0),
  ('uade-ing-informatica', 'Ingeniero en Informática', 5, null, 1);

-- ── Lic. en Gestión de Tecnología de la Información (13121) · 41 materias · 20 correlativas
insert into public.plan (id, universidad_id, codigo, anio, carrera, estado, publicado_at, orden)
values ('uade-lic-gestion-ti', 'uade', '13121', 2021, 'Lic. en Gestión de Tecnología de la Información', 'publicado', now(), 1)
  on conflict (id) do update set
    universidad_id = excluded.universidad_id, codigo = excluded.codigo,
    anio = excluded.anio, carrera = excluded.carrera, orden = excluded.orden,
    estado = 'publicado', publicado_at = coalesce(public.plan.publicado_at, now());

delete from public.correlativa where plan_id = 'uade-lic-gestion-ti';
delete from public.materia     where plan_id = 'uade-lic-gestion-ti';
delete from public.titulo      where plan_id = 'uade-lic-gestion-ti';

insert into public.materia (plan_id, cod, nom, anio, cuatri, opt, especial, orden) values
  ('uade-lic-gestion-ti', '3.4.225', 'Introducción a la Algoritmia', 1, 1, false, false, 0),
  ('uade-lic-gestion-ti', '3.4.164', 'Sistemas de Información I', 1, 1, false, false, 1),
  ('uade-lic-gestion-ti', '3.4.072', 'Arquitectura de Computadores', 1, 1, false, false, 2),
  ('uade-lic-gestion-ti', '1.2.001', 'Marketing', 1, 1, false, false, 3),
  ('uade-lic-gestion-ti', '3.4.226', 'Diseño y Desarrollo Web', 1, 1, false, false, 4),
  ('uade-lic-gestion-ti', '3.4.227', 'Algoritmos y Estructuras de Datos I', 1, 2, false, false, 5),
  ('uade-lic-gestion-ti', '3.4.207', 'Sistemas de Información II', 1, 2, false, false, 6),
  ('uade-lic-gestion-ti', '3.4.075', 'Sistemas Operativos', 1, 2, false, false, 7),
  ('uade-lic-gestion-ti', '3.1.024', 'Matemática Discreta', 1, 2, false, false, 8),
  ('uade-lic-gestion-ti', '3.4.228', 'Testing de Aplicaciones', 1, 2, false, false, 9),
  ('uade-lic-gestion-ti', '3.4.229', 'Algoritmos y Estructuras de Datos II', 2, 1, false, false, 10),
  ('uade-lic-gestion-ti', '3.4.208', 'Paradigma Orientado a Objetos', 2, 1, false, false, 11),
  ('uade-lic-gestion-ti', '3.4.230', 'Redes de Datos', 2, 1, false, false, 12),
  ('uade-lic-gestion-ti', '1.4.076', 'Fundamentos de Economía', 2, 1, false, false, 13),
  ('uade-lic-gestion-ti', '3.4.131', 'Gestión de Personas en Organizaciones de Tecnología', 2, 1, false, false, 14),
  ('uade-lic-gestion-ti', '3.4.231', 'Diseño y Análisis de Algoritmos', 2, 2, false, false, 15),
  ('uade-lic-gestion-ti', '3.4.142', 'Dirección de Proyectos de Tecnología', 2, 2, false, false, 16),
  ('uade-lic-gestion-ti', '3.4.209', 'Ingeniería de Datos I', 2, 2, false, false, 17),
  ('uade-lic-gestion-ti', '3.4.214', 'Ingeniería de Software', 2, 2, false, false, 18),
  ('uade-lic-gestion-ti', '1.1.093', 'Liderazgo y Negociación', 2, 2, false, false, 19),
  ('uade-lic-gestion-ti', 'OPT1', 'Optativa I', 3, 1, true, false, 20),
  ('uade-lic-gestion-ti', '3.4.082', 'Aplicaciones Interactivas', 3, 1, false, false, 21),
  ('uade-lic-gestion-ti', '3.4.210', 'Proceso de Desarrollo de Software', 3, 1, false, false, 22),
  ('uade-lic-gestion-ti', '3.4.092', 'Seguridad e Integridad de la Información', 3, 1, false, false, 23),
  ('uade-lic-gestion-ti', '3.1.049', 'Probabilidad y Estadística', 3, 1, false, false, 24),
  ('uade-lic-gestion-ti', '2.4.216', 'Examen de Inglés', 3, 1, false, false, 25),
  ('uade-lic-gestion-ti', 'OPT2', 'Optativa II', 3, 2, true, false, 26),
  ('uade-lic-gestion-ti', '3.4.233', 'Seminario de Gestión de Tecnología', 3, 2, false, false, 27),
  ('uade-lic-gestion-ti', '3.4.213', 'Ingeniería de Datos II', 3, 2, false, false, 28),
  ('uade-lic-gestion-ti', '3.4.139', 'Evaluación de Proyectos de Tecnología', 3, 2, false, false, 29),
  ('uade-lic-gestion-ti', '3.1.056', 'Estadística Avanzada', 3, 2, false, false, 30),
  ('uade-lic-gestion-ti', 'OPT3', 'Optativa III', 4, 1, true, false, 31),
  ('uade-lic-gestion-ti', '3.4.216', 'Desarrollo de Aplicaciones I', 4, 1, false, false, 32),
  ('uade-lic-gestion-ti', '3.4.141', 'Seguridad de Procesos y Aplicaciones', 4, 1, false, false, 33),
  ('uade-lic-gestion-ti', '3.4.217', 'Ciencia de Datos', 4, 1, false, false, 34),
  ('uade-lic-gestion-ti', '3.4.220', 'Tendencias Tecnológicas', 4, 1, false, false, 35),
  ('uade-lic-gestion-ti', 'OPT4', 'Optativa IV', 4, 2, true, false, 36),
  ('uade-lic-gestion-ti', '3.4.218', 'Desarrollo de Aplicaciones II', 4, 2, false, false, 37),
  ('uade-lic-gestion-ti', '3.4.135', 'Tecnología e Innovación', 4, 2, false, false, 38),
  ('uade-lic-gestion-ti', '3.4.221', 'Negocios Tecnológicos', 4, 2, false, false, 39),
  ('uade-lic-gestion-ti', '2.3.056', 'Derecho Informático', 4, 2, false, false, 40);

insert into public.correlativa (plan_id, cod, requiere, orden) values
  ('uade-lic-gestion-ti', '3.4.227', '3.4.225', 0),
  ('uade-lic-gestion-ti', '3.4.207', '3.4.164', 1),
  ('uade-lic-gestion-ti', '3.4.075', '3.4.072', 2),
  ('uade-lic-gestion-ti', '3.4.229', '3.4.227', 3),
  ('uade-lic-gestion-ti', '3.4.231', '3.4.229', 4),
  ('uade-lic-gestion-ti', '3.4.142', '3.4.207', 5),
  ('uade-lic-gestion-ti', '3.4.209', '3.1.024', 6),
  ('uade-lic-gestion-ti', '3.4.214', '3.4.207', 7),
  ('uade-lic-gestion-ti', '3.4.082', '3.4.208', 8),
  ('uade-lic-gestion-ti', '3.4.210', '3.4.208', 9),
  ('uade-lic-gestion-ti', '3.4.092', '3.4.230', 10),
  ('uade-lic-gestion-ti', '3.4.233', '3.4.208', 11),
  ('uade-lic-gestion-ti', '3.4.233', '3.4.209', 12),
  ('uade-lic-gestion-ti', '3.4.213', '3.4.209', 13),
  ('uade-lic-gestion-ti', '3.4.139', '3.1.049', 14),
  ('uade-lic-gestion-ti', '3.1.056', '3.1.049', 15),
  ('uade-lic-gestion-ti', '3.4.216', '3.4.082', 16),
  ('uade-lic-gestion-ti', '3.4.141', '3.4.210', 17),
  ('uade-lic-gestion-ti', '3.4.217', '3.4.209', 18),
  ('uade-lic-gestion-ti', '3.4.218', '3.4.082', 19);

insert into public.titulo (plan_id, nombre, hasta_anio, hasta_cuatri, orden) values
  ('uade-lic-gestion-ti', 'Licenciado en Gestión de Tecnología de la Información', 4, null, 0);

-- ── Tecnicatura en Desarrollo de Software (1121) · 20 materias · 11 correlativas
insert into public.plan (id, universidad_id, codigo, anio, carrera, estado, publicado_at, orden)
values ('uade-tec-desarrollo-software', 'uade', '1121', 2021, 'Tecnicatura en Desarrollo de Software', 'publicado', now(), 2)
  on conflict (id) do update set
    universidad_id = excluded.universidad_id, codigo = excluded.codigo,
    anio = excluded.anio, carrera = excluded.carrera, orden = excluded.orden,
    estado = 'publicado', publicado_at = coalesce(public.plan.publicado_at, now());

delete from public.correlativa where plan_id = 'uade-tec-desarrollo-software';
delete from public.materia     where plan_id = 'uade-tec-desarrollo-software';
delete from public.titulo      where plan_id = 'uade-tec-desarrollo-software';

insert into public.materia (plan_id, cod, nom, anio, cuatri, opt, especial, orden) values
  ('uade-tec-desarrollo-software', '3.4.225', 'Introducción a la Algoritmia', 1, 1, false, false, 0),
  ('uade-tec-desarrollo-software', '3.4.164', 'Sistemas de Información I', 1, 1, false, false, 1),
  ('uade-tec-desarrollo-software', '3.4.072', 'Arquitectura de Computadores', 1, 1, false, false, 2),
  ('uade-tec-desarrollo-software', '3.4.226', 'Diseño y Desarrollo Web', 1, 1, false, false, 3),
  ('uade-tec-desarrollo-software', '3.4.227', 'Algoritmos y Estructuras de Datos I', 1, 2, false, false, 4),
  ('uade-tec-desarrollo-software', '3.4.207', 'Sistemas de Información II', 1, 2, false, false, 5),
  ('uade-tec-desarrollo-software', '3.4.075', 'Sistemas Operativos', 1, 2, false, false, 6),
  ('uade-tec-desarrollo-software', '3.4.228', 'Testing de Aplicaciones', 1, 2, false, false, 7),
  ('uade-tec-desarrollo-software', '3.4.229', 'Algoritmos y Estructuras de Datos II', 2, 1, false, false, 8),
  ('uade-tec-desarrollo-software', '3.4.208', 'Paradigma Orientado a Objetos', 2, 1, false, false, 9),
  ('uade-tec-desarrollo-software', '3.4.230', 'Redes de Datos', 2, 1, false, false, 10),
  ('uade-tec-desarrollo-software', '3.4.209', 'Ingeniería de Datos I', 2, 1, false, false, 11),
  ('uade-tec-desarrollo-software', 'OPT1', 'Optativa I', 2, 2, true, false, 12),
  ('uade-tec-desarrollo-software', '3.4.231', 'Diseño y Análisis de Algoritmos', 2, 2, false, false, 13),
  ('uade-tec-desarrollo-software', '3.4.210', 'Proceso de Desarrollo de Software', 2, 2, false, false, 14),
  ('uade-tec-desarrollo-software', '3.4.082', 'Aplicaciones Interactivas', 2, 2, false, false, 15),
  ('uade-tec-desarrollo-software', 'OPT2', 'Optativa II', 3, 1, true, false, 16),
  ('uade-tec-desarrollo-software', '3.4.216', 'Desarrollo de Aplicaciones I', 3, 1, false, false, 17),
  ('uade-tec-desarrollo-software', '3.4.213', 'Ingeniería de Datos II', 3, 1, false, false, 18),
  ('uade-tec-desarrollo-software', '3.4.232', 'Trabajo Integrador Final', 3, 1, false, false, 19);

insert into public.correlativa (plan_id, cod, requiere, orden) values
  ('uade-tec-desarrollo-software', '3.4.227', '3.4.225', 0),
  ('uade-tec-desarrollo-software', '3.4.207', '3.4.164', 1),
  ('uade-tec-desarrollo-software', '3.4.075', '3.4.072', 2),
  ('uade-tec-desarrollo-software', '3.4.229', '3.4.227', 3),
  ('uade-tec-desarrollo-software', '3.4.231', '3.4.229', 4),
  ('uade-tec-desarrollo-software', '3.4.210', '3.4.208', 5),
  ('uade-tec-desarrollo-software', '3.4.082', '3.4.208', 6),
  ('uade-tec-desarrollo-software', '3.4.216', '3.4.082', 7),
  ('uade-tec-desarrollo-software', '3.4.213', '3.4.209', 8),
  ('uade-tec-desarrollo-software', '3.4.232', '3.4.082', 9),
  ('uade-tec-desarrollo-software', '3.4.232', '3.4.209', 10);

insert into public.titulo (plan_id, nombre, hasta_anio, hasta_cuatri, orden) values
  ('uade-tec-desarrollo-software', 'Técnico Universitario en Desarrollo de Software', 3, null, 0);

-- ── Lic. en Inteligencia Artificial y Ciencia de Datos (107425) · 39 materias · 23 correlativas
insert into public.plan (id, universidad_id, codigo, anio, carrera, estado, publicado_at, orden)
values ('uade-lic-ia-ciencia-datos', 'uade', '107425', 2025, 'Lic. en Inteligencia Artificial y Ciencia de Datos', 'publicado', now(), 3)
  on conflict (id) do update set
    universidad_id = excluded.universidad_id, codigo = excluded.codigo,
    anio = excluded.anio, carrera = excluded.carrera, orden = excluded.orden,
    estado = 'publicado', publicado_at = coalesce(public.plan.publicado_at, now());

delete from public.correlativa where plan_id = 'uade-lic-ia-ciencia-datos';
delete from public.materia     where plan_id = 'uade-lic-ia-ciencia-datos';
delete from public.titulo      where plan_id = 'uade-lic-ia-ciencia-datos';

insert into public.materia (plan_id, cod, nom, anio, cuatri, opt, especial, orden) values
  ('uade-lic-ia-ciencia-datos', '1.2.001', 'Marketing', 1, 1, false, false, 0),
  ('uade-lic-ia-ciencia-datos', '3.4.255', 'Pensamiento Computacional, Algoritmia y Programación', 1, 1, false, false, 1),
  ('uade-lic-ia-ciencia-datos', '3.1.067', 'Álgebra', 1, 1, false, false, 2),
  ('uade-lic-ia-ciencia-datos', '3.4.256', 'Introducción a la Ciencia de Datos', 1, 1, false, false, 3),
  ('uade-lic-ia-ciencia-datos', '3.1.018', 'Estadística General', 1, 2, false, false, 4),
  ('uade-lic-ia-ciencia-datos', '3.4.257', 'Introducción a la Inteligencia Artificial', 1, 2, false, false, 5),
  ('uade-lic-ia-ciencia-datos', '3.4.258', 'Python para Ciencia de Datos', 1, 2, false, false, 6),
  ('uade-lic-ia-ciencia-datos', '2.5.036', 'Ética en la Inteligencia Artificial', 1, 2, false, false, 7),
  ('uade-lic-ia-ciencia-datos', '3.1.072', 'Cálculo', 1, 2, false, false, 8),
  ('uade-lic-ia-ciencia-datos', 'OPT1', 'Optativa I', 2, 1, true, false, 9),
  ('uade-lic-ia-ciencia-datos', '3.4.259', 'Inferencia y Estimación', 2, 1, false, false, 10),
  ('uade-lic-ia-ciencia-datos', '3.4.260', 'Orientación a Objetos con Python', 2, 1, false, false, 11),
  ('uade-lic-ia-ciencia-datos', '3.4.261', 'Bases de Datos Relacionales', 2, 1, false, false, 12),
  ('uade-lic-ia-ciencia-datos', '3.4.262', 'Analíticas de Marketing Digital', 2, 1, false, false, 13),
  ('uade-lic-ia-ciencia-datos', 'OPT2', 'Optativa II', 2, 2, true, false, 14),
  ('uade-lic-ia-ciencia-datos', '3.4.263', 'Machine Learning I', 2, 2, false, false, 15),
  ('uade-lic-ia-ciencia-datos', '3.4.102', 'Minería de Datos', 2, 2, false, false, 16),
  ('uade-lic-ia-ciencia-datos', '3.4.264', 'Presentación y Comunicación de Resultados', 2, 2, false, false, 17),
  ('uade-lic-ia-ciencia-datos', '3.4.265', 'Analíticas para Sistemas de Información Geográficos', 2, 2, false, false, 18),
  ('uade-lic-ia-ciencia-datos', 'OPT3', 'Optativa III', 3, 1, true, false, 19),
  ('uade-lic-ia-ciencia-datos', '3.4.266', 'Bases de Datos Avanzadas', 3, 1, false, false, 20),
  ('uade-lic-ia-ciencia-datos', '3.4.267', 'Machine Learning II', 3, 1, false, false, 21),
  ('uade-lic-ia-ciencia-datos', '3.4.268', 'Deep Learning: Redes Neuronales Avanzadas', 3, 1, false, false, 22),
  ('uade-lic-ia-ciencia-datos', '3.4.269', 'Seminario Integrador de Ciencia de Datos', 3, 1, false, false, 23),
  ('uade-lic-ia-ciencia-datos', '3.4.270', 'Procesamiento del Lenguaje Natural', 3, 2, false, false, 24),
  ('uade-lic-ia-ciencia-datos', '3.4.271', 'Gestión y Evaluación de Proyectos de AI y Datos', 3, 2, false, false, 25),
  ('uade-lic-ia-ciencia-datos', '3.4.272', 'Fundamentos de Visión Artificial', 3, 2, false, false, 26),
  ('uade-lic-ia-ciencia-datos', '3.4.273', 'Automatización de Procesos Empresariales con AI', 3, 2, false, false, 27),
  ('uade-lic-ia-ciencia-datos', '3.4.274', 'Consultoría en Proyectos de Datos e Inteligencia Artificial', 3, 2, false, false, 28),
  ('uade-lic-ia-ciencia-datos', '3.4.275', 'Modelos de Lenguaje Amplio, Audio y Voz', 4, 1, false, false, 29),
  ('uade-lic-ia-ciencia-datos', '3.4.276', 'Canalización e Integración de Servicios de Nube', 4, 1, false, false, 30),
  ('uade-lic-ia-ciencia-datos', '3.4.277', 'Seminario de Tendencias en AI', 4, 1, false, false, 31),
  ('uade-lic-ia-ciencia-datos', '3.4.278', 'Aprendizaje por Refuerzo', 4, 1, false, false, 32),
  ('uade-lic-ia-ciencia-datos', '3.4.279', 'Proyecto Final de Inteligencia Artificial', 4, 1, false, false, 33),
  ('uade-lic-ia-ciencia-datos', '3.4.280', 'Aplicaciones Industriales de Ciencia de Datos', 4, 2, false, false, 34),
  ('uade-lic-ia-ciencia-datos', '3.4.281', 'Plataformas de Visión Artificial', 4, 2, false, false, 35),
  ('uade-lic-ia-ciencia-datos', '3.4.282', 'AI Generativa Visual', 4, 2, false, false, 36),
  ('uade-lic-ia-ciencia-datos', '3.4.283', 'Robótica y Sistemas Autónomos', 4, 2, false, false, 37),
  ('uade-lic-ia-ciencia-datos', '2.4.216', 'Examen de Inglés', 4, 2, false, false, 38);

insert into public.correlativa (plan_id, cod, requiere, orden) values
  ('uade-lic-ia-ciencia-datos', '3.4.258', '3.4.255', 0),
  ('uade-lic-ia-ciencia-datos', '3.4.259', '3.1.018', 1),
  ('uade-lic-ia-ciencia-datos', '3.4.260', '3.4.258', 2),
  ('uade-lic-ia-ciencia-datos', '3.4.262', '3.1.018', 3),
  ('uade-lic-ia-ciencia-datos', '3.4.263', '3.1.018', 4),
  ('uade-lic-ia-ciencia-datos', '3.4.263', '3.4.259', 5),
  ('uade-lic-ia-ciencia-datos', '3.4.102', '3.4.261', 6),
  ('uade-lic-ia-ciencia-datos', '3.4.265', '3.4.255', 7),
  ('uade-lic-ia-ciencia-datos', '3.4.266', '3.4.261', 8),
  ('uade-lic-ia-ciencia-datos', '3.4.267', '3.4.263', 9),
  ('uade-lic-ia-ciencia-datos', '3.4.268', '3.4.259', 10),
  ('uade-lic-ia-ciencia-datos', '3.4.269', '3.4.264', 11),
  ('uade-lic-ia-ciencia-datos', '3.4.270', '3.4.268', 12),
  ('uade-lic-ia-ciencia-datos', '3.4.272', '3.4.266', 13),
  ('uade-lic-ia-ciencia-datos', '3.4.272', '3.4.268', 14),
  ('uade-lic-ia-ciencia-datos', '3.4.275', '3.4.270', 15),
  ('uade-lic-ia-ciencia-datos', '3.4.276', '3.4.261', 16),
  ('uade-lic-ia-ciencia-datos', '3.4.276', '3.4.266', 17),
  ('uade-lic-ia-ciencia-datos', '3.4.278', '3.4.267', 18),
  ('uade-lic-ia-ciencia-datos', '3.4.279', '3.4.269', 19),
  ('uade-lic-ia-ciencia-datos', '3.4.279', '3.4.270', 20),
  ('uade-lic-ia-ciencia-datos', '3.4.279', '3.4.272', 21),
  ('uade-lic-ia-ciencia-datos', '3.4.282', '3.4.268', 22);

insert into public.titulo (plan_id, nombre, hasta_anio, hasta_cuatri, orden) values
  ('uade-lic-ia-ciencia-datos', 'Técnico Universitario en Ciencia de Datos', 3, 1, 0),
  ('uade-lic-ia-ciencia-datos', 'Licenciado en Inteligencia Artificial y Ciencia de Datos', 4, null, 1);

commit;

-- Verificación:
-- select id, carrera, jsonb_array_length(materias) as materias,
--        jsonb_array_length(correlativas) as correlativas
--   from public.plan_publicado order by carrera;
