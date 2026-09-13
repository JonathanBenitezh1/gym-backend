import { Router } from 'express'
import { verificarToken, exigirPasswordPropia, soloProfesor } from '../middlewares/authMiddleware.js'
import { profesEnSede, miTurno, marcarLlegada, marcarSalida } from '../controllers/presenciaController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

// Cualquier socio con sesión ve quién está en el gimnasio.
router.get('/en-sede', profesEnSede)

// Marcar la llegada y la salida es de quien da clases, incluido el admin.
router.get('/mi-turno', soloProfesor, miTurno)
router.post('/llegada', soloProfesor, marcarLlegada)
router.post('/salida',  soloProfesor, marcarSalida)

export default router
