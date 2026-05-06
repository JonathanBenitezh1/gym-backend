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

// Verifica que el usuario sea admin
export const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' })
  }
  next()
}

// Verifica que el usuario sea profesor o admin
export const soloProfesor = (req, res, next) => {
  if (req.usuario.rol !== 'profesor' && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para profesores' })
  }
  next()
}