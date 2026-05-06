import { Router } from 'express'
import { verificarToken, soloProfesor } from '../middlewares/authMiddleware.js'
import {
  obtenerMisClases,
  obtenerMisHorarios,
  modificarHorario,
  buscarAlumnoPorDni,
  obtenerRutinaDeAlumno,
  guardarRutina,
  obtenerMisRutinasComoAlumno
} from '../controllers/profesorController.js'

const router = Router()

router.get('/mis-clases',          verificarToken, soloProfesor, obtenerMisClases)
router.get('/mis-horarios',        verificarToken, soloProfesor, obtenerMisHorarios)
router.put('/horarios/:id',        verificarToken, soloProfesor, modificarHorario)
router.get('/alumnos/:dni',        verificarToken, soloProfesor, buscarAlumnoPorDni)
router.get('/rutinas/:alumno_id',  verificarToken, soloProfesor, obtenerRutinaDeAlumno)
router.post('/rutinas',            verificarToken, soloProfesor, guardarRutina)
router.get('/mis-rutinas',         verificarToken, obtenerMisRutinasComoAlumno)

export default router