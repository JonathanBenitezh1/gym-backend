import pool from '../db/conexion.js'

// pagos.created_at es TIMESTAMP sin zona, grabado con now() en la zona de la
// sesion: UTC en Neon, la de la PC en local. Se pasa primero a instante real
// con la zona de la sesion y recien ahi a hora argentina, asi un pago del 31 a
// las 22 no cae en el mes siguiente en ningun entorno.
const EN_ARGENTINA = (columna) =>
  `((${columna}) AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'America/Argentina/Buenos_Aires')`

const HOY_AR = `(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`

/**
 * Numeros del gimnasio para el panel. Una sola llamada: cinco consultas
 * chicas en paralelo, todas agregadas en la base.
 */
export const obtenerEstadisticas = async (req, res) => {
  try {
    const [ingresos, socios, ocupacion, asistencia, pendientes] = await Promise.all([
      // Cobrado por mes, ultimos 6 meses incluido el actual. generate_series
      // deja en cero los meses sin pagos en lugar de saltearlos.
      pool.query(
        `WITH meses AS (
           SELECT generate_series(
             date_trunc('month', ${HOY_AR}) - interval '5 months',
             date_trunc('month', ${HOY_AR}),
             interval '1 month'
           )::date AS mes
         )
         SELECT to_char(m.mes, 'YYYY-MM') AS mes,
                COALESCE(SUM(p.monto), 0)::float AS total,
                COUNT(p.id)::int AS pagos
         FROM meses m
         LEFT JOIN pagos p
           ON p.estado = 'pagado'
          AND date_trunc('month', ${EN_ARGENTINA('p.created_at')})::date = m.mes
         GROUP BY m.mes ORDER BY m.mes`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE activo)::int AS activos,
           COUNT(*) FILTER (WHERE activo AND date_trunc('month', ${EN_ARGENTINA('created_at')})
                                          = date_trunc('month', ${HOY_AR}))::int AS nuevos_mes,
           COUNT(*) FILTER (WHERE activo AND (apto_vence IS NULL OR apto_vence < ${HOY_AR}))::int AS sin_apto
         FROM usuarios WHERE rol = 'alumno'`
      ),
      // Ocupacion actual de cada horario activo: lugares tomados sobre el total.
      pool.query(
        `SELECT h.id, c.nombre AS clase, h.dia_semana, h.hora_inicio,
                h.cupos_totales, (h.cupos_totales - h.cupos_disponibles)::int AS ocupados
         FROM horarios h JOIN clases c ON c.id = h.clase_id
         WHERE h.activo AND c.activo
         ORDER BY (h.cupos_totales - h.cupos_disponibles)::float / h.cupos_totales DESC, c.nombre
         LIMIT 12`
      ),
      // Asistencia de los ultimos 30 dias por clase, sobre lo que el profe marco.
      pool.query(
        `SELECT c.nombre AS clase,
                COUNT(*) FILTER (WHERE a.asistio)::int AS presentes,
                COUNT(*)::int AS marcadas
         FROM asistencias a
         JOIN horarios h ON h.id = a.horario_id
         JOIN clases c ON c.id = h.clase_id
         WHERE a.fecha >= ${HOY_AR} - 30
         GROUP BY c.nombre
         ORDER BY marcadas DESC LIMIT 10`
      ),
      pool.query(
        `SELECT COALESCE(SUM(total), 0)::float AS monto, COUNT(*)::int AS cantidad
         FROM reservas WHERE estado = 'pendiente'`
      )
    ])

    res.json({
      ingresos: ingresos.rows,
      socios: socios.rows[0],
      ocupacion: ocupacion.rows,
      asistencia: asistencia.rows,
      pendientes: pendientes.rows[0]
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al calcular las estadísticas' })
  }
}
