import pool from '../db/conexion.js'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { validarHorario, ORDEN_DIA, validarDatosUsuario } from '../utils/validaciones.js'
import { registrarActividad, anotarActividad } from '../utils/auditoria.js'
import { avisarCupoLibre } from './esperaController.js'
import { olvidarUsuario } from '../middlewares/authMiddleware.js'
import { LIBRES, proximoPeriodo } from '../utils/cupos.js'

// ─── CLASES ───────────────────────────────────────────

export const crearClase = async (req, res) => {
  const { nombre, rama, profesor_id, descripcion, duracion } = req.body

  try {
    const resultado = await pool.query(
      `INSERT INTO clases (nombre, rama, profesor_id, descripcion, duracion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, rama, profesor_id, descripcion, duracion]
    )

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'clase.crear', entidad: 'clase',
      entidad_id: resultado.rows[0].id, detalle: { nombre }
    })

    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear la clase' })
  }
}

export const editarClase = async (req, res) => {
  const { id } = req.params

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const actual = await client.query(
      'SELECT * FROM clases WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (actual.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'La clase no existe' })
    }

    const previa = actual.rows[0]

    // Se cambia solo lo que trae el pedido. Antes se escribian los seis
    // campos siempre, asi que un pedido sin `activo` lo dejaba en NULL, y
    // como NULL no es verdadero, eso cancelaba todas las reservas
    // pendientes de la clase sin que nadie lo hubiera pedido.
    const tomar = (campo) => req.body[campo] === undefined ? previa[campo] : req.body[campo]

    const nombre      = tomar('nombre')
    const rama        = tomar('rama')
    const profesor_id = tomar('profesor_id')
    const descripcion = tomar('descripcion')
    const duracion    = tomar('duracion')
    const activo      = req.body.activo === undefined ? previa.activo : Boolean(req.body.activo)

    const resultado = await client.query(
      `UPDATE clases SET nombre=$1, rama=$2, profesor_id=$3,
       descripcion=$4, duracion=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [nombre, rama, profesor_id, descripcion, duracion, activo, id]
    )

    // Solo cuando la clase pasa de activa a inactiva se cancelan reservas.
    const seDesactivo = previa.activo === true && activo === false

    // Se guardan aca para poder avisarles despues del commit.
    const usuariosAfectados = new Set()
    let canceladas = 0

    if (seDesactivo) {
      // Obtenemos las reservas pendientes de esta clase. No hay cupo que
      // devolver: los lugares se cuentan con las reservas.
      const reservasPendientes = await client.query(
        `SELECT r.id, r.usuario_id FROM reservas r
         JOIN horarios h ON r.horario_id = h.id
         WHERE h.clase_id = $1 AND r.estado = 'pendiente'`,
        [id]
      )

      for (const reserva of reservasPendientes.rows) {
        usuariosAfectados.add(reserva.usuario_id)
        canceladas++

        // Cancelamos la reserva
        await client.query(
          `UPDATE reservas SET estado = 'cancelado' WHERE id = $1`,
          [reserva.id]
        )
      }
    }

    await registrarActividad(client, {
      usuario_id: req.usuario.id,
      accion: seDesactivo ? 'clase.desactivar' : 'clase.editar',
      entidad: 'clase',
      entidad_id: Number(id),
      detalle: seDesactivo ? { nombre, reservas_canceladas: canceladas } : { nombre }
    })

    await client.query('COMMIT')

    // Notificar a todos en tiempo real
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })

    if (seDesactivo) {
      // El aviso de cancelacion va a cada socio afectado y al panel, no a
      // toda la app: antes le avisaba a cualquiera que estuviera conectado.
      for (const usuario_id of usuariosAfectados) {
        io.to(`usuario:${usuario_id}`).emit('reserva_cancelada', { mensaje: 'Clase desactivada' })
      }
      io.to('admins').emit('reserva_cancelada', { mensaje: 'Clase desactivada' })
    }

    res.json(resultado.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'Error al editar la clase' })
  } finally {
    client.release()
  }
}
export const eliminarClase = async (req, res) => {
  const { id } = req.params
  try {
    const borrada = await pool.query('DELETE FROM clases WHERE id = $1 RETURNING nombre', [id])

    if (borrada.rows.length > 0) {
      anotarActividad({
        usuario_id: req.usuario.id, accion: 'clase.eliminar', entidad: 'clase',
        entidad_id: Number(id), detalle: { nombre: borrada.rows[0].nombre }
      })
    }
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
    res.json({ mensaje: 'Clase eliminada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar la clase' })
  }
}

export const obtenerClases = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT c.*, u.nombre AS nombre_profesor
       FROM clases c
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       ORDER BY c.rama, c.nombre`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener las clases' })
  }
}

// ─── HORARIOS ─────────────────────────────────────────

export const crearHorario = async (req, res) => {
  const { clase_id, dia_semana, hora_inicio, hora_fin,
          cupos_totales, precio } = req.body

  const errorHorario = validarHorario({ dia_semana, hora_inicio, hora_fin, cupos_totales, precio })
  if (errorHorario) {
    return res.status(400).json({ error: errorHorario })
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO horarios 
       (clase_id, dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, precio)
       VALUES ($1, $2, $3, $4, $5, $5, $6)
       RETURNING *`,
      [clase_id, dia_semana, hora_inicio, hora_fin, cupos_totales, precio]
    )

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'horario.crear', entidad: 'horario',
      entidad_id: resultado.rows[0].id, detalle: { dia_semana, hora_inicio, precio }
    })

    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear el horario' })
  }
}

// Lista todos los horarios, incluidos los inactivos, con el nombre de la
// clase y del profesor. La ruta pública solo devuelve los activos, así que
// sin esto el administrador no podía ver ni corregir los que dio de baja.
// cupos_disponibles son los lugares libres de la semana que viene.
export const obtenerHorariosAdmin = async (req, res) => {
  const { desde, hasta } = proximoPeriodo()
  try {
    const resultado = await pool.query(
      `SELECT h.*, ${LIBRES('h', '$1', '$2')} AS cupos_disponibles,
              c.nombre AS clase, c.rama, c.activo AS clase_activa,
              u.nombre AS profesor
       FROM horarios h
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN usuarios u ON c.profesor_id = u.id
       ORDER BY c.nombre, ${ORDEN_DIA('h.dia_semana')}, h.hora_inicio`,
      [desde, hasta]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los horarios' })
  }
}

export const editarHorario = async (req, res) => {
  const { id } = req.params
  // cupos_disponibles ya no se toma del pedido: el formulario mandaba el
  // valor de cuando se abrió, y si en el medio reservó alguien, al guardar se
  // devolvían esos lugares. Ahora se cuentan con las reservas.
  const { dia_semana, hora_inicio, hora_fin,
          cupos_totales, precio, activo } = req.body

  const errorHorario = validarHorario({
    dia_semana, hora_inicio, hora_fin, cupos_totales, precio
  })
  if (errorHorario) {
    return res.status(400).json({ error: errorHorario })
  }

  try {
    // La columna vieja solo se acota al total, para no romper su restricción.
    const resultado = await pool.query(
      `UPDATE horarios SET dia_semana=$1, hora_inicio=$2, hora_fin=$3,
       cupos_totales=$4, cupos_disponibles=LEAST(cupos_disponibles, $4), precio=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [dia_semana, hora_inicio, hora_fin,
       cupos_totales, precio, activo, id]
    )

    if (resultado.rows.length > 0) {
      anotarActividad({
        usuario_id: req.usuario.id, accion: 'horario.editar', entidad: 'horario',
        entidad_id: Number(id), detalle: { dia_semana, hora_inicio, precio }
      })
      // Si el admin sumó cupos, los que esperaban se enteran.
      avisarCupoLibre(req.app.get('io'), [Number(id)])
    }

    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al editar el horario' })
  }
}

export const eliminarHorario = async (req, res) => {
  const { id } = req.params
  try {
    const borrado = await pool.query(
      'DELETE FROM horarios WHERE id = $1 RETURNING dia_semana, hora_inicio',
      [id]
    )

    if (borrado.rows.length > 0) {
      anotarActividad({
        usuario_id: req.usuario.id, accion: 'horario.eliminar', entidad: 'horario',
        entidad_id: Number(id), detalle: borrado.rows[0]
      })
    }
    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Clases actualizadas' })
    res.json({ mensaje: 'Horario eliminado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar el horario' })
  }
}

// ─── USUARIOS ─────────────────────────────────────────

export const obtenerUsuarios = async (req, res) => {
  try {
    const resultado = await pool.query(
      // La fecha va como texto: pg la convierte a Date en hora del servidor
      // y el JSON la corre un día.
      `SELECT id, nombre, email, dni, telefono, rol, activo, created_at,
              to_char(apto_vence, 'YYYY-MM-DD') AS apto_vence,
              EXISTS (SELECT 1 FROM fotos_socio f WHERE f.usuario_id = usuarios.id) AS tiene_foto,
              cuenta_puerta
       FROM usuarios ORDER BY created_at DESC`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
}

// ─── APTO MÉDICO ──────────────────────────────────────

const RE_FECHA_APTO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Carga o borra el vencimiento del apto médico. `vence: null` lo borra.
 * Se aceptan fechas pasadas: sirve para registrar un apto que ya venció.
 */
export const cambiarApto = async (req, res) => {
  const id = Number(req.params.id)
  const { vence } = req.body
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Usuario inválido' })
  }

  if (vence !== null) {
    const fecha = RE_FECHA_APTO.test(String(vence)) ? new Date(`${vence}T00:00:00Z`) : null
    // El redondeo de Date convierte 2026-02-31 en marzo: se compara de vuelta.
    const valida = fecha && !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === vence
    const anio = fecha?.getUTCFullYear()
    const tope = new Date().getUTCFullYear() + 3
    if (!valida || anio < 2000 || anio > tope) {
      return res.status(400).json({ error: `La fecha del apto no es válida (hasta ${tope})` })
    }
  }

  try {
    const resultado = await pool.query(
      `UPDATE usuarios SET apto_vence = $1 WHERE id = $2
       RETURNING id, nombre, to_char(apto_vence, 'YYYY-MM-DD') AS apto_vence`,
      [vence, id]
    )
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    anotarActividad({
      usuario_id: req.usuario.id, accion: 'usuario.apto', entidad: 'usuario',
      entidad_id: id, afectado_id: id, detalle: { vence }
    })
    res.json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo guardar el apto médico' })
  }
}

/**
 * Genera una contraseña temporal fácil de dictar en voz alta.
 * Se omiten los caracteres que se confunden al leerlos (O/0, I/1/L).
 */
function generarPasswordTemporal() {
  const LETRAS  = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const NUMEROS = '23456789'
  let clave = ''
  for (let i = 0; i < 4; i++) clave += LETRAS[randomInt(LETRAS.length)]
  for (let i = 0; i < 4; i++) clave += NUMEROS[randomInt(NUMEROS.length)]
  return clave
}

/**
 * Restablece la contraseña de un usuario y devuelve la temporal UNA sola vez,
 * para que el administrador se la pase al socio. Queda marcada como temporal:
 * la app lo obliga a elegir una propia antes de seguir usando el sistema.
 */
export const restablecerPassword = async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE id = $1',
      [id]
    )

    if (usuario.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const temporal = generarPasswordTemporal()
    const hash = await bcrypt.hash(temporal, 10)

    // Subir la versión cierra las sesiones que tenía abiertas: sin esto, apenas
    // el socio elegía su clave nueva, un token viejo volvía a funcionar.
    await pool.query(
      `UPDATE usuarios SET password = $1, debe_cambiar_password = true, sesion_version = sesion_version + 1
       WHERE id = $2`,
      [hash, id]
    )

    // La marca de contraseña temporal tiene que regir desde el próximo pedido.
    olvidarUsuario(id)
    req.app.get('io').in(`usuario:${id}`).disconnectSockets(true)

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'usuario.restablecer_password',
      entidad: 'usuario', entidad_id: Number(id), afectado_id: Number(id)
    })

    res.json({
      mensaje: 'Contraseña restablecida',
      usuario: usuario.rows[0],
      password_temporal: temporal
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al restablecer la contraseña' })
  }
}

export const cambiarRol = async (req, res) => {
  const { id } = req.params
  const { rol } = req.body

  const rolesValidos = ['alumno', 'profesor', 'profesional', 'admin', 'recepcion']
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' })
  }

  // Un administrador que se saca el rol a si mismo deja el panel sin nadie
  // adentro, y para recuperarlo hay que tocar la base a mano.
  if (Number(id) === req.usuario.id) {
    return res.status(400).json({
      error: 'No podés cambiar tu propio rol. Pedíselo a otro administrador'
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const objetivo = await client.query(
      'SELECT id, rol, cuenta_puerta FROM usuarios WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (objetivo.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // La cuenta de la puerta no es de una persona: solo sirve como recepción.
    if (objetivo.rows[0].cuenta_puerta && rol !== 'recepcion') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'La cuenta de la puerta solo puede ser de recepción' })
    }

    // Tampoco se puede dejar el gimnasio sin ningun administrador.
    if (objetivo.rows[0].rol === 'admin' && rol !== 'admin') {
      const otros = await client.query(
        `SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'admin' AND activo AND id <> $1`,
        [id]
      )
      if (otros.rows[0].total === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          error: 'Es el único administrador que queda. Nombrá otro antes de cambiarle el rol'
        })
      }
    }

    const resultado = await client.query(
      'UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id, nombre, email, rol',
      [rol, id]
    )

    await registrarActividad(client, {
      usuario_id: req.usuario.id, accion: 'usuario.rol', entidad: 'usuario',
      entidad_id: Number(id), afectado_id: Number(id),
      detalle: { antes: objetivo.rows[0].rol, despues: rol }
    })

    await client.query('COMMIT')

    // El cambio rige desde el próximo pedido, sin esperar a que venza el token.
    olvidarUsuario(id)

    // Y en el tiempo real: entra o sale de la sala del panel sin reconectarse.
    const io = req.app.get('io')
    if (rol === 'admin') io.in(`usuario:${id}`).socketsJoin('admins')
    else io.in(`usuario:${id}`).socketsLeave('admins')

    res.json(resultado.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'Error al cambiar el rol' })
  } finally {
    client.release()
  }
}

/**
 * Dar de baja o reactivar a alguien, sin borrarlo.
 *
 * Antes no había forma de cortarle el acceso a un profe que dejó el gimnasio
 * ni a un socio, salvo tocar la base a mano. La baja conserva el historial:
 * reservas, pagos y rutinas quedan como estaban.
 */
export const cambiarEstadoUsuario = async (req, res) => {
  const { id } = req.params
  const { activo } = req.body

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Indicá si el usuario queda activo o dado de baja' })
  }

  if (Number(id) === req.usuario.id && !activo) {
    return res.status(400).json({ error: 'No podés darte de baja a vos mismo' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const objetivo = await client.query(
      'SELECT id, nombre, rol, activo FROM usuarios WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (objetivo.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const u = objetivo.rows[0]

    if (u.activo === activo) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: activo ? 'Ya estaba activo' : 'Ya estaba dado de baja' })
    }

    // Igual que con el rol: el gimnasio no puede quedar sin un admin activo.
    if (!activo && u.rol === 'admin') {
      const otros = await client.query(
        `SELECT COUNT(*)::int AS total FROM usuarios
         WHERE rol = 'admin' AND activo AND id <> $1`,
        [id]
      )
      if (otros.rows[0].total === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          error: 'Es el único administrador activo. Nombrá otro antes de darlo de baja'
        })
      }
    }

    await client.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, id])

    await registrarActividad(client, {
      usuario_id: req.usuario.id,
      accion: activo ? 'usuario.reactivar' : 'usuario.baja',
      entidad: 'usuario', entidad_id: Number(id), afectado_id: Number(id)
    })

    await client.query('COMMIT')

    // La baja corta el acceso en el próximo pedido y el tiempo real ya mismo.
    olvidarUsuario(id)
    if (!activo) req.app.get('io').in(`usuario:${id}`).disconnectSockets(true)

    res.json({ id: u.id, nombre: u.nombre, activo })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'No se pudo cambiar el estado del usuario' })
  } finally {
    client.release()
  }
}

// ─── RESERVAS Y PAGOS ─────────────────────────────────

export const obtenerReservas = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT r.*, u.nombre AS alumno, u.dni, u.telefono,
              c.nombre AS clase, h.dia_semana, h.hora_inicio,
              p.metodo, p.estado AS estado_pago
       FROM reservas r
       JOIN usuarios u ON r.usuario_id = u.id
       JOIN horarios h ON r.horario_id = h.id
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       ORDER BY r.created_at DESC`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener reservas' })
  }
}

export const confirmarPagoEfectivo = async (req, res) => {
  const { id } = req.params

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const reserva = await client.query(
      'SELECT estado, total, usuario_id FROM reservas WHERE id = $1 FOR UPDATE',
      [id]
    )

    if (reserva.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Reserva no encontrada' })
    }

    if (reserva.rows[0].estado === 'cancelado') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No se puede confirmar el pago de una reserva cancelada' })
    }

    if (reserva.rows[0].estado === 'pagado') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Esta reserva ya figura como pagada' })
    }

    const pagoPrevio = await client.query(
      'SELECT id FROM pagos WHERE reserva_id = $1',
      [id]
    )

    if (pagoPrevio.rows.length === 0) {
      // El socio pago en el mostrador sin registrarlo desde la app. Antes la
      // reserva quedaba en 'pagado' pero sin fila en pagos, asi que el cobro
      // no aparecia en el historial ni en ninguna cuenta.
      await client.query(
        `INSERT INTO pagos (reserva_id, monto, metodo, estado)
         VALUES ($1, $2, 'efectivo', 'pagado')`,
        [id, reserva.rows[0].total]
      )
    } else {
      await client.query(`UPDATE pagos SET estado='pagado' WHERE reserva_id=$1`, [id])
    }

    await client.query(`UPDATE reservas SET estado='pagado' WHERE id=$1`, [id])

    await registrarActividad(client, {
      usuario_id: req.usuario.id, accion: 'pago.confirmar', entidad: 'reserva',
      entidad_id: Number(id), afectado_id: reserva.rows[0].usuario_id,
      detalle: {
        monto: reserva.rows[0].total,
        metodo: 'efectivo',
        sin_aviso_previo: pagoPrevio.rows.length === 0
      }
    })

    await client.query('COMMIT')

    // Al socio que pago y al panel. Antes se anunciaba a todos, asi que
    // cualquiera recibia un "tu pago fue confirmado" que no era suyo.
    const io = req.app.get('io')
    io.to(`usuario:${reserva.rows[0].usuario_id}`).emit('pago_confirmado', { reserva_id: id })
    io.to('admins').emit('pago_confirmado', { reserva_id: id })

    res.json({ mensaje: 'Pago confirmado correctamente' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'Error al confirmar el pago' })
  } finally {
    client.release()
  }
}

export const obtenerProfesores = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, dni 
       FROM usuarios 
       WHERE (rol = 'profesor' OR rol = 'profesional') AND activo
       ORDER BY nombre`
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener profesores' })
  }
}
export const verificarClaseAntesDeshabilitar = async (req, res) => {
  const { id } = req.params
  try {
    const pagadas = await pool.query(
      `SELECT COUNT(*) as total FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       WHERE h.clase_id = $1 AND r.estado = 'pagado'`,
      [id]
    )
    const pendientes = await pool.query(
      `SELECT COUNT(*) as total FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       WHERE h.clase_id = $1 AND r.estado = 'pendiente'`,
      [id]
    )
    res.json({
      pagadas: parseInt(pagadas.rows[0].total),
      pendientes: parseInt(pendientes.rows[0].total)
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al verificar la clase' })
  }
}

// ─── ACTIVIDAD ────────────────────────────────────────

/** Últimos movimientos, con el nombre de quién lo hizo y de a quién afectó. */
export const obtenerActividad = async (req, res) => {
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 100, 1), 300)

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.detalle, a.creado_en,
              quien.nombre    AS quien,
              quien.rol       AS rol_quien,
              afectado.nombre AS afectado
       FROM auditoria a
       LEFT JOIN usuarios quien    ON quien.id = a.usuario_id
       LEFT JOIN usuarios afectado ON afectado.id = a.afectado_id
       ORDER BY a.creado_en DESC
       LIMIT $1`,
      [limite]
    )
    res.json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo cargar la actividad' })
  }
}
// ─── CUENTA DE LA PUERTA ──────────────────────────────

/**
 * Cuenta fija para la PC de la entrada: rol recepción, sin DNI, sesión de 6
 * meses. No es de ninguna persona, así que no aparece en la lista de la
 * puerta ni en las cuotas. La contraseña la elige el admin en el panel.
 */
export const crearCuentaPuerta = async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim() || 'Puerta'
  const email = String(req.body.email ?? '').trim().toLowerCase()
  const { password } = req.body

  const error = validarDatosUsuario({ nombre, email, password })
  if (error) return res.status(400).json({ error })

  try {
    const existe = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email])
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya hay una cuenta con ese email' })
    }
    const hash = await bcrypt.hash(String(password), 10)
    const r = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, dni, telefono, rol, cuenta_puerta)
       VALUES ($1, $2, $3, NULL, NULL, 'recepcion', true)
       RETURNING id, nombre, email, rol, cuenta_puerta`,
      [nombre, email, hash]
    )
    anotarActividad({
      usuario_id: req.usuario.id, accion: 'puerta.crear', entidad: 'usuario',
      entidad_id: r.rows[0].id, afectado_id: r.rows[0].id, detalle: { nombre }
    })
    res.status(201).json(r.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo crear la cuenta de la puerta' })
  }
}

/**
 * Cierra todas las sesiones abiertas de un usuario, sin cambiarle la
 * contraseña: el teléfono que se perdió, la PC de la puerta que se cambió.
 * El próximo pedido de esas sesiones da 401 y el tiempo real se corta ya.
 */
export const cerrarSesionesUsuario = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Usuario inválido' })
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'Para cerrar tu propia sesión usá el botón de salir' })
  }
  try {
    const r = await pool.query(
      'UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = $1 RETURNING nombre',
      [id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    olvidarUsuario(id)
    req.app.get('io').in(`usuario:${id}`).disconnectSockets(true)
    anotarActividad({
      usuario_id: req.usuario.id, accion: 'usuario.cerrar_sesiones', entidad: 'usuario',
      entidad_id: id, afectado_id: id
    })
    res.json({ mensaje: `Se cerraron las sesiones de ${r.rows[0].nombre}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudieron cerrar las sesiones' })
  }
}
