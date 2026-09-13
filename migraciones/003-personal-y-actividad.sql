-- 003 — Baja de usuarios, profes en la sede y registro de actividad
--
-- Tres cosas, las tres traídas del proyecto de Flavia y adaptadas a DTC:
--
--   • usuarios.activo : dar de baja a alguien sin borrarlo. Hoy no hay forma
--                       de cortarle el acceso a un profe que se fue ni a un
--                       socio, salvo tocar la base a mano.
--   • turnos_profe    : el profe marca que llegó y los socios ven en la app
--                       quién está atendiendo. Se guarda como turnos y no
--                       como un sí/no, así queda el historial de quién estuvo.
--   • auditoria       : quién hizo qué y cuándo. Hoy no queda rastro de quién
--                       confirmó un pago, canceló una clase o cambió un rol.
--
-- Las fechas van en TIMESTAMPTZ a propósito. El original de Flavia usaba
-- TIMESTAMP y comparaba contra la fecha del servidor, que está en UTC: un profe
-- que llegaba a las 20 desaparecía de la app a las 21, cuando en UTC ya era el
-- día siguiente.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

-- ─── Baja sin borrar ─────────────────────────────────────────────────────

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- ─── Profes en la sede ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turnos_profe (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  inicio      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin         TIMESTAMPTZ,
  CONSTRAINT turnos_profe_fin_check CHECK (fin IS NULL OR fin >= inicio)
);

-- Un profe no puede tener dos turnos abiertos: si toca "Llegué" dos veces, el
-- segundo no entra en vez de duplicarse.
CREATE UNIQUE INDEX IF NOT EXISTS turno_abierto_por_profe
  ON turnos_profe (usuario_id) WHERE fin IS NULL;

CREATE INDEX IF NOT EXISTS idx_turnos_profe_inicio ON turnos_profe (inicio DESC);

-- ─── Registro de actividad ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auditoria (
  id           SERIAL PRIMARY KEY,
  -- Quién lo hizo. Si esa persona se borra, el movimiento queda igual.
  usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion       VARCHAR(60) NOT NULL,     -- 'pago.confirmar', 'usuario.rol', ...
  entidad      VARCHAR(40),              -- 'reserva', 'clase', 'usuario', ...
  entidad_id   INTEGER,
  -- A quién afectó, cuando corresponde: el socio del pago, el usuario del rol.
  afectado_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  detalle      JSONB NOT NULL DEFAULT '{}',
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha    ON auditoria (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_afectado ON auditoria (afectado_id);

COMMIT;
