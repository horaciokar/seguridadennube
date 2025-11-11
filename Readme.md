# Proyecto Seguridad en la Nube

Este proyecto es una aplicación web con un backend Node.js y una base de datos MySQL.

## Requisitos

*   Node.js
*   MySQL Server

## Instalación

1.  **Clonar el repositorio (opcional):**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd seguridadennube
    ```

2.  **Instalar dependencias de Node.js:**
    ```bash
    npm install
    ```

3.  **Configuración de la Base de Datos MySQL:**

    a. **Instalar MySQL en Ubuntu:**
    ```bash
    sudo apt-get update
    sudo apt-get install -y mysql-server
    ```

    b. **Crear la base de datos y el usuario:**
    Inicia sesión en MySQL como root (`sudo mysql`) y ejecuta los siguientes comandos. Se creará una base de datos llamada `seguridadennube` y un usuario `user_db` con la contraseña `password_db`.

    ```sql
    CREATE DATABASE IF NOT EXISTS seguridadennube;
    CREATE USER IF NOT EXISTS 'user_db'@'localhost' IDENTIFIED BY 'password_db';
    GRANT ALL PRIVILEGES ON seguridadennube.* TO 'user_db'@'localhost';
    FLUSH PRIVILEGES;
    EXIT;
    ```

    c. **Importar el esquema de la base de datos:**
    Desde la terminal de tu proyecto, ejecuta el siguiente comando para importar la estructura de las tablas:
    ```bash
    mysql -u user_db -p'password_db' seguridadennube < db.sql
    ```
    *(Nota: No hay espacio entre -p y la contraseña)*

4.  **Configurar las variables de entorno:**
    Asegúrate de que tu archivo `.env` en la raíz del proyecto contenga las siguientes variables:
    ```
    DB_HOST=localhost
    DB_USER=user_db
    DB_PASSWORD=password_db
    DB_DATABASE=seguridadennube
    ```

5.  **Iniciar la aplicación:**
    ```bash
    node server.js
    ```
    La aplicación debería estar corriendo en `http://localhost:3000` (o el puerto que tengas configurado).
