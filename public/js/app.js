// Configuración de la API
const API_URL = 'http://34.207.87.35/:3000/api';

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
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en el inicio de sesión');
        }
        
        // Guardar token en localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Mostrar dashboard
        showDashboard();
        
    } catch (error) {
        showMessage(loginMessage, error.message, true);
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
        
        const response = await fetch(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar usuarios');
        }
        
        const users = await response.json();
        
        // Limpiar lista actual
        usersList.innerHTML = '';
        
        // Mostrar usuarios en la tabla
        users.forEach(user => {
            const row = document.createElement('tr');
            
            // Formatear fecha
            const fecha = new Date(user.fecha_registro);
            const fechaFormateada = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()} ${fecha.getHours()}:${fecha.getMinutes()}`;
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.nombre}</td>
                <td>${user.apellido}</td>
                <td>${user.email}</td>
                <td>${fechaFormateada}</td>
            `;
            
            usersList.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
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
});

// Verificar si el usuario ya tiene sesión iniciada al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        showDashboard();
    }
});