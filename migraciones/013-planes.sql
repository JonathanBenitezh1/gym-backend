-- 013 — Planes mensuales y horarios de varios días
--
-- Pedido del gimnasio (25/09/2026). Cambia el modelo de cobro:
--
--   • Un horario pasa a tener varios días con la misma hora: "Lucha, lunes,
--     miércoles y viernes de 17 a 18:30". Se carga una sola vez y se reserva
--     completo. Su precio es el de la semana entera.
--   • La cuota general se reemplaza por planes: cada uno tiene un precio por
--     mes y las clases que incluye ("Lucha", "Lucha + Gym", "Completa"). Cada
--     socio tiene un plan a la vez. El vencimiento y los días de gracia siguen
--     siendo los de la cuota (usuarios.cuota_vence, config_cuota).
--   • El socio con plan reserva un lugar fijo en los horarios de su plan, que
--     es suyo mientras lo pague: vencida la gracia, el lugar se libera solo.
--   • El socio puede pedir un plan desde la app; lo cobra el mostrador.
--   • La puerta controla el horario: deja pasar si el socio tiene una clase
--     ahora, desde `margen_ingreso_min` antes del inicio hasta el final.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

-- ─── Horarios de varios días ──────────────────────────
-- 1 = lunes … 7 = domingo, igual que EXTRACT(ISODOW). dia_semana queda con el
-- primer día, para que el backend anterior siga leyendo algo si hay que volver.
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS dias SMALLINT[];
UPDATE horarios
   SET dias = ARRAY[array_position(
         ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']::text[],
         dia_semana::text)]::smallint[]
 WHERE dias IS NULL;
ALTER TABLE horarios ALTER COLUMN dias SET NOT NULL;
ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_dias_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_dias_check
  CHECK (cardinality(dias) BETWEEN 1 AND 7 AND dias <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);
COMMENT ON COLUMN horarios.dia_semana IS
  'Sin uso desde la migración 013: los días están en dias. Guarda el primero.';
COMMENT ON COLUMN horarios.precio IS 'Precio de la semana completa (todos los días del horario).';

-- ─── Planes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planes (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  descripcion   TEXT,
  precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0 AND precio <= 99999999),
  -- "Completa": incluye todas las clases, también las que se creen después.
  incluye_todo  BOOLEAN NOT NULL DEFAULT false,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS planes_nombre_idx ON planes (lower(nombre));

CREATE TABLE IF NOT EXISTS plan_clases (
  plan_id   INTEGER NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
  clase_id  INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, clase_id)
);

-- Un plan con socios no se puede borrar (se desactiva). El pedido sí se
-- limpia solo si el plan desaparece.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES planes(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plan_pedido_id INTEGER REFERENCES planes(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plan_pedido_at TIMESTAMPTZ;

-- Qué plan se cobró. El nombre se copia: si el plan cambia de nombre o se
-- borra, el pago sigue diciendo qué se pagó.
ALTER TABLE pagos_cuota ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES planes(id) ON DELETE SET NULL;
ALTER TABLE pagos_cuota ADD COLUMN IF NOT EXISTS plan_nombre VARCHAR(100);

-- ─── Lugares fijos ────────────────────────────────────
-- Sin fechas: vale mientras el plan del socio esté al día o en gracia y la
-- clase siga en su plan. El backend borra los que dejan de valer.
CREATE TABLE IF NOT EXISTS reservas_fijas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  horario_id  INTEGER NOT NULL REFERENCES horarios(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, horario_id)
);
CREATE INDEX IF NOT EXISTS reservas_fijas_horario_idx ON reservas_fijas (horario_id);

-- ─── Puerta ───────────────────────────────────────────
ALTER TABLE config_cuota ADD COLUMN IF NOT EXISTS margen_ingreso_min INTEGER NOT NULL DEFAULT 30;
ALTER TABLE config_cuota DROP CONSTRAINT IF EXISTS config_cuota_margen_check;
ALTER TABLE config_cuota ADD CONSTRAINT config_cuota_margen_check
  CHECK (margen_ingreso_min BETWEEN 0 AND 180);

ALTER TABLE ingresos DROP CONSTRAINT IF EXISTS ingresos_resultado_check;
ALTER TABLE ingresos ADD CONSTRAINT ingresos_resultado_check CHECK (resultado IN
  ('al_dia', 'gracia', 'vencida', 'sin_cuota', 'personal', 'baja', 'no_registrado',
   'fuera_horario', 'pago_pendiente'));
-- La clase por la que entró (o la próxima, si llegó fuera de horario).
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS clase VARCHAR(100);

COMMIT;
