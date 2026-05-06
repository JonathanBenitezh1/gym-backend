import pool from '../db/conexion.js'

// ─── CLASES ───────────────────────────────────────────

export const crearClase = async (req, res) => {
  const { nombre, rama, profesor_id, descripcion, duracion } = req.body

  try {
    const resultado = await pool.query(
      `INSERT INTO clases (nombre, rama, profesor_id, descripcion, duracion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, rama, profesor_id, descripcion, duracion]
    )
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear la clase' })
  }
}

export const editarClase = async (req, res) => {
  const { id } = req.params
  const { nombre, rama, profesor_id, descripcion, duracion, activo } = req.body

  try {
    const resultado = await pool.query(
      `UPDATE clases SET nombre=$1, rama=$2, profesor_id=$3,
       descripcion=$4, duracion=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [nombre, rama, profesor_id, descripcion, duracion, activo, id]
    )
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al editar la clase' })
  }
}

export const eliminarClase = async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM clases WHERE id = $1', [id])
    res.json({ mensaje: 'Clase eliminada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar la clase' })
  }
}

export const obtenerClases = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, u.nombre AS nombre_profesor
       FROM clases c
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       ORDER BY c.rama, c.nombre`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener las clases' })
  }
}

// ─── HORARIOS ─────────────────────────────────────────

export const crearHorario = async (req, res) => {
  const { clase_id, dia_semana, hora_inicio, hora_fin,
          cupos_totales, precio } = req.body

  try {
    const resultado = await pool.query(
      `INSERT INTO horarios 
       (clase_id, dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, precio)
       VALUES ($1, $2, $3, $4, $5, $5, $6)
       RETURNING *`,
      [clase_id, dia_semana, hora_inicio, hora_fin, cupos_totales, precio]
    )
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear el horario' })
  }
}

export const editarHorario = async (req, res) => {
  const { id } = req.params
  const { dia_semana, hora_inicio, hora_fin,
          cupos_totales, cupos_disponibles, precio, activo } = req.body

  try {
    const resultado = await pool.query(
      `UPDATE horarios SET dia_semana=$1, hora_inicio=$2, hora_fin=$3,
       cupos_totales=$4, cupos_disponibles=$5, precio=$6, activo=$7
       WHERE id=$8 RETURNING *`,
      [dia_semana, hora_inicio, hora_fin,
       cupos_totales, cupos_disponibles, precio, activo, id]
    )
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al editar el horario' })
  }
}

export const eliminarHorario = async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM horarios WHERE id = $1', [id])
    res.json({ mensaje: 'Horario eliminado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar el horario' })
  }
}

// ─── USUARIOS ─────────────────────────────────────────

export const obtenerUsuarios = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, dni, rol, created_at
       FROM usuarios ORDER BY created_at DESC`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
}

export const cambiarRol = async (req, res) => {
  const { id } = req.params
  const { rol } = req.body

  const rolesValidos = ['alumno', 'profesor', 'profesional', 'admin']
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' })
  }

  try {
    const resultado = await pool.query(
      'UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id, nombre, email, rol',
      [rol, id]
    )
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cambiar el rol' })
  }
}

// ─── RESERVAS Y PAGOS ─────────────────────────────────

export const obtenerReservas = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT r.*, u.nombre AS alumno, u.dni,
              c.nombre AS clase, h.dia_semana, h.hora_inicio,
              p.metodo, p.estado AS estado_pago
       FROM reservas r
       JOIN usuarios u ON r.usuario_id = u.id
       JOIN horarios h ON r.horario_id = h.id
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       ORDER BY r.created_at DESC`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener reservas' })
  }
}

export const confirmarPagoEfectivo = async (req, res) => {
  const { id } = req.params

  try {
    await pool.query(
      `UPDATE pagos SET estado='pagado' WHERE reserva_id=$1`, [id]
    )
    await pool.query(
      `UPDATE reservas SET estado='pagado' WHERE id=$1`, [id]
    )

    const io = req.app.get('io')
    io.emit('pago_confirmado', { reserva_id: id })

    res.json({ mensaje: 'Pago confirmado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al confirmar el pago' })
  }
}

export const obtenerProfesores = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, dni 
       FROM usuarios 
       WHERE rol = 'profesor' OR rol = 'profesional'
       ORDER BY nombre`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener profesores' })
  }
}