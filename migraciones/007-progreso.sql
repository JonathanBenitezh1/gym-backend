-- 007 — Progreso del socio
--
-- Registros sueltos de peso, medidas y marcas personales. Una fila por
-- medición: "Peso 78,5 kg el 20/09", "Sentadilla 100 kg el 22/09". Así la
-- misma tabla sirve para cualquier medida sin agregar columnas.
--
-- Carga el socio lo suyo. Los profes y el admin lo ven al armar la rutina.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

CREATE TABLE IF NOT EXISTS progreso (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  medida       VARCHAR(40) NOT NULL,
  valor        NUMERIC(7,2) NOT NULL CHECK (valor > 0 AND valor < 10000),
  unidad       VARCHAR(10) NOT NULL,
  fecha        DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progreso_usuario_idx ON progreso (usuario_id, medida, fecha);

COMMIT;
