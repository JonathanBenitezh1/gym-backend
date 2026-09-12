import jwt from 'jsonwebtoken'

// Verifica que el token JWT sea válido
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // formato: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado, token requerido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = decoded // guardamos los datos del usuario en el request
    next() // seguimos al endpoint
  } catch (error) {
    res.status(403).json({ error: 'Token inválido o expirado' })
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