import jwt from 'jsonwebtoken'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

/**
 * Límites de pedidos, todos en un solo lugar.
 *
 * El problema de fondo: los celulares conectados al wifi del gimnasio (y la
 * PC de recepción) salen a internet por la misma IP. Un contador por IP los
 * suma a todos: 20 logins fallidos de cualquiera bloqueaban el login de todo
 * el gimnasio durante 15 minutos, y con el uso normal de la app el límite
 * general de 600 también se llenaba entre todos (auditoría del 24/09/2026,
 * P2 y P3). Por eso cada contador se cuenta por lo que corresponde:
 *
 *   • general       → por usuario si el pedido trae una sesión válida;
 *                     por IP si no.
 *   • login         → por IP + email (10 fallidos), y un tope por IP (100
 *                     fallidos) contra el que prueba muchas cuentas.
 *   • registro      → aparte del login, por IP (30 fallidos).
 *   • cambiar clave → por usuario (10 fallidos).
 *   • puerta        → propio y alto (3000), fuera del general.
 */

const QUINCE_MINUTOS = 15 * 60 * 1000

/**
 * La IP real de quien pide.
 *
 * Delante de Render está Cloudflare, así que `req.ip` es la IP de salida de
 * Cloudflare, compartida por toda la gente que entra por el mismo nodo.
 * Cloudflare manda la IP real en CF-Connecting-IP y pisa cualquier valor que
 * traiga el pedido. En la PC no hay Cloudflare y se usa `req.ip`.
 * `ipKeyGenerator` agrupa las IPv6 por subred, para que no alcance con rotar
 * direcciones dentro de la misma conexión.
 */
export const claveDeCliente = (req) => ipKeyGenerator(req.get('cf-connecting-ip') || req.ip)

/**
 * El usuario de la sesión, si el token es válido. La firma se verifica igual
 * que en `verificarToken`: un token inventado no sirve para abrir un contador
 * nuevo, cae en el de su IP.
 */
function usuarioDelPedido(req) {
  const encabezado = req.headers.authorization
  if (!encabezado?.startsWith('Bearer ')) return null
  try {
    const datos = jwt.verify(encabezado.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    return Number.isInteger(datos?.id) ? datos.id : null
  } catch {
    return null
  }
}

const comunes = { windowMs: QUINCE_MINUTOS, standardHeaders: true, legacyHeaders: false }

// Límite general: evita que un cliente sature la API a pedidos. La puerta
// queda afuera y tiene el suyo.
export const limiteGeneral = rateLimit({
  ...comunes,
  max: 600,
  skip: (req) => req.path.startsWith('/puerta/'),
  keyGenerator: (req) => {
    const id = usuarioDelPedido(req)
    return id ? `usuario:${id}` : `ip:${claveDeCliente(req)}`
  },
  message: { error: 'Demasiadas peticiones. Esperá unos minutos e intentá de nuevo.' }
})

const emailDelPedido = (req) => String(req.body?.email ?? '').trim().toLowerCase().slice(0, 100)

// Login, primera barrera: por IP + email. El que se equivoca con su clave se
// bloquea solo él, no el resto del gimnasio.
export const limiteLoginCuenta = rateLimit({
  ...comunes,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${claveDeCliente(req)}|${emailDelPedido(req)}`,
  message: { error: 'Demasiados intentos con este email. Esperá 15 minutos e intentá de nuevo.' }
})

// Login, segunda barrera: por IP, más alto. Frena al que prueba muchas cuentas
// distintas desde el mismo lugar, sin molestar a un wifi con mucha gente.
export const limiteLoginIp = rateLimit({
  ...comunes,
  max: 100,
  skipSuccessfulRequests: true,
  keyGenerator: claveDeCliente,
  message: { error: 'Demasiados intentos desde esta conexión. Esperá 15 minutos e intentá de nuevo.' }
})

// Registro, aparte del login: un día de muchas altas en el gimnasio no tiene
// que bloquear el login de nadie.
export const limiteRegistro = rateLimit({
  ...comunes,
  max: 30,
  skipSuccessfulRequests: true,
  keyGenerator: claveDeCliente,
  message: { error: 'Demasiados intentos de registro. Esperá 15 minutos e intentá de nuevo.' }
})

// Cambiar la clave pide la actual: sin tope, un token robado permitía probar
// miles de claves por día hasta quedarse con la cuenta. Va después de
// verificarToken, así que el usuario ya está identificado.
export const limiteCambioClave = rateLimit({
  ...comunes,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `usuario:${req.usuario?.id ?? claveDeCliente(req)}`,
  message: { error: 'Demasiados intentos. Esperá 15 minutos e intentá de nuevo.' }
})

// Una pasada son 2 pedidos (ingreso y foto): esto alcanza para ~1500 por
// cuarto de hora, muy por encima de cualquier hora pico.
export const limitePuerta = rateLimit({
  ...comunes,
  max: 3000,
  keyGenerator: claveDeCliente,
  message: { error: 'Demasiadas peticiones desde la puerta. Esperá unos minutos.' }
})
