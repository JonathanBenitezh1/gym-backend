/**
 * Cambia la contraseña de un usuario existente, buscándolo por email.
 *
 * Sirve para recuperar el acceso al admin si no recordás la contraseña,
 * o para cualquier usuario, directamente contra la base (sin pasar por la app).
 *
 * Los datos van por variables de entorno para que la contraseña no quede
 * escrita en el historial de la terminal.
 *
 * Uso (PowerShell), apuntando a la base de producción:
 *   $env:PGURL = "postgresql://..."            # DATABASE_PUBLIC_URL de Railway
 *   $env:RESET_EMAIL = "jonathanbenitezh1@gmail.com"
 *   $pw = Read-Host "Nueva contrasena" -AsSecureString
 *   $env:RESET_PASSWORD = [System.Net.NetworkCredential]::new("", $pw).Password
 *   node scripts/resetear-password.js
 *   $env:RESET_PASSWORD = $null
 */

import pg from 'pg'
import bcrypt from 'bcryptjs'

const conexion = process.env.PGURL || process.env.DATABASE_URL
const email    = (process.env.RESET_EMAIL || '').trim().toLowerCase()
const password =  process.env.RESET_PASSWORD || ''

const faltantes = []
if (!conexion) faltantes.push('PGURL')
if (!email)    faltantes.push('RESET_EMAIL')
if (!password) faltantes.push('RESET_PASSWORD')

if (faltantes.length > 0) {
  console.error('\n✖ Faltan estas variables de entorno:\n')
  faltantes.forEach(v => console.error(`   - ${v}`))
  console.error('\n  Mirá el encabezado de este archivo para ver cómo definirlas.\n')
  process.exit(1)
}

if (password.length < 6) {
  console.error('\n✖ La contraseña debe tener al menos 6 caracteres.\n')
  process.exit(1)
}

const esLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conexion)

const pool = new pg.Pool({
  connectionString: conexion,
  ssl: esLocal ? false : { rejectUnauthorized: false }
})

try {
  const usuario = await pool.query(
    'SELECT id, nombre, rol FROM usuarios WHERE email = $1',
    [email]
  )

  if (usuario.rows.length === 0) {
    console.error(`\n✖ No existe ningún usuario con el email ${email}.\n`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  // Ponemos debe_cambiar_password en false: es una clave que la persona
  // eligió a propósito, no una temporal que deba cambiar al entrar.
  await pool.query(
    'UPDATE usuarios SET password = $1, debe_cambiar_password = false WHERE email = $2',
    [hash, email]
  )

  const u = usuario.rows[0]
  console.log('\n✔ Contraseña actualizada:\n')
  console.log(`   nombre : ${u.nombre}`)
  console.log(`   email  : ${email}`)
  console.log(`   rol    : ${u.rol}`)
  console.log('\n  Ya podés entrar con la nueva contraseña.\n')

} catch (error) {
  console.error('\n✖ Error al actualizar la contraseña:', error.message, '\n')
  process.exit(1)
} finally {
  await pool.end()
}
