import { Router } from 'express'
import { verificarToken } from '../middlewares/authMiddleware.js'
import { registrarPagoEfectivo } from '../controllers/pagosController.js'

const router = Router()

router.use(verificarToken)

router.post('/', registrarPagoEfectivo)

export default router