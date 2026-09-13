import pool from '../db/conexion.js'
import { registrarActividad } from '../utils/auditoria.js'

// Las fechas se comparan en el huso del gimnasio. El servidor y la base están
// en UTC: contra su "hoy", un profe que llega a las 20 de Argentina
// desaparecería de la app a las 21, cuando en UTC ya es el día siguiente. El
// proyecto de Flavia, de donde viene esta función, tiene ese error.
const ZONA = 'America/Argentina/Buenos_Aires'
const HOY = `(now() AT TIME ZONE '${ZONA}')::date`
const diaDe = (columna) => `(${columna} AT TIME ZONE '${ZONA}')::date`

/**
 * Quién está en el gimnasio ahora. Lo ve cualquier socio con sesión, así que
 * devuelve solo el nombre y la hora de llegada: ni ids ni datos de contacto.
 */
export const profesEnSede = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.inicio, u.nombre
       FROM turnos_profe t
       JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.fin IS NULL AND u.activo AND ${diaDe('t.inicio')} = ${HOY}
       ORDER BY t.inicio`
    )
    res.json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo saber quién está en el gimnasio' })
  }
}

/** El turno abierto de quien está logueado, si tiene uno hoy. */
export const miTurno = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, inicio FROM turnos_profe
       WHERE usuario_id = $1 AND fin IS NULL AND ${diaDe('inicio')} = ${HOY}`,
      [req.usuario.id]
    )
    res.json(rows[0] || null)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo obtener tu turno' })
  }
}

/** "Llegué": abre el turno y los socios lo ven en la app. */
export const marcarLlegada = async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Un turno de un día anterior que quedó abierto se cierra solo, para que
    // no bloquee el de hoy.
    await client.query(
      `UPDATE turnos_profe SET fin = inicio
       WHERE usuario_id = $1 AND fin IS NULL AND ${diaDe('inicio')} < ${HOY}`,
      [req.usuario.id]
    )

    const { rows } = await client.query(
      'INSERT INTO turnos_profe (usuario_id) VALUES ($1) RETURNING id, inicio',
      [req.usuario.id]
    )

    await registrarActividad(client, {
      usuario_id: req.usuario.id,
      accion: 'turno.llegada',
      entidad: 'turno_profe',
      entidad_id: rows[0].id
    })

    await client.query('COMMIT')

    req.app.get('io').emit('profes_en_sede', {})
    res.status(201).json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')

    // El índice único de turnos abiertos: ya había marcado la llegada hoy.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya figurás en el gimnasio' })
    }

    console.error(error)
    res.status(500).json({ error: 'No se pudo marcar la llegada' })
  } finally {
    client.release()
  }
}

/** "Me voy": cierra el turno. */
export const marcarSalida = async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `UPDATE turnos_profe SET fin = now()
       WHERE usuario_id = $1 AND fin IS NULL
       RETURNING id, inicio, fin`,
      [req.usuario.id]
    )

    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No figurás en el gimnasio' })
    }

    await registrarActividad(client, {
      usuario_id: req.usuario.id,
      accion: 'turno.salida',
      entidad: 'turno_profe',
      entidad_id: rows[0].id
    })

    await client.query('COMMIT')

    req.app.get('io').emit('profes_en_sede', {})
    res.json(rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    res.status(500).json({ error: 'No se pudo marcar la salida' })
  } finally {
    client.release()
  }
}
