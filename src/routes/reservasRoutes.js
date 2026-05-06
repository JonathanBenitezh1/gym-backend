import { Router } from 'express'
import { verificarToken } from '../middlewares/authMiddleware.js'
import {
  crearReserva,
  obtenerMisReservas,
  cancelarReserva,
  obtenerHorariosReservados
} from '../controllers/reservasController.js'

const router = Router()

// Todas requieren estar logueado
router.use(verificarToken)

router.post('/', crearReserva)
router.get('/mis-reservas', obtenerMisReservas)
router.put('/:id/cancelar', cancelarReserva)
router.get('/reservados', obtenerHorariosReservados)

export default router