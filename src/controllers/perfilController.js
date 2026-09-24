import pool from '../db/conexion.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { validarDatosUsuario, duracionSesion } from '../utils/validaciones.js'
import { olvidarUsuario } from '../middlewares/authMiddleware.js'

export const obtenerPerfil = async (req, res) => {
  const id = req.usuario.id
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, dni, telefono, rol, created_at, debe_cambiar_password,
              to_char(apto_vence, 'YYYY-MM-DD') AS apto_vence
       FROM usuarios WHERE id = $1`,
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
  const { nombre, telefono } = req.body
  const email = String(req.body.email || '').trim().toLowerCase()

  try {
    if (!nombre || !email || !telefono) {
      return res.status(400).json({ error: 'Completá todos los campos' })
    }

    const errorValidacion = validarDatosUsuario({ nombre, email, telefono })
    if (errorValidacion) {
      return res.status(400).json({ error: errorValidacion })
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
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: 'Completá la contraseña actual y la nueva' })
    }

    const errorValidacion = validarDatosUsuario({ password: password_nueva })
    if (errorValidacion) {
      return res.status(400).json({ error: errorValidacion })
    }

    const usuario = await pool.query(
      'SELECT password FROM usuarios WHERE id = $1', [id]
    )

    const valida = await bcrypt.compare(password_actual, usuario.rows[0].password)
    if (!valida) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' })
    }

    const hashed = await bcrypt.hash(password_nueva, 10)
    // Al elegir una contraseña propia deja de estar pendiente el cambio
    // obligatorio que impone el restablecimiento desde el panel. Subir la
    // versión cierra las sesiones abiertas en otros dispositivos.
    const actualizado = await pool.query(
      `UPDATE usuarios SET password=$1, debe_cambiar_password=false, sesion_version = sesion_version + 1
       WHERE id=$2 RETURNING sesion_version, cuenta_puerta`,
      [hashed, id]
    )

    // Sin esto la marca de contraseña temporal seguiría unos segundos en memoria.
    olvidarUsuario(id)

    // El tiempo real también se corta: la app que hizo el cambio se vuelve a
    // conectar con el token nuevo, las otras sesiones quedan afuera.
    req.app.get('io').in(`usuario:${id}`).disconnectSockets(true)

    // El token viejo quedó sin validez, asi que devolvemos uno nuevo: sin
    // esto la app quedaria trabada en la pantalla de cambio obligatorio, o
    // afuera de la sesión.
    const token = jwt.sign(
      { id, rol: req.usuario.rol, debe_cambiar_password: false, ver: actualizado.rows[0].sesion_version },
      process.env.JWT_SECRET,
      { expiresIn: duracionSesion(actualizado.rows[0]) }
    )

    res.json({ mensaje: 'Contraseña actualizada correctamente', token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cambiar la contraseña' })
  }
}