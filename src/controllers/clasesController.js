import pool from '../db/conexion.js'
import { LIBRES, ORDEN_HORARIO, periodoPedido } from '../utils/cupos.js'
import { liberarFijasYAvisar } from '../utils/planes.js'

// Horarios activos con los lugares libres del período que se va a reservar
// (?desde y ?hasta que manda la app, o el próximo semanal).
export const obtenerHorariosDisponibles = async (req, res) => {
  const { desde, hasta } = periodoPedido(req.query)
  try {
    // Antes de contar: los lugares fijos de planes vencidos quedan libres.
    await liberarFijasYAvisar(req.app.get('io'))
    const resultado = await pool.query(
      `SELECT 
        h.id,
        h.dias,
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
       ORDER BY c.nombre, ${ORDEN_HORARIO('h')}`,
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