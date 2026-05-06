import pool from '../db/conexion.js'

// Obtener todos los horarios disponibles agrupados por rama
export const obtenerHorariosDisponibles = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        h.id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        h.cupos_disponibles,
        h.cupos_totales,
        h.precio,
        c.id AS clase_id,
        c.nombre AS clase,
        c.rama,
        c.descripcion,
        c.duracion,
        u.nombre AS profesor
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       WHERE h.activo = true AND c.activo = true
       ORDER BY c.rama, h.dia_semana, h.hora_inicio`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener horarios' })
  }
}

// Obtener horarios de una clase específica
export const obtenerHorariosPorClase = async (req, res) => {
  const { id } = req.params
  try {
    const resultado = await pool.query(
      `SELECT h.*, c.nombre AS clase, c.rama, u.nombre AS profesor
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       WHERE h.clase_id = $1 AND h.activo = true`,
      [id]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener horarios' })
  }
}