-- 002 — Restricciones de integridad
--
-- La base no tenía ni un CHECK: los estados, los tipos y los roles eran
-- texto libre, y nada impedía cupos negativos, precios en negativo o una
-- reserva que terminara antes de empezar. La validación vivía sólo en el
-- código, así que cualquier ruta nueva que se olvidara de validar podía
-- escribir datos imposibles sin que nadie se enterara.
--
-- Todo lo de acá es defensa en profundidad: duplica a propósito lo que ya
-- valida el backend.
--
-- Se aplica una sola vez, y se puede volver a correr sin problema: cada
-- restricción se borra antes de crearse.

BEGIN;

-- ─── usuarios ────────────────────────────────────────────────────────────

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('alumno', 'profesor', 'profesional', 'admin'));

-- ─── horarios ────────────────────────────────────────────────────────────

ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_dia_semana_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_dia_semana_check
  CHECK (dia_semana IN ('Lunes', 'Martes', 'Miércoles', 'Jueves',
                        'Viernes', 'Sábado', 'Domingo'));

ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_horas_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_horas_check
  CHECK (hora_fin > hora_inicio);

ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_cupos_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_cupos_check
  CHECK (cupos_totales > 0 AND cupos_disponibles BETWEEN 0 AND cupos_totales);

ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_precio_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_precio_check
  CHECK (precio >= 0);

-- ─── reservas ────────────────────────────────────────────────────────────

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_tipo_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_tipo_check
  CHECK (tipo IN ('semanal', 'quincenal'));

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('pendiente', 'pagado', 'cancelado'));

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_fechas_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_fechas_check
  CHECK (fecha_fin >= fecha_inicio);

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_total_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_total_check
  CHECK (total >= 0);

-- ─── pagos ───────────────────────────────────────────────────────────────

-- Una reserva no puede tener dos pagos. El backend ya lo controlaba, pero
-- con una consulta y después un INSERT: dos clicks simultáneos pasaban los
-- dos controles y entraban las dos filas.
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_reserva_id_key;
ALTER TABLE pagos ADD CONSTRAINT pagos_reserva_id_key UNIQUE (reserva_id);

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('efectivo', 'mercadopago'));

-- 'rechazado' se deja previsto para cuando se implemente el pago online.
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check
  CHECK (estado IN ('pendiente', 'pagado', 'rechazado'));

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_monto_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_monto_check
  CHECK (monto >= 0);

-- ─── rutinas ─────────────────────────────────────────────────────────────

-- guardarRutina busca la rutina del profesor para ese alumno y si no está la
-- crea. Sin esta restricción, dos guardados a la vez creaban dos rutinas.
ALTER TABLE rutinas DROP CONSTRAINT IF EXISTS rutinas_profesor_alumno_key;
ALTER TABLE rutinas ADD CONSTRAINT rutinas_profesor_alumno_key
  UNIQUE (profesor_id, alumno_id);

COMMIT;
