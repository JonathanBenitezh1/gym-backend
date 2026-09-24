import { Router } from 'express'
import { verificarToken, exigirPasswordPropia, soloRecepcion } from '../middlewares/authMiddleware.js'
import { registrarIngreso, obtenerUltimosIngresos, obtenerFoto, obtenerPadron, recibirLote } from '../controllers/puertaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia, soloRecepcion)

router.post('/ingreso',              registrarIngreso)
router.get('/ingresos',              obtenerUltimosIngresos)
router.get('/foto/:usuario_id',      obtenerFoto)
router.get('/padron',                obtenerPadron)
router.post('/ingresos/lote',        recibirLote)

export default router
