import pool from '../db/conexion.js'

export const crearReserva = async (req, res) => {
  const { horarios_ids, tipo, fecha_inicio, fecha_fin } = req.body
  const usuario_id = req.usuario.id

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let total = 0
    const reservasCreadas = []

    for (const horario_id of horarios_ids) {
      const horario = await client.query(
        'SELECT * FROM horarios WHERE id = $1 FOR UPDATE',
        [horario_id]
      )

      if (horario.rows.length === 0) {
        throw new Error(`Horario ${horario_id} no encontrado`)
      }

      const h = horario.rows[0]
     

// Verificar que el horario y la clase estén activos
        const claseActiva = await client.query(
          `SELECT c.activo FROM clases c
          JOIN horarios h ON h.clase_id = c.id
          WHERE h.id = $1`,
          [horario_id]
        )
        if (!claseActiva.rows[0]?.activo || !h.activo) {
          throw new Error(`Una de las clases seleccionadas ya no está disponible`)
        }

        if (h.cupos_disponibles <= 0) {
          throw new Error(`No hay cupos disponibles en uno de los horarios seleccionados`)
        }

      const precio = tipo === 'quincenal' ? h.precio * 2 : h.precio
      total += precio

      const reserva = await client.query(
        `INSERT INTO reservas 
         (usuario_id, horario_id, fecha_inicio, fecha_fin, tipo, total)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [usuario_id, horario_id, fecha_inicio, fecha_fin, tipo, precio]
      )

      await client.query(
        `UPDATE horarios 
         SET cupos_disponibles = cupos_disponibles - 1
         WHERE id = $1`,
        [horario_id]
      )

      reservasCreadas.push(reserva.rows[0])
    }

    await client.query('COMMIT')

    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    io.emit('nueva_reserva', { usuario_id, total, tipo })

    res.status(201).json({
      mensaje: 'Reservas creadas correctamente',
      reservas: reservasCreadas,
      total
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(400).json({ error: error.message || 'Error al crear la reserva' })
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

    const reserva = await client.query(
      'SELECT * FROM reservas WHERE id = $1 AND usuario_id = $2',
      [id, usuario_id]
    )

    if (reserva.rows.length === 0) {
      throw new Error('Reserva no encontrada')
    }

    if (reserva.rows[0].estado === 'pagado') {
      throw new Error('No podés cancelar una reserva ya pagada')
    }

    await client.query(
      `UPDATE horarios 
       SET cupos_disponibles = cupos_disponibles + 1
       WHERE id = $1`,
      [reserva.rows[0].horario_id]
    )

    await client.query(
      `UPDATE reservas SET estado = 'cancelado' WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')

    const io = req.app.get('io')
    io.emit('actualizacion_horarios', { mensaje: 'Horarios actualizados' })
    io.emit('reserva_cancelada', { reserva_id: id })

    res.json({ mensaje: 'Reserva cancelada correctamente' })

  } catch (error) {
    await client.query('ROLLBACK')
    res.status(400).json({ error: error.message })
  } finally {
    client.release()
  }
}

export const obtenerHorariosReservados = async (req, res) => {
  const usuario_id = req.usuario.id

  try {
    const resultado = await pool.query(
      `SELECT DISTINCT horario_id 
       FROM reservas 
       WHERE usuario_id = $1 
       AND estado NOT IN ('cancelado')`,
      [usuario_id]
    )
    res.json(resultado.rows.map(r => r.horario_id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener horarios reservados' })
  }
}