import pool from '../db/conexion.js'
import { validarPedidoDeReserva } from '../utils/validaciones.js'
import { registrarActividad } from '../utils/auditoria.js'
import { avisarCupoLibre } from './esperaController.js'
import { LIBRES, SE_SUPERPONE, periodoPedido } from '../utils/cupos.js'

/**
 * Error con un mensaje pensado para mostrarle a la persona.
 *
 * Hace falta distinguirlos: antes el `catch` devolvía `error.message` de
 * cualquier error, así que una falla de la base le mostraba al cliente el
 * nombre de una restricción o de una columna.
 */
function errorDeNegocio(mensaje) {
  return Object.assign(new Error(mensaje), { esDeNegocio: true })
}

function responderError(res, error, mensajeGenerico) {
  if (error.esDeNegocio) {
    return res.status(400).json({ error: error.message })
  }
  console.error(error)
  return res.status(500).json({ error: mensajeGenerico })
}

export const crearReserva = async (req, res) => {
  const usuario_id = req.usuario.id

  // El pedido se valida antes de abrir la transacción, y la fecha de fin la
  // calcula el servidor a partir del tipo: nunca la que mande el cliente.
  const pedido = validarPedidoDeReserva(req.body)
  if (pedido.error) {
    return res.status(400).json({ error: pedido.error })
  }

  const { horarios, tipo, multiplicador } = pedido
  const fecha_inicio = pedido.fechaInicio
  const fecha_fin    = pedido.fechaFin

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let total = 0
    const reservasCreadas = []

    for (const horario_id of horarios) {
      // FOR UPDATE bloquea la fila del horario hasta el commit, así dos
      // personas no pueden tomar el último cupo a la vez.
      const horario = await client.query(
        'SELECT * FROM horarios WHERE id = $1 FOR UPDATE',
        [horario_id]
      )

      if (horario.rows.length === 0) {
        throw errorDeNegocio('Uno de los horarios elegidos no existe')
      }

      const h = horario.rows[0]

      // No reservar dos veces la misma clase en el mismo período. El fin no
      // cuenta: antes se comparaba con >= y la semanal que terminaba el lunes
      // impedía reservar la semana siguiente, que empieza ese mismo lunes.
      const reservaExistente = await client.query(
        `SELECT r.id FROM reservas r
         WHERE r.usuario_id = $1
         AND r.horario_id = $2
         AND ${SE_SUPERPONE('r', '$3', '$4')}`,
        [usuario_id, horario_id, fecha_inicio, fecha_fin]
      )

      if (reservaExistente.rows.length > 0) {
        throw errorDeNegocio('Ya tenés una reserva activa para esta clase en ese período')
      }

      // Tampoco dos clases que se pisan el mismo día.
      const superposicion = await client.query(
        `SELECT r.id FROM reservas r
         JOIN horarios h ON r.horario_id = h.id
         WHERE r.usuario_id = $1
         AND h.dia_semana = (SELECT dia_semana FROM horarios WHERE id = $2)
         AND (
           h.hora_inicio < (SELECT hora_fin FROM horarios WHERE id = $2) AND
           h.hora_fin > (SELECT hora_inicio FROM horarios WHERE id = $2)
         )
         AND ${SE_SUPERPONE('r', '$3', '$4')}`,
        [usuario_id, horario_id, fecha_inicio, fecha_fin]
      )

      if (superposicion.rows.length > 0) {
        throw errorDeNegocio('Ya tenés una clase en ese horario ese día')
      }

      // El horario y su clase tienen que estar activos.
      const claseActiva = await client.query(
        `SELECT c.activo FROM clases c
         JOIN horarios h ON h.clase_id = c.id
         WHERE h.id = $1`,
        [horario_id]
      )
      if (!claseActiva.rows[0]?.activo || !h.activo) {
        throw errorDeNegocio('Una de las clases seleccionadas ya no está disponible')
      }

      // Los lugares se cuentan con las reservas del período pedido, no con un
      // contador. La fila del horario está bloqueada: una reserva simultánea
      // espera y cuenta después, con esta ya guardada.
      const lugares = await client.query(
        `SELECT ${LIBRES('h', '$2', '$3')} AS libres FROM horarios h WHERE h.id = $1`,
        [horario_id, fecha_inicio, fecha_fin]
      )
      if (lugares.rows[0].libres <= 0) {
        throw errorDeNegocio('No hay cupos disponibles en uno de los horarios seleccionados')
      }

      const precio = Number(h.precio) * multiplicador
      total += precio

      const reserva = await client.query(
        `INSERT INTO reservas
         (usuario_id, horario_id, fecha_inicio, fecha_fin, tipo, total)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [usuario_id, horario_id, fecha_inicio, fecha_fin, tipo, precio]
      )

      reservasCreadas.push(reserva.rows[0])
    }

    // Quien reservó un horario en el que esperaba ya no necesita el aviso.
    await client.query(
      'DELETE FROM lista_espera WHERE usuario_id = $1 AND horario_id = ANY($2::int[])',
      [usuario_id, horarios]
    )

    await client.query('COMMIT')

    const io = req.app.get('io')
    // Los cupos cambiaron para todos; el detalle de la reserva, solo al panel.
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    io.to('admins').emit('nueva_reserva', { usuario_id, total, tipo })

    res.status(201).json({
      mensaje: 'Reservas creadas correctamente',
      reservas: reservasCreadas,
      total
    })

  } catch (error) {
    await client.query('ROLLBACK')
    responderError(res, error, 'No se pudo crear la reserva')
  } finally {
    client.release()
  }
}

export const obtenerMisReservas = async (req, res) => {
  const usuario_id = req.usuario.id

  try {
    const resultado = await pool.query(
      `SELECT
        r.*,
        c.nombre AS clase,
        c.rama,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        p.metodo,
        p.estado AS estado_pago
       FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       JOIN clases c ON h.clase_id = c.id
       LEFT JOIN pagos p ON p.reserva_id = r.id
       WHERE r.usuario_id = $1
       ORDER BY r.created_at DESC`,
      [usuario_id]
    )
    res.json(resultado.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener reservas' })
  }
}

export const cancelarReserva = async (req, res) => {
  const { id } = req.params
  const usuario_id = req.usuario.id

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // FOR UPDATE es lo que evita que dos cancelaciones simultáneas de la
    // misma reserva devuelvan el cupo dos veces.
    const reserva = await client.query(
      'SELECT * FROM reservas WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
      [id, usuario_id]
    )

    if (reserva.rows.length === 0) {
      throw errorDeNegocio('Reserva no encontrada')
    }

    const estado = reserva.rows[0].estado

    // Sin este control se podía cancelar la misma reserva una y otra vez, y
    // cada llamada sumaba un cupo que no existía.
    if (estado === 'cancelado') {
      throw errorDeNegocio('Esta reserva ya estaba cancelada')
    }

    if (estado === 'pagado') {
      throw errorDeNegocio('No podés cancelar una reserva ya pagada')
    }

    // No hay cupo que devolver: los lugares se cuentan con las reservas, y
    // una cancelada deja de contar.
    await client.query(
      `UPDATE reservas SET estado = 'cancelado' WHERE id = $1`,
      [id]
    )

    await registrarActividad(client, {
      usuario_id, accion: 'reserva.cancelar', entidad: 'reserva',
      entidad_id: Number(id), afectado_id: usuario_id,
      detalle: { monto: reserva.rows[0].total }
    })

    await client.query('COMMIT')

    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    // Quien cancela ya lo sabe: este aviso es para que el panel se actualice.
    io.to('admins').emit('reserva_cancelada', { reserva_id: id })
    avisarCupoLibre(io, [reserva.rows[0].horario_id])

    res.json({ mensaje: 'Reserva cancelada correctamente' })

  } catch (error) {
    await client.query('ROLLBACK')
    responderError(res, error, 'No se pudo cancelar la reserva')
  } finally {
    client.release()
  }
}

/**
 * Horarios que el socio ya tiene en el período que está por reservar (?desde
 * y ?hasta, o el próximo semanal). Antes devolvía todos los que reservó alguna
 * vez: después de la primera semana, la app los mostraba como "Ya reservada"
 * para siempre y no se podían volver a reservar.
 */
export const obtenerHorariosReservados = async (req, res) => {
  const usuario_id = req.usuario.id
  const { desde, hasta } = periodoPedido(req.query)

  try {
    const resultado = await pool.query(
      `SELECT DISTINCT horario_id
       FROM reservas r
       WHERE r.usuario_id = $1
       AND ${SE_SUPERPONE('r', '$2', '$3')}`,
      [usuario_id, desde, hasta]
    )
    res.json(resultado.rows.map(r => r.horario_id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener horarios reservados' })
  }
}
