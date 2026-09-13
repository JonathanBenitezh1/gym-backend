import pool from '../db/conexion.js'

/**
 * Registro de actividad: quién hizo qué y cuándo.
 *
 * Antes el panel no dejaba rastro: no había forma de saber quién confirmó un
 * pago, quién canceló una reserva o quién le cambió el rol a alguien.
 *
 * `ejecutor` es el cliente de una transacción abierta, así el movimiento y su
 * registro se guardan juntos o no se guarda ninguno.
 */
export async function registrarActividad(ejecutor, {
  usuario_id, accion, entidad = null, entidad_id = null, afectado_id = null, detalle = {}
}) {
  await ejecutor.query(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, afectado_id, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuario_id, accion, entidad, entidad_id, afectado_id, JSON.stringify(detalle)]
  )
}

/**
 * Para acciones que no corren en una transacción. Si el registro falla, la
 * acción ya está hecha y no tiene sentido devolverle un error a la persona:
 * la falla queda en los logs.
 */
export function anotarActividad(datos) {
  registrarActividad(pool, datos).catch(error => {
    console.error('No se pudo registrar la actividad:', datos.accion, error.message)
  })
}
