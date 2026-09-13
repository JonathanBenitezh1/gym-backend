import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/conexion.js'
import { validarDatosUsuario } from '../utils/validaciones.js'

// Hash descartable contra el que comparar cuando el email no existe. Sin esto,
// un email desconocido contestaba al instante y uno real recién después de
// calcular bcrypt: con esa diferencia de tiempo se arma la lista de socios.
const HASH_SENUELO = bcrypt.hashSync('contraseña que nadie usa', 10)

export const registro = async (req, res) => {
  const { nombre, password, dni, telefono } = req.body
  // Normalizamos el email para que no entren duplicados por mayúsculas
  const email = String(req.body.email || '').trim().toLowerCase()

  try {
    if (!nombre || !email || !password || !dni || !telefono) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' })
    }

    const errorValidacion = validarDatosUsuario({ nombre, email, password, dni, telefono })
    if (errorValidacion) {
      return res.status(400).json({ error: errorValidacion })
    }

    const existeEmail = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1', [email]
    )
    if (existeEmail.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' })
    }

    const existeDni = await pool.query(
      'SELECT id FROM usuarios WHERE dni = $1', [dni]
    )
    if (existeDni.rows.length > 0) {
      return res.status(400).json({ error: 'El DNI ya está registrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, dni, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, dni, telefono, rol`,
      [nombre, email, hashedPassword, dni, telefono]
    )

    const usuario = resultado.rows[0]

    // Quien se registra elige su propia clave, asi que nunca arranca con el
    // cambio obligatorio pendiente.
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, debe_cambiar_password: false },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({ token, usuario })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }

}
export const login = async (req, res) => {
  const { password } = req.body
  const email = String(req.body.email || '').trim().toLowerCase()

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    )

    const usuario = resultado.rows[0]

    // bcrypt corre siempre, exista o no el email, para que el tiempo de
    // respuesta no delate cuál de los dos falló.
    const passwordValida = await bcrypt.compare(String(password), usuario?.password || HASH_SENUELO)

    if (!usuario || !passwordValida) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    // La marca viaja dentro del token para que el servidor pueda exigir el
    // cambio sin consultar la base en cada pedido.
    const debeCambiar = usuario.debe_cambiar_password === true

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, debe_cambiar_password: debeCambiar },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        dni: usuario.dni,
        rol: usuario.rol,
        // Si el administrador le restableció la contraseña, la app le va a
        // pedir que elija una propia antes de dejarlo seguir.
        debe_cambiar_password: usuario.debe_cambiar_password === true
      }
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }
}