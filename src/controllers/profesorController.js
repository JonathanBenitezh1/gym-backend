import pool from '../db/conexion.js'

// ─── MIS CLASES Y HORARIOS ────────────────────────────

export const obtenerMisClases = async (req, res) => {
  const profesor_id = req.usuario.id
  try {
    const resultado = await pool.query(
      `SELECT c.*, COUNT(h.id) AS cantidad_horarios
       FROM clases c
       LEFT JOIN horarios h ON h.clase_id = c.id
       WHERE c.profesor_id = $1 AND c.activo = true
       GROUP BY c.id ORDER BY c.nombre`,
      [profesor_id]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener las clases' })
  }
}

export const obtenerMisHorarios = async (req, res) => {
  const profesor_id = req.usuario.id
  try {
    const resultado = await pool.query(
      `SELECT h.*, c.nombre AS clase, c.rama
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       WHERE c.profesor_id = $1
       ORDER BY h.dia_semana, h.hora_inicio`,
      [profesor_id]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los horarios' })
  }
}

export const modificarHorario = async (req, res) => {
  const { id } = req.params
  const profesor_id = req.usuario.id
  const { dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, activo } = req.body

  try {
    const verificacion = await pool.query(
      `SELECT h.id FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       WHERE h.id = $1 AND c.profesor_id = $2`,
      [id, profesor_id]
    )
    if (verificacion.rows.length === 0) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este horario' })
    }
    const resultado = await pool.query(
      `UPDATE horarios 
       SET dia_semana=$1, hora_inicio=$2, hora_fin=$3,
           cupos_totales=$4, cupos_disponibles=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, activo, id]
    )
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al modificar el horario' })
  }
}

// ─── RUTINAS ──────────────────────────────────────────

export const buscarAlumnoPorDni = async (req, res) => {
  const { dni } = req.params
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, dni 
       FROM usuarios WHERE dni = $1 AND rol = 'alumno'`,
      [dni]
    )
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ningún alumno con ese DNI' })
    }
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al buscar el alumno' })
  }
}

export const obtenerRutinaDeAlumno = async (req, res) => {
  const { alumno_id } = req.params
  const profesor_id = req.usuario.id

  try {
    // Obtenemos la rutina
    const rutina = await pool.query(
      `SELECT r.*, u.nombre AS alumno, u.dni
       FROM rutinas r
       JOIN usuarios u ON r.alumno_id = u.id
       WHERE r.alumno_id = $1 AND r.profesor_id = $2`,
      [alumno_id, profesor_id]
    )

    if (rutina.rows.length === 0) {
      return res.json(null)
    }

    const rutina_id = rutina.rows[0].id

    // Obtenemos las sesiones con sus ejercicios
    const sesiones = await pool.query(
      `SELECT s.*, 
              json_agg(
                json_build_object(
                  'id', e.id,
                  'nombre', e.nombre,
                  'series', e.series,
                  'repeticiones', e.repeticiones,
                  'orden', e.orden
                ) ORDER BY e.orden
              ) FILTER (WHERE e.id IS NOT NULL) AS ejercicios
       FROM sesiones s
       LEFT JOIN ejercicios e ON e.sesion_id = s.id
       WHERE s.rutina_id = $1
       GROUP BY s.id
       ORDER BY s.orden`,
      [rutina_id]
    )

    res.json({
      ...rutina.rows[0],
      sesiones: sesiones.rows
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener la rutina' })
  }
}

export const guardarRutina = async (req, res) => {
  const profesor_id = req.usuario.id
  const { alumno_id, sesiones } = req.body

  // sesiones es un array de { nombre, orden, ejercicios: [{ nombre, series, repeticiones, orden }] }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Verificamos que el alumno exista
    const alumno = await client.query(
      'SELECT id FROM usuarios WHERE id = $1 AND rol = $2',
      [alumno_id, 'alumno']
    )
    if (alumno.rows.length === 0) {
      throw new Error('Alumno no encontrado')
    }

    // Buscamos si ya existe una rutina de este profesor para este alumno
    const existente = await client.query(
      'SELECT id FROM rutinas WHERE profesor_id = $1 AND alumno_id = $2',
      [profesor_id, alumno_id]
    )

    let rutina_id

    if (existente.rows.length > 0) {
      rutina_id = existente.rows[0].id
      // Borramos sesiones y ejercicios anteriores (CASCADE los borra)
      await client.query('DELETE FROM sesiones WHERE rutina_id = $1', [rutina_id])
      // Actualizamos fecha
      await client.query(
        'UPDATE rutinas SET updated_at = NOW() WHERE id = $1',
        [rutina_id]
      )
    } else {
      // Creamos la rutina nueva
      const nueva = await client.query(
        'INSERT INTO rutinas (profesor_id, alumno_id) VALUES ($1, $2) RETURNING id',
        [profesor_id, alumno_id]
      )
      rutina_id = nueva.rows[0].id
    }

    // Insertamos sesiones y ejercicios
    for (const sesion of sesiones) {
      const nuevaSesion = await client.query(
        'INSERT INTO sesiones (rutina_id, nombre, orden) VALUES ($1, $2, $3) RETURNING id',
        [rutina_id, sesion.nombre, sesion.orden]
      )
      const sesion_id = nuevaSesion.rows[0].id

      for (const ejercicio of sesion.ejercicios || []) {
        await client.query(
          'INSERT INTO ejercicios (sesion_id, nombre, series, repeticiones, orden) VALUES ($1, $2, $3, $4, $5)',
          [sesion_id, ejercicio.nombre, ejercicio.series, ejercicio.repeticiones, ejercicio.orden]
        )
      }
    }

    await client.query('COMMIT')
    res.status(201).json({ mensaje: 'Rutina guardada correctamente' })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: error.message || 'Error al guardar la rutina' })
  } finally {
    client.release()
  }
}

export const obtenerMisRutinasComoAlumno = async (req, res) => {
  const alumno_id = req.usuario.id

  try {
    const rutinas = await pool.query(
      `SELECT r.*, u.nombre AS profesor
       FROM rutinas r
       JOIN usuarios u ON r.profesor_id = u.id
       WHERE r.alumno_id = $1
       ORDER BY r.updated_at DESC`,
      [alumno_id]
    )

    // Para cada rutina traemos sus sesiones y ejercicios
    const result = []

    for (const rutina of rutinas.rows) {
      const sesiones = await pool.query(
        `SELECT s.*,
                json_agg(
                  json_build_object(
                    'id', e.id,
                    'nombre', e.nombre,
                    'series', e.series,
                    'repeticiones', e.repeticiones,
                    'orden', e.orden
                  ) ORDER BY e.orden
                ) FILTER (WHERE e.id IS NOT NULL) AS ejercicios
         FROM sesiones s
         LEFT JOIN ejercicios e ON e.sesion_id = s.id
         WHERE s.rutina_id = $1
         GROUP BY s.id
         ORDER BY s.orden`,
        [rutina.id]
      )

      result.push({
        ...rutina,
        sesiones: sesiones.rows
      })
    }

    res.json(result)

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener rutinas' })
  }
}