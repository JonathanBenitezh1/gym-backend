import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { obtenerPlanesPublicos, pedirPlan, cancelarPedido } from '../controllers/planesController.js'

const router = Router()

// Pública, como los horarios.
router.get('/', obtenerPlanesPublicos)

router.post('/:id/pedir', verificarToken, exigirPasswordPropia, pedirPlan)
router.delete('/pedido',  verificarToken, exigirPasswordPropia, cancelarPedido)

export default router
