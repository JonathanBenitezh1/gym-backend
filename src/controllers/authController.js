import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/conexion.js'
export const registro = async (req, res) => {
  const { nombre, email, password, dni, telefono } = req.body

  try {
    if (!nombre || !email || !password || !dni || !telefono) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' })
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

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
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
  const { email, password } = req.body

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    )

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    const usuario = resultado.rows[0]
    const passwordValida = await bcrypt.compare(password, usuario.password)

    if (!passwordValida) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
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
        rol: usuario.rol
      }
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }
}