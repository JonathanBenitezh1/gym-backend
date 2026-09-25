import pool from '../db/conexion.js'
import { anotarActividad } from '../utils/auditoria.js'
import { leerPlanes, liberarFijasYAvisar } from '../utils/planes.js'

/**
 * Planes mensuales (migración 013). El gimnasio arma cada plan con las clases
 * que incluye y su precio por mes: "Lucha", "Lucha + Gym", "Completa". El
 * socio lo pide desde la app y el mostrador se lo cobra.
 */

const CLAVE_FORANEA = '23503'
const NOMBRE_REPETIDO = '23505'

function validarPlan({ nombre, descripcion, precio, incluye_todo, clases_ids }) {
  const limpio = String(nombre ?? '').trim()
  if (limpio.length < 2) return { error: 'El nombre del plan es demasiado corto' }
  if (limpio.length > 100) return { error: 'El nombre del plan es demasiado largo' }

  const texto = descripcion == null ? null : String(descripcion).trim()
  if (texto && texto.length > 500) return { error: 'La descripción es demasiado larga' }

  const monto = typeof precio === 'number' || (typeof precio === 'string' && precio.trim() !== '')
    ? Number(precio) : NaN
  if (!Number.isFinite(monto) || monto < 0 || monto > 99999999) return { error: 'El precio no es válido' }

  const todo = Boolean(incluye_todo)
  const lista = Array.isArray(clases_ids) ? clases_ids : []
  const clases = [...new Set(lista.map(Number))]
  if (clases.length > 100 || clases.some(id => !Number.isInteger(id) || id <= 0)) {
    return { error: 'Hay una clase inválida en el plan' }
  }
  if (!todo && clases.length === 0) return { error: 'Elegí al menos una clase, o marcá que incluye todas' }

  return { plan: { nombre: limpio, descripcion: texto || null, precio: monto, incluye_todo: todo, clases: todo ? [] : clases } }
}

// ─── Para el socio ────────────────────────────────────

// Pública, como los horarios: son los precios del gimnasio.
export const obtenerPlanesPublicos = async (req, res) => {
  try {
    const planes = await leerPlanes()
    res.json(planes.map(({ socios, activo, ...plan }) => plan))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los planes' })
  }
}

/** El socio pide un plan desde la app. Lo confirma el mostrador al cobrarlo. */
export const pedirPlan = async (req, res) => {
  const plan_id = Number(req.params.id)
  if (!Number.isInteger(plan_id) || plan_id <= 0) {
    return res.status(400).json({ error: 'Plan inválido' })
  }
  if (req.usuario.rol !== 'alumno') {
    return res.status(400).json({ error: 'Los planes son para socios' })
  }
  try {
    const r = await pool.query(
      `UPDATE usuarios SET plan_pedido_id = p.id, plan_pedido_at = now()
       FROM planes p
       WHERE usuarios.id = $1 AND p.id = $2 AND p.activo
       RETURNING p.nombre`,
      [req.usuario.id, plan_id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Ese plan ya no está disponible' })

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'plan.pedir', entidad: 'plan',
      entidad_id: plan_id, afectado_id: req.usuario.id, detalle: { plan: r.rows[0].nombre }
    })
    req.app.get('io').to('admins').emit('plan_pedido', { usuario_id: req.usuario.id, plan_id })
    res.json({ mensaje: 'Pedido registrado', plan: r.rows[0].nombre })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo registrar el pedido' })
  }
}

export const cancelarPedido = async (req, res) => {
  try {
    await pool.query(
      'UPDATE usuarios SET plan_pedido_id = NULL, plan_pedido_at = NULL WHERE id = $1',
      [req.usuario.id]
    )
    req.app.get('io').to('admins').emit('plan_pedido', { usuario_id: req.usuario.id, plan_id: null })
    res.json({ mensaje: 'Pedido cancelado' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo cancelar el pedido' })
  }
}

// ─── Admin ────────────────────────────────────────────

export const obtenerPlanesAdmin = async (req, res) => {
  try {
    res.json(await leerPlanes({ soloActivos: false }))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los planes' })
  }
}

async function guardarClases(client, plan_id, clases) {
  await client.query('DELETE FROM plan_clases WHERE plan_id = $1', [plan_id])
  if (clases.length > 0) {
    await client.query(
      `INSERT INTO plan_clases (plan_id, clase_id) SELECT $1, unnest($2::int[])`,
      [plan_id, clases]
    )
  }
}

function responderErrorPlan(res, error, mensaje) {
  if (error.code === NOMBRE_REPETIDO) return res.status(400).json({ error: 'Ya hay un plan con ese nombre' })
  if (error.code === CLAVE_FORANEA) return res.status(400).json({ error: 'Una de las clases elegidas no existe' })
  console.error(error)
  return res.status(500).json({ error: mensaje })
}

export const crearPlan = async (req, res) => {
  const { error, plan } = validarPlan(req.body)
  if (error) return res.status(400).json({ error })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `INSERT INTO planes (nombre, descripcion, precio, incluye_todo)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [plan.nombre, plan.descripcion, plan.precio, plan.incluye_todo]
    )
    await guardarClases(client, r.rows[0].id, plan.clases)
    await client.query('COMMIT')

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'plan.crear', entidad: 'plan',
      entidad_id: r.rows[0].id, detalle: { nombre: plan.nombre, precio: plan.precio }
    })
    req.app.get('io').emit('planes_actualizados', {})
    res.status(201).json({ id: r.rows[0].id })
  } catch (error) {
    await client.query('ROLLBACK')
    responderErrorPlan(res, error, 'No se pudo crear el plan')
  } finally {
    client.release()
  }
}

/**
 * Edita el plan entero. Si le saca una clase, los socios con ese plan pierden
 * su lugar fijo en ella (liberarFijas): ya no la están pagando.
 */
export const editarPlan = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Plan inválido' })

  // El interruptor de activo del panel manda solo eso.
  if (Object.keys(req.body).every(k => k === 'activo')) {
    try {
      const r = await pool.query(
        'UPDATE planes SET activo = $1 WHERE id = $2 RETURNING nombre',
        [Boolean(req.body.activo), id]
      )
      if (r.rows.length === 0) return res.status(404).json({ error: 'El plan no existe' })
      anotarActividad({
        usuario_id: req.usuario.id, accion: req.body.activo ? 'plan.activar' : 'plan.desactivar',
        entidad: 'plan', entidad_id: id, detalle: { nombre: r.rows[0].nombre }
      })
      req.app.get('io').emit('planes_actualizados', {})
      return res.json({ mensaje: 'Plan actualizado' })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'No se pudo actualizar el plan' })
    }
  }

  const { error, plan } = validarPlan(req.body)
  if (error) return res.status(400).json({ error })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `UPDATE planes SET nombre = $1, descripcion = $2, precio = $3, incluye_todo = $4
       WHERE id = $5 RETURNING id`,
      [plan.nombre, plan.descripcion, plan.precio, plan.incluye_todo, id]
    )
    if (r.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'El plan no existe' })
    }
    await guardarClases(client, id, plan.clases)
    await client.query('COMMIT')

    anotarActividad({
      usuario_id: req.usuario.id, accion: 'plan.editar', entidad: 'plan',
      entidad_id: id, detalle: { nombre: plan.nombre, precio: plan.precio }
    })
    const io = req.app.get('io')
    io.emit('planes_actualizados', {})
    await liberarFijasYAvisar(io)
    res.json({ mensaje: 'Plan actualizado' })
  } catch (error) {
    await client.query('ROLLBACK')
    responderErrorPlan(res, error, 'No se pudo guardar el plan')
  } finally {
    client.release()
  }
}

// Solo si nadie lo tiene: si no, se desactiva (deja de ofrecerse y los que
// lo tienen lo siguen renovando).
export const eliminarPlan = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Plan inválido' })
  try {
    const r = await pool.query('DELETE FROM planes WHERE id = $1 RETURNING nombre', [id])
    if (r.rows.length > 0) {
      anotarActividad({
        usuario_id: req.usuario.id, accion: 'plan.eliminar', entidad: 'plan',
        entidad_id: id, detalle: { nombre: r.rows[0].nombre }
      })
    }
    req.app.get('io').emit('planes_actualizados', {})
    res.json({ mensaje: 'Plan eliminado' })
  } catch (error) {
    if (error.code === CLAVE_FORANEA) {
      return res.status(409).json({ error: 'Hay socios con este plan: desactivalo en vez de borrarlo' })
    }
    console.error(error)
    res.status(500).json({ error: 'No se pudo eliminar el plan' })
  }
}
