import jwt from 'jsonwebtoken'
import pool from '../db/conexion.js'

/**
 * Datos del usuario leídos de la base, con una memoria corta.
 *
 * El token guarda el rol del momento en que se inició sesión y dura 7 días.
 * Si solo se confiara en él, a alguien que le bajaron el rol o lo dieron de
 * baja le seguirían valiendo los permisos viejos hasta una semana. Por eso
 * cada pedido mira la base.
 *
 * La memoria de 15 segundos existe porque la API está en Virginia y la base
 * en São Paulo: sin ella, cada pedido sumaría ese viaje. Cuando algo cambia
 * desde el panel (rol, baja, contraseña) se borra al instante con
 * `olvidarUsuario`, así que nunca demora un cambio hecho desde la app.
 */
const MEMORIA_MS = 15 * 1000
const memoria = new Map()

export function olvidarUsuario(id) {
  memoria.delete(Number(id))
}

export async function leerUsuario(id) {
  const clave = Number(id)
  const guardado = memoria.get(clave)
  if (guardado && guardado.vence > Date.now()) return guardado.datos

  const { rows } = await pool.query(
    'SELECT id, rol, activo, debe_cambiar_password FROM usuarios WHERE id = $1',
    [clave]
  )

  const datos = rows[0] || null
  memoria.set(clave, { datos, vence: Date.now() + MEMORIA_MS })
  return datos
}

// Verifica el token y contrasta al usuario contra la base.
export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // formato: "Bearer TOKEN"

  // 401 es "no sé quién sos", y la app lo usa para volver al login. 403 queda
  // para "sé quién sos, pero no podés hacer esto".
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado, token requerido' })
  }

  let datos
  try {
    // El algoritmo se fija a propósito: sin esto, la librería acepta el que
    // venga declarado en el propio token.
    datos = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return res.status(401).json({ error: 'Tu sesión venció. Iniciá sesión de nuevo.' })
  }

  try {
    const usuario = await leerUsuario(datos.id)

    if (!usuario) {
      return res.status(401).json({ error: 'Tu usuario ya no existe' })
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Tu usuario está dado de baja. Consultá en el gimnasio.' })
    }

    // El rol y la marca de contraseña temporal salen de la base, no del token.
    req.usuario = {
      id: usuario.id,
      rol: usuario.rol,
      debe_cambiar_password: usuario.debe_cambiar_password
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Bloquea a quien todavia usa una contrasena temporal.
 *
 * Antes este control existia solo en el navegador: RutaProtegida mostraba la
 * pantalla de cambio obligatorio, pero la API contestaba igual. Editando el
 * localStorage se saltaba la pantalla y la clave temporal quedaba servida.
 */
export const exigirPasswordPropia = (req, res, next) => {
  if (req.usuario?.debe_cambiar_password) {
    return res.status(403).json({
      error: 'Elegi una contrasena propia antes de seguir usando la app',
      codigo: 'DEBE_CAMBIAR_PASSWORD'
    })
  }
  next()
}

// Verifica que el usuario sea admin
export const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' })
  }
  next()
}

// Roles que dictan clases: además del profesor están los profesionales
// (nutrición, kinesiología, entrenamiento personal), que también tienen
// clases asignadas y gestionan sus horarios y rutinas.
export const ROLES_DOCENTES = ['profesor', 'profesional', 'admin']

export const soloProfesor = (req, res, next) => {
  if (!ROLES_DOCENTES.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Acceso solo para profesores' })
  }
  next()
}