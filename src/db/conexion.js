import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// En producción (Railway y similares) la conexión llega en una sola cadena.
// En desarrollo se arma con las variables sueltas del .env.
const url = process.env.DATABASE_URL

// Ni las conexiones locales ni las internas de Railway usan SSL; las públicas sí.
const necesitaSSL = url
  ? !/@(localhost|127\.0\.0\.1|[^@/]*\.railway\.internal)[:/]/.test(url)
  : false

const pool = url
  ? new Pool({
      connectionString: url,
      ssl: necesitaSSL ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    })

export default pool