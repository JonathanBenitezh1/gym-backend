import { Router } from 'express'
import { verificarToken, soloProfesor, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import {
  obtenerMisClases,
  obtenerMisHorarios,
  modificarHorario,
  buscarAlumnoPorDni,
  buscarAlumnos,
  obtenerRutinaDeAlumno,
  guardarRutina,
  obtenerMisRutinasComoAlumno
} from '../controllers/profesorController.js'
import { obtenerPlantillas, guardarPlantilla, borrarPlantilla } from '../controllers/plantillasController.js'

const router = Router()

router.use(verificarToken, exigirPasswordPropia)

router.get('/mis-clases',          soloProfesor, obtenerMisClases)
router.get('/mis-horarios',        soloProfesor, obtenerMisHorarios)
router.put('/horarios/:id',        soloProfesor, modificarHorario)
router.get('/alumnos',            soloProfesor, buscarAlumnos)
router.get('/alumnos/:dni',        soloProfesor, buscarAlumnoPorDni)
router.get('/rutinas/:alumno_id',  soloProfesor, obtenerRutinaDeAlumno)
router.post('/rutinas',            soloProfesor, guardarRutina)
router.get('/plantillas',         soloProfesor, obtenerPlantillas)
router.post('/plantillas',        soloProfesor, guardarPlantilla)
router.delete('/plantillas/:id',  soloProfesor, borrarPlantilla)

// Esta la usa cualquier alumno para ver la rutina que le cargaron.
router.get('/mis-rutinas',         obtenerMisRutinasComoAlumno)

export default router