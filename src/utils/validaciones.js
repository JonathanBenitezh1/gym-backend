/**
 * Validaciones de entrada.
 *
 * El frontend ya valida estos campos, pero eso solo mejora la experiencia:
 * cualquiera puede llamar a la API directamente y saltearse esos controles.
 * Estas son las que realmente protegen los datos.
 */

const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_DNI      = /^\d{7,8}$/
const RE_TELEFONO = /^\d{10,15}$/

export const LARGO_MINIMO_PASSWORD = 8

export const esEmailValido    = (valor) => RE_EMAIL.test(String(valor || '').trim())
export const esDniValido      = (valor) => RE_DNI.test(String(valor || '').trim())
export const esTelefonoValido = (valor) => RE_TELEFONO.test(String(valor || '').trim())

/**
 * Valida los datos de registro y edición de perfil.
 * Devuelve el primer error encontrado, o null si está todo bien.
 *
 * `campos` acepta cualquier subconjunto: solo valida lo que recibe.
 */
export function validarDatosUsuario({ nombre, email, password, dni, telefono }) {
  if (nombre !== undefined) {
    const limpio = String(nombre).trim()
    if (limpio.length < 2)   return 'El nombre es demasiado corto'
    if (limpio.length > 100) return 'El nombre es demasiado largo'
  }

  if (email !== undefined) {
    if (!esEmailValido(email)) return 'El email no tiene un formato válido'
    if (String(email).length > 100) return 'El email es demasiado largo'
  }

  if (password !== undefined) {
    if (String(password).length < LARGO_MINIMO_PASSWORD) {
      return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`
    }
    // bcrypt solo considera los primeros 72 bytes; más allá de eso da falsa
    // sensación de seguridad, así que lo cortamos explícitamente.
    if (String(password).length > 72) {
      return 'La contraseña no puede superar los 72 caracteres'
    }
  }

  if (dni !== undefined && !esDniValido(dni)) {
    return 'El DNI debe tener 7 u 8 números, sin puntos'
  }

  if (telefono !== undefined && telefono !== null && String(telefono).trim() !== '') {
    if (!esTelefonoValido(telefono)) {
      return 'El teléfono debe tener entre 10 y 15 números, sin espacios ni guiones'
    }
  }

  return null
}

/**
 * Días tal como los guarda la base: texto, no número. La pantalla del panel
 * ofrece de lunes a sábado; se incluye domingo por si algún día se usa.
 */
export const DIAS_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
]

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/**
 * Valida un horario antes de crearlo o editarlo. Devuelve el primer error,
 * o null si está todo bien. Los campos que no vienen no se validan, porque
 * el profesor manda menos campos que el administrador.
 *
 * Sin esto un error de tipeo en el panel dejaba horarios imposibles: la hora
 * de fin antes de la de inicio, cupos negativos o un precio en cero.
 */
export function validarHorario({ dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, precio }) {
  if (dia_semana !== undefined && !DIAS_SEMANA.includes(String(dia_semana))) {
    return 'El día tiene que ser uno de la semana, escrito como en el panel'
  }

  if (hora_inicio !== undefined && !RE_HORA.test(String(hora_inicio))) {
    return 'La hora de inicio no es válida'
  }

  if (hora_fin !== undefined && !RE_HORA.test(String(hora_fin))) {
    return 'La hora de fin no es válida'
  }

  if (hora_inicio !== undefined && hora_fin !== undefined &&
      String(hora_fin) <= String(hora_inicio)) {
    return 'La hora de fin tiene que ser posterior a la de inicio'
  }

  let totales
  if (cupos_totales !== undefined) {
    totales = Number(cupos_totales)
    if (!Number.isInteger(totales) || totales < 1 || totales > 500) {
      return 'Los cupos totales tienen que ser un número entero entre 1 y 500'
    }
  }

  if (cupos_disponibles !== undefined) {
    const disponibles = Number(cupos_disponibles)
    if (!Number.isInteger(disponibles) || disponibles < 0) {
      return 'Los cupos disponibles no pueden ser negativos'
    }
    if (totales !== undefined && disponibles > totales) {
      return 'No puede haber más cupos disponibles que cupos totales'
    }
  }

  if (precio !== undefined) {
    const valor = Number(precio)
    if (!Number.isFinite(valor) || valor < 0) {
      return 'El precio no puede ser negativo'
    }
  }

  return null
}

/**
 * Tipos de reserva, con los días que cubren y lo que multiplican al precio
 * del horario. Antes el precio se calculaba con el tipo pero el período lo
 * elegía el cliente, así que se podía pedir una reserva de cinco años y
 * pagar una semana. Ahora el tipo manda las dos cosas.
 */
export const TIPOS_RESERVA = {
  semanal:   { dias: 7,  multiplicador: 1 },
  quincenal: { dias: 14, multiplicador: 2 }
}

// Tope de horarios por pedido. Sin esto, un array enorme hace cientos de
// consultas con filas bloqueadas dentro de una sola transacción.
export const MAX_HORARIOS_POR_RESERVA = 10

// Hasta cuándo se puede reservar hacia adelante.
const MAX_DIAS_A_FUTURO = 60

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

// El servidor corre en UTC y el gimnasio vive en UTC-3. Sin fijar la zona,
// después de las 21 de Argentina el servidor ya está en el día siguiente y
// rechazaría como vencida una reserva para hoy.
const ZONA_GIMNASIO = 'America/Argentina/Buenos_Aires'

/**
 * Hoy en el huso del gimnasio, como milisegundos de la medianoche UTC de ese
 * día. Sirve para comparar días sin que moleste la hora.
 */
function hoyEnElGimnasio() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_GIMNASIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  return Date.parse(`${partes}T00:00:00Z`)
}

/**
 * Valida el pedido de reserva y devuelve `{ error }` o los datos ya
 * normalizados: `{ horarios, tipo, fechaInicio, fechaFin, multiplicador }`.
 *
 * `fecha_fin` no se toma del cliente: se calcula acá a partir del tipo.
 */
export function validarPedidoDeReserva({ horarios_ids, tipo, fecha_inicio }) {
  if (!Array.isArray(horarios_ids) || horarios_ids.length === 0) {
    return { error: 'Elegí al menos un horario' }
  }

  if (horarios_ids.length > MAX_HORARIOS_POR_RESERVA) {
    return { error: `No podés reservar más de ${MAX_HORARIOS_POR_RESERVA} horarios por vez` }
  }

  const horarios = []
  for (const valor of horarios_ids) {
    const id = Number(valor)
    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'Hay un horario inválido en el pedido' }
    }
    if (horarios.includes(id)) {
      return { error: 'Hay un horario repetido en el pedido' }
    }
    horarios.push(id)
  }

  const definicion = TIPOS_RESERVA[tipo]
  if (!definicion) {
    return { error: 'El tipo de reserva tiene que ser semanal o quincenal' }
  }

  if (!RE_FECHA.test(String(fecha_inicio || ''))) {
    return { error: 'La fecha de inicio no tiene un formato válido' }
  }

  const inicio = Date.parse(`${fecha_inicio}T00:00:00Z`)
  if (Number.isNaN(inicio)) {
    return { error: 'La fecha de inicio no existe' }
  }

  const hoy = hoyEnElGimnasio()
  const UN_DIA = 24 * 60 * 60 * 1000

  if (inicio < hoy) {
    return { error: 'No se puede reservar una fecha que ya pasó' }
  }

  if (inicio > hoy + MAX_DIAS_A_FUTURO * UN_DIA) {
    return { error: `Solo se puede reservar hasta ${MAX_DIAS_A_FUTURO} días a futuro` }
  }

  // Se suman los días completos, igual que venía calculando la pantalla de
  // horarios: una semanal desde un lunes vence el lunes siguiente. Se
  // mantiene así a propósito, para no cambiarle el período a nadie.
  const fin = new Date(inicio + definicion.dias * UN_DIA)

  return {
    horarios,
    tipo,
    fechaInicio: fecha_inicio,
    fechaFin: fin.toISOString().slice(0, 10),
    multiplicador: definicion.multiplicador
  }
}
