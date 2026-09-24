// Estado de la cuota a partir de su vencimiento.
//
// Las fechas son texto "AAAA-MM-DD" y se comparan como días UTC: el huso
// horario lo resuelve quien calcula "hoy" (hoyEnArgentina), no esta cuenta.

const ZONA = 'America/Argentina/Buenos_Aires'
const UN_DIA = 24 * 60 * 60 * 1000

export function hoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())
}

const aDia = (texto) => Date.parse(`${texto}T00:00:00Z`) / UN_DIA

/**
 * - al_dia:  hoy es igual o anterior al vencimiento.
 * - gracia:  pasaron entre 1 y `diasGracia` días. `dias_restantes` cuenta hoy:
 *            con vencimiento el 10 y 6 de gracia, el 11 quedan 6 y el 16 queda 1.
 * - vencida: se terminó la gracia.
 * - sin_cuota: nunca pagó.
 */
export function estadoCuota(vence, diasGracia, hoy = hoyEnArgentina()) {
  if (!vence) return { estado: 'sin_cuota', dias_restantes: 0 }
  const atraso = aDia(hoy) - aDia(vence)
  if (atraso <= 0) return { estado: 'al_dia', dias_restantes: 0 }
  if (atraso <= diasGracia) return { estado: 'gracia', dias_restantes: diasGracia - atraso + 1 }
  return { estado: 'vencida', dias_restantes: 0 }
}

// Suma meses sin desbordar: 31/01 + 1 mes da 28/02 (o 29), no 03/03.
export function sumarMeses(fecha, meses) {
  const [a, m, d] = fecha.split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  const anio = Math.floor(total / 12)
  const mes = total % 12
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const dia = Math.min(d, ultimo)
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Nuevo vencimiento al pagar `meses`.
 *
 * Si el socio está al día o en gracia, el período sigue desde su vencimiento
 * anterior: pagar tarde no regala días. Si viene de más atrás (o es nuevo),
 * arranca de nuevo:
 * - mensual:  un mes desde hoy.
 * - dia_fijo: hasta el próximo día fijo que venga después de hoy.
 */
export function calcularNuevoVence({ venceActual, meses, config, hoy = hoyEnArgentina() }) {
  const { estado } = estadoCuota(venceActual, config.dias_gracia, hoy)
  if (estado === 'al_dia' || estado === 'gracia') return sumarMeses(venceActual, meses)

  if (config.modo_vencimiento === 'dia_fijo') {
    const [a, m, d] = hoy.split('-').map(Number)
    const fijo = `${a}-${String(m).padStart(2, '0')}-${String(config.dia_vencimiento).padStart(2, '0')}`
    const primero = d < config.dia_vencimiento ? fijo : sumarMeses(fijo, 1)
    return sumarMeses(primero, meses - 1)
  }
  return sumarMeses(hoy, meses)
}
