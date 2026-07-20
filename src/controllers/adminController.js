import pool from '../db/conexion.js'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'

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
    const io = req.app.get('io')
      io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear la clase' })
  }
}

export const editarClase = async (req, res) => {
  const { id } = req.params
  const { nombre, rama, profesor_id, descripcion, duracion, activo } = req.body

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const resultado = await client.query(
      `UPDATE clases SET nombre=$1, rama=$2, profesor_id=$3,
       descripcion=$4, duracion=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [nombre, rama, profesor_id, descripcion, duracion, activo, id]
    )

    // Si se desactiva la clase, cancelar reservas pendientes y devolver cupos
    if (!activo) {
      // Obtenemos las reservas pendientes de esta clase
      const reservasPendientes = await client.query(
        `SELECT r.id, r.horario_id FROM reservas r
         JOIN horarios h ON r.horario_id = h.id
         WHERE h.clase_id = $1 AND r.estado = 'pendiente'`,
        [id]
      )

      for (const reserva of reservasPendientes.rows) {
        // Devolvemos el cupo
        await client.query(
          `UPDATE horarios SET cupos_disponibles = cupos_disponibles + 1
           WHERE id = $1`,
          [reserva.horario_id]
        )
        // Cancelamos la reserva
        await client.query(
          `UPDATE reservas SET estado = 'cancelado' WHERE id = $1`,
          [reserva.id]
        )
      }
    }

    await client.query('COMMIT')

    // Notificar a todos en tiempo real
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
    if (!activo) {
      io.emit('reserva_cancelada', { mensaje: 'Clase desactivada' })
    }

    res.json(resultado.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'Error al editar la clase' })
  } finally {
    client.release()
  }
}
export const eliminarClase = async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM clases WHERE id = $1', [id])
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
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
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear el horario' })
  }
}

// Lista todos los horarios, incluidos los inactivos, con el nombre de la
// clase y del profesor. La ruta pública solo devuelve los activos, así que
// sin esto el administrador no podía ver ni corregir los que dio de baja.
export const obtenerHorariosAdmin = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT h.*, c.nombre AS clase, c.rama, c.activo AS clase_activa,
              u.nombre AS profesor
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       ORDER BY c.nombre, h.dia_semana, h.hora_inicio`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los horarios' })
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
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
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

/**
 * Genera una contraseña temporal fácil de dictar en voz alta.
 * Se omiten los caracteres que se confunden al leerlos (O/0, I/1/L).
 */
function generarPasswordTemporal() {
  const LETRAS  = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const NUMEROS = '23456789'
  let clave = ''
  for (let i = 0; i < 4; i++) clave += LETRAS[randomInt(LETRAS.length)]
  for (let i = 0; i < 4; i++) clave += NUMEROS[randomInt(NUMEROS.length)]
  return clave
}

/**
 * Restablece la contraseña de un usuario y devuelve la temporal UNA sola vez,
 * para que el administrador se la pase al socio. Queda marcada como temporal:
 * la app lo obliga a elegir una propia antes de seguir usando el sistema.
 */
export const restablecerPassword = async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE id = $1',
      [id]
    )

    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const temporal = generarPasswordTemporal()
    const hash = await bcrypt.hash(temporal, 10)

    await pool.query(
      'UPDATE usuarios SET password = $1, debe_cambiar_password = true WHERE id = $2',
      [hash, id]
    )

    res.json({
      mensaje: 'Contraseña restablecida',
      usuario: usuario.rows[0],
      password_temporal: temporal
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al restablecer la contraseña' })
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

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const reserva = await client.query(
      'SELECT estado FROM reservas WHERE id = $1',
      [id]
    )

    if (reserva.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Reserva no encontrada' })
    }

    if (reserva.rows[0].estado === 'cancelado') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No se puede confirmar el pago de una reserva cancelada' })
    }

    if (reserva.rows[0].estado === 'pagado') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Esta reserva ya figura como pagada' })
    }

    await client.query(`UPDATE pagos SET estado='pagado' WHERE reserva_id=$1`, [id])
    await client.query(`UPDATE reservas SET estado='pagado' WHERE id=$1`, [id])

    await client.query('COMMIT')

    const io = req.app.get('io')
    io.emit('pago_confirmado', { reserva_id: id })

    res.json({ mensaje: 'Pago confirmado correctamente' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'Error al confirmar el pago' })
  } finally {
    client.release()
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
export const verificarClaseAntesDeshabilitar = async (req, res) => {
  const { id } = req.params
  try {
    const pagadas = await pool.query(
      `SELECT COUNT(*) as total FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       WHERE h.clase_id = $1 AND r.estado = 'pagado'`,
      [id]
    )
    const pendientes = await pool.query(
      `SELECT COUNT(*) as total FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       WHERE h.clase_id = $1 AND r.estado = 'pendiente'`,
      [id]
    )
    res.json({
      pagadas: parseInt(pagadas.rows[0].total),
      pendientes: parseInt(pendientes.rows[0].total)
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al verificar la clase' })
  }
}