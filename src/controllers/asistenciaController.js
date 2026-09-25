import pool from '../db/conexion.js'

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Quiénes tienen lugar en el horario $1 el día $2: una reserva semanal que
 * cubre ese día, o un lugar fijo del plan tomado hasta ese día. Si alguien
 * tiene las dos, cuenta una vez, como fijo.
 */
const INSCRIPTOS = `
  SELECT DISTINCT ON (usuario_id) usuario_id, tipo FROM (
    SELECT rf.usuario_id, 'fijo' AS tipo, 0 AS orden FROM reservas_fijas rf
    WHERE rf.horario_id = $1
      AND (rf.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= $2::date
    UNION ALL
    SELECT r.usuario_id, 'semanal', 1 FROM reservas r
    WHERE r.horario_id = $1 AND r.estado IN ('pendiente', 'pagado')
      AND r.fecha_inicio <= $2::date AND r.fecha_fin > $2::date
  ) todos ORDER BY usuario_id, orden`

/**
 * Verifica que el horario pertenezca a una clase del profesor.
 * Los administradores pueden acceder a cualquier horario.
 *
 * Sin esto, cualquier profesor podría ver los datos personales de los alumnos
 * de clases ajenas o marcarles asistencia.
 */
async function puedeAccederAlHorario(usuario, horario_id) {
  if (usuario.rol === 'admin') return true

  const resultado = await pool.query(
    `SELECT 1 FROM horarios h
     JOIN clases c ON h.clase_id = c.id
     WHERE h.id = $1 AND c.profesor_id = $2`,
    [horario_id, usuario.id]
  )
  return resultado.rows.length > 0
}

export const obtenerAlumnosDeHorario = async (req, res) => {
  const { horario_id } = req.params
  const { fecha } = req.query

  try {
    if (!RE_FECHA.test(String(fecha || ''))) {
      return res.status(400).json({ error: 'Falta la fecha, o no tiene el formato correcto' })
    }

    if (!await puedeAccederAlHorario(req.usuario, horario_id)) {
      return res.status(403).json({ error: 'No tenés permiso para ver este horario' })
    }

    // Los de la semana y los que tienen lugar fijo por su plan.
    const alumnos = await pool.query(
      `SELECT
        u.id,
        u.nombre,
        u.dni,
        inscriptos.tipo,
        COALESCE(a.asistio, false) AS asistio
       FROM (${INSCRIPTOS}) inscriptos
       JOIN usuarios u ON u.id = inscriptos.usuario_id
       LEFT JOIN asistencias a ON a.usuario_id = u.id
         AND a.horario_id = $1
         AND a.fecha = $2
       ORDER BY u.nombre`,
      [horario_id, fecha]
    )
    res.json(alumnos.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener alumnos' })
  }
}

export const marcarAsistencia = async (req, res) => {
  const { horario_id, usuario_id, fecha, asistio } = req.body

  try {
    if (!horario_id || !usuario_id || !RE_FECHA.test(String(fecha || ''))) {
      return res.status(400).json({ error: 'Faltan datos para registrar la asistencia' })
    }

    if (!await puedeAccederAlHorario(req.usuario, horario_id)) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este horario' })
    }

    // El alumno tiene que tener una reserva vigente en ese horario. El fin
    // no cuenta: con BETWEEN, la semanal de un lunes cubría dos lunes, y el
    // socio que renovaba aparecía dos veces en la lista.
    const tieneReserva = await pool.query(
      `SELECT 1 FROM (${INSCRIPTOS}) inscriptos WHERE usuario_id = $3`,
      [horario_id, fecha, usuario_id]
    )
    if (tieneReserva.rows.length === 0) {
      return res.status(400).json({
        error: 'Ese alumno no tiene una reserva que cubra esa fecha en este horario'
      })
    }

    await pool.query(
      `INSERT INTO asistencias (horario_id, usuario_id, fecha, asistio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (horario_id, usuario_id, fecha)
       DO UPDATE SET asistio = $4`,
      [horario_id, usuario_id, fecha, Boolean(asistio)]
    )
    res.json({ mensaje: 'Asistencia registrada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar asistencia' })
  }
}
