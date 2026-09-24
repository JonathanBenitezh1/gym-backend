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
    const [ingresos, socios, ocupacion, asistencia, pendientes, puerta, porHora] = await Promise.all([
      // Cobrado por mes, ultimos 6 meses incluido el actual. generate_series
      // deja en cero los meses sin pagos en lugar de saltearlos.
      pool.query(
        `WITH meses AS (
           SELECT generate_series(
             date_trunc('month', ${HOY_AR}) - interval '5 months',
             date_trunc('month', ${HOY_AR}),
             interval '1 month'
           )::date AS mes
         ),
         -- Reservas pagadas y cuotas, en hora argentina. pagos_cuota ya es
         -- TIMESTAMPTZ, así que se convierte directo.
         cobros AS (
           SELECT monto, ${EN_ARGENTINA('created_at')} AS fecha FROM pagos WHERE estado = 'pagado'
           UNION ALL
           SELECT monto, created_at AT TIME ZONE 'America/Argentina/Buenos_Aires' FROM pagos_cuota
         )
         SELECT to_char(m.mes, 'YYYY-MM') AS mes,
                COALESCE(SUM(c.monto), 0)::float AS total,
                COUNT(c.monto)::int AS pagos
         FROM meses m
         LEFT JOIN cobros c ON date_trunc('month', c.fecha)::date = m.mes
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
      ),
      // Pasadas por la puerta hoy. ingresos.created_at es TIMESTAMPTZ.
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE resultado IN ('al_dia', 'gracia', 'personal'))::int AS entraron,
                COUNT(*) FILTER (WHERE resultado NOT IN ('al_dia', 'gracia', 'personal'))::int AS rechazados
         FROM ingresos
         WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${HOY_AR}`
      ),
      // Promedio de ingresos por hora en los últimos 30 días: muestra las
      // horas pico. Se divide por los días que tuvieron algún ingreso, así un
      // gimnasio que abrió hace una semana no ve promedios achicados.
      pool.query(
        `WITH entradas AS (
           SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS fecha
           FROM ingresos
           WHERE resultado IN ('al_dia', 'gracia', 'personal')
             AND created_at >= now() - interval '30 days'
         ), dias AS (SELECT GREATEST(COUNT(DISTINCT fecha::date), 1) AS n FROM entradas)
         SELECT EXTRACT(HOUR FROM fecha)::int AS hora,
                ROUND(COUNT(*)::numeric / (SELECT n FROM dias), 1)::float AS promedio
         FROM entradas GROUP BY 1 ORDER BY 1`
      )
    ])

    res.json({
      ingresos: ingresos.rows,
      socios: socios.rows[0],
      ocupacion: ocupacion.rows,
      asistencia: asistencia.rows,
      pendientes: pendientes.rows[0],
      puerta: { ...puerta.rows[0], por_hora: porHora.rows }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al calcular las estadísticas' })
  }
}
