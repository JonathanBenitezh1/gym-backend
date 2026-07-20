import pool from '../db/conexion.js'

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
    if (!fecha) {
      return res.status(400).json({ error: 'Falta la fecha' })
    }

    if (!await puedeAccederAlHorario(req.usuario, horario_id)) {
      return res.status(403).json({ error: 'No tenés permiso para ver este horario' })
    }

    const alumnos = await pool.query(
      `SELECT
        u.id,
        u.nombre,
        u.dni,
        COALESCE(a.asistio, false) AS asistio
       FROM reservas r
       JOIN usuarios u ON r.usuario_id = u.id
       LEFT JOIN asistencias a ON a.usuario_id = u.id
         AND a.horario_id = $1
         AND a.fecha = $2
       WHERE r.horario_id = $1
       AND r.estado IN ('pendiente', 'pagado')
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
    if (!horario_id || !usuario_id || !fecha) {
      return res.status(400).json({ error: 'Faltan datos para registrar la asistencia' })
    }

    if (!await puedeAccederAlHorario(req.usuario, horario_id)) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este horario' })
    }

    // El alumno tiene que tener una reserva vigente en ese horario.
    const tieneReserva = await pool.query(
      `SELECT 1 FROM reservas
       WHERE horario_id = $1 AND usuario_id = $2
       AND estado IN ('pendiente', 'pagado')`,
      [horario_id, usuario_id]
    )
    if (tieneReserva.rows.length === 0) {
      return res.status(400).json({ error: 'Ese alumno no tiene una reserva activa en este horario' })
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
