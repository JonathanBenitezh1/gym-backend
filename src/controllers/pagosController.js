import pool from '../db/conexion.js'

export const registrarPagoEfectivo = async (req, res) => {
  const { reserva_id, monto, metodo } = req.body

  try {
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

    const pago = await pool.query(
      `INSERT INTO pagos (reserva_id, monto, metodo, estado)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING *`,
      [reserva_id, monto, metodo]
    )

    // Avisamos al panel en tiempo real
    const io = req.app.get('io')
    io.emit('nuevo_pago', { reserva_id, monto, metodo })

    res.status(201).json(pago.rows[0])

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al registrar el pago' })
  }
}