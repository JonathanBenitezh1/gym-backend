import pool from '../db/conexion.js'
import { estadoCuota } from '../utils/cuota.js'
import { leerConfig } from './cuotaController.js'
import { anotarActividad } from '../utils/auditoria.js'

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
                to_char(u.cuota_vence, 'YYYY-MM-DD') AS cuota_vence,
                EXISTS (SELECT 1 FROM fotos_socio f WHERE f.usuario_id = u.id) AS tiene_foto,
                (SELECT EXTRACT(EPOCH FROM now() - i.created_at)::int / 60
                   FROM ingresos i
                  WHERE i.usuario_id = u.id AND i.resultado IN ('al_dia', 'gracia', 'personal')
                  ORDER BY i.created_at DESC LIMIT 1) AS minutos_desde_ultimo
         FROM usuarios u WHERE u.dni = $1`,
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
        const e = estadoCuota(u.cuota_vence, config.dias_gracia)
        resultado = e.estado
        extra = { dias_restantes: e.dias_restantes, cuota_vence: u.cuota_vence }
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
      `INSERT INTO ingresos (usuario_id, dni, resultado, registrado_por)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [u?.id ?? null, dni, respuesta.resultado, req.usuario.id]
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
  const limite = Math.min(Number(req.query.limite) || 10, 200)
  try {
    const r = await pool.query(
      `SELECT i.id, i.dni, i.resultado, i.created_at, u.nombre
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
