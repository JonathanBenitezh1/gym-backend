-- 010 — Cerrar las otras sesiones al cambiar la contraseña
--
-- El token dura 7 días y hasta ahora nada lo invalidaba antes de tiempo. Si
-- alguien quedaba con la sesión abierta en un teléfono ajeno o en la PC del
-- gimnasio, cambiar la contraseña no lo sacaba: el token viejo seguía
-- sirviendo. Ni siquiera el "Restablecer clave" del panel alcanzaba: apenas el
-- socio elegía su clave nueva, el token viejo volvía a funcionar.
--
-- Cada usuario lleva ahora un número de versión que viaja en el token. Cambiar
-- o restablecer la contraseña lo sube, y los tokens con el número anterior
-- dejan de valer en el próximo pedido.
--
-- Arranca en 0 y los tokens emitidos antes de esta migración no traen número:
-- el servidor los toma como 0, así que nadie queda afuera al publicarla.
--
-- Va ANTES del deploy del backend: `verificarToken` lee esta columna en cada
-- pedido, y sin ella nadie puede entrar a la app.
--
-- No borra datos. Se puede correr más de una vez.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
