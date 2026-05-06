import { Router } from 'express'
import {
  obtenerHorariosDisponibles,
  obtenerHorariosPorClase
} from '../controllers/clasesController.js'

const router = Router()

// Estas rutas son públicas, no requieren token
router.get('/horarios', obtenerHorariosDisponibles)
router.get('/clases/:id/horarios', obtenerHorariosPorClase)

export default router