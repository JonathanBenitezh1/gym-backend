import { ORDEN_DIA } from './validaciones.js'
import { hoyEnArgentina } from './cuota.js'

/**
 * Cupos por semana.
 *
 * Antes cada horario tenía un contador (cupos_disponibles) que bajaba con cada
 * reserva y subía solo al cancelar, nunca cuando terminaba el período: con el
 * uso, cada horario quedaba "Sin cupos" para siempre aunque la clase estuviera
 * vacía.
 *
 * Ahora los lugares se cuentan con las reservas. Una reserva cubre los días de
 * [fecha_inicio, fecha_fin): la semanal de un lunes va de ese lunes al domingo,
 * y el lunes siguiente ya es de la semana que viene. Para un período se mira
 * cada día de clase del horario y se toma el más lleno (una quincenal tiene
 * que tener lugar las dos semanas).
 */

const UN_DIA = 24 * 60 * 60 * 1000
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

const aDia = (texto) => Date.parse(`${texto}T00:00:00Z`)
const aTexto = (ms) => new Date(ms).toISOString().slice(0, 10)
const esFecha = (texto) => RE_FECHA.test(String(texto)) && aTexto(aDia(texto)) === texto

export const sumarDias = (texto, dias) => aTexto(aDia(texto) + dias * UN_DIA)

/**
 * El período que reserva la app: desde el próximo lunes, una o dos semanas.
 * Un domingo el próximo lunes es mañana; un lunes, el de la semana que viene.
 * Es la misma cuenta que hace la pantalla de clases.
 */
export function proximoPeriodo(dias = 7, hoy = hoyEnArgentina()) {
  const diaSemana = new Date(aDia(hoy)).getUTCDay() // 0 = domingo
  const desde = sumarDias(hoy, diaSemana === 0 ? 1 : 8 - diaSemana)
  return { desde, hasta: sumarDias(desde, dias) }
}

/** La semana en curso, de lunes a domingo. */
export function semanaActual(hoy = hoyEnArgentina()) {
  const diaSemana = new Date(aDia(hoy)).getUTCDay()
  const desde = sumarDias(hoy, -((diaSemana + 6) % 7))
  return { desde, hasta: sumarDias(desde, 7) }
}

/**
 * El período que pide la app en ?desde=&hasta= (fin excluido). Si no viene o
 * no tiene sentido, el próximo semanal: así la app vieja, que no los manda,
 * sigue viendo la semana que reserva.
 *
 * Se acota a lo que la app puede reservar (hasta dos semanas, hasta 60 días
 * adelante): la ruta es pública y no conviene dejar pedir un año entero.
 */
export function periodoPedido({ desde, hasta } = {}, hoy = hoyEnArgentina()) {
  if (esFecha(desde) && esFecha(hasta)) {
    const largo = (aDia(hasta) - aDia(desde)) / UN_DIA
    const adelante = (aDia(desde) - aDia(hoy)) / UN_DIA
    if (largo >= 1 && largo <= 14 && adelante >= -7 && adelante <= 60) return { desde, hasta }
  }
  return proximoPeriodo(7, hoy)
}

/**
 * Lugares libres de un horario en el período [desde, hasta), como expresión
 * SQL: el total menos lo ocupado el día de clase más lleno del período.
 *
 * `horario` es el alias de la tabla horarios en la consulta; `desde` y
 * `hasta`, los parámetros ($1, $2...). Nada de esto viene del pedido.
 */
export const LIBRES = (horario, desde, hasta) => `GREATEST(${horario}.cupos_totales - COALESCE((
    SELECT MAX((
      SELECT COUNT(*) FROM reservas r
      WHERE r.horario_id = ${horario}.id AND r.estado <> 'cancelado'
        AND r.fecha_inicio <= g.dia::date AND r.fecha_fin > g.dia::date
    ))
    FROM generate_series(${desde}::timestamp, ${hasta}::timestamp - interval '1 day', interval '1 day') AS g(dia)
    WHERE EXTRACT(ISODOW FROM g.dia) = ${ORDEN_DIA(`${horario}.dia_semana`)}
  ), 0), 0)::int`

/** Una reserva no cancelada que se superpone con [desde, hasta). */
export const SE_SUPERPONE = (reserva, desde, hasta) =>
  `${reserva}.estado <> 'cancelado' AND ${reserva}.fecha_inicio < ${hasta}::date AND ${reserva}.fecha_fin > ${desde}::date`
