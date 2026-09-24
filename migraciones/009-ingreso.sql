-- 009 — Control de ingreso con DNI y foto
--
-- Un empleado en la puerta pasa el DNI del socio por un lector; la pantalla
-- muestra su foto, su nombre y el estado de la cuota, y el empleado confirma
-- que la cara coincide. Hace falta:
--
--   • rol 'recepcion' : el empleado de la puerta. Ve la pantalla de ingreso y
--                       nada del panel (pagos, roles, actividad).
--   • fotos_socio     : una foto por socio, sacada en el mostrador. Aparte de
--                       usuarios para que las consultas de siempre no
--                       arrastren la imagen.
--   • ingresos        : cada pasada por la puerta, con su resultado. Se
--                       guarda también lo rechazado (DNI no registrado,
--                       cuota vencida) para poder revisarlo.
--
-- Si se corta internet, la pantalla decide con la última lista de socios que
-- bajó y manda los ingresos después (ingresos.id_local).
--
-- La foto no se usa para reconocimiento automático: la compara una persona.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('alumno', 'profesor', 'profesional', 'admin', 'recepcion'));

CREATE TABLE IF NOT EXISTS fotos_socio (
  usuario_id   INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  imagen       BYTEA NOT NULL,
  tipo         VARCHAR(20) NOT NULL DEFAULT 'image/jpeg' CHECK (tipo IN ('image/jpeg', 'image/webp')),
  cargada_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Tope de 100 KB: la app las achica antes de mandarlas.
  CHECK (octet_length(imagen) <= 102400)
);

CREATE TABLE IF NOT EXISTS ingresos (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  dni             VARCHAR(12) NOT NULL,
  resultado       VARCHAR(20) NOT NULL CHECK (resultado IN
                    ('al_dia', 'gracia', 'vencida', 'sin_cuota', 'personal', 'baja', 'no_registrado')),
  registrado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingresos anotados sin conexión: la pantalla les pone un id propio y los
-- manda cuando vuelve internet. Si el envío se repite, el id evita duplicarlos.
ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS id_local VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ingresos_id_local_idx ON ingresos (id_local) WHERE id_local IS NOT NULL;

CREATE INDEX IF NOT EXISTS ingresos_fecha_idx   ON ingresos (created_at);
CREATE INDEX IF NOT EXISTS ingresos_usuario_idx ON ingresos (usuario_id, created_at DESC);

COMMIT;
