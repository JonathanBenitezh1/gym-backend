import { Router } from 'express'
import { verificarToken, exigirPasswordPropia, soloRecepcion } from '../middlewares/authMiddleware.js'
import { registrarIngreso, obtenerUltimosIngresos, obtenerFoto } from '../controllers/puertaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia, soloRecepcion)

router.post('/ingreso',              registrarIngreso)
router.get('/ingresos',              obtenerUltimosIngresos)
router.get('/foto/:usuario_id',      obtenerFoto)

export default router
