import pool from '../db/conexion.js'
import { leerConfig } from './cuotaController.js'
import { anotarActividad } from '../utils/auditoria.js'
import { ahoraEnArgentina, decidirIngreso } from '../utils/ingreso.js'

/**
 * Lo que tiene reservado cada socio, para decidir en la puerta (migración
 * 013): sus lugares fijos del plan y sus semanales que todavía no
 * terminaron. `$1` es hoy; `$2`, un socio, o null para todos (el padrón).
 */
const CLASES_DE_SOCIOS = `
  SELECT rf.usuario_id, c.nombre AS clase, h.dias, h.hora_inicio, h.hora_fin,
         'fijo' AS tipo, NULL AS desde, NULL AS hasta, true AS pagado
  FROM reservas_fijas rf
  JOIN horarios h ON h.id = rf.horario_id
  JOIN clases c ON c.id = h.clase_id
  WHERE h.activo AND c.activo AND ($2::int IS NULL OR rf.usuario_id = $2)
  UNION ALL
  SELECT r.usuario_id, c.nombre, h.dias, h.hora_inicio, h.hora_fin,
         'semanal', to_char(r.fecha_inicio, 'YYYY-MM-DD'), to_char(r.fecha_fin, 'YYYY-MM-DD'),
         r.estado = 'pagado'
  FROM reservas r
  JOIN horarios h ON h.id = r.horario_id
  JOIN clases c ON c.id = h.clase_id
  WHERE r.estado <> 'cancelado' AND r.fecha_fin > $1::date
    AND h.activo AND c.activo AND ($2::int IS NULL OR r.usuario_id = $2)`

// La hora sale como 17:00:00; para la pantalla alcanza con 17:00.
const limpiarClase = ({ usuario_id, ...c }) => ({
  ...c, hora_inicio: c.hora_inicio.slice(0, 5), hora_fin: c.hora_fin.slice(0, 5)
})

const RE_DNI = /^\d{7,8}$/
const PERSONAL = ['profesor', 'profesional', 'admin', 'recepcion']

// Dentro de esta ventana, un segundo ingreso con el mismo DNI se marca en la
// pantalla: puede ser alguien que prestó el DNI (o una foto del DNI).
const MINUTOS_REINGRESO = 120

/**
 * Registra una pasada por la puerta y devuelve lo que la pantalla muestra.
 *
 * Se guarda siempre, también lo rechazado: sirve para ver después quién
 * intentó entrar con la cuota vencida o con un DNI que no está cargado.
 */
export const registrarIngreso = async (req, res) => {
  const dni = String(req.body.dni ?? '').trim()
  if (!RE_DNI.test(dni)) {
    return res.status(400).json({ error: 'El DNI tiene que tener 7 u 8 números' })
  }

  try {
    const [config, encontrado] = await Promise.all([
      leerConfig(),
      pool.query(
        `SELECT u.id, u.nombre, u.rol, u.activo,
                to_char(u.cuota_vence, 'YYYY-MM-DD') AS cuota_vence, p.nombre AS plan,
                EXISTS (SELECT 1 FROM fotos_socio f WHERE f.usuario_id = u.id) AS tiene_foto,
                (SELECT EXTRACT(EPOCH FROM now() - i.created_at)::int / 60
                   FROM ingresos i
                  WHERE i.usuario_id = u.id AND i.resultado IN ('al_dia', 'gracia', 'personal', 'pago_pendiente')
                  ORDER BY i.created_at DESC LIMIT 1) AS minutos_desde_ultimo
         FROM usuarios u LEFT JOIN planes p ON p.id = u.plan_id
         WHERE u.dni = $1`,
        [dni]
      )
    ])

    const u = encontrado.rows[0]
    let respuesta
    if (!u) {
      respuesta = { resultado: 'no_registrado' }
    } else {
      let resultado
      let extra = {}
      if (!u.activo) resultado = 'baja'
      else if (PERSONAL.includes(u.rol)) resultado = 'personal'
      else {
        const ahora = ahoraEnArgentina()
        const clases = await pool.query(CLASES_DE_SOCIOS, [ahora.dia, u.id])
        const { resultado: decidido, ...detalle } = decidirIngreso(
          { cuota_vence: u.cuota_vence, plan: u.plan, clases: clases.rows.map(limpiarClase) },
          { ahora, diasGracia: config.dias_gracia, margen: config.margen_ingreso_min }
        )
        resultado = decidido
        extra = detalle
      }
      const reingreso = u.minutos_desde_ultimo !== null && u.minutos_desde_ultimo < MINUTOS_REINGRESO
      respuesta = {
        resultado,
        usuario_id: u.id,
        nombre: u.nombre.trim(),
        tiene_foto: u.tiene_foto,
        ...extra,
        ...(reingreso ? { minutos_desde_ultimo: u.minutos_desde_ultimo } : {})
      }
    }

    const ingreso = await pool.query(
      `INSERT INTO ingresos (usuario_id, dni, resultado, registrado_por, clase)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [u?.id ?? null, dni, respuesta.resultado, req.usuario.id, respuesta.clase ?? null]
    )

    // El panel del admin ve los ingresos en vivo.
    req.app.get('io').to('admins').emit('nuevo_ingreso', { resultado: respuesta.resultado })

    res.status(201).json({ id: ingreso.rows[0].id, created_at: ingreso.rows[0].created_at, dni, ...respuesta })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo registrar el ingreso' })
  }
}

export const obtenerUltimosIngresos = async (req, res) => {
  // Un límite negativo o con decimales llegaba tal cual al LIMIT y daba 500.
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 10, 1), 200)
  try {
    const r = await pool.query(
      `SELECT i.id, i.dni, i.resultado, i.clase, i.created_at, u.nombre
       FROM ingresos i LEFT JOIN usuarios u ON u.id = i.usuario_id
       ORDER BY i.created_at DESC LIMIT $1`,
      [limite]
    )
    res.json(r.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los ingresos' })
  }
}

// ─── Fotos ────────────────────────────────────────────

export const obtenerFoto = async (req, res) => {
  const id = Number(req.params.usuario_id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Usuario inválido' })
  try {
    const r = await pool.query('SELECT imagen, tipo, updated_at FROM fotos_socio WHERE usuario_id = $1', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Sin foto' })
    // Privada: la puede guardar el navegador de recepción, nunca un intermediario.
    res.set('Cache-Control', 'private, max-age=300')
    res.type(r.rows[0].tipo).send(r.rows[0].imagen)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener la foto' })
  }
}

const RE_DATA_URL = /^data:(image\/(?:jpeg|webp));base64,([A-Za-z0-9+/=]+)$/

/**
 * La foto llega como data URL. La app la achica antes de mandarla, así que
 * cabe en el límite de 100 KB del cuerpo del pedido sin agrandarlo: en base64
 * pesa un tercio más, por eso la imagen tope es de 70 KB.
 */
export const guardarFoto = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Usuario inválido' })

  const m = RE_DATA_URL.exec(String(req.body.imagen ?? ''))
  if (!m) return res.status(400).json({ error: 'La foto tiene que ser JPG o WEBP' })
  const imagen = Buffer.from(m[2], 'base64')
  // Se revisa la firma del archivo: el tipo declarado no alcanza.
  const esJpeg = imagen[0] === 0xff && imagen[1] === 0xd8 && imagen[2] === 0xff
  const esWebp = imagen.subarray(0, 4).toString() === 'RIFF' && imagen.subarray(8, 12).toString() === 'WEBP'
  if ((m[1] === 'image/jpeg' && !esJpeg) || (m[1] === 'image/webp' && !esWebp)) {
    return res.status(400).json({ error: 'El archivo no es una imagen válida' })
  }
  if (imagen.length > 70 * 1024) {
    return res.status(400).json({ error: 'La foto es muy pesada' })
  }

  try {
    const r = await pool.query(
      `INSERT INTO fotos_socio (usuario_id, imagen, tipo, cargada_por)
       SELECT id, $2, $3, $4 FROM usuarios WHERE id = $1
       ON CONFLICT (usuario_id) DO UPDATE
         SET imagen = EXCLUDED.imagen, tipo = EXCLUDED.tipo,
             cargada_por = EXCLUDED.cargada_por, updated_at = now()
       RETURNING usuario_id`,
      [id, imagen, m[1], req.usuario.id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    anotarActividad({ usuario_id: req.usuario.id, accion: 'usuario.foto', entidad: 'usuario', entidad_id: id, afectado_id: id })
    res.json({ mensaje: 'Foto guardada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo guardar la foto' })
  }
}

export const borrarFoto = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Usuario inválido' })
  try {
    await pool.query('DELETE FROM fotos_socio WHERE usuario_id = $1', [id])
    anotarActividad({ usuario_id: req.usuario.id, accion: 'usuario.foto_borrar', entidad: 'usuario', entidad_id: id, afectado_id: id })
    res.json({ mensaje: 'Foto borrada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo borrar la foto' })
  }
}

// ─── Sin conexión ─────────────────────────────────────

/**
 * Lista de socios para que la pantalla de la puerta pueda decidir sola si se
 * corta internet. Solo lo necesario para la puerta: sin email ni teléfono.
 * `foto_version` cambia cuando se reemplaza la foto, para no mostrar una vieja
 * guardada en la PC.
 */
export const obtenerPadron = async (req, res) => {
  try {
    const hoy = ahoraEnArgentina().dia
    const [config, socios, clases] = await Promise.all([
      leerConfig(),
      pool.query(
        `SELECT u.id AS usuario_id, u.dni, u.nombre, u.rol, u.activo,
                to_char(u.cuota_vence, 'YYYY-MM-DD') AS cuota_vence, p.nombre AS plan,
                (EXTRACT(EPOCH FROM f.updated_at) * 1000)::bigint AS foto_version
         FROM usuarios u
         LEFT JOIN fotos_socio f ON f.usuario_id = u.id
         LEFT JOIN planes p ON p.id = u.plan_id
         WHERE u.dni IS NOT NULL`
      ),
      pool.query(CLASES_DE_SOCIOS, [hoy, null])
    ])
    // Las clases de cada socio van con él: sin conexión, la pantalla decide
    // con la misma regla que el servidor (utils/ingreso.js).
    const porSocio = new Map()
    for (const fila of clases.rows) {
      if (!porSocio.has(fila.usuario_id)) porSocio.set(fila.usuario_id, [])
      porSocio.get(fila.usuario_id).push(limpiarClase(fila))
    }
    res.set('Cache-Control', 'no-store')
    res.json({
      dias_gracia: config.dias_gracia,
      margen_ingreso_min: config.margen_ingreso_min,
      generado: new Date().toISOString(),
      socios: socios.rows.map(s => ({ ...s, clases: porSocio.get(s.usuario_id) ?? [] }))
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener la lista de socios' })
  }
}

const RESULTADOS = [
  'al_dia', 'gracia', 'vencida', 'sin_cuota', 'personal', 'baja', 'no_registrado',
  'fuera_horario', 'pago_pendiente'
]
const MAX_LOTE = 500
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000

/**
 * Ingresos que la pantalla anotó sin conexión. Se guarda el resultado que se
 * mostró en ese momento (es lo que pasó en la puerta) y la hora real de la
 * pasada. Los repetidos se ignoran por id_local.
 */
export const recibirLote = async (req, res) => {
  const lote = req.body.ingresos
  if (!Array.isArray(lote) || lote.length === 0 || lote.length > MAX_LOTE) {
    return res.status(400).json({ error: `Mandá entre 1 y ${MAX_LOTE} ingresos` })
  }
  const ahora = Date.now()
  const validos = lote.filter(i =>
    RE_DNI.test(String(i?.dni)) &&
    RESULTADOS.includes(i?.resultado) &&
    /^[A-Za-z0-9-]{8,40}$/.test(String(i?.id_local)) &&
    Number.isFinite(Date.parse(i?.fecha)) &&
    Date.parse(i.fecha) <= ahora + 60_000 &&
    Date.parse(i.fecha) >= ahora - UNA_SEMANA
  )

  try {
    let guardados = 0
    for (const i of validos) {
      const clase = typeof i.clase === 'string' ? i.clase.slice(0, 100) : null
      const r = await pool.query(
        `INSERT INTO ingresos (usuario_id, dni, resultado, registrado_por, created_at, id_local, clase)
         VALUES ((SELECT id FROM usuarios WHERE dni = $1), $1, $2, $3, $4, $5, $6)
         ON CONFLICT (id_local) WHERE id_local IS NOT NULL DO NOTHING`,
        [i.dni, i.resultado, req.usuario.id, i.fecha, i.id_local, clase]
      )
      guardados += r.rowCount
    }
    if (guardados > 0) req.app.get('io').to('admins').emit('nuevo_ingreso', { lote: guardados })
    // Los inválidos se descartan: reintentarlos no los arreglaría.
    res.status(201).json({ recibidos: lote.length, guardados, descartados: lote.length - validos.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudieron guardar los ingresos' })
  }
}
