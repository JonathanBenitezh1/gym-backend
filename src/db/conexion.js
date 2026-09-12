import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// En producción (Neon, Railway y similares) la conexión llega en una sola
// cadena. En desarrollo se arma con las variables sueltas del .env.
const url = process.env.DATABASE_URL

// Ni las conexiones locales ni las internas de Railway usan SSL; las públicas sí.
const necesitaSSL = url
  ? !/@(localhost|127\.0\.0\.1|[^@/]*\.railway\.internal)[:/]/.test(url)
  : false

// Neon apaga la base cuando nadie la usa, y al apagarse corta las conexiones
// que el pool tenía guardadas en espera. Soltamos las ociosas a los 10
// segundos para que casi nunca haya una abierta cuando eso pasa.
const opciones = url
  ? {
      connectionString: url,
      ssl: necesitaSSL ? { rejectUnauthorized: true } : false,
      idleTimeoutMillis: 10000
    }
  : {
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      idleTimeoutMillis: 10000
    }

const pool = new Pool(opciones)

// Sin este handler, una conexión ociosa que se corta emite un 'error' sin
// escuchar y Node tumba el proceso entero. Con él, el pool descarta esa
// conexión y la siguiente consulta abre una nueva.
pool.on('error', (error) => {
  console.error('Conexión ociosa del pool cortada:', error.message)
})

export default pool
