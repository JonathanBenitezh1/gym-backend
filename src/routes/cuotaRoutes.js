import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { obtenerMiCuota } from '../controllers/cuotaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.get('/mia', obtenerMiCuota)

export default router
