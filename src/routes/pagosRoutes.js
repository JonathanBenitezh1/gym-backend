import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { registrarPagoEfectivo } from '../controllers/pagosController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.post('/', registrarPagoEfectivo)

export default router