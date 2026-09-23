import pool from '../db/conexion.js'

// Unidades aceptadas. Libres, un socio escribía "kilos", otro "kg", otro "k",
// y el mismo ejercicio quedaba partido en tres medidas distintas.
const UNIDADES = ['kg', 'cm', '%', 'reps', 'seg', 'min']

// Tope por socio: sobra para años de mediciones semanales.
const MAX_REGISTROS = 1000

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

const HOY_AR = `(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`

// La fecha va como texto: como Date, pg la corre un día por la zona horaria.
const COLUMNAS = `id, medida, valor::float AS valor, unidad,
                  to_char(fecha, 'YYYY-MM-DD') AS fecha`

async function listar(usuario_id) {
  const resultado = await pool.query(
    `SELECT ${COLUMNAS} FROM progreso
     WHERE usuario_id = $1
     ORDER BY lower(medida), fecha, id`,
    [usuario_id]
  )
  return resultado.rows
}

export const obtenerMiProgreso = async (req, res) => {
  try {
    res.json(await listar(req.usuario.id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener tu progreso' })
  }
}

export const registrarProgreso = async (req, res) => {
  const medida = String(req.body.medida ?? '').trim()
  const unidad = String(req.body.unidad ?? '')
  const valor  = Number(req.body.valor)
  const fecha  = String(req.body.fecha ?? '')

  if (!medida || medida.length > 40) {
    return res.status(400).json({ error: 'Poné qué medís, en hasta 40 letras' })
  }
  if (!UNIDADES.includes(unidad)) {
    return res.status(400).json({ error: 'Unidad inválida' })
  }
  if (!Number.isFinite(valor) || valor <= 0 || valor >= 10000) {
    return res.status(400).json({ error: 'El valor tiene que ser un número mayor a cero' })
  }
  const f = RE_FECHA.test(fecha) ? new Date(`${fecha}T00:00:00Z`) : null
  if (!f || Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== fecha || f.getUTCFullYear() < 2000) {
    return res.status(400).json({ error: 'La fecha no es válida' })
  }

  try {
    const cantidad = await pool.query(
      'SELECT COUNT(*)::int AS n FROM progreso WHERE usuario_id = $1',
      [req.usuario.id]
    )
    if (cantidad.rows[0].n >= MAX_REGISTROS) {
      return res.status(400).json({ error: 'Llegaste al máximo de registros. Borrá algunos viejos.' })
    }

    // La fecha futura se controla en la base, con el día de Argentina.
    const resultado = await pool.query(
      `INSERT INTO progreso (usuario_id, medida, valor, unidad, fecha)
       SELECT $1, $2, $3, $4, $5::date
       WHERE $5::date <= ${HOY_AR}
       RETURNING ${COLUMNAS}`,
      [req.usuario.id, medida, Math.round(valor * 100) / 100, unidad, fecha]
    )
    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'La fecha no puede ser futura' })
    }
    res.status(201).json(resultado.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo guardar el registro' })
  }
}

export const borrarProgreso = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Registro inválido' })
  }
  try {
    // Solo el dueño: el filtro por usuario hace que un id ajeno dé 404.
    const resultado = await pool.query(
      'DELETE FROM progreso WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [id, req.usuario.id]
    )
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' })
    }
    res.json({ mensaje: 'Registro borrado' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'No se pudo borrar el registro' })
  }
}

// Para profes y admin, al armar la rutina de un socio.
export const obtenerProgresoDeAlumno = async (req, res) => {
  const alumno_id = Number(req.params.alumno_id)
  if (!Number.isInteger(alumno_id) || alumno_id <= 0) {
    return res.status(400).json({ error: 'Alumno inválido' })
  }
  try {
    res.json(await listar(alumno_id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener el progreso' })
  }
}
