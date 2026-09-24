import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import {
  obtenerPerfil,
  editarPerfil,
  cambiarPassword,
  obtenerHistorialPagos
} from '../controllers/perfilController.js'
import { limiteCambioClave } from '../middlewares/limites.js'

const router = Router()

router.use(verificarToken)

// Estas dos siguen abiertas con una clave temporal: son justo las que
// necesita la pantalla de cambio obligatorio para poder salir de ahi.
router.get('/',                 obtenerPerfil)
router.put('/cambiar-password', limiteCambioClave, cambiarPassword)

// De aca para abajo hace falta tener una contrasena propia.
router.use(exigirPasswordPropia)

router.put('/',      editarPerfil)
router.get('/pagos', obtenerHistorialPagos)
export default router