-- Migración 001 — Restablecer contraseña desde el panel
--
-- Marca las contraseñas generadas por el administrador como temporales.
-- Mientras el indicador esté en verdadero, la app obliga al usuario a
-- elegir una contraseña propia antes de poder usar el resto de la
-- aplicación, así la temporal (que el administrador conoce) no queda
-- viva indefinidamente.
--
-- Aplicar con:
--   psql "<CADENA_DE_CONEXION>" -f migraciones/001-restablecer-password.sql

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
