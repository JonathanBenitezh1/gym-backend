-- 008 — Cuota mensual
--
-- Cada socio tiene una fecha hasta la que pagó (usuarios.cuota_vence). Con esa
-- fecha y los días de gracia sale su estado: al día, en gracia o vencida. La
-- pantalla de la puerta y los avisos de la app leen ese estado.
--
-- Cómo se corre el vencimiento al pagar lo define el gimnasio en
-- config_cuota: un mes desde el vencimiento anterior, o el mismo día del mes
-- para todos. Está en la base y no en el código para cambiarlo desde el panel.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cuota_vence DATE;

-- Una sola fila: la configuración del gimnasio.
CREATE TABLE IF NOT EXISTS config_cuota (
  id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  modo_vencimiento  VARCHAR(20) NOT NULL DEFAULT 'mensual'
                    CHECK (modo_vencimiento IN ('mensual', 'dia_fijo')),
  -- Hasta 28 para que exista en todos los meses.
  dia_vencimiento   INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimiento BETWEEN 1 AND 28),
  dias_gracia       INTEGER NOT NULL DEFAULT 6 CHECK (dias_gracia BETWEEN 0 AND 30),
  precio            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO config_cuota (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Cada cobro de cuota, con el vencimiento que tenía antes y el que quedó.
-- Guardar los dos permite rehacer la historia si hay un reclamo.
CREATE TABLE IF NOT EXISTS pagos_cuota (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  monto           NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
  metodo          VARCHAR(20) NOT NULL CHECK (metodo IN ('efectivo', 'transferencia', 'mercadopago', 'otro')),
  meses           INTEGER NOT NULL DEFAULT 1 CHECK (meses BETWEEN 1 AND 12),
  vence_anterior  DATE,
  vence_nuevo     DATE NOT NULL,
  registrado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagos_cuota_usuario_idx ON pagos_cuota (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pagos_cuota_fecha_idx ON pagos_cuota (created_at);

COMMIT;
