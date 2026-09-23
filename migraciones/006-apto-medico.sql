-- 006 — Apto médico
--
-- Fecha de vencimiento del apto físico de cada socio. La carga el admin al
-- recibir el certificado. NULL = no presentó.
--
-- Solo avisa: un apto vencido o faltante no bloquea reservas. Decisión del
-- 23/09/2026, para no frenar a los socios actuales que todavía no lo trajeron.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apto_vence DATE;

COMMIT;
