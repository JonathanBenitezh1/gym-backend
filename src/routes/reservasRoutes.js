import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import {
  crearReserva,
  obtenerMisReservas,
  cancelarReserva,
  obtenerHorariosReservados,
  tomarFijos,
  dejarFijo,
  obtenerMisFijos
} from '../controllers/reservasController.js'

const router = Router()

// Todas requieren estar logueado
router.use(verificarToken, exigirPasswordPropia)

router.post('/', crearReserva)
router.get('/mis-reservas', obtenerMisReservas)
router.put('/:id/cancelar', cancelarReserva)
router.get('/reservados', obtenerHorariosReservados)

// Lugares fijos del plan mensual
router.get('/fijos', obtenerMisFijos)
router.post('/fijos', tomarFijos)
router.delete('/fijos/:horario_id', dejarFijo)

export default router