import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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

// Límite general: evita que un cliente sature la API a pedidos.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Esperá unos minutos e intentá de nuevo.' }
}))

// Límite estricto en login y registro: es la defensa contra fuerza bruta.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Esperá 15 minutos e intentá de nuevo.' }
})

app.set('io', io)

app.use('/api/auth',       limiteAuth, authRoutes)
app.use('/api/admin',      adminRoutes)
app.use('/api',            clasesRoutes)
app.use('/api/reservas',   reservasRoutes)
app.use('/api/pagos',      pagosRoutes)
app.use('/api/profesor',   profesorRoutes)
app.use('/api/perfil',     perfilRoutes)
app.use('/api/asistencia', asistenciaRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'El servidor está funcionando ✅' })
})

io.on('connection', (socket) => {
  socket.on('disconnect', () => {})
})

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
