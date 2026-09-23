-- 004 — Lista de espera
--
-- Cuando un horario se llena, el socio se anota. Si se libera un lugar, se
-- avisa en la app a todos los anotados y el cupo es del primero que reserva.
-- No se asigna solo: el socio decide si todavía le sirve y paga como siempre.
--
-- Al reservar ese horario, el socio sale de la lista solo.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

CREATE TABLE IF NOT EXISTS lista_espera (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  horario_id  INTEGER NOT NULL REFERENCES horarios(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, horario_id)
);

CREATE INDEX IF NOT EXISTS lista_espera_horario_idx ON lista_espera (horario_id);

COMMIT;
