import { Router } from 'express'
import { verificarToken, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import { obtenerMiLista, anotarme, salirDeLista } from '../controllers/esperaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.get('/',                obtenerMiLista)
router.post('/:horario_id',    anotarme)
router.delete('/:horario_id',  salirDeLista)

export default router
