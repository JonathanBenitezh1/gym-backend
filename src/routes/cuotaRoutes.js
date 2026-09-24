import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { obtenerMiCuota, obtenerMisPagosCuota } from '../controllers/cuotaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.get('/mia', obtenerMiCuota)
router.get('/mia/pagos', obtenerMisPagosCuota)

export default router
