const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de logger
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://seguridadenredes.ddns.net',
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware de registro de solicitudes
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  
  // Registrar IP y headers relevantes para debug
  console.log(`Solicitud desde IP: ${ip}`);
  console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
  console.log('X-Real-IP:', req.headers['x-real-ip']);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - IP: ${ip}`);
  });
  next();
});

// Middleware para manejar errores de JSON malformado
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error(`JSON malformado: ${err.message}`);
    return res.status(400).json({ message: 'JSON malformado en la solicitud' });
  }
  next(err);
});

// Pool de conexiones a la base de datos para mejor manejo de recursos
let pool;

async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });

    logger.info('Pool de conexiones a la base de datos inicializado');
    
    // Verificar la conexión
    const connection = await pool.getConnection();
    logger.info('Conexión a la base de datos establecida correctamente');
    connection.release();
    
    // Verificar y crear tablas/columnas
    await checkAndCreateDatabaseStructure();
  } catch (err) {
    logger.error(`Error inicializando la base de datos: ${err.message}`);
    // Reintento en 5 segundos
    setTimeout(initializeDatabase, 5000);
  }
}

async function checkAndCreateDatabaseStructure() {
  const connection = await pool.getConnection();
  try {
    // Comprobar y añadir columna ultimo_acceso
    const [ultimoAccesoColumns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'ultimo_acceso'`,
      [process.env.DB_NAME]
    );

    if (ultimoAccesoColumns.length === 0) {
      logger.info('Añadiendo columna ultimo_acceso a la tabla users');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN ultimo_acceso TIMESTAMP NULL DEFAULT NULL
      `);
    }

    // Comprobar y añadir columna ip_address
    const [ipAddressColumns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'ip_address'`,
      [process.env.DB_NAME]
    );

    if (ipAddressColumns.length === 0) {
      logger.info('Añadiendo columna ip_address a la tabla users');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN ip_address VARCHAR(45) NULL DEFAULT NULL
      `);
    }
    
    // Comprobar y añadir columna role
    const [roleColumns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'role'`,
      [process.env.DB_NAME]
    );

    if (roleColumns.length === 0) {
      logger.info('Añadiendo columna role a la tabla users');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'viewer'
      `);
    }

    // Comprobar y crear tabla login_history
    const [loginHistoryTable] = await connection.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = ? 
       AND table_name = 'login_history'`,
      [process.env.DB_NAME]
    );

    if (loginHistoryTable.length === 0) {
      logger.info('Creando tabla login_history');
      await connection.query(`
        CREATE TABLE login_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(45) NULL,
          user_agent TEXT NULL,
          status VARCHAR(20) DEFAULT 'success',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    }

    // Comprobar y crear tabla gps_data
    const [gpsDataTable] = await connection.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = ? 
       AND table_name = 'gps_data'`,
      [process.env.DB_NAME]
    );

    if (gpsDataTable.length === 0) {
      logger.info('Creando tabla gps_data');
      await connection.query(`
        CREATE TABLE gps_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          device_id VARCHAR(50) NOT NULL,
          latitude DOUBLE NOT NULL,
          longitude DOUBLE NOT NULL,
          altitude DOUBLE,
          speed DOUBLE,
          satellites INT,
          hdop DOUBLE,
          battery DOUBLE,
          gps_timestamp BIGINT,
          gps_date BIGINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_device_id (device_id),
          INDEX idx_created_at (created_at)
        )
      `);
    }
    
    // Verificar si existe el usuario admin
    const [adminUser] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      ['horaciokar@gmail.com']
    );

    if (adminUser.length === 0) {
      logger.info('Creando usuario administrador inicial');
      const hashedPassword = await bcrypt.hash('1234567890', 10);
      await connection.query(
        'INSERT INTO users (nombre, apellido, email, password, role) VALUES (?, ?, ?, ?, ?)',
        ['Admin', 'System', 'horaciokar@gmail.com', hashedPassword, 'admin']
      );
    }

    logger.info('Estructura de la base de datos verificada y actualizada');
  } catch (err) {
    logger.error(`Error verificando estructura de la base de datos: ${err.message}`);
    throw err;
  } finally {
    connection.release();
  }
}

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(403).json({ message: 'No se proporcionó token de acceso' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(403).json({ message: 'Formato de token inválido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error(`Error en verificación de token: ${err.message}`);
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// Middleware para verificar si es administrador
const isAdmin = async (req, res, next) => {
  const userId = req.user.id;
  
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (users[0].role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permisos de administrador' });
    }
    
    next();
  } catch (err) {
    logger.error(`Error al verificar rol de administrador: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al verificar permisos' });
  } finally {
    connection.release();
  }
};

// Middleware para verificar la clave API (para dispositivos ESP32)
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.ESP32_API_KEY || '1234567890';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    logger.warn(`Intento de acceso con API key inválida: ${apiKey}`);
    return res.status(401).json({ message: 'Clave API no válida' });
  }
  
  next();
};

// Función para obtener IP real del cliente
const getClientIp = (req) => {
  // Si trust proxy está habilitado, usamos req.ip directamente
  if (req.ip && req.ip !== '::1' && !req.ip.includes('127.0.0.1')) {
      return req.ip;
  }
  
  // Si no, intentamos con los headers de proxy
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map(ip => ip.trim());
      return ips[0]; // El primer IP es el del cliente original
  }
  
  // Intentar con X-Real-IP
  if (req.headers['x-real-ip']) {
      return req.headers['x-real-ip'];
  }
  
  // Obtener la dirección remota directamente
  let ip = req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.connection?.socket?.remoteAddress;
  
  // Limpiar formato IPv6 mapeado
  if (ip && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
  }
  
  return ip || 'unknown';
};

// Ruta para verificar si un token es válido
app.get('/api/verify-token', verifyToken, (req, res) => {
  res.status(200).json({ valid: true, user: req.user });
});

// Ruta para obtener información del usuario actual
app.get('/api/users/me', verifyToken, async (req, res) => {
  const userId = req.user.id;
  
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query(
      'SELECT id, nombre, apellido, email, fecha_registro, ultimo_acceso, role FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(users[0]);
  } catch (err) {
    logger.error(`Error al obtener información del usuario: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener información' });
  } finally {
    connection.release();
  }
});

// Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { nombre, apellido, email, password } = req.body;
  
  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }
  
  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Email inválido' });
  }
  
  // Validar contraseña
  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const connection = await pool.getConnection();
  try {
    // Verificar si el email ya existe
    const [existingUsers] = await connection.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Obtener la IP del cliente
    const ipAddress = getClientIp(req);
    
    // Insertar usuario en la base de datos
    const [result] = await connection.query(
      'INSERT INTO users (nombre, apellido, email, password, ip_address, role) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, apellido, email, hashedPassword, ipAddress, 'viewer']
    );
    
    logger.info(`Usuario registrado con ID: ${result.insertId}`);
    return res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (err) {
    logger.error(`Error registrando usuario: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al registrar usuario' });
  } finally {
    connection.release();
  }
});

// Ruta para iniciar sesión
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
  }
  
  // Obtener la IP y user agent
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );
    
    if (users.length === 0) {
      // Registrar intento fallido
      await logFailedLogin(connection, 0, ipAddress, userAgent, 'usuario_no_existe');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    const user = users[0];
    
    // Verificar contraseña
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      // Registrar intento fallido
      await logFailedLogin(connection, user.id, ipAddress, userAgent, 'contraseña_incorrecta');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Actualizar último acceso e IP
    const now = new Date();
    await connection.query(
      'UPDATE users SET ultimo_acceso = ?, ip_address = ? WHERE id = ?', 
      [now, ipAddress, user.id]
    );
    
    // Registrar inicio de sesión exitoso
    await logSuccessfulLogin(connection, user.id, ipAddress, userAgent);
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'viewer' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    logger.info(`Inicio de sesión exitoso para usuario ${user.id} (${user.email})`);
    
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        role: user.role || 'viewer'
      }
    });
  } catch (err) {
    logger.error(`Error en inicio de sesión: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor durante inicio de sesión' });
  } finally {
    connection.release();
  }
});

// Función para registrar inicio de sesión exitoso
async function logSuccessfulLogin(connection, userId, ipAddress, userAgent) {
  try {
    await connection.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [userId, ipAddress, userAgent, 'success']
    );
  } catch (err) {
    logger.error(`Error al registrar inicio de sesión exitoso: ${err.message}`);
  }
}

// Función para registrar intento de inicio de sesión fallido
async function logFailedLogin(connection, userId, ipAddress, userAgent, reason) {
  try {
    await connection.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [userId, ipAddress, userAgent, 'failed_' + reason]
    );
  } catch (err) {
    logger.error(`Error al registrar intento fallido de inicio de sesión: ${err.message}`);
  }
}

// Ruta protegida para obtener todos los usuarios (requiere autenticación)
app.get('/api/users', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query(
      'SELECT id, nombre, apellido, email, fecha_registro, ultimo_acceso, ip_address, role FROM users'
    );
    
    res.json(users);
  } catch (err) {
    logger.error(`Error al obtener usuarios: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener usuarios' });
  } finally {
    connection.release();
  }
});

// Ruta para obtener el historial de conexiones de un usuario
app.get('/api/users/:id/login-history', verifyToken, async (req, res) => {
  const userId = req.params.id;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  // Si no es el propio usuario y no es admin, denegar acceso
  if (parseInt(userId) !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'No tienes permiso para ver este historial' });
  }
  
  const connection = await pool.getConnection();
  try {
    const [loginHistory] = await connection.query(
      `SELECT h.id, h.login_time, h.ip_address, h.user_agent, h.status,
              u.nombre, u.apellido, u.email
       FROM login_history h
       JOIN users u ON h.user_id = u.id
       WHERE h.user_id = ?
       ORDER BY h.login_time DESC
       LIMIT 100`,
      [userId]
    );
    
    res.json(loginHistory);
  } catch (err) {
    logger.error(`Error al obtener historial de conexiones: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener historial' });
  } finally {
    connection.release();
  }
});

// Eliminar usuario por ID (solo admin)
app.delete('/api/users/:id', verifyToken, isAdmin, async (req, res) => {
  const userId = req.params.id;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  logger.info(`Intento de eliminar usuario con ID: ${userId}`);
  
  // No permitir que un usuario se elimine a sí mismo
  if (parseInt(userId) === req.user.id) {
    return res.status(403).json({ message: 'No puedes eliminar tu propio usuario' });
  }
  
  const connection = await pool.getConnection();
  try {
    // Verificar si el usuario existe
    const [users] = await connection.query(
      'SELECT * FROM users WHERE id = ?', 
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Eliminar el usuario
    await connection.query(
      'DELETE FROM users WHERE id = ?', 
      [userId]
    );
    
    logger.info(`Usuario con ID ${userId} eliminado correctamente`);
    return res.status(200).json({ 
      message: 'Usuario eliminado correctamente',
      userId: userId
    });
  } catch (err) {
    logger.error(`Error al eliminar usuario: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al eliminar usuario' });
  } finally {
    connection.release();
  }
});

// Actualizar datos de un usuario (solo admin)
app.put('/api/users/:id', verifyToken, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { nombre, apellido } = req.body;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  // Verificar campos obligatorios
  if (!nombre || !apellido) {
    return res.status(400).json({ message: 'Nombre y apellido son obligatorios' });
  }
  
  logger.info(`Intento de actualizar usuario con ID: ${userId}`);
  
  const connection = await pool.getConnection();
  try {
    // Verificar si el usuario existe
    const [users] = await connection.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Actualizar los datos del usuario
    await connection.query(
      'UPDATE users SET nombre = ?, apellido = ? WHERE id = ?',
      [nombre, apellido, userId]
    );
    
    logger.info(`Usuario con ID ${userId} actualizado correctamente`);
    return res.status(200).json({ 
      message: 'Usuario actualizado correctamente',
      userId: userId
    });
  } catch (err) {
    logger.error(`Error al actualizar usuario: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al actualizar usuario' });
  } finally {
    connection.release();
  }
});

// Cambiar rol de usuario (solo admin)
app.put('/api/users/:id/role', verifyToken, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  // Verificar que el rol sea válido
  if (!role || !['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }
  
  // No permitir cambiar el rol propio (protección adicional)
  if (parseInt(userId) === req.user.id) {
    return res.status(403).json({ message: 'No puedes cambiar tu propio rol' });
  }
  
  const connection = await pool.getConnection();
  try {
    // Verificar si el usuario existe
    const [users] = await connection.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Actualizar el rol del usuario
    await connection.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );
    
    logger.info(`Rol del usuario con ID ${userId} actualizado a ${role}`);
    return res.status(200).json({ 
      message: 'Rol actualizado correctamente',
      userId: userId,
      role: role
    });
  } catch (err) {
    logger.error(`Error al actualizar rol: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al actualizar rol' });
  } finally {
    connection.release();
  }
});

// Cambiar contraseña
app.put('/api/users/:id/password', verifyToken, async (req, res) => {
  const userId = req.params.id;
  const { currentPassword, newPassword } = req.body;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  // Solo el propio usuario puede cambiar su contraseña
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ message: 'No puedes cambiar la contraseña de otro usuario' });
  }
  
  // Verificar campos obligatorios
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Contraseña actual y nueva son obligatorias' });
  }
  
  // Validar contraseña
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }
  
  logger.info(`Intento de cambiar contraseña de usuario con ID: ${userId}`);
  
  const connection = await pool.getConnection();
  try {
    // Verificar si el usuario existe y su contraseña actual
    const [users] = await connection.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = users[0];
    
    // Verificar la contraseña actual
    const match = await bcrypt.compare(currentPassword, user.password);
    
    if (!match) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
    }
    
    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Actualizar la contraseña
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    logger.info(`Contraseña del usuario con ID ${userId} actualizada correctamente`);
    return res.status(200).json({ 
      message: 'Contraseña actualizada correctamente'
    });
  } catch (err) {
    logger.error(`Error al actualizar contraseña: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al actualizar contraseña' });
  } finally {
    connection.release();
  }
});

// ----- RUTAS PARA GPS -----

// Endpoint para recibir datos GPS del ESP32
app.post('/api/gps', verifyApiKey, async (req, res) => {
  const { 
    device_id, 
    latitude, 
    longitude, 
    altitude, 
    speed,
    satellites,
    hdop,
    timestamp,
    date,
    battery,
    simulated
  } = req.body;
  
  // Validar datos requeridos
  if (!device_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: device_id, latitude, longitude' });
  }
  
  // Validar rangos de latitud y longitud
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Valores de latitud o longitud fuera de rango' });
  }
  
  const connection = await pool.getConnection();
  try {
    // Insertar datos en la base de datos
    const [result] = await connection.query(
      `INSERT INTO gps_data 
       (device_id, latitude, longitude, altitude, speed, satellites, hdop, battery, gps_timestamp, gps_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [device_id, latitude, longitude, altitude, speed, satellites, hdop, battery, timestamp, date]
    );
    
    logger.info(`Datos GPS recibidos de ${device_id}: Lat=${latitude}, Lon=${longitude}`);
    return res.status(201).json({ 
      message: 'Datos GPS guardados correctamente',
      id: result.insertId
    });
  } catch (err) {
    logger.error(`Error al guardar datos GPS: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al guardar datos GPS' });
  } finally {
    connection.release();
  }
});

// Endpoint para obtener datos GPS (protegido con autenticación JWT)
app.get('/api/gps', verifyToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const device = req.query.device || null;
  const startDate = req.query.start || null;
  const endDate = req.query.end || null;
  
  // Construir la consulta SQL con filtros opcionales
  let query = 'SELECT * FROM gps_data';
  const queryParams = [];
  
  let whereAdded = false;
  
  // Filtro por dispositivo
  if (device) {
    query += ' WHERE device_id = ?';
    queryParams.push(device);
    whereAdded = true;
  }
  
  // Filtro por fecha de inicio
  if (startDate) {
    if (whereAdded) {
      query += ' AND';
    } else {
      query += ' WHERE';
      whereAdded = true;
    }
    query += ' DATE(created_at) >= ?';
    queryParams.push(startDate);
  }
  
  // Filtro por fecha de fin
  if (endDate) {
    if (whereAdded) {
      query += ' AND';
    } else {
      query += ' WHERE';
    }
    query += ' DATE(created_at) <= ?';
    queryParams.push(endDate);
  }
  
  // Ordenar por fecha descendente (más reciente primero)
  query += ' ORDER BY created_at DESC';
  
  // Limitar el número de resultados
  query += ' LIMIT ?';
  queryParams.push(limit);
  
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(query, queryParams);
    res.json(results);
  } catch (err) {
    logger.error(`Error al obtener datos GPS: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener datos GPS' });
  } finally {
    connection.release();
  }
});

// Endpoint para obtener el último registro GPS de cada dispositivo
app.get('/api/gps/latest', verifyToken, async (req, res) => {
  const query = `
    SELECT g.*
    FROM gps_data g
    INNER JOIN (
      SELECT device_id, MAX(created_at) as max_date
      FROM gps_data
      GROUP BY device_id
    ) m ON g.device_id = m.device_id AND g.created_at = m.max_date
    ORDER BY g.created_at DESC
  `;
  
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(query);
    res.json(results);
  } catch (err) {
    logger.error(`Error al obtener últimos datos GPS: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener últimos datos GPS' });
  } finally {
    connection.release();
  }
});

// Endpoint para obtener la lista de dispositivos GPS disponibles
app.get('/api/gps/devices', verifyToken, async (req, res) => {
  const query = `
    SELECT DISTINCT device_id, 
           COUNT(*) as total_records,
           MIN(created_at) as first_record,
           MAX(created_at) as last_record
    FROM gps_data
    GROUP BY device_id
    ORDER BY last_record DESC
  `;
  
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(query);
    res.json(results);
  } catch (err) {
    logger.error(`Error al obtener dispositivos GPS: ${err.message}`);
    return res.status(500).json({ message: 'Error del servidor al obtener dispositivos GPS' });
  } finally {
    connection.release();
  }
});

// Endpoint para verificar salud del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  logger.error(`Error no manejado: ${err.stack}`);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Proceso de inicio
async function startServer() {
  try {
    // Inicializar la base de datos
    await initializeDatabase();
    
    // Configuración HTTPS
    try {
      const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/seguridadenredes.ddns.net/privkey.pem'),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/seguridadenredes.ddns.net/fullchain.pem')
      };

      // Crear servidor HTTPS
      const httpsServer = https.createServer(httpsOptions, app);
      
      // Manejar errores del servidor
      httpsServer.on('error', (err) => {
        logger.error(`Error en el servidor HTTPS: ${err.message}`);
      });
      
      httpsServer.listen(port, () => {
        logger.info(`Servidor HTTPS corriendo en puerto ${port}`);
      });

      // Opcional: Redirigir HTTP a HTTPS
      if (process.env.REDIRECT_HTTP === 'true') {
        const httpApp = express();
        httpApp.all('*', (req, res) => {
          return res.redirect(`https://${req.hostname}:${port}${req.path}`);
        });
        httpApp.listen(80, () => logger.info('Servidor HTTP redirigiendo a HTTPS'));
      }
    } catch (error) {
      logger.error(`Error al iniciar el servidor HTTPS: ${error.message}`);
      logger.info('Iniciando servidor sin HTTPS como fallback...');
      
      // Iniciar el servidor HTTP como fallback
      const httpServer = app.listen(port, () => {
        logger.info(`Servidor fallback HTTP corriendo en puerto ${port}`);
      });
      
      // Manejar errores del servidor
      httpServer.on('error', (err) => {
        logger.error(`Error en el servidor HTTP: ${err.message}`);
      });
    }
    
    // Manejar señales de terminación
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (err) {
    logger.error(`Error al iniciar servidor: ${err.message}`);
    process.exit(1);
  }
}

// Función para apagado correcto
async function gracefulShutdown() {
  logger.info('Iniciando apagado correcto...');
  
  // Cerrar pool de conexiones a la base de datos
  if (pool) {
    logger.info('Cerrando conexiones a la base de datos...');
    await pool.end();
  }
  
  logger.info('Apagado completado, saliendo...');
  process.exit(0);
}

// Manejo de excepciones no capturadas
process.on('uncaughtException', (err) => {
  logger.error(`Excepción no capturada: ${err.stack}`);
  // Salir con error
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Rechazo de promesa no manejado: ${reason}`);
});

// Iniciar el servidor
startServer();

module.exports = app; // Para pruebas

// Resto del código existente para SDR...