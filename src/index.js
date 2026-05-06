import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'

import authRoutes from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import clasesRoutes from './routes/clasesRoutes.js'
import reservasRoutes from './routes/reservasRoutes.js'
import pagosRoutes from './routes/pagosRoutes.js'
import profesorRoutes from './routes/profesorRoutes.js'

dotenv.config()

const app    = express()
const server = createServer(app)
const io     = new Server(server, {
  cors: { origin: 'http://localhost:5173' }
})

const PORT = process.env.PORT || 3000

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.set('io', io)

app.use('/api/auth',     authRoutes)
app.use('/api/admin',    adminRoutes)
app.use('/api',          clasesRoutes)
app.use('/api/reservas', reservasRoutes)
app.use('/api/pagos',    pagosRoutes)
app.use('/api/profesor', profesorRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'El servidor está funcionando ✅' })
})

io.on('connection', (socket) => {
  console.log('Panel conectado:', socket.id)
  socket.on('disconnect', () => {
    console.log('Panel desconectado:', socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})