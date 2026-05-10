import pool from '../db/conexion.js'
import bcrypt from 'bcryptjs'

export const obtenerPerfil = async (req, res) => {
  const id = req.usuario.id
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, dni, telefono, rol, created_at FROM usuarios WHERE id = $1',
      [id]
    )
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener el perfil' })
  }
}
export const obtenerHistorialPagos = async (req, res) => {
  const id = req.usuario.id
  try {
    const resultado = await pool.query(
      `SELECT 
        p.id,
        p.monto,
        p.metodo,
        p.estado,
        p.created_at,
        c.nombre AS clase,
        h.dia_semana,
        h.hora_inicio,
        r.tipo,
        r.fecha_inicio,
        r.fecha_fin
       FROM pagos p
       JOIN reservas r ON p.reserva_id = r.id
       JOIN horarios h ON r.horario_id = h.id
       JOIN clases c ON h.clase_id = c.id
       WHERE r.usuario_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener el historial de pagos' })
  }
}

export const editarPerfil = async (req, res) => {
  const id = req.usuario.id
  const { nombre, email, telefono } = req.body

  try {
    if (!nombre || !email || !telefono) {
      return res.status(400).json({ error: 'Completá todos los campos' })
    }

    // Verificamos que el email no lo use otro usuario
    const existeEmail = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
      [email, id]
    )
    if (existeEmail.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está en uso' })
    }

    const resultado = await pool.query(
      `UPDATE usuarios 
       SET nombre=$1, email=$2, telefono=$3
       WHERE id=$4
       RETURNING id, nombre, email, dni, telefono, rol`,
      [nombre, email, telefono, id]
    )

    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar el perfil' })
  }
}

export const cambiarPassword = async (req, res) => {
  const id = req.usuario.id
  const { password_actual, password_nueva } = req.body

  try {
    const usuario = await pool.query(
      'SELECT password FROM usuarios WHERE id = $1', [id]
    )

    const valida = await bcrypt.compare(password_actual, usuario.rows[0].password)
    if (!valida) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' })
    }

    if (password_nueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    const hashed = await bcrypt.hash(password_nueva, 10)
    await pool.query(
      'UPDATE usuarios SET password=$1 WHERE id=$2',
      [hashed, id]
    )

    res.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cambiar la contraseña' })
  }
}