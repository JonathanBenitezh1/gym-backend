import { Router } from 'express'
import { registro, login } from '../controllers/authController.js'
import { limiteLoginIp, limiteLoginCuenta, limiteRegistro } from '../middlewares/limites.js'

const router = Router()

router.post('/registro', limiteRegistro, registro)
router.post('/login', limiteLoginIp, limiteLoginCuenta, login)

export default router