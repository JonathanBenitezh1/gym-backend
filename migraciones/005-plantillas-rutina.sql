-- 005 — Plantillas de rutina
--
-- Una rutina armada una vez (por ejemplo "Principiante 3 días") se reusa con
-- otros socios: se carga en el editor, se ajusta y se guarda como rutina del
-- socio. La plantilla no se toca al ajustarla.
--
-- Las ven todos los profes y el admin. La borra quien la creó o un admin.
-- Las sesiones van en JSONB: una plantilla se lee y se escribe entera, nunca
-- por ejercicio, así que no hacen falta tablas aparte.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

CREATE TABLE IF NOT EXISTS plantillas_rutina (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(80) NOT NULL,
  creador_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  sesiones    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dos plantillas con el mismo nombre confunden al elegir.
CREATE UNIQUE INDEX IF NOT EXISTS plantillas_rutina_nombre_idx
  ON plantillas_rutina (lower(nombre));

COMMIT;
