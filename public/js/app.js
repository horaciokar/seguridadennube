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
const dashboardMessage = document.getElementById('dashboard-message') || document.createElement('div');

// Referencias a elementos de modales
const changePasswordBtn = document.getElementById('change-password-btn');
const passwordModal = document.getElementById('password-modal');
const changePasswordForm = document.getElementById('change-password-form');
const passwordModalMessage = document.getElementById('password-modal-message');
const editUserModal = document.getElementById('edit-user-modal');
const editUserForm = document.getElementById('edit-user-form');
const editModalMessage = document.getElementById('edit-modal-message');
const closeModalBtns = document.querySelectorAll('.close-modal');

// Si no existe el elemento de mensaje en el dashboard, crearlo
if (!document.getElementById('dashboard-message')) {
    dashboardMessage.id = 'dashboard-message';
    dashboardMessage.className = 'message';
    userDashboard.insertBefore(dashboardMessage, userDashboard.firstChild);
}

// Asegurarse de que todos los modales estén ocultos al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    editUserModal.classList.add('hidden');
    passwordModal.classList.add('hidden');
    
    // Resto del código DOMContentLoaded sigue abajo...
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
                    logout();
                }
            })
            .catch(() => {
                // En caso de error, cerrar sesión
                logout();
            });
    }
});

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

// Función para formatear fechas
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const fecha = new Date(dateString);
        return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()} ${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
        console.error('Error al formatear fecha:', e);
        return 'N/A';
    }
}

// Función para eliminar un usuario
async function deleteUser(userId) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        // Confirmar antes de eliminar
        if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            return;
        }
        
        showMessage(dashboardMessage, 'Eliminando usuario...', false);
        
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al eliminar usuario: ${response.status}`);
        }
        
        const data = await response.json();
        showMessage(dashboardMessage, 'Usuario eliminado correctamente', false);
        
        // Recargar la lista de usuarios
        loadUsers();
        
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        showMessage(dashboardMessage, `Error: ${error.message}`, true);
    }
}

// Función para abrir el modal de edición de usuario
function openEditModal(user) {
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-nombre').value = user.nombre;
    document.getElementById('edit-apellido').value = user.apellido;
    
    const emailInput = document.getElementById('edit-email');
    emailInput.value = user.email;
    emailInput.disabled = true; // Asegurar que esté deshabilitado
    emailInput.setAttribute('readonly', 'readonly'); // También añadir readonly para mayor seguridad
    
    // Resetear mensajes
    const editModalMessage = document.getElementById('edit-modal-message');
    if (editModalMessage) {
        editModalMessage.style.display = 'none';
    }
    
    // Mostrar el modal
    editUserModal.classList.remove('hidden');
}

// Función para actualizar datos de usuario
async function updateUser(userId, userData) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        showMessage(editModalMessage, 'Actualizando datos...', false);
        
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al actualizar usuario: ${response.status}`);
        }
        
        const data = await response.json();
        showMessage(editModalMessage, 'Usuario actualizado correctamente', false);
        
        // Actualizar usuario en localStorage si es el usuario actual
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.id === parseInt(userId)) {
            currentUser.nombre = userData.nombre;
            currentUser.apellido = userData.apellido;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Actualizar nombre en el dashboard
            userNameSpan.textContent = `${currentUser.nombre} ${currentUser.apellido}`;
        }
        
        // Cerrar el modal después de 2 segundos
        setTimeout(() => {
            editUserModal.classList.add('hidden');
            // Recargar la lista de usuarios
            loadUsers();
        }, 2000);
        
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        showMessage(editModalMessage, `Error: ${error.message}`, true);
    }
}

// Función para cambiar la contraseña
async function changePassword(userId, passwordData) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        showMessage(passwordModalMessage, 'Actualizando contraseña...', false);
        
        const response = await fetch(`${API_URL}/users/${userId}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al cambiar contraseña: ${response.status}`);
        }
        
        const data = await response.json();
        showMessage(passwordModalMessage, 'Contraseña actualizada correctamente', false);
        
        // Cerrar el modal después de 2 segundos
        setTimeout(() => {
            passwordModal.classList.add('hidden');
            changePasswordForm.reset();
        }, 2000);
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        showMessage(passwordModalMessage, `Error: ${error.message}`, true);
    }
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
    
    // Asegurarse de que los modales estén ocultos
    editUserModal.classList.add('hidden');
    passwordModal.classList.add('hidden');
    
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
            emptyRow.innerHTML = '<td colspan="7" class="text-center">No hay usuarios registrados</td>';
            usersList.appendChild(emptyRow);
        } else {
            // Obtener el usuario actual
            const currentUser = JSON.parse(localStorage.getItem('user'));
            
            users.forEach(user => {
                const row = document.createElement('tr');
                
                // Formatear fechas
                const fechaRegistro = formatDate(user.fecha_registro);
                const ultimoAcceso = formatDate(user.ultimo_acceso);
                
                // Columnas básicas
                row.innerHTML = `
                    <td>${user.id || 'N/A'}</td>
                    <td>${user.nombre || 'N/A'}</td>
                    <td>${user.apellido || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${fechaRegistro}</td>
                    <td>${ultimoAcceso}</td>
                    <td class="action-column">
                        ${currentUser.id === user.id ? 
                            '<span class="current-user-badge">Tú</span>' : 
                            `<button class="btn-edit" data-id="${user.id}">Editar</button>
                             <button class="btn-delete" data-id="${user.id}">Eliminar</button>`}
                    </td>
                `;
                
                usersList.appendChild(row);
                
                // Añadir event listeners a los botones si no es el usuario actual
                if (currentUser.id !== user.id) {
                    // Botón eliminar
                    const deleteButton = row.querySelector('.btn-delete');
                    if (deleteButton) {
                        deleteButton.addEventListener('click', function() {
                            const userId = this.getAttribute('data-id');
                            deleteUser(userId);
                        });
                    }
                    
                    // Botón editar
                    const editButton = row.querySelector('.btn-edit');
                    if (editButton) {
                        editButton.addEventListener('click', function() {
                            const userId = this.getAttribute('data-id');
                            // Buscar el usuario en el array de usuarios
                            const userToEdit = users.find(u => u.id == userId);
                            if (userToEdit) {
                                openEditModal(userToEdit);
                            }
                        });
                    }
                }
            });
        }
        
        showMessage(dashboardMessage, 'Usuarios cargados correctamente', false);
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showMessage(dashboardMessage, `Error: ${error.message}`, true);
    }
}

// Event listener para el formulario de cambio de contraseña
changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage(passwordModalMessage, 'Todos los campos son obligatorios', true);
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage(passwordModalMessage, 'Las nuevas contraseñas no coinciden', true);
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage(passwordModalMessage, 'La nueva contraseña debe tener al menos 6 caracteres', true);
        return;
    }
    
    // Obtener el ID del usuario actual
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        showMessage(passwordModalMessage, 'Error: No se pudo identificar al usuario actual', true);
        return;
    }
    
    // Enviar solicitud para cambiar contraseña
    await changePassword(currentUser.id, {
        currentPassword,
        newPassword
    });
});

// Event listener para el formulario de edición de usuario
editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const nombre = document.getElementById('edit-nombre').value.trim();
    const apellido = document.getElementById('edit-apellido').value.trim();
    
    // Validaciones
    if (!nombre || !apellido) {
        showMessage(editModalMessage, 'Nombre y apellido son obligatorios', true);
        return;
    }
    
    // Enviar solicitud para actualizar usuario
    await updateUser(userId, {
        nombre,
        apellido
    });
});

// Función para cerrar sesión
function logout() {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Mostrar formularios y ocultar dashboard
    authForms.classList.remove('hidden');
    userDashboard.classList.add('hidden');
    
    // Asegurarse de que los modales estén ocultos
    editUserModal.classList.add('hidden');
    passwordModal.classList.add('hidden');
    
    // Limpiar formularios
    loginForm.reset();
    registerForm.reset();
    
    // Resetear pestañas
    loginTab.click();
}

// Event listener para cerrar sesión
logoutBtn.addEventListener('click', logout);

// Event listener para abrir modal de cambio de contraseña
changePasswordBtn.addEventListener('click', () => {
    passwordModal.classList.remove('hidden');
    passwordModalMessage.style.display = 'none';
    changePasswordForm.reset();
});

// Event listeners para cerrar modales
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        passwordModal.classList.add('hidden');
        editUserModal.classList.add('hidden');
    });
});

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
        passwordModal.classList.add('hidden');
    }
    if (e.target === editUserModal) {
        editUserModal.classList.add('hidden');
    }
});

// Verificar si el usuario ya tiene sesión iniciada al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que los modales estén ocultos al inicio
    editUserModal.classList.add('hidden');
    passwordModal.classList.add('hidden');
    
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
                    logout();
                }
            })
            .catch(() => {
                // En caso de error, cerrar sesión
                logout();
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