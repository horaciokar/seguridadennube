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

// Conectar a la base de datos y verificar/crear tablas necesarias
db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos MySQL');
  
  // Verificar si existe la columna ultimo_acceso, si no, crearla
  db.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = ? 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'ultimo_acceso'`, 
    [process.env.DB_NAME], 
    (err, results) => {
      if (err) {
        console.error('Error al verificar columnas:', err);
        return;
      }
      
      if (results.length === 0) {
        // La columna no existe, crearla
        db.query(`
          ALTER TABLE users 
          ADD COLUMN ultimo_acceso TIMESTAMP NULL DEFAULT NULL
        `, (err) => {
          if (err) {
            console.error('Error al añadir columna ultimo_acceso:', err);
          } else {
            console.log('Columna ultimo_acceso añadida correctamente');
          }
        });
      }
  });
  
  // Verificar si existe la columna ip_address, si no, crearla
  db.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = ? 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'ip_address'`, 
    [process.env.DB_NAME], 
    (err, results) => {
      if (err) {
        console.error('Error al verificar columna ip_address:', err);
        return;
      }
      
      if (results.length === 0) {
        // La columna no existe, crearla
        db.query(`
          ALTER TABLE users 
          ADD COLUMN ip_address VARCHAR(45) NULL DEFAULT NULL
        `, (err) => {
          if (err) {
            console.error('Error al añadir columna ip_address:', err);
          } else {
            console.log('Columna ip_address añadida correctamente');
          }
        });
      }
  });
  
  // Verificar si existe la tabla login_history, si no, crearla
  db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ? 
    AND table_name = 'login_history'`, 
    [process.env.DB_NAME], 
    (err, results) => {
      if (err) {
        console.error('Error al verificar tabla login_history:', err);
        return;
      }
      
      if (results.length === 0) {
        // La tabla no existe, crearla
        db.query(`
          CREATE TABLE login_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            status VARCHAR(20) DEFAULT 'success',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error al crear tabla login_history:', err);
          } else {
            console.log('Tabla login_history creada correctamente');
          }
        });
      }
  });
  
  // Verificar si existe la tabla gps_data, si no, crearla
  db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ? 
    AND table_name = 'gps_data'`, 
    [process.env.DB_NAME], 
    (err, results) => {
      if (err) {
        console.error('Error al verificar tabla gps_data:', err);
        return;
      }
      
      if (results.length === 0) {
        // La tabla no existe, crearla
        db.query(`
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error al crear tabla gps_data:', err);
          } else {
            console.log('Tabla gps_data creada correctamente');
          }
        });
      }
  });
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

// Middleware para verificar la clave API (para dispositivos ESP32)
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.ESP32_API_KEY || '1234567890Abc#';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ message: 'Clave API no válida' });
  }
  
  next();
};

// Función para obtener IP real del cliente
const getClientIp = (req) => {
  // Primero buscamos la IP en los headers de proxy
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // El formato puede ser: client, proxy1, proxy2, ...
    return xForwardedFor.split(',')[0].trim();
  }
  
  // Otras formas de obtener la IP
  return req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
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
      
      // Obtener la IP del cliente
      const ipAddress = getClientIp(req);
      
      // Insertar usuario en la base de datos
      db.query(
        'INSERT INTO users (nombre, apellido, email, password, ip_address) VALUES (?, ?, ?, ?, ?)',
        [nombre, apellido, email, hashedPassword, ipAddress],
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
  
  // Obtener la IP y user agent
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      // Registrar intento fallido si el email existe en la base de datos
      logFailedLogin(email, ipAddress, userAgent, 'usuario_no_existe');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    const user = results[0];
    
    // Verificar contraseña
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      // Registrar intento fallido
      logFailedLogin(user.id, ipAddress, userAgent, 'contraseña_incorrecta');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Actualizar último acceso e IP
    const now = new Date();
    db.query('UPDATE users SET ultimo_acceso = ?, ip_address = ? WHERE id = ?', 
      [now, ipAddress, user.id], 
      (updateErr) => {
        if (updateErr) {
          console.error('Error al actualizar último acceso e IP:', updateErr);
        }
      }
    );
    
    // Registrar inicio de sesión exitoso
    logSuccessfulLogin(user.id, ipAddress, userAgent);
    
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

// Función para registrar inicio de sesión exitoso
function logSuccessfulLogin(userId, ipAddress, userAgent) {
  db.query(
    'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
    [userId, ipAddress, userAgent, 'success'],
    (err) => {
      if (err) {
        console.error('Error al registrar inicio de sesión exitoso:', err);
      }
    }
  );
}

// Función para registrar intento de inicio de sesión fallido
function logFailedLogin(userId, ipAddress, userAgent, reason) {
  // Si es un email y no un ID
  if (isNaN(userId)) {
    // Solo registrar la IP y el motivo
    db.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [0, ipAddress, userAgent, 'failed_' + reason],
      (err) => {
        if (err) {
          console.error('Error al registrar intento fallido de inicio de sesión:', err);
        }
      }
    );
  } else {
    // Registrar con el ID de usuario
    db.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [userId, ipAddress, userAgent, 'failed_' + reason],
      (err) => {
        if (err) {
          console.error('Error al registrar intento fallido de inicio de sesión:', err);
        }
      }
    );
  }
}

// Ruta protegida para obtener todos los usuarios (requiere autenticación)
app.get('/api/users', verifyToken, (req, res) => {
  db.query('SELECT id, nombre, apellido, email, fecha_registro, ultimo_acceso, ip_address FROM users', (err, results) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    res.json(results);
  });
});

// Ruta para obtener el historial de conexiones de un usuario
app.get('/api/users/:id/login-history', verifyToken, (req, res) => {
  const userId = req.params.id;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  // Si no es el propio usuario y no es admin, denegar acceso
  if (parseInt(userId) !== req.user.id && req.user.role !== 'admin') {
    // En un sistema real, tendrías roles. Aquí lo simplificamos
    return res.status(403).json({ message: 'No tienes permiso para ver este historial' });
  }
  
  // Consultar historial
  db.query(
    `SELECT h.id, h.login_time, h.ip_address, h.user_agent, h.status,
            u.nombre, u.apellido, u.email
     FROM login_history h
     JOIN users u ON h.user_id = u.id
     WHERE h.user_id = ?
     ORDER BY h.login_time DESC
     LIMIT 100`,
    [userId],
    (err, results) => {
      if (err) {
        console.error('Error al obtener historial de conexiones:', err);
        return res.status(500).json({ message: 'Error del servidor' });
      }
      
      res.json(results);
    }
  );
});

// Eliminar usuario por ID
app.delete('/api/users/:id', verifyToken, (req, res) => {
  const userId = req.params.id;
  
  // Verificar que el ID sea válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido' });
  }
  
  console.log(`Intento de eliminar usuario con ID: ${userId}`);
  
  // No permitir que un usuario se elimine a sí mismo
  if (parseInt(userId) === req.user.id) {
    return res.status(403).json({ message: 'No puedes eliminar tu propio usuario' });
  }
  
  // Verificar si el usuario existe antes de eliminarlo
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Eliminar el usuario
    db.query('DELETE FROM users WHERE id = ?', [userId], (err, result) => {
      if (err) {
        console.error('Error al eliminar usuario:', err);
        return res.status(500).json({ message: 'Error al eliminar el usuario' });
      }
      
      console.log(`Usuario con ID ${userId} eliminado correctamente`);
      return res.status(200).json({ 
        message: 'Usuario eliminado correctamente',
        userId: userId
      });
    });
  });
});

// Actualizar datos de un usuario
app.put('/api/users/:id', verifyToken, async (req, res) => {
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
  
  console.log(`Intento de actualizar usuario con ID: ${userId}`);
  
  // Verificar si el usuario existe
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Actualizar los datos del usuario
    db.query(
      'UPDATE users SET nombre = ?, apellido = ? WHERE id = ?',
      [nombre, apellido, userId],
      (err, result) => {
        if (err) {
          console.error('Error al actualizar usuario:', err);
          return res.status(500).json({ message: 'Error al actualizar el usuario' });
        }
        
        console.log(`Usuario con ID ${userId} actualizado correctamente`);
        return res.status(200).json({ 
          message: 'Usuario actualizado correctamente',
          userId: userId
        });
      }
    );
  });
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
  
  console.log(`Intento de cambiar contraseña de usuario con ID: ${userId}`);
  
  // Verificar si el usuario existe y su contraseña actual
  db.query('SELECT * FROM users WHERE id = ?', [userId], async (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = results[0];
    
    // Verificar la contraseña actual
    const match = await bcrypt.compare(currentPassword, user.password);
    
    if (!match) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
    }
    
    try {
      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Actualizar la contraseña
      db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        (err, result) => {
          if (err) {
            console.error('Error al actualizar contraseña:', err);
            return res.status(500).json({ message: 'Error al actualizar la contraseña' });
          }
          
          console.log(`Contraseña del usuario con ID ${userId} actualizada correctamente`);
          return res.status(200).json({ 
            message: 'Contraseña actualizada correctamente'
          });
        }
      );
    } catch (error) {
      console.error('Error al hashear la nueva contraseña:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
});

// ----- RUTAS PARA GPS -----

// Endpoint para recibir datos GPS del ESP32
app.post('/api/gps', verifyApiKey, (req, res) => {
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
    battery
  } = req.body;
  
  // Validar datos requeridos
  if (!device_id || !latitude || !longitude) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: device_id, latitude, longitude' });
  }
  
  // Validar rangos de latitud y longitud
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Valores de latitud o longitud fuera de rango' });
  }
  
  // Insertar datos en la base de datos
  db.query(
    `INSERT INTO gps_data 
     (device_id, latitude, longitude, altitude, speed, satellites, hdop, battery, gps_timestamp, gps_date) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [device_id, latitude, longitude, altitude, speed, satellites, hdop, battery, timestamp, date],
    (err, result) => {
      if (err) {
        console.error('Error al guardar datos GPS:', err);
        return res.status(500).json({ message: 'Error al guardar datos GPS' });
      }
      
      console.log(`Datos GPS recibidos de ${device_id}: Lat=${latitude}, Lon=${longitude}`);
      return res.status(201).json({ 
        message: 'Datos GPS guardados correctamente',
        id: result.insertId
      });
    }
  );
});

// Endpoint para obtener datos GPS (protegido con autenticación JWT)
app.get('/api/gps', verifyToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 100; // Limitar el número de registros
  const device = req.query.device || null; // Filtrar por dispositivo
  const startDate = req.query.start || null; // Fecha de inicio (YYYY-MM-DD)
  const endDate = req.query.end || null; // Fecha de fin (YYYY-MM-DD)
  
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
  
  // Ejecutar la consulta
  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error al obtener datos GPS:', err);
      return res.status(500).json({ message: 'Error al obtener datos GPS' });
    }
    
    res.json(results);
  });
});

// Endpoint para obtener el último registro GPS de cada dispositivo
app.get('/api/gps/latest', verifyToken, (req, res) => {
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
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener últimos datos GPS:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
    
    res.json(results);
  });
});

// Endpoint para obtener la lista de dispositivos GPS disponibles
app.get('/api/gps/devices', verifyToken, (req, res) => {
  const query = `
    SELECT DISTINCT device_id, 
           COUNT(*) as total_records,
           MIN(created_at) as first_record,
           MAX(created_at) as last_record
    FROM gps_data
    GROUP BY device_id
    ORDER BY last_record DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener dispositivos GPS:', err);
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