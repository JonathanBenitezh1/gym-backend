import pool from '../db/conexion.js'
import { hoyEnArgentina } from './cuota.js'
import { avisarCupoLibre } from '../controllers/esperaController.js'

/**
 * Planes mensuales (migración 013).
 *
 * Cada socio tiene un plan a la vez (usuarios.plan_id) que vence en
 * usuarios.cuota_vence, con los días de gracia de config_cuota. Con el plan
 * al día o en gracia puede tomar lugares fijos en los horarios de las clases
 * que incluye.
 */

/**
 * El plan `plan` incluye la clase `clase`, como expresión SQL. Los dos son
 * columnas de la consulta (p. ej. 'u.plan_id', 'c.id'), nunca datos del pedido.
 */
export const INCLUYE = (plan, clase) => `EXISTS (
  SELECT 1 FROM planes p WHERE p.id = ${plan}
    AND (p.incluye_todo OR EXISTS (
      SELECT 1 FROM plan_clases pc WHERE pc.plan_id = p.id AND pc.clase_id = ${clase})))`

/**
 * Borra los lugares fijos que dejaron de valer: el socio se dio de baja, no
 * tiene plan, se le terminó la gracia o su plan ya no incluye esa clase.
 *
 * Se llama antes de contar lugares. Así un lugar se libera solo cuando vence
 * el plan, y si el socio paga después, no lo recupera por encima de quien lo
 * tomó en el medio.
 *
 * Devuelve los horarios que quedaron con lugar.
 */
export async function liberarFijas(ejecutor = pool, hoy = hoyEnArgentina()) {
  const r = await ejecutor.query(
    `DELETE FROM reservas_fijas rf
      USING usuarios u, horarios h, config_cuota cc
      WHERE rf.usuario_id = u.id AND rf.horario_id = h.id AND cc.id = 1
        AND (NOT u.activo OR u.plan_id IS NULL OR u.cuota_vence IS NULL
             OR u.cuota_vence + cc.dias_gracia < $1::date
             OR NOT ${INCLUYE('u.plan_id', 'h.clase_id')})
      RETURNING rf.horario_id`,
    [hoy]
  )
  return [...new Set(r.rows.map(f => f.horario_id))]
}

/**
 * liberarFijas fuera de una transacción, con aviso a la lista de espera. Si
 * falla no corta el pedido que la llamó: a lo sumo se ve un lugar ocupado de
 * más hasta la próxima vez.
 */
export async function liberarFijasYAvisar(io) {
  try {
    const liberados = await liberarFijas()
    if (liberados.length > 0 && io) {
      io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
      avisarCupoLibre(io, liberados)
    }
  } catch (error) {
    console.error('No se pudieron liberar los lugares fijos vencidos:', error)
  }
}

/** Los planes activos con sus clases, para la app y el panel. */
export async function leerPlanes({ soloActivos = true } = {}) {
  const r = await pool.query(
    `SELECT p.id, p.nombre, p.descripcion, p.precio::float AS precio, p.incluye_todo, p.activo,
            COALESCE(array_agg(pc.clase_id ORDER BY pc.clase_id) FILTER (WHERE pc.clase_id IS NOT NULL), '{}') AS clases_ids,
            (SELECT COUNT(*)::int FROM usuarios u WHERE u.plan_id = p.id) AS socios
     FROM planes p
     LEFT JOIN plan_clases pc ON pc.plan_id = p.id
     ${soloActivos ? 'WHERE p.activo' : ''}
     GROUP BY p.id
     ORDER BY p.precio, p.nombre`
  )
  return r.rows
}
