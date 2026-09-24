import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'

import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import clasesRoutes from './routes/clasesRoutes.js'
import reservasRoutes from './routes/reservasRoutes.js'
import pagosRoutes from './routes/pagosRoutes.js'
import profesorRoutes from './routes/profesorRoutes.js'
import perfilRoutes from './routes/perfilRoutes.js'
import asistenciaRoutes from './routes/asistenciaRoutes.js'
import presenciaRoutes from './routes/presenciaRoutes.js'
import esperaRoutes     from './routes/esperaRoutes.js'
import progresoRoutes   from './routes/progresoRoutes.js'
import cuotaRoutes      from './routes/cuotaRoutes.js'
import puertaRoutes     from './routes/puertaRoutes.js'
import { leerUsuario, sesionVigente } from './middlewares/authMiddleware.js'
import { limiteGeneral, limitePuerta } from './middlewares/limites.js'

dotenv.config()

// Orígenes permitidos para CORS. En desarrollo apunta a Vite (localhost:5173);
// en producción se define con CORS_ORIGIN. Acepta varios separados por coma,
// útil para tener el dominio propio y el de las vistas previas a la vez.
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const origenesPermitidos = CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
const permiteCualquiera = origenesPermitidos.includes('*')

const corsOptions = {
  origin: permiteCualquiera ? true : origenesPermitidos,
  credentials: true
}

const app    = express()
const server = createServer(app)
const io     = new Server(server, { cors: corsOptions })

const PORT = process.env.PORT || 3000

// Railway (y cualquier hosting con proxy) reenvía las peticiones. Sin esto,
// el limitador de intentos vería siempre la IP del proxy en vez de la real.
app.set('trust proxy', 1)

// Cabeceras de seguridad. crossOriginResourcePolicy va en 'cross-origin'
// porque el frontend vive en otro dominio.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors(corsOptions))
app.use(express.json({ limit: '100kb' }))

// Límites de pedidos: ver middlewares/limites.js.
app.use('/api', limiteGeneral)

app.set('io', io)

app.use('/api/auth',       authRoutes)
app.use('/api/admin',      adminRoutes)
app.use('/api',            clasesRoutes)
app.use('/api/reservas',   reservasRoutes)
app.use('/api/pagos',      pagosRoutes)
app.use('/api/profesor',   profesorRoutes)
app.use('/api/perfil',     perfilRoutes)
app.use('/api/asistencia', asistenciaRoutes)
app.use('/api/presencia',  presenciaRoutes)
app.use('/api/espera',     esperaRoutes)
app.use('/api/progreso',   progresoRoutes)
app.use('/api/cuota',      cuotaRoutes)
app.use('/api/puerta',     limitePuerta, puertaRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'El servidor está funcionando ✅' })
})

// Una ruta de la API que no existe contesta JSON, no la página HTML de Express.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'No existe esa ruta' })
})

const MENSAJES_DE_ERROR = {
  400: 'El cuerpo del pedido no es válido',
  413: 'El pedido es demasiado grande'
}

// Cualquier error que se escape de un controlador. Sin esto, Express contesta
// con su página de error, que en desarrollo muestra el stack trace y rutas del
// servidor. El detalle queda en los logs, no en la respuesta.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  // Un JSON mal formado es culpa de quien llama: antes salía como 500 y
  // parecía que la API estaba rota.
  const estado = Number(error.status || error.statusCode) || 500
  if (estado >= 500) console.error('Error no controlado:', error)

  res.status(estado).json({
    error: MENSAJES_DE_ERROR[estado] || (estado >= 500 ? 'Error interno del servidor' : 'Pedido no válido')
  })
})

/**
 * La conexion de tiempo real ahora pide el mismo token que la API.
 *
 * Antes cualquiera podia conectarse sin credenciales y escuchar todo lo que
 * el servidor emitia, incluidos ids de usuario y montos de pago.
 */
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token

  if (!token) {
    return next(new Error('Falta el token'))
  }

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })

    // Como en la API, el rol sale de la base: un rol cambiado o una baja
    // rigen también para el tiempo real.
    const usuario = await leerUsuario(datos.id)
    if (!usuario || !usuario.activo) return next(new Error('Usuario sin acceso'))
    if (!sesionVigente(datos, usuario)) return next(new Error('Token invalido o expirado'))

    socket.data.usuario = { id: usuario.id, rol: usuario.rol }
    next()
  } catch {
    next(new Error('Token invalido o expirado'))
  }
})

io.on('connection', (socket) => {
  const { id, rol } = socket.data.usuario

  // Cada uno entra a su propia sala, asi los avisos personales le llegan
  // solo a quien corresponde. Antes un "tu pago fue confirmado" le aparecia
  // a todos los socios conectados, no al que habia pagado.
  socket.join(`usuario:${id}`)

  // El panel necesita enterarse de cada reserva y de cada pago.
  if (rol === 'admin') socket.join('admins')

  socket.on('disconnect', () => {})
})

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
