import { Router } from 'express'
import { verificarToken, soloAdmin, exigirPasswordPropia } from '../middlewares/authMiddleware.js'
import {
  crearClase, editarClase, eliminarClase, obtenerClases,
  crearHorario, editarHorario, eliminarHorario, obtenerHorariosAdmin,
  obtenerUsuarios, cambiarRol, restablecerPassword,
  obtenerReservas, confirmarPagoEfectivo,
  obtenerProfesores, cambiarEstadoUsuario, obtenerActividad, cambiarApto,
  crearCuentaPuerta, cerrarSesionesUsuario
} from '../controllers/adminController.js'
import { verificarClaseAntesDeshabilitar } from '../controllers/adminController.js'
import { obtenerEstadisticas } from '../controllers/estadisticasController.js'
import { guardarFoto, borrarFoto } from '../controllers/puertaController.js'
import {
  obtenerConfigCuota, guardarConfigCuota, obtenerCuotas,
  registrarPagoCuota, corregirVence, obtenerPagosDeSocio, asignarPlan
} from '../controllers/cuotaController.js'
import { obtenerPlanesAdmin, crearPlan, editarPlan, eliminarPlan } from '../controllers/planesController.js'

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
router.put('/usuarios/:id/cerrar-sesiones', cerrarSesionesUsuario)
router.post('/cuentas-puerta', crearCuentaPuerta)
router.put('/usuarios/:id/apto', cambiarApto)
router.put('/usuarios/:id/foto', guardarFoto)
router.delete('/usuarios/:id/foto', borrarFoto)

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
router.put('/cuotas/:usuario_id/plan', asignarPlan)

// Planes mensuales
router.get('/planes', obtenerPlanesAdmin)
router.post('/planes', crearPlan)
router.put('/planes/:id', editarPlan)
router.delete('/planes/:id', eliminarPlan)

// Estadisticas del panel
router.get('/estadisticas', obtenerEstadisticas)
export default router