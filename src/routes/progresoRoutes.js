import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { obtenerMiProgreso, registrarProgreso, borrarProgreso } from '../controllers/progresoController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.get('/',        obtenerMiProgreso)
router.post('/',       registrarProgreso)
router.delete('/:id',  borrarProgreso)

export default router
