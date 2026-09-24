-- 011 — Cupos por semana
--
-- Hasta ahora cada horario tenía un contador, cupos_disponibles, que bajaba
-- con cada reserva y subía solo al cancelarla: nunca cuando terminaba el
-- período. Con el uso, cada horario quedaba "Sin cupos" para siempre aunque la
-- clase estuviera vacía.
--
-- Desde el backend de esta migración, los lugares se cuentan con las reservas
-- no canceladas que cubren cada día de clase de la semana. La columna queda,
-- sin uso, para no borrar datos; el código solo la acota al total para que no
-- se rompa su restricción.
--
-- Se agrega el índice con el que se hace esa cuenta.
--
-- No borra datos. Se puede correr más de una vez. Conviene aplicarla antes
-- del deploy del backend (sin el índice anda igual, más lento).

BEGIN;

CREATE INDEX IF NOT EXISTS reservas_horario_periodo_idx
  ON reservas (horario_id, fecha_inicio, fecha_fin)
  WHERE estado <> 'cancelado';

COMMENT ON COLUMN horarios.cupos_disponibles IS
  'Sin uso desde la migración 011: los lugares libres se cuentan por semana con las reservas.';

COMMIT;
