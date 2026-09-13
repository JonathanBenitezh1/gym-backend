/**
 * Datos de demostración: la app con las pantallas llenas, para probar y para
 * mostrar sin tener que inventar nada en el momento.
 *
 * Carga un admin, un profe y seis socios, cuatro clases con sus horarios,
 * reservas en todos los estados (pendiente sin pago, pago por confirmar,
 * pagada, cancelada, quincenal), una rutina, un profe en la sede, un socio
 * dado de baja y algunos movimientos en el registro de actividad.
 *
 * Uso (PowerShell), desde gym-backend:
 *   node scripts/datos-demo.js            # carga
 *   node scripts/datos-demo.js --borrar   # borra solo lo de demo
 *
 * Se conecta con PGURL, o con DATABASE_URL del .env.
 *
 * ⚠️ Pensado para una base de prueba. Todo lo que crea queda marcado: los
 *    usuarios con email @demo.local, y las clases con el profe de demo. El
 *    borrado se limita a eso y no toca socios, clases ni reservas reales.
 *
 *    El admin de demo no usa una contraseña fija: se genera una al azar en
 *    cada carga y se muestra una sola vez. Así, si alguien lo corre por error
 *    contra producción, no queda una puerta de entrada conocida.
 */

import dotenv from 'dotenv'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'

dotenv.config({ quiet: true })

const MARCA = '@demo.local'
const PASSWORD_DEMO = 'demo1234'
const ZONA = 'America/Argentina/Buenos_Aires'

const conexion = process.env.PGURL || process.env.DATABASE_URL

if (!conexion) {
  console.error('\n✖ Falta la conexión: definí PGURL o DATABASE_URL en el .env.\n')
  process.exit(1)
}

const host = conexion.match(/@([^/:]+)/)?.[1] || 'desconocido'
const esLocal = /^(localhost|127\.0\.0\.1)$/.test(host) || host.endsWith('.railway.internal')

const pool = new pg.Pool({
  connectionString: conexion,
  ssl: esLocal ? false : { rejectUnauthorized: true }
})

// ─── Datos ───────────────────────────────────────────────────────────────

const PROFE = { nombre: 'Profe Demo', email: `profe${MARCA}`, dni: '90000001', telefono: '3510000001' }
const ADMIN = { nombre: 'Admin Demo', email: `admin${MARCA}`, dni: '90000002', telefono: '3510000002' }

// `baja: true` es un socio dado de baja: existe, pero no puede entrar.
const SOCIOS = [
  { clave: 'lucia',     nombre: 'Lucía Gómez',      dni: '90000011', telefono: '3510000011' },
  { clave: 'martin',    nombre: 'Martín Pereyra',   dni: '90000012', telefono: '3510000012' },
  { clave: 'sofia',     nombre: 'Sofía Ledesma',    dni: '90000013', telefono: '3510000013' },
  { clave: 'diego',     nombre: 'Diego Funes',      dni: '90000014', telefono: '3510000014' },
  { clave: 'valentina', nombre: 'Valentina Ríos',   dni: '90000015', telefono: '3510000015' },
  { clave: 'tomas',     nombre: 'Tomás Aguirre',    dni: '90000016', telefono: '3510000016', baja: true }
]

const CLASES = [
  {
    clave: 'boxeo', nombre: 'Boxeo', rama: 'disciplina', duracion: 60,
    descripcion: 'Técnica, bolsa y guantes. Todos los niveles.',
    horarios: [
      { clave: 'boxeo-lun', dia: 'Lunes',     inicio: '19:00', fin: '20:00', cupos: 15, precio: 8000 },
      { clave: 'boxeo-mie', dia: 'Miércoles', inicio: '19:00', fin: '20:00', cupos: 15, precio: 8000 },
      { clave: 'boxeo-vie', dia: 'Viernes',   inicio: '19:00', fin: '20:00', cupos: 15, precio: 8000 }
    ]
  },
  {
    clave: 'funcional', nombre: 'Funcional', rama: 'gimnasio', duracion: 60,
    descripcion: 'Circuitos de fuerza y resistencia.',
    horarios: [
      { clave: 'func-mar', dia: 'Martes', inicio: '18:00', fin: '19:00', cupos: 20, precio: 6000 },
      { clave: 'func-jue', dia: 'Jueves', inicio: '18:00', fin: '19:00', cupos: 20, precio: 6000 },
      { clave: 'func-sab', dia: 'Sábado', inicio: '10:00', fin: '11:00', cupos: 20, precio: 6000 }
    ]
  },
  {
    clave: 'muay', nombre: 'Muay Thai', rama: 'disciplina', duracion: 60,
    descripcion: 'Golpes, rodillas y codos. Traer vendas.',
    horarios: [
      { clave: 'muay-lun', dia: 'Lunes',  inicio: '20:00', fin: '21:00', cupos: 12, precio: 9000 },
      { clave: 'muay-jue', dia: 'Jueves', inicio: '20:00', fin: '21:00', cupos: 12, precio: 9000 }
    ]
  },
  {
    clave: 'nutri', nombre: 'Consulta de nutrición', rama: 'profesional', duracion: 45,
    descripcion: 'Plan de alimentación según tu objetivo.',
    horarios: [
      { clave: 'nutri-mie', dia: 'Miércoles', inicio: '17:00', fin: '17:45', cupos: 4, precio: 12000 }
    ]
  }
]

// `pago`: sin pago (null), pago registrado por el socio esperando confirmación
// ('pendiente'), o confirmado por el gimnasio ('pagado').
const RESERVAS = [
  { socio: 'lucia',     horario: 'boxeo-lun', tipo: 'semanal',   estado: 'pendiente', pago: null },
  { socio: 'martin',    horario: 'func-mar',  tipo: 'semanal',   estado: 'pendiente', pago: 'pendiente' },
  { socio: 'sofia',     horario: 'muay-lun',  tipo: 'quincenal', estado: 'pagado',    pago: 'pagado' },
  { socio: 'diego',     horario: 'boxeo-mie', tipo: 'semanal',   estado: 'cancelado', pago: null },
  { socio: 'valentina', horario: 'func-sab',  tipo: 'semanal',   estado: 'pagado',    pago: 'pagado' },
  { socio: 'valentina', horario: 'boxeo-vie', tipo: 'semanal',   estado: 'pendiente', pago: null }
]

const DIAS_POR_TIPO = { semanal: 7, quincenal: 14 }
const MULTIPLICADOR = { semanal: 1, quincenal: 2 }

// ─── Utilidades ──────────────────────────────────────────────────────────

function passwordAlAzar() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let clave = ''
  for (let i = 0; i < 14; i++) clave += letras[randomInt(letras.length)]
  return clave
}

async function existeTabla(cliente, tabla) {
  const { rows } = await cliente.query('SELECT to_regclass($1) AS t', [`public.${tabla}`])
  return rows[0].t !== null
}

async function existeColumna(cliente, tabla, columna) {
  const { rows } = await cliente.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tabla, columna]
  )
  return rows.length > 0
}

async function idsDemo(cliente) {
  const { rows } = await cliente.query(
    'SELECT id FROM usuarios WHERE email LIKE $1',
    [`%${MARCA}`]
  )
  return rows.map(r => r.id)
}

// ─── Carga ───────────────────────────────────────────────────────────────

async function cargar(cliente) {
  if ((await idsDemo(cliente)).length > 0) {
    console.error('\n✖ Ya hay datos de demo cargados. Borralos primero con --borrar.\n')
    process.exit(1)
  }

  const hayBaja      = await existeColumna(cliente, 'usuarios', 'activo')
  const hayTurnos    = await existeTabla(cliente, 'turnos_profe')
  const hayAuditoria = await existeTabla(cliente, 'auditoria')

  const hashDemo = await bcrypt.hash(PASSWORD_DEMO, 10)
  const passwordAdmin = passwordAlAzar()
  const hashAdmin = await bcrypt.hash(passwordAdmin, 10)

  await cliente.query('BEGIN')

  const insertarUsuario = async (u, rol, hash) => {
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (nombre, email, password, dni, telefono, rol)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [u.nombre, u.email, hash, u.dni, u.telefono, rol]
    )
    return rows[0].id
  }

  const idAdmin = await insertarUsuario(ADMIN, 'admin', hashAdmin)
  const idProfe = await insertarUsuario(PROFE, 'profesor', hashDemo)

  const socios = {}
  for (const s of SOCIOS) {
    const email = `${s.clave}${MARCA}`
    socios[s.clave] = await insertarUsuario({ ...s, email }, 'alumno', hashDemo)
    if (s.baja && hayBaja) {
      await cliente.query('UPDATE usuarios SET activo = false WHERE id = $1', [socios[s.clave]])
    }
  }

  const horarios = {}
  for (const c of CLASES) {
    const { rows } = await cliente.query(
      `INSERT INTO clases (nombre, rama, profesor_id, descripcion, duracion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [c.nombre, c.rama, idProfe, c.descripcion, c.duracion]
    )
    for (const h of c.horarios) {
      const creado = await cliente.query(
        `INSERT INTO horarios
         (clase_id, dia_semana, hora_inicio, hora_fin, cupos_totales, cupos_disponibles, precio)
         VALUES ($1, $2, $3, $4, $5, $5, $6) RETURNING id, precio`,
        [rows[0].id, h.dia, h.inicio, h.fin, h.cupos, h.precio]
      )
      horarios[h.clave] = creado.rows[0]
    }
  }

  // El período arranca hoy en el huso del gimnasio, igual que en la app.
  const { rows: [{ hoy }] } = await cliente.query(
    `SELECT (now() AT TIME ZONE $1)::date AS hoy`,
    [ZONA]
  )

  const reservas = []
  for (const r of RESERVAS) {
    const horario = horarios[r.horario]
    const total = Number(horario.precio) * MULTIPLICADOR[r.tipo]

    const { rows } = await cliente.query(
      `INSERT INTO reservas (usuario_id, horario_id, fecha_inicio, fecha_fin, tipo, total, estado)
       VALUES ($1, $2, $3::date, $3::date + $4::int, $5, $6, $7) RETURNING id`,
      [socios[r.socio], horario.id, hoy, DIAS_POR_TIPO[r.tipo], r.tipo, total, r.estado]
    )
    reservas.push({ ...r, id: rows[0].id, total })

    if (r.pago) {
      await cliente.query(
        `INSERT INTO pagos (reserva_id, monto, metodo, estado) VALUES ($1, $2, 'efectivo', $3)`,
        [rows[0].id, total, r.pago]
      )
    }
  }

  // Los cupos quedan coherentes con las reservas que no están canceladas.
  await cliente.query(
    `UPDATE horarios h
     SET cupos_disponibles = h.cupos_totales - (
       SELECT COUNT(*) FROM reservas r WHERE r.horario_id = h.id AND r.estado <> 'cancelado'
     )
     WHERE h.id = ANY($1)`,
    [Object.values(horarios).map(h => h.id)]
  )

  // Una rutina, para que la pantalla de rutinas no quede vacía.
  const rutina = await cliente.query(
    'INSERT INTO rutinas (profesor_id, alumno_id) VALUES ($1, $2) RETURNING id',
    [idProfe, socios.lucia]
  )
  const sesion = await cliente.query(
    'INSERT INTO sesiones (rutina_id, nombre, orden) VALUES ($1, $2, 1) RETURNING id',
    [rutina.rows[0].id, 'Día 1 · Tren superior']
  )
  const ejercicios = [
    ['Press de banca', 4, '10'],
    ['Remo con barra', 4, '10'],
    ['Flexiones de brazos', 3, '15']
  ]
  for (const [i, [nombre, series, repeticiones]] of ejercicios.entries()) {
    await cliente.query(
      `INSERT INTO ejercicios (sesion_id, nombre, series, repeticiones, orden)
       VALUES ($1, $2, $3, $4, $5)`,
      [sesion.rows[0].id, nombre, series, repeticiones, i + 1]
    )
  }

  if (hayTurnos) {
    await cliente.query('INSERT INTO turnos_profe (usuario_id) VALUES ($1)', [idProfe])
  }

  if (hayAuditoria) {
    const sofia = reservas.find(r => r.socio === 'sofia')
    const movimientos = [
      [idAdmin, 'pago.confirmar', 'reserva', sofia.id, socios.sofia, { monto: sofia.total, metodo: 'efectivo' }],
      [idAdmin, 'usuario.baja', 'usuario', socios.tomas, socios.tomas, {}],
      [idProfe, 'turno.llegada', 'turno_profe', null, null, {}]
    ]
    for (const [usuario, accion, entidad, entidadId, afectado, detalle] of movimientos) {
      await cliente.query(
        `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, afectado_id, detalle)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [usuario, accion, entidad, entidadId, afectado, JSON.stringify(detalle)]
      )
    }
  }

  await cliente.query('COMMIT')

  console.log('\n✔ Datos de demo cargados.\n')
  console.log(`   Admin:  ${ADMIN.email}  ·  contraseña: ${passwordAdmin}`)
  console.log(`   Profe:  ${PROFE.email}  ·  contraseña: ${PASSWORD_DEMO}`)
  console.log(`   Socios: lucia, martin, sofia, diego, valentina${MARCA}  ·  contraseña: ${PASSWORD_DEMO}`)
  console.log(`   Baja:   tomas${MARCA} (no puede entrar)\n`)
  console.log(`   ${CLASES.length} clases, ${Object.keys(horarios).length} horarios, ${reservas.length} reservas.`)

  const faltan = [
    !hayBaja && 'la baja de usuarios',
    !hayTurnos && 'los profes en la sede',
    !hayAuditoria && 'el registro de actividad'
  ].filter(Boolean)
  if (faltan.length) {
    console.log(`\n   Sin la migración 003 no se cargó: ${faltan.join(', ')}.`)
  }
  console.log('\n   La contraseña del admin no se vuelve a mostrar.\n')
}

// ─── Borrado ─────────────────────────────────────────────────────────────

async function borrar(cliente) {
  const usuarios = await idsDemo(cliente)

  if (usuarios.length === 0) {
    console.log('\nNo hay datos de demo para borrar.\n')
    return
  }

  await cliente.query('BEGIN')

  const { rows: clases } = await cliente.query(
    'SELECT id FROM clases WHERE profesor_id = ANY($1)', [usuarios]
  )
  const idsClases = clases.map(c => c.id)

  const { rows: horarios } = await cliente.query(
    'SELECT id FROM horarios WHERE clase_id = ANY($1)', [idsClases]
  )
  const idsHorarios = horarios.map(h => h.id)

  // Si un socio real reservó una clase de demo, borrarla le borraría la
  // reserva. En ese caso se frena y se avisa.
  const { rows: ajenas } = await cliente.query(
    `SELECT COUNT(*)::int AS total FROM reservas
     WHERE horario_id = ANY($1) AND NOT (usuario_id = ANY($2))`,
    [idsHorarios, usuarios]
  )
  if (ajenas[0].total > 0) {
    await cliente.query('ROLLBACK')
    console.error(
      `\n✖ Hay ${ajenas[0].total} reserva(s) de socios reales en clases de demo.` +
      '\n  No se borró nada. Revisalas antes de volver a intentar.\n'
    )
    process.exit(1)
  }

  // Un usuario de demo que reservó una clase real le devuelve el cupo.
  await cliente.query(
    `UPDATE horarios h
     SET cupos_disponibles = LEAST(h.cupos_disponibles + r.cantidad, h.cupos_totales)
     FROM (
       SELECT horario_id, COUNT(*) AS cantidad FROM reservas
       WHERE usuario_id = ANY($1) AND estado <> 'cancelado' AND NOT (horario_id = ANY($2))
       GROUP BY horario_id
     ) r
     WHERE h.id = r.horario_id`,
    [usuarios, idsHorarios]
  )

  const { rows: reservas } = await cliente.query(
    'SELECT id FROM reservas WHERE usuario_id = ANY($1) OR horario_id = ANY($2)',
    [usuarios, idsHorarios]
  )
  const idsReservas = reservas.map(r => r.id)

  if (await existeTabla(cliente, 'auditoria')) {
    await cliente.query(
      'DELETE FROM auditoria WHERE usuario_id = ANY($1) OR afectado_id = ANY($1)',
      [usuarios]
    )
  }

  await cliente.query(
    'DELETE FROM asistencias WHERE usuario_id = ANY($1) OR horario_id = ANY($2)',
    [usuarios, idsHorarios]
  )
  await cliente.query('DELETE FROM pagos WHERE reserva_id = ANY($1)', [idsReservas])
  await cliente.query('DELETE FROM reservas WHERE id = ANY($1)', [idsReservas])

  // Las sesiones y los ejercicios se van en cascada con la rutina.
  await cliente.query(
    'DELETE FROM rutinas WHERE alumno_id = ANY($1) OR profesor_id = ANY($1)',
    [usuarios]
  )

  // Los horarios se van en cascada con la clase; los turnos, con el usuario.
  await cliente.query('DELETE FROM clases WHERE id = ANY($1)', [idsClases])
  await cliente.query('DELETE FROM usuarios WHERE id = ANY($1)', [usuarios])

  await cliente.query('COMMIT')

  console.log('\n✔ Datos de demo borrados.\n')
  console.log(`   ${usuarios.length} usuarios, ${idsClases.length} clases, ${idsHorarios.length} horarios, ${idsReservas.length} reservas.\n`)
}

// ─── Arranque ────────────────────────────────────────────────────────────

const modoBorrar = process.argv.includes('--borrar')
const cliente = await pool.connect()

try {
  // Se muestra a qué base se conectó, para no cargar demo en la equivocada.
  const { rows: [{ reales }] } = await cliente.query(
    'SELECT COUNT(*)::int AS reales FROM usuarios WHERE email NOT LIKE $1',
    [`%${MARCA}`]
  )
  console.log(`\nBase: ${host} · ${reales} usuario(s) que no son de demo.`)

  if (modoBorrar) await borrar(cliente)
  else await cargar(cliente)
} catch (error) {
  await cliente.query('ROLLBACK').catch(() => {})
  console.error('\n✖ Error:', error.message, '\n  No se aplicó ningún cambio.\n')
  process.exitCode = 1
} finally {
  cliente.release()
  await pool.end()
}
