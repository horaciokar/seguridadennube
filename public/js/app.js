// Configuración de la API
const API_URL = 'https://seguridadenredes.ddns.net/api'; // Cambiado a HTTPS para evitar errores de contenido mixto

// Referencias a elementos del DOM
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authForms = document.getElementById('auth-forms');
const userDashboard = document.getElementById('user-dashboard');
const logoutBtn = document.getElementById('logout-btn');
const userNameSpan = document.getElementById('user-name');
const usersList = document.getElementById('users-list');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const dashboardMessage = document.getElementById('dashboard-message') || document.createElement('div'); // Elemento para mensajes en el dashboard

// Si no existe el elemento de mensaje en el dashboard, crearlo
if (!document.getElementById('dashboard-message')) {
    dashboardMessage.id = 'dashboard-message';
    dashboardMessage.className = 'message';
    userDashboard.insertBefore(dashboardMessage, userDashboard.firstChild);
}

// Cambiar entre pestañas de login y registro
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
});

// Función para mostrar mensajes
function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('error', 'success');
    element.classList.add(isError ? 'error' : 'success');
    
    // Hacer visible el mensaje
    element.style.display = 'block';
    
    // Ocultar el mensaje después de 5 segundos
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Función para manejar el registro de usuarios
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('register-nombre').value.trim();
    const apellido = document.getElementById('register-apellido').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!nombre || !apellido || !email || !password) {
        showMessage(registerMessage, 'Todos los campos son obligatorios', true);
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, apellido, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en el registro');
        }
        
        showMessage(registerMessage, 'Registro exitoso. Ahora puedes iniciar sesión.');
        
        // Limpiar el formulario
        registerForm.reset();
        
        // Cambiar a la pestaña de login después de un registro exitoso
        setTimeout(() => {
            loginTab.click();
        }, 2000);
        
    } catch (error) {
        showMessage(registerMessage, error.message, true);
    }
});

// Función para manejar el inicio de sesión
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showMessage(loginMessage, 'Email y contraseña son obligatorios', true);
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Error en el inicio de sesión');
        }
        
        const data = await response.json();
        
        // Guardar token en localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Mostrar dashboard
        showDashboard();
        
    } catch (error) {
        showMessage(loginMessage, error.message || 'Error al conectar con el servidor', true);
    }
});

// Función para mostrar el dashboard después de iniciar sesión
function showDashboard() {
    // Obtener información del usuario
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        return;
    }
    
    // Mostrar nombre del usuario
    userNameSpan.textContent = `${user.nombre} ${user.apellido}`;
    
    // Ocultar formularios y mostrar dashboard
    authForms.classList.add('hidden');
    userDashboard.classList.remove('hidden');
    
    // Cargar lista de usuarios
    loadUsers();
}

// Función para cargar la lista de usuarios desde la API
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        // Mostrar mensaje de carga
        showMessage(dashboardMessage, 'Cargando usuarios...', false);
        
        console.log('Cargando usuarios con token:', token);
        console.log('URL de la API:', `${API_URL}/users`);
        
        const response = await fetch(`${API_URL}/users`, {
            method: 'GET', // Especificar método explícitamente
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('Respuesta recibida:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error al cargar usuarios: ${response.status}`);
        }
        
        const users = await response.json();
        console.log('Usuarios recibidos:', users);
        
        if (!Array.isArray(users)) {
            throw new Error('La respuesta no contiene un array de usuarios');
        }
        
        // Limpiar lista actual
        usersList.innerHTML = '';
        
        // Mostrar usuarios en la tabla
        if (users.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="5" class="text-center">No hay usuarios registrados</td>';
            usersList.appendChild(emptyRow);
        } else {
            users.forEach(user => {
                const row = document.createElement('tr');
                
                // Formatear fecha
                let fechaFormateada = 'N/A';
                if (user.fecha_registro) {
                    try {
                        const fecha = new Date(user.fecha_registro);
                        fechaFormateada = `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()} ${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
                    } catch (e) {
                        console.error('Error al formatear fecha:', e);
                    }
                }
                
                row.innerHTML = `
                    <td>${user.id || 'N/A'}</td>
                    <td>${user.nombre || 'N/A'}</td>
                    <td>${user.apellido || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${fechaFormateada}</td>
                `;
                
                usersList.appendChild(row);
            });
        }
        
        showMessage(dashboardMessage, 'Usuarios cargados correctamente', false);
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showMessage(dashboardMessage, `Error: ${error.message}`, true);
    }
}

// Función para cerrar sesión
logoutBtn.addEventListener('click', () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Mostrar formularios y ocultar dashboard
    authForms.classList.remove('hidden');
    userDashboard.classList.add('hidden');
    
    // Limpiar formularios
    loginForm.reset();
    registerForm.reset();
    
    // Resetear pestañas
    loginTab.click();
});

// Verificar si el usuario ya tiene sesión iniciada al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // Verificar si el token es válido antes de mostrar el dashboard
        verifyToken(token)
            .then(isValid => {
                if (isValid) {
                    showDashboard();
                } else {
                    // Si el token no es válido, cerrar sesión
                    logoutBtn.click();
                }
            })
            .catch(() => {
                // En caso de error, cerrar sesión
                logoutBtn.click();
            });
    }
});

// Función para verificar si el token es válido
async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/verify-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('Error al verificar token:', error);
        return false;
    }
}