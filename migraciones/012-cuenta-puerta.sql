-- 012 — Cuenta de la puerta
--
-- La PC de la entrada queda fija en la pantalla de ingreso con una cuenta
-- propia, que no es de ninguna persona: así no depende de la cuenta del admin,
-- que puede seguir usando el panel desde otro lado.
--
-- Esa cuenta no tiene DNI (no es un socio ni un empleado): el DNI deja de ser
-- obligatorio, pero solo para las cuentas marcadas como de puerta. Todas las
-- demás lo siguen necesitando, igual que antes. Son siempre de rol recepción.
--
-- Su sesión dura 6 meses en lugar de 7 días, para que la PC no pida la clave
-- cada semana. Se corta desde el panel (sube sesion_version, migración 010).
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cuenta_puerta BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE usuarios ALTER COLUMN dni DROP NOT NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_dni_o_puerta_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_dni_o_puerta_check
  CHECK (dni IS NOT NULL OR cuenta_puerta);

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_puerta_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_puerta_rol_check
  CHECK (NOT cuenta_puerta OR rol = 'recepcion');

COMMIT;
