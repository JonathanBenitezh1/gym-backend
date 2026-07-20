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

export const LARGO_MINIMO_PASSWORD = 6

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
