import pool from '../db/conexion.js'
import { ORDEN_DIA } from '../utils/validaciones.js'
import { LIBRES, periodoPedido } from '../utils/cupos.js'

// Horarios activos con los lugares libres del período que se va a reservar
// (?desde y ?hasta que manda la app, o el próximo semanal).
export const obtenerHorariosDisponibles = async (req, res) => {
  const { desde, hasta } = periodoPedido(req.query)
  try {
    const resultado = await pool.query(
      `SELECT 
        h.id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        ${LIBRES('h', '$1', '$2')} AS cupos_disponibles,
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
       ORDER BY c.rama, ${ORDEN_DIA('h.dia_semana')}, h.hora_inicio`,
      [desde, hasta]
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
  const { desde, hasta } = periodoPedido(req.query)
  try {
    // cupos_disponibles se pisa con lo calculado: la columna ya no se usa.
    const resultado = await pool.query(
      `SELECT h.*, ${LIBRES('h', '$2', '$3')} AS cupos_disponibles,
              c.nombre AS clase, c.rama, u.nombre AS profesor
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       WHERE h.clase_id = $1 AND h.activo = true`,
      [id, desde, hasta]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener horarios' })
  }
}