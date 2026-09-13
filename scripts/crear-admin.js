/**
 * Crea un usuario administrador en la base.
 *
 * Los datos se pasan por variables de entorno, así la contraseña
 * nunca queda escrita en el historial de la terminal.
 *
 * Uso (PowerShell):
 *   $env:PGURL = "postgresql://..."          # DATABASE_PUBLIC_URL de Railway
 *   $env:ADMIN_NOMBRE   = "Nombre Apellido"
 *   $env:ADMIN_EMAIL    = "admin@ejemplo.com"
 *   $env:ADMIN_DNI      = "12345678"
 *   $env:ADMIN_TELEFONO = "3511234567"
 *   $pw = Read-Host "Contraseña" -AsSecureString
 *   $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $pw).Password
 *   node scripts/crear-admin.js
 */

import pg from 'pg'
import bcrypt from 'bcryptjs'

const conexion = process.env.PGURL || process.env.DATABASE_URL

const nombre   = (process.env.ADMIN_NOMBRE   || '').trim()
const email    = (process.env.ADMIN_EMAIL    || '').trim().toLowerCase()
const dni      = (process.env.ADMIN_DNI      || '').trim()
const telefono = (process.env.ADMIN_TELEFONO || '').trim()
const password =  process.env.ADMIN_PASSWORD || ''

const faltantes = []
if (!conexion) faltantes.push('PGURL')
if (!nombre)   faltantes.push('ADMIN_NOMBRE')
if (!email)    faltantes.push('ADMIN_EMAIL')
if (!dni)      faltantes.push('ADMIN_DNI')
if (!password) faltantes.push('ADMIN_PASSWORD')

if (faltantes.length > 0) {
  console.error('\n✖ Faltan estas variables de entorno:\n')
  faltantes.forEach(v => console.error(`   - ${v}`))
  console.error('\n  Mirá el encabezado de este archivo para ver cómo definirlas.\n')
  process.exit(1)
}

if (password.length < 8) {
  console.error('\n✖ La contraseña debe tener al menos 8 caracteres.\n')
  process.exit(1)
}

// Las bases locales no suelen tener SSL; las de Railway y similares sí.
// Detectamos por el host para que el script sirva en los dos casos.
const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conexion)

const pool = new pg.Pool({
  connectionString: conexion,
  ssl: esLocal ? false : { rejectUnauthorized: false }
})

try {
  const repetido = await pool.query(
    'SELECT email, dni FROM usuarios WHERE email = $1 OR dni = $2',
    [email, dni]
  )

  if (repetido.rows.length > 0) {
    const campo = repetido.rows[0].email === email ? 'email' : 'DNI'
    console.error(`\n✖ Ya existe un usuario con ese ${campo}.\n`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  const creado = await pool.query(
    `INSERT INTO usuarios (nombre, email, password, dni, telefono, rol)
     VALUES ($1, $2, $3, $4, $5, 'admin')
     RETURNING id, nombre, email, dni, rol`,
    [nombre, email, hash, dni, telefono || null]
  )

  const u = creado.rows[0]
  console.log('\n✔ Administrador creado correctamente:\n')
  console.log(`   id     : ${u.id}`)
  console.log(`   nombre : ${u.nombre}`)
  console.log(`   email  : ${u.email}`)
  console.log(`   dni    : ${u.dni}`)
  console.log(`   rol    : ${u.rol}\n`)

} catch (error) {
  console.error('\n✖ Error al crear el administrador:', error.message, '\n')
  process.exit(1)
} finally {
  await pool.end()
}
