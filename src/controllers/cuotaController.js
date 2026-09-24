import pool from '../db/conexion.js'
import { registrarActividad, anotarActividad } from '../utils/auditoria.js'
import { estadoCuota, calcularNuevoVence, hoyEnArgentina } from '../utils/cuota.js'

const METODOS = ['efectivo', 'transferencia', 'mercadopago', 'otro']

// Number(null) y Number('') dan 0. Un precio o un monto que no llegó (o que
// la app no pudo leer y mandó como null) se guardaba como $0 sin ningún aviso.
const aNumero = (valor) =>
  typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '')
    ? Number(valor)
    : NaN

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

const fechaValida = (texto) => {
  if (!RE_FECHA.test(String(texto))) return false
  const f = new Date(`${texto}T00:00:00Z`)
  // El redondeo de Date convierte 2026-02-31 en marzo: se compara de vuelta.
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === texto && f.getUTCFullYear() >= 2000
}

export async function leerConfig(ejecutor = pool) {
  const r = await ejecutor.query(
    `SELECT modo_vencimiento, dia_vencimiento, dias_gracia, precio::float AS precio
     FROM config_cuota WHERE id = 1`
  )
  return r.rows[0]
}

// ─── Configuración ────────────────────────────────────

export const obtenerConfigCuota = async (req, res) => {
  try {
    res.json(await leerConfig())
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener la configuración de la cuota' })
  }
}

export const guardarConfigCuota = async (req, res) => {
  const { modo_vencimiento, dia_vencimiento, dias_gracia, precio } = req.body
  const dia = Number(dia_vencimiento)
  const gracia = Number(dias_gracia)
  const monto = aNumero(precio)

  if (!['mensual', 'dia_fijo'].includes(modo_vencimiento)) {
    return res.status(400).json({ error: 'Elegí cómo vence la cuota' })
  }
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    return res.status(400).json({ error: 'El día de vencimiento va del 1 al 28, para que exista en todos los meses' })
  }
  if (!Number.isInteger(gracia) || gracia < 0 || gracia > 30) {
    return res.status(400).json({ error: 'Los días de gracia van de 0 a 30' })
  }
  if (!Number.isFinite(monto) || monto < 0 || monto > 99999999) {
    return res.status(400).json({ error: 'El precio no es válido' })
  }

  try {
    await pool.query(
      `UPDATE config_cuota
       SET modo_vencimiento = $1, dia_vencimiento = $2, dias_gracia = $3, precio = $4, updated_at = now()
       WHERE id = 1`,
      [modo_vencimiento, dia, gracia, monto]
    )
    anotarActividad({
      usuario_id: req.usuario.id, accion: 'cuota.config', entidad: 'cuota',
      detalle: { modo_vencimiento, dia_vencimiento: dia, dias_gracia: gracia, precio: monto }
    })
    res.json(await leerConfig())
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo guardar la configuración' })
  }
}

// ─── Socios y su estado ───────────────────────────────

export const obtenerCuotas = async (req, res) => {
  try {
    const [config, socios] = await Promise.all([
      leerConfig(),
      pool.query(
        // La fecha va como texto: como Date, pg la corre un día por la zona horaria.
        `SELECT u.id, u.nombre, u.dni, u.telefono,
                to_char(u.cuota_vence, 'YYYY-MM-DD') AS cuota_vence,
                ultimo.monto::float AS ultimo_monto, ultimo.created_at AS ultimo_pago
         FROM usuarios u
         LEFT JOIN LATERAL (
           SELECT monto, created_at FROM pagos_cuota
           WHERE usuario_id = u.id ORDER BY created_at DESC LIMIT 1
         ) ultimo ON true
         WHERE u.rol = 'alumno' AND u.activo
         ORDER BY u.cuota_vence NULLS FIRST, u.nombre`
      )
    ])
    const hoy = hoyEnArgentina()
    res.json({
      config,
      hoy,
      socios: socios.rows.map(s => ({ ...s, ...estadoCuota(s.cuota_vence, config.dias_gracia, hoy) }))
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener las cuotas' })
  }
}

/**
 * Registra el cobro y corre el vencimiento. Todo en una transacción con la
 * fila del socio bloqueada: dos cobros simultáneos del mismo socio no pueden
 * calcular su vencimiento desde la misma fecha.
 */
export const registrarPagoCuota = async (req, res) => {
  const usuario_id = Number(req.params.usuario_id)
  const meses = Number(req.body.meses ?? 1)
  const monto = aNumero(req.body.monto)
  const { metodo } = req.body

  if (!Number.isInteger(usuario_id) || usuario_id <= 0) {
    return res.status(400).json({ error: 'Socio inválido' })
  }
  if (!Number.isInteger(meses) || meses < 1 || meses > 12) {
    return res.status(400).json({ error: 'Se pueden cobrar de 1 a 12 meses' })
  }
  if (!Number.isFinite(monto) || monto < 0 || monto > 99999999) {
    return res.status(400).json({ error: 'El monto no es válido' })
  }
  if (!METODOS.includes(metodo)) {
    return res.status(400).json({ error: 'Elegí cómo pagó' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const socio = await client.query(
      `SELECT id, nombre, rol, activo, to_char(cuota_vence, 'YYYY-MM-DD') AS cuota_vence
       FROM usuarios WHERE id = $1 FOR UPDATE`,
      [usuario_id]
    )
    const s = socio.rows[0]
    if (!s || s.rol !== 'alumno') {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'No se encontró ese socio' })
    }
    if (!s.activo) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'El socio está dado de baja. Reactivalo antes de cobrarle' })
    }

    const config = await leerConfig(client)
    const nuevo = calcularNuevoVence({ venceActual: s.cuota_vence, meses, config })

    await client.query('UPDATE usuarios SET cuota_vence = $1 WHERE id = $2', [nuevo, usuario_id])
    const pago = await client.query(
      `INSERT INTO pagos_cuota (usuario_id, monto, metodo, meses, vence_anterior, vence_nuevo, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [usuario_id, monto, metodo, meses, s.cuota_vence, nuevo, req.usuario.id]
    )
    await registrarActividad(client, {
      usuario_id: req.usuario.id, accion: 'cuota.pago', entidad: 'cuota',
      entidad_id: pago.rows[0].id, afectado_id: usuario_id,
      detalle: { monto, metodo, meses, vence_anterior: s.cuota_vence, vence_nuevo: nuevo }
    })

    await client.query('COMMIT')

    // El socio ve su estado nuevo al instante, sin recargar.
    req.app.get('io').to(`usuario:${usuario_id}`).emit('cuota_actualizada', { cuota_vence: nuevo })

    res.status(201).json({
      cuota_vence: nuevo,
      vence_anterior: s.cuota_vence,
      ...estadoCuota(nuevo, config.dias_gracia)
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'No se pudo registrar el pago' })
  } finally {
    client.release()
  }
}

// Corrección a mano: un error de carga, una bonificación, un socio que ya
// venía pagando antes de usar la app. Queda en la actividad con el valor viejo.
export const corregirVence = async (req, res) => {
  const usuario_id = Number(req.params.usuario_id)
  const { vence } = req.body

  if (!Number.isInteger(usuario_id) || usuario_id <= 0) {
    return res.status(400).json({ error: 'Socio inválido' })
  }
  if (vence !== null && !fechaValida(vence)) {
    return res.status(400).json({ error: 'La fecha no es válida' })
  }

  try {
    const r = await pool.query(
      `UPDATE usuarios u SET cuota_vence = $1
       FROM (SELECT id, to_char(cuota_vence, 'YYYY-MM-DD') AS anterior FROM usuarios WHERE id = $2) previo
       WHERE u.id = previo.id AND u.rol = 'alumno'
       RETURNING previo.anterior, to_char(u.cuota_vence, 'YYYY-MM-DD') AS cuota_vence`,
      [vence, usuario_id]
    )
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ese socio' })
    }
    anotarActividad({
      usuario_id: req.usuario.id, accion: 'cuota.corregir', entidad: 'cuota',
      afectado_id: usuario_id, detalle: { anterior: r.rows[0].anterior, vence }
    })
    req.app.get('io').to(`usuario:${usuario_id}`).emit('cuota_actualizada', { cuota_vence: vence })
    res.json({ cuota_vence: r.rows[0].cuota_vence })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo corregir el vencimiento' })
  }
}

export const obtenerPagosDeSocio = async (req, res) => {
  const usuario_id = Number(req.params.usuario_id)
  if (!Number.isInteger(usuario_id) || usuario_id <= 0) {
    return res.status(400).json({ error: 'Socio inválido' })
  }
  try {
    const r = await pool.query(
      `SELECT p.id, p.monto::float AS monto, p.metodo, p.meses, p.created_at,
              to_char(p.vence_anterior, 'YYYY-MM-DD') AS vence_anterior,
              to_char(p.vence_nuevo, 'YYYY-MM-DD') AS vence_nuevo,
              u.nombre AS registrado_por
       FROM pagos_cuota p LEFT JOIN usuarios u ON u.id = p.registrado_por
       WHERE p.usuario_id = $1 ORDER BY p.created_at DESC LIMIT 24`,
      [usuario_id]
    )
    res.json(r.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los pagos' })
  }
}

// ─── Para el socio ────────────────────────────────────

export const obtenerMiCuota = async (req, res) => {
  try {
    const [config, yo] = await Promise.all([
      leerConfig(),
      pool.query(
        `SELECT rol, to_char(cuota_vence, 'YYYY-MM-DD') AS cuota_vence FROM usuarios WHERE id = $1`,
        [req.usuario.id]
      )
    ])
    const { rol, cuota_vence } = yo.rows[0]
    if (rol !== 'alumno') return res.json({ estado: 'personal' })
    res.json({
      cuota_vence,
      dias_gracia: config.dias_gracia,
      precio: config.precio,
      ...estadoCuota(cuota_vence, config.dias_gracia)
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener tu cuota' })
  }
}
