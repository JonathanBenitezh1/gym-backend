import pool from '../db/conexion.js'
import { normalizarSesiones } from './profesorController.js'

// Tope del gimnasio entero: sin esto la lista del selector crecia sin fin.
const MAX_PLANTILLAS = 100

export const obtenerPlantillas = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.id, p.nombre, p.sesiones, p.creador_id, p.updated_at,
              u.nombre AS creador
       FROM plantillas_rutina p
       LEFT JOIN usuarios u ON u.id = p.creador_id
       ORDER BY lower(p.nombre)`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener las plantillas' })
  }
}

/**
 * Crea una plantilla, o la reemplaza si ya existe una con ese nombre.
 *
 * Reemplazar solo puede quien la creó o un admin: si no, un profe pisaba la
 * plantilla de otro con solo repetir el nombre.
 */
export const guardarPlantilla = async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim()
  if (!nombre || nombre.length > 80) {
    return res.status(400).json({ error: 'La plantilla necesita un nombre de hasta 80 letras' })
  }

  const { error: errorSesiones, sesiones } = normalizarSesiones(req.body.sesiones)
  if (errorSesiones) {
    return res.status(400).json({ error: errorSesiones })
  }

  try {
    const existente = await pool.query(
      'SELECT id, creador_id FROM plantillas_rutina WHERE lower(nombre) = lower($1)',
      [nombre]
    )

    if (existente.rows.length > 0) {
      const { id, creador_id } = existente.rows[0]
      if (creador_id !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(409).json({ error: 'Ya hay una plantilla con ese nombre, de otro profe. Elegí otro nombre.' })
      }
      await pool.query(
        'UPDATE plantillas_rutina SET sesiones = $1, nombre = $2, updated_at = now() WHERE id = $3',
        [JSON.stringify(sesiones), nombre, id]
      )
      return res.json({ id, mensaje: 'Plantilla actualizada' })
    }

    const cantidad = await pool.query('SELECT COUNT(*)::int AS n FROM plantillas_rutina')
    if (cantidad.rows[0].n >= MAX_PLANTILLAS) {
      return res.status(400).json({ error: `El gimnasio ya tiene ${MAX_PLANTILLAS} plantillas. Borrá alguna que no se use.` })
    }

    const nueva = await pool.query(
      'INSERT INTO plantillas_rutina (nombre, creador_id, sesiones) VALUES ($1, $2, $3) RETURNING id',
      [nombre, req.usuario.id, JSON.stringify(sesiones)]
    )
    res.status(201).json({ id: nueva.rows[0].id, mensaje: 'Plantilla guardada' })
  } catch (error) {
    // Dos guardados simultáneos con el mismo nombre chocan contra el índice único.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya hay una plantilla con ese nombre' })
    }
    console.error(error)
    res.status(500).json({ error: 'No se pudo guardar la plantilla' })
  }
}

export const borrarPlantilla = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Plantilla inválida' })
  }
  try {
    const resultado = await pool.query(
      `DELETE FROM plantillas_rutina
       WHERE id = $1 AND (creador_id = $2 OR $3)
       RETURNING id`,
      [id, req.usuario.id, req.usuario.rol === 'admin']
    )
    if (resultado.rows.length === 0) {
      return res.status(403).json({ error: 'Solo quien creó la plantilla o un admin la puede borrar' })
    }
    res.json({ mensaje: 'Plantilla borrada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo borrar la plantilla' })
  }
}
