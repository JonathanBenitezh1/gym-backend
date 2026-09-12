import pool from '../db/conexion.js'

const METODOS_VALIDOS = ['efectivo', 'mercadopago']

export const registrarPagoEfectivo = async (req, res) => {
  const { reserva_id, metodo } = req.body

  try {
    if (!METODOS_VALIDOS.includes(metodo)) {
      return res.status(400).json({ error: 'Método de pago no válido' })
    }

    // La reserva tiene que existir y ser de quien está pidiendo el pago.
    const reserva = await pool.query(
      'SELECT * FROM reservas WHERE id = $1 AND usuario_id = $2',
      [reserva_id, req.usuario.id]
    )

    if (reserva.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' })
    }

    if (reserva.rows[0].estado === 'pagado') {
      return res.status(400).json({ error: 'Esta reserva ya está pagada' })
    }

    if (reserva.rows[0].estado === 'cancelado') {
      return res.status(400).json({ error: 'Esta reserva está cancelada' })
    }

    // Evitamos registrar dos veces el pago de la misma reserva.
    const pagoPrevio = await pool.query(
      'SELECT id FROM pagos WHERE reserva_id = $1',
      [reserva_id]
    )
    if (pagoPrevio.rows.length > 0) {
      return res.status(400).json({ error: 'Esta reserva ya tiene un pago registrado' })
    }

    // El importe sale de la reserva guardada, nunca de lo que manda el cliente:
    // si viniera del navegador, cualquiera podría pagar lo que quisiera.
    const monto = reserva.rows[0].total

    const pago = await pool.query(
      `INSERT INTO pagos (reserva_id, monto, metodo, estado)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING *`,
      [reserva_id, monto, metodo]
    )

    // Avisamos al panel en tiempo real
    // Solo al panel: el monto no tiene por que verlo el resto de los socios.
    const io = req.app.get('io')
    io.to('admins').emit('nuevo_pago', { reserva_id, monto, metodo })

    res.status(201).json(pago.rows[0])

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar el pago' })
  }
}
