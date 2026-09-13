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

// Cuánto se guarda una conexión ociosa antes de soltarla.
//
// Abrir una conexión nueva de la API (Virginia) a la base (São Paulo) cuesta
// cerca de 0,7 segundos: TCP, TLS y autenticación cruzando el continente.
// Medido en producción el 13/09/2026: la misma consulta tardó 1,05 s después
// de 13 segundos sin uso y 0,35 s con la conexión abierta. Con los 10 segundos
// de antes, casi cada click del panel pagaba ese costo.
//
// El techo son los 5 minutos sin uso tras los que Neon apaga la base y corta
// sus conexiones. Con 4 minutos el pool las suelta antes, y si igual se corta
// alguna, el handler de 'error' de más abajo la descarta.
const OCIOSA_MS = 4 * 60 * 1000
const opciones = url
  ? {
      connectionString: url,
      ssl: necesitaSSL ? { rejectUnauthorized: true } : false,
      idleTimeoutMillis: OCIOSA_MS,
      keepAlive: true
    }
  : {
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      idleTimeoutMillis: OCIOSA_MS
    }

const pool = new Pool(opciones)

// Sin este handler, una conexión ociosa que se corta emite un 'error' sin
// escuchar y Node tumba el proceso entero. Con él, el pool descarta esa
// conexión y la siguiente consulta abre una nueva.
pool.on('error', (error) => {
  console.error('Conexión ociosa del pool cortada:', error.message)
})

export default pool
