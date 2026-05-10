import { Router } from 'express'
import { verificarToken, soloProfesor } from '../middlewares/authMiddleware.js'
import { obtenerAlumnosDeHorario, marcarAsistencia } from '../controllers/asistenciaController.js'

const router = Router()

router.use(verificarToken, soloProfesor)

router.get('/:horario_id/alumnos', obtenerAlumnosDeHorario)
router.post('/marcar', marcarAsistencia)

export default router