import { Router } from 'express'
import { verificarToken, soloAdmin, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import {
  crearClase, editarClase, eliminarClase, obtenerClases,
  crearHorario, editarHorario, eliminarHorario, obtenerHorariosAdmin,
  obtenerUsuarios, cambiarRol, restablecerPassword,
  obtenerReservas, confirmarPagoEfectivo,
  obtenerProfesores, cambiarEstadoUsuario, obtenerActividad, cambiarApto
} from '../controllers/adminController.js'
import { verificarClaseAntesDeshabilitar } from '../controllers/adminController.js'
import { obtenerEstadisticas } from '../controllers/estadisticasController.js'
import {
  obtenerConfigCuota, guardarConfigCuota, obtenerCuotas,
  registrarPagoCuota, corregirVence, obtenerPagosDeSocio
} from '../controllers/cuotaController.js'

const router = Router()

// Todas las rutas del admin requieren token y rol admin
router.use(verificarToken, exigirPasswordPropia, soloAdmin)

// Clases
router.get('/clases', obtenerClases)
router.post('/clases', crearClase)
router.put('/clases/:id', editarClase)
router.delete('/clases/:id', eliminarClase)
router.get('/profesores', obtenerProfesores)

// Horarios
router.get('/horarios', obtenerHorariosAdmin)
router.post('/horarios', crearHorario)
router.put('/horarios/:id', editarHorario)
router.delete('/horarios/:id', eliminarHorario)

// Usuarios
router.get('/usuarios', obtenerUsuarios)
router.put('/usuarios/:id/rol', cambiarRol)
router.put('/usuarios/:id/restablecer-password', restablecerPassword)
router.put('/usuarios/:id/estado', cambiarEstadoUsuario)
router.put('/usuarios/:id/apto', cambiarApto)

// Reservas y pagos
router.get('/reservas', obtenerReservas)
router.put('/reservas/:id/confirmar-pago', confirmarPagoEfectivo)
router.get('/clases/:id/verificar', verificarClaseAntesDeshabilitar)

// Registro de actividad
router.get('/actividad', obtenerActividad)

// Cuotas
router.get('/cuotas', obtenerCuotas)
router.get('/cuotas/config', obtenerConfigCuota)
router.put('/cuotas/config', guardarConfigCuota)
router.post('/cuotas/:usuario_id/pago', registrarPagoCuota)
router.put('/cuotas/:usuario_id/vence', corregirVence)
router.get('/cuotas/:usuario_id/pagos', obtenerPagosDeSocio)

// Estadisticas del panel
router.get('/estadisticas', obtenerEstadisticas)
export default router