import { Router } from 'express'
import { verificarToken } from '../middlewares/authMiddleware.js'
import {
  obtenerPerfil,
  editarPerfil,
  cambiarPassword
} from '../controllers/perfilController.js'

const router = Router()

router.use(verificarToken)

router.get('/',               obtenerPerfil)
router.put('/',               editarPerfil)
router.put('/cambiar-password', cambiarPassword)

export default router