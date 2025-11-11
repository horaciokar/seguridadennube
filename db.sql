CREATE DATABASE IF NOT EXISTS seguridadennube;

-- Usar la base de datos
USE seguridadennube;

-- Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Opcionalmente, puedes insertar algunos usuarios de prueba
INSERT INTO users (nombre, apellido, email, password) VALUES
('Juan', 'Pérez', 'juan@ejemplo.com', '$2b$10$H.A8SoRQrNVgwMWLs1SxP.gSrQG7XTb.WPuZwKnYzYgIPGzRHBkwe'), -- password: test123
('María', 'López', 'maria@ejemplo.com', '$2b$10$H.A8SoRQrNVgwMWLs1SxP.gSrQG7XTb.WPuZwKnYzYgIPGzRHBkwe'); -- password: test123