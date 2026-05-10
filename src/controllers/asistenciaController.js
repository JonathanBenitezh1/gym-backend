import pool from '../db/conexion.js'

export const obtenerAlumnosDeHorario = async (req, res) => {
  const { horario_id } = req.params
  const { fecha } = req.query

  try {
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
    await pool.query(
      `INSERT INTO asistencias (horario_id, usuario_id, fecha, asistio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (horario_id, usuario_id, fecha)
       DO UPDATE SET asistio = $4`,
      [horario_id, usuario_id, fecha, asistio]
    )
    res.json({ mensaje: 'Asistencia registrada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar asistencia' })
  }
}