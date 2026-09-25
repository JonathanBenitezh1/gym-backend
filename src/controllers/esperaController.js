import pool from '../db/conexion.js'
import { LIBRES, SE_SUPERPONE, proximoPeriodo } from '../utils/cupos.js'
import { textoDias } from '../utils/validaciones.js'

// La lista de espera es para la semana que reserva la app: la próxima.

// Tope por socio: sin esto uno solo podia anotarse en todos los horarios.
const MAX_ANOTADAS = 10

export const obtenerMiLista = async (req, res) => {
  const { desde, hasta } = proximoPeriodo()
  try {
    const resultado = await pool.query(
      `SELECT le.horario_id, le.created_at, c.nombre AS clase,
              h.dias, h.hora_inicio, h.hora_fin,
              ${LIBRES('h', '$2', '$3')} AS cupos_disponibles
       FROM lista_espera le
       JOIN horarios h ON h.id = le.horario_id
       JOIN clases c ON c.id = h.clase_id
       WHERE le.usuario_id = $1 AND h.activo AND c.activo
       ORDER BY le.created_at`,
      [req.usuario.id, desde, hasta]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener tu lista de espera' })
  }
}

export const anotarme = async (req, res) => {
  const horario_id = Number(req.params.horario_id)
  const usuario_id = req.usuario.id
  if (!Number.isInteger(horario_id) || horario_id <= 0) {
    return res.status(400).json({ error: 'Horario inválido' })
  }

  const { desde, hasta } = proximoPeriodo()

  try {
    const horario = await pool.query(
      `SELECT ${LIBRES('h', '$2', '$3')} AS libres, h.activo AND c.activo AS disponible
       FROM horarios h JOIN clases c ON c.id = h.clase_id
       WHERE h.id = $1`,
      [horario_id, desde, hasta]
    )
    if (horario.rows.length === 0 || !horario.rows[0].disponible) {
      return res.status(404).json({ error: 'Esa clase ya no está disponible' })
    }
    // Con lugar libre no hay nada que esperar: se reserva directo.
    if (horario.rows[0].libres > 0) {
      return res.status(400).json({ error: 'La semana que viene todavía hay lugar: podés reservar directo' })
    }

    const yaReservo = await pool.query(
      `SELECT 1 FROM reservas r
       WHERE r.usuario_id = $1 AND r.horario_id = $2
         AND ${SE_SUPERPONE('r', '$3', '$4')}
       UNION ALL
       SELECT 1 FROM reservas_fijas rf WHERE rf.usuario_id = $1 AND rf.horario_id = $2`,
      [usuario_id, horario_id, desde, hasta]
    )
    if (yaReservo.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tenés una reserva en esta clase' })
    }

    const cantidad = await pool.query(
      'SELECT COUNT(*)::int AS n FROM lista_espera WHERE usuario_id = $1',
      [usuario_id]
    )
    if (cantidad.rows[0].n >= MAX_ANOTADAS) {
      return res.status(400).json({ error: `Podés esperar hasta ${MAX_ANOTADAS} clases a la vez` })
    }

    await pool.query(
      `INSERT INTO lista_espera (usuario_id, horario_id) VALUES ($1, $2)
       ON CONFLICT (usuario_id, horario_id) DO NOTHING`,
      [usuario_id, horario_id]
    )
    res.status(201).json({ mensaje: 'Te avisamos si se libera un lugar' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No pudimos anotarte' })
  }
}

export const salirDeLista = async (req, res) => {
  const horario_id = Number(req.params.horario_id)
  if (!Number.isInteger(horario_id) || horario_id <= 0) {
    return res.status(400).json({ error: 'Horario inválido' })
  }
  try {
    await pool.query(
      'DELETE FROM lista_espera WHERE usuario_id = $1 AND horario_id = $2',
      [req.usuario.id, horario_id]
    )
    res.json({ mensaje: 'Saliste de la lista de espera' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No pudimos sacarte de la lista' })
  }
}

/**
 * Avisa a los anotados de los horarios que tienen lugar libre.
 *
 * Se llama después del COMMIT de lo que liberó el cupo, así nadie recibe un
 * aviso de algo que se revirtió. Si falla, no rompe la operación que lo
 * disparó: el socio igual ve el lugar libre al abrir la app.
 */
export async function avisarCupoLibre(io, horarioIds) {
  const ids = [...new Set(horarioIds.map(Number))].filter(Number.isInteger)
  if (ids.length === 0) return
  const { desde, hasta } = proximoPeriodo()
  try {
    const resultado = await pool.query(
      `SELECT le.usuario_id, h.id AS horario_id, c.nombre AS clase,
              h.dias, h.hora_inicio
       FROM lista_espera le
       JOIN horarios h ON h.id = le.horario_id
       JOIN clases c ON c.id = h.clase_id
       WHERE le.horario_id = ANY($1::int[])
         AND ${LIBRES('h', '$2', '$3')} > 0 AND h.activo AND c.activo`,
      [ids, desde, hasta]
    )
    for (const fila of resultado.rows) {
      io.to(`usuario:${fila.usuario_id}`).emit('cupo_liberado', {
        horario_id: fila.horario_id,
        clase: fila.clase,
        dias: fila.dias,
        // La app anterior arma el aviso con este texto.
        dia_semana: textoDias(fila.dias),
        hora_inicio: fila.hora_inicio
      })
    }
  } catch (error) {
    console.error('No se pudo avisar a la lista de espera:', error)
  }
}
