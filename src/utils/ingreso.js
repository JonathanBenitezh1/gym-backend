// Decisión de la puerta (migración 013): deja pasar si el socio tiene una
// clase ahora, desde `margen` minutos antes del inicio hasta el final.
//
// La pantalla de la puerta tiene una copia idéntica en
// gym-app/src/utils/ingreso.js, para decidir igual sin conexión. Si se cambia
// una, se cambia la otra.

const ZONA = 'America/Argentina/Buenos_Aires'
const UN_DIA = 24 * 60 * 60 * 1000
const DIAS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Día, día de la semana (1 = lunes) y minuto del día en el gimnasio. */
export function ahoraEnArgentina(momento = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(momento).map(x => [x.type, x.value]))
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    isodow: DIAS_EN.indexOf(p.weekday) + 1,
    minutos: Number(p.hour) * 60 + Number(p.minute)
  }
}

const aMinutos = (hora) => {
  const [h, m] = String(hora).split(':').map(Number)
  return h * 60 + m
}
const aDia = (texto) => Date.parse(`${texto}T00:00:00Z`)
const sumarDias = (texto, n) => new Date(aDia(texto) + n * UN_DIA).toISOString().slice(0, 10)

/** Igual que utils/cuota.js: al_dia, gracia (con los días que quedan), vencida o sin_cuota. */
export function estadoPlan(vence, diasGracia, hoy) {
  if (!vence) return { estado: 'sin_cuota', dias_restantes: 0 }
  const atraso = (aDia(hoy) - aDia(vence)) / UN_DIA
  if (atraso <= 0) return { estado: 'al_dia', dias_restantes: 0 }
  if (atraso <= diasGracia) return { estado: 'gracia', dias_restantes: diasGracia - atraso + 1 }
  return { estado: 'vencida', dias_restantes: 0 }
}

/**
 * `clases`: lo que el socio tiene reservado. Cada una con clase, dias,
 * hora_inicio, hora_fin y tipo: 'fijo' (lugar del plan, vale mientras el plan
 * esté al día o en gracia) o 'semanal' (vale de `desde` a `hasta`, sin
 * incluir `hasta`; `pagado` dice si ya se cobró).
 *
 * Resultados:
 * - al_dia:         tiene clase ahora y está pagada.
 * - gracia:         tiene clase ahora por su plan, que está en gracia.
 * - pago_pendiente: tiene clase ahora, de una semanal sin cobrar.
 * - fuera_horario:  tiene algo vigente, pero no a esta hora. Va la próxima.
 * - vencida:        su plan venció y no tiene nada más.
 * - sin_cuota:      no tiene plan ni semanales.
 */
export function decidirIngreso({ cuota_vence, plan, clases = [] }, { ahora, diasGracia, margen }) {
  const ep = estadoPlan(cuota_vence, diasGracia, ahora.dia)
  const planVale = Boolean(plan) && (ep.estado === 'al_dia' || ep.estado === 'gracia')
  const base = { plan: plan ?? null, cuota_vence: cuota_vence ?? null }

  const valeEl = (c, dia) => c.tipo === 'fijo'
    ? planVale
    : c.desde <= dia && dia < c.hasta

  const vigentes = clases.filter(c => valeEl(c, ahora.dia) || (c.tipo === 'semanal' && c.hasta > ahora.dia))

  const ahoraMismo = clases.filter(c =>
    valeEl(c, ahora.dia) &&
    c.dias.includes(ahora.isodow) &&
    ahora.minutos >= aMinutos(c.hora_inicio) - margen &&
    ahora.minutos < aMinutos(c.hora_fin)
  )

  const pagada = ahoraMismo.find(c => c.tipo === 'semanal' ? c.pagado : ep.estado === 'al_dia')
  if (pagada) return { ...base, resultado: 'al_dia', clase: pagada.clase }

  const enGracia = ahoraMismo.find(c => c.tipo === 'fijo')
  if (enGracia) return { ...base, resultado: 'gracia', clase: enGracia.clase, dias_restantes: ep.dias_restantes }

  const sinPagar = ahoraMismo[0]
  if (sinPagar) return { ...base, resultado: 'pago_pendiente', clase: sinPagar.clase }

  if (vigentes.length > 0 || planVale) {
    const proxima = proximaClase(clases, valeEl, ahora, margen)
    return { ...base, resultado: 'fuera_horario', ...(proxima ? { proxima, clase: proxima.clase } : {}) }
  }
  if (plan && ep.estado === 'vencida') return { ...base, resultado: 'vencida' }
  return { ...base, resultado: 'sin_cuota' }
}

/** La próxima clase del socio en los siete días que vienen. */
function proximaClase(clases, valeEl, ahora, margen) {
  for (let k = 0; k <= 7; k++) {
    const dia = sumarDias(ahora.dia, k)
    const isodow = ((ahora.isodow - 1 + k) % 7) + 1
    const candidatas = clases
      .filter(c => valeEl(c, dia) && c.dias.includes(isodow))
      .filter(c => k > 0 || aMinutos(c.hora_inicio) - margen > ahora.minutos)
      .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))
    if (candidatas.length > 0) {
      const c = candidatas[0]
      return { clase: c.clase, dia, isodow, hora_inicio: String(c.hora_inicio).slice(0, 5) }
    }
  }
  return null
}
