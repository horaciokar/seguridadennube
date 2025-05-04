const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'https://seguridadenredes.ddns.net', // Dominio principal de tu aplicación
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de la conexión a la base de datos
const db = mysql.createConnection({
  host: process.env.DB_HOST,         // Endpoint de tu instancia RDS
  user: process.env.DB_USER,         // Usuario de la base de datos
  password: process.env.DB_PASSWORD, // Contraseña de la base de datos
  database: process.env.DB_NAME      // Nombre de la base de datos
});

// Conectar a la base de datos
db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos MySQL');
});

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({ message: 'No se proporcionó token de acceso' });
  }
  
  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// Ruta para verificar si un token es válido
app.get('/api/verify-token', verifyToken, (req, res) => {
  res.status(200).json({ valid: true, user: req.user });
});

// Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { nombre, apellido, email, password } = req.body;
  
  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }
  
  try {
    // Verificar si el email ya existe
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Error en la consulta:', err);
        return res.status(500).json({ message: 'Error del servidor' });
      }
      
      if (results.length > 0) {
        return res.status(400).json({ message: 'El email ya está registrado' });
      }
      
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insertar usuario en la base de datos
      db.query(
        'INSERT INTO users (nombre, apellido, email, password) VALUES (?, ?, ?, ?)',
        [nombre, apellido, email, hashedPassword],
        (err, result) => {
          if (err) {
            console.error('Error al registrar usuario:', err);
            return res.status(500).json({ message: 'Error al registrar usuario' });
          }
          
          return res.status(201).json({ message: 'Usuario registrado exitosamente' });
        }
      );
    });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta para iniciar sesión
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
  }
  
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    const user = results[0];
    
    // Verificar contraseña
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email
      }
    });
  });
});

// Ruta protegida para obtener todos los usuarios (requiere autenticación)
app.get('/api/users', verifyToken, (req, res) => {
  db.query('SELECT id, nombre, apellido, email, fecha_registro FROM users', (err, results) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    res.json(results);
  });
});

// Configuración HTTPS
try {
  const httpsOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/seguridadenredes.ddns.net/privkey.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/seguridadenredes.ddns.net/fullchain.pem')
  };

  // Crear servidor HTTPS
  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`Servidor HTTPS corriendo en https://localhost:${port}`);
  });

  // Opcional: Redirigir HTTP a HTTPS
  if (process.env.REDIRECT_HTTP === 'true') {
    const httpApp = express();
    httpApp.all('*', (req, res) => {
      return res.redirect(`https://${req.hostname}:${port}${req.path}`);
    });
    httpApp.listen(80, () => console.log('Servidor HTTP redirigiendo a HTTPS'));
  }
} catch (error) {
  console.error('Error al iniciar el servidor HTTPS:', error);
  console.log('Iniciando servidor sin HTTPS como fallback...');
  
  // Iniciar el servidor HTTP como fallback
  app.listen(port, () => {
    console.log(`Servidor fallback HTTP corriendo en http://localhost:${port}`);
  });
}