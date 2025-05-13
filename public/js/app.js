// Configuración de la API
const API_URL = 'https://seguridadenredes.ddns.net/api';

// Referencias a elementos del DOM con verificación de existencia
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
const loginHistoryModal = document.getElementById('login-history-modal');
const loginHistoryList = document.getElementById('login-history-list');
const historyUserName = document.getElementById('history-user-name');
const historyUserEmail = document.getElementById('history-user-email');
const closeModalBtns = document.querySelectorAll('.close-modal');

// Referencias a elementos de pestañas del dashboard
const usersTab = document.getElementById('users-tab');
const myLoginTab = document.getElementById('my-login-tab');
const usersContent = document.getElementById('users-content');
const myLoginContent = document.getElementById('my-login-content');
const myLoginList = document.getElementById('my-login-list');

// Console log para debug
console.log("Elementos del DOM:", {
  loginTab: !!loginTab,
  registerTab: !!registerTab,
  loginForm: !!loginForm,
  registerForm: !!registerForm,
  authForms: !!authForms,
  userDashboard: !!userDashboard,
  logoutBtn: !!logoutBtn,
  userNameSpan: !!userNameSpan,
  usersList: !!usersList,
  loginMessage: !!loginMessage,
  registerMessage: !!registerMessage
});

// Si no existe el elemento de mensaje en el dashboard, crearlo
if (!document.getElementById('dashboard-message') && userDashboard) {
    dashboardMessage.id = 'dashboard-message';
    dashboardMessage.className = 'message';
    userDashboard.insertBefore(dashboardMessage, userDashboard.firstChild);
}

// Asegurarse de que todos los modales estén ocultos al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    if (editUserModal) editUserModal.classList.add('hidden');
    if (passwordModal) passwordModal.classList.add('hidden');
    if (loginHistoryModal) loginHistoryModal.classList.add('hidden');
    
    // Resto del código DOMContentLoaded sigue abajo...
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // Verificar si el token es válido antes de mostrar el dashboard
        verifyToken(token)
            .then(isValid => {
                if (isValid) {
                    showDashboard();
                    
                    // AÑADIDO: Asegurarse de que el botón GPS tenga un event listener
                    const gpsButton = document.getElementById('gps-dashboard-btn');
                    if (gpsButton) {
                        console.log('Botón GPS encontrado, añadiendo event listener');
                        gpsButton.addEventListener('click', function(e) {
                            console.log('GPS button clicked from DOMContentLoaded');
                            window.location.href = 'gps.html';
                        });
                    } else {
                        console.log('Botón GPS no encontrado en DOMContentLoaded');
                    }
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
if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        if (registerForm) registerForm.classList.remove('hidden');
        if (loginForm) loginForm.classList.add('hidden');
    });
}

// Cambiar entre pestañas del dashboard
if (usersTab && myLoginTab) {
    usersTab.addEventListener('click', () => {
        usersTab.classList.add('active');
        myLoginTab.classList.remove('active');
        if (usersContent) usersContent.classList.add('active');
        if (myLoginContent) myLoginContent.classList.remove('active');
    });

    myLoginTab.addEventListener('click', () => {
        myLoginTab.classList.add('active');
        usersTab.classList.remove('active');
        if (myLoginContent) myLoginContent.classList.add('active');
        if (usersContent) usersContent.classList.remove('active');
        
        // Cargar mi historial de conexiones si no se ha cargado aún
        if (myLoginList && myLoginList.innerHTML === '') {
            loadMyLoginHistory();
        }
    });
}

// Función para mostrar mensajes
function showMessage(element, message, isError = false) {
    if (!element) return;
    
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
        
        if (dashboardMessage) {
            showMessage(dashboardMessage, 'Eliminando usuario...', false);
        }
        
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
        if (dashboardMessage) {
            showMessage(dashboardMessage, 'Usuario eliminado correctamente', false);
        }
        
        // Recargar la lista de usuarios
        loadUsers();
        
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        if (dashboardMessage) {
            showMessage(dashboardMessage, `Error: ${error.message}`, true);
        }
    }
}

// Función para abrir el modal de edición de usuario
function openEditModal(user) {
    if (!editUserModal) return;
    
    const idInput = document.getElementById('edit-user-id');
    const nombreInput = document.getElementById('edit-nombre');
    const apellidoInput = document.getElementById('edit-apellido');
    const emailInput = document.getElementById('edit-email');
    
    if (idInput) idInput.value = user.id;
    if (nombreInput) nombreInput.value = user.nombre;
    if (apellidoInput) apellidoInput.value = user.apellido;
    
    if (emailInput) {
        emailInput.value = user.email;
        emailInput.disabled = true; // Asegurar que esté deshabilitado
        emailInput.setAttribute('readonly', 'readonly'); // También añadir readonly para mayor seguridad
    }
    
    // Resetear mensajes
    if (editModalMessage) {
        editModalMessage.style.display = 'none';
    }
    
    // Mostrar el modal
    editUserModal.classList.remove('hidden');
}

// Función para mostrar el historial de conexiones de un usuario
async function showLoginHistory(userId, userName, userEmail) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        if (!loginHistoryModal || !loginHistoryList) return;
        
        // Mostrar información del usuario en el modal
        if (historyUserName) historyUserName.textContent = userName;
        if (historyUserEmail) historyUserEmail.textContent = userEmail;
        
        // Limpiar lista actual
        loginHistoryList.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
        
        // Mostrar el modal
        loginHistoryModal.classList.remove('hidden');
        
        // Cargar historial
        const response = await fetch(`${API_URL}/users/${userId}/login-history`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar historial: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Limpiar mensaje de carga
        loginHistoryList.innerHTML = '';
        
        // Mostrar datos en la tabla
        if (data.length === 0) {
            loginHistoryList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay registros de conexión</td></tr>';
        } else {
            data.forEach(entry => {
                const row = document.createElement('tr');
                
                // Determinar clase CSS para el estado
                let statusClass = '';
                let statusText = entry.status || 'N/A';
                
                if (statusText === 'success') {
                    statusClass = 'history-status-success';
                    statusText = 'Exitoso';
                } else if (statusText.startsWith('failed')) {
                    statusClass = 'history-status-failed';
                    
                    // Traducir los motivos de fallo
                    if (statusText === 'failed_contraseña_incorrecta') {
                        statusText = 'Fallido: Contraseña incorrecta';
                    } else if (statusText === 'failed_usuario_no_existe') {
                        statusText = 'Fallido: Usuario no existe';
                    } else {
                        statusText = 'Fallido';
                    }
                }
                
                row.innerHTML = `
                    <td>${formatDate(entry.login_time)}</td>
                    <td>${entry.ip_address || 'N/A'}</td>
                    <td>${entry.user_agent ? entry.user_agent.substring(0, 50) + '...' : 'N/A'}</td>
                    <td class="${statusClass}">${statusText}</td>
                `;
                
                loginHistoryList.appendChild(row);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (loginHistoryList) {
            loginHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
        }
    }
}

// Función para cargar mi historial de conexiones
async function loadMyLoginHistory() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!token || !user || !myLoginList) {
            throw new Error('No hay información de sesión disponible');
        }
        
        // Cargar historial
        const response = await fetch(`${API_URL}/users/${user.id}/login-history`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar historial: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Limpiar lista actual
        myLoginList.innerHTML = '';
        
        // Mostrar datos en la tabla
        if (data.length === 0) {
            myLoginList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay registros de conexión</td></tr>';
        } else {
            data.forEach(entry => {
                const row = document.createElement('tr');
                
                // Determinar clase CSS para el estado
                let statusClass = '';
                let statusText = entry.status || 'N/A';
                
                if (statusText === 'success') {
                    statusClass = 'history-status-success';
                    statusText = 'Exitoso';
                } else if (statusText.startsWith('failed')) {
                    statusClass = 'history-status-failed';
                    
                    // Traducir los motivos de fallo
                    if (statusText === 'failed_contraseña_incorrecta') {
                        statusText = 'Fallido: Contraseña incorrecta';
                    } else if (statusText === 'failed_usuario_no_existe') {
                        statusText = 'Fallido: Usuario no existe';
                    } else {
                        statusText = 'Fallido';
                    }
                }
                
                row.innerHTML = `
                    <td>${formatDate(entry.login_time)}</td>
                    <td>${entry.ip_address || 'N/A'}</td>
                    <td>${entry.user_agent ? entry.user_agent.substring(0, 50) + '...' : 'N/A'}</td>
                    <td class="${statusClass}">${statusText}</td>
                `;
                
                myLoginList.appendChild(row);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (myLoginList) {
            myLoginList.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
        }
    }
}

// Función para actualizar datos de usuario
async function updateUser(userId, userData) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        if (editModalMessage) {
            showMessage(editModalMessage, 'Actualizando datos...', false);
        }
        
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
        if (editModalMessage) {
            showMessage(editModalMessage, 'Usuario actualizado correctamente', false);
        }
        
        // Actualizar usuario en localStorage si es el usuario actual
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.id === parseInt(userId)) {
            currentUser.nombre = userData.nombre;
            currentUser.apellido = userData.apellido;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Actualizar nombre en el dashboard
            if (userNameSpan) {
                userNameSpan.textContent = `${currentUser.nombre} ${currentUser.apellido}`;
            }
        }
        
        // Cerrar el modal después de 2 segundos
        if (editUserModal) {
            setTimeout(() => {
                editUserModal.classList.add('hidden');
                // Recargar la lista de usuarios
                loadUsers();
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        if (editModalMessage) {
            showMessage(editModalMessage, `Error: ${error.message}`, true);
        }
    }
}

// Función para cambiar la contraseña
async function changePassword(userId, passwordData) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        if (passwordModalMessage) {
            showMessage(passwordModalMessage, 'Actualizando contraseña...', false);
        }
        
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
        if (passwordModalMessage) {
            showMessage(passwordModalMessage, 'Contraseña actualizada correctamente', false);
        }
        
        // Cerrar el modal después de 2 segundos
        if (passwordModal && changePasswordForm) {
            setTimeout(() => {
                passwordModal.classList.add('hidden');
                changePasswordForm.reset();
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        if (passwordModalMessage) {
            showMessage(passwordModalMessage, `Error: ${error.message}`, true);
        }
    }
}

// Función para manejar el registro de usuarios
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombreInput = document.getElementById('register-nombre');
        const apellidoInput = document.getElementById('register-apellido');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        
        if (!nombreInput || !apellidoInput || !emailInput || !passwordInput) {
            if (registerMessage) {
                showMessage(registerMessage, 'Error: Faltan campos en el formulario', true);
            }
            return;
        }
        
        const nombre = nombreInput.value.trim();
        const apellido = apellidoInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!nombre || !apellido || !email || !password) {
            if (registerMessage) {
                showMessage(registerMessage, 'Todos los campos son obligatorios', true);
            }
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
            
            if (registerMessage) {
                showMessage(registerMessage, 'Registro exitoso. Ahora puedes iniciar sesión.');
            }
            
            // Limpiar el formulario
            registerForm.reset();
            
            // Cambiar a la pestaña de login después de un registro exitoso
            if (loginTab) {
                setTimeout(() => {
                    loginTab.click();
                }, 2000);
            }
            
        } catch (error) {
            if (registerMessage) {
                showMessage(registerMessage, error.message, true);
            }
        }
    });
}

// Función para manejar el inicio de sesión
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        
        if (!emailInput || !passwordInput) {
            if (loginMessage) {
                showMessage(loginMessage, 'Error: Faltan campos en el formulario', true);
            }
            return;
        }
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            if (loginMessage) {
                showMessage(loginMessage, 'Email y contraseña son obligatorios', true);
            }
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
            if (loginMessage) {
                showMessage(loginMessage, error.message || 'Error al conectar con el servidor', true);
            }
        }
    });
}

// Función para mostrar el dashboard después de iniciar sesión
function showDashboard() {
    // Obtener información del usuario
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        return;
    }
    
    // Mostrar nombre del usuario
    if (userNameSpan) {
        userNameSpan.textContent = `${user.nombre} ${user.apellido}`;
    }
    
    // Ocultar formularios y mostrar dashboard
    if (authForms) authForms.classList.add('hidden');
    if (userDashboard) userDashboard.classList.remove('hidden');
    
    // Asegurarse de que los modales estén ocultos
    if (editUserModal) editUserModal.classList.add('hidden');
    if (passwordModal) passwordModal.classList.add('hidden');
    if (loginHistoryModal) loginHistoryModal.classList.add('hidden');
    
    // Asegurarse de que estamos en la pestaña de usuarios
    if (usersTab) usersTab.click();
    
    // Cargar lista de usuarios
    loadUsers();
    
    // Obtener referencia al botón GPS
    const gpsButton = document.getElementById('gps-dashboard-btn');
    
    // Solo crear el botón si no existe
    if (!gpsButton) {
        console.log('Botón GPS no encontrado, creándolo');
        const dashboardHeader = document.querySelector('.header-buttons');
        
        if (dashboardHeader) {
            const newGpsButton = document.createElement('a');
            newGpsButton.id = 'gps-dashboard-btn';
            newGpsButton.className = 'btn btn-secondary';
            newGpsButton.textContent = 'Panel GPS';
            newGpsButton.style.marginRight = '10px';
            newGpsButton.href = 'gps.html';
            
            // Insertar antes del botón de cambiar contraseña
            if (changePasswordBtn) {
                dashboardHeader.insertBefore(newGpsButton, changePasswordBtn);
            } else {
                dashboardHeader.insertBefore(newGpsButton, dashboardHeader.firstChild);
            }
            
            console.log('Botón GPS creado y añadido al DOM');
        }
    } else {
        console.log('Botón GPS ya existe en el DOM');
        // Asegurarse de que el botón tenga un href correcto
        gpsButton.href = 'gps.html';
    }
    
    // Añadir enlace a gestión de perfiles si el usuario es admin
    if (user.role === 'admin') {
        const profilesButton = document.getElementById('profiles-btn');
        const dashboardHeader = document.querySelector('.header-buttons');
        
        if (!profilesButton && dashboardHeader) {
            const newProfilesButton = document.createElement('a');
            newProfilesButton.id = 'profiles-btn';
            newProfilesButton.className = 'btn btn-secondary';
            newProfilesButton.textContent = 'Gestión de Perfiles';
            newProfilesButton.href = 'profiles.html';
            newProfilesButton.style.marginRight = '10px';
            
            // Insertar al inicio de los botones
            dashboardHeader.insertBefore(newProfilesButton, dashboardHeader.firstChild);
            
            console.log('Botón Perfiles creado y añadido al DOM');
        }
    }
 }
 
 // Función para cargar la lista de usuarios desde la API
 async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        const isAdmin = user.role === 'admin';
        
        // Mostrar mensaje de carga
        if (dashboardMessage) {
            showMessage(dashboardMessage, 'Cargando usuarios...', false);
        }
        
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
        if (usersList) usersList.innerHTML = '';
        
        // Mostrar usuarios en la tabla
        if (users.length === 0) {
            if (usersList) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="8" class="text-center">No hay usuarios registrados</td>';
                usersList.appendChild(emptyRow);
            }
        } else {
            // Obtener el usuario actual
            const currentUser = JSON.parse(localStorage.getItem('user'));
            
            if (usersList) {
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
                        <td>${user.ip_address || 'N/A'}</td>
                        <td class="action-column">
                            ${currentUser.id === user.id ? 
                                '<span class="current-user-badge">Tú</span>' : 
                                `<button class="btn-history" data-id="${user.id}" data-name="${user.nombre} ${user.apellido}" data-email="${user.email}">Historial</button>
                                 ${isAdmin ? `<button class="btn-edit" data-id="${user.id}">Editar</button>
                                 <button class="btn-delete" data-id="${user.id}">Eliminar</button>` : ''}`}
                        </td>
                    `;
                    
                    usersList.appendChild(row);
                    
                    // Añadir event listeners a los botones
                    // Botón de historial siempre visible
                    const historyButton = row.querySelector('.btn-history');
                    if (historyButton) {
                        historyButton.addEventListener('click', function() {
                            const userId = this.getAttribute('data-id');
                            const userName = this.getAttribute('data-name');
                            const userEmail = this.getAttribute('data-email');
                            showLoginHistory(userId, userName, userEmail);
                        });
                    }
                    
                    // Botones de editar y eliminar solo para admin
                    if (isAdmin && currentUser.id !== user.id) {
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
        }
        
        if (dashboardMessage) {
            showMessage(dashboardMessage, 'Usuarios cargados correctamente', false);
        }
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        if (dashboardMessage) {
            showMessage(dashboardMessage, `Error: ${error.message}`, true);
        }
    }
 }
 
 // Event listener para el formulario de cambio de contraseña
 if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
            if (passwordModalMessage) {
                showMessage(passwordModalMessage, 'Error: Faltan campos en el formulario', true);
            }
            return;
        }
        
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validaciones
        if (!currentPassword || !newPassword || !confirmPassword) {
            if (passwordModalMessage) {
                showMessage(passwordModalMessage, 'Todos los campos son obligatorios', true);
            }
            return;
        }
        
        if (newPassword !== confirmPassword) {
            if (passwordModalMessage) {
                showMessage(passwordModalMessage, 'Las nuevas contraseñas no coinciden', true);
            }
            return;
        }
        
        if (newPassword.length < 6) {
            if (passwordModalMessage) {
                showMessage(passwordModalMessage, 'La nueva contraseña debe tener al menos 6 caracteres', true);
            }
            return;
        }
        
        // Obtener el ID del usuario actual
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) {
            if (passwordModalMessage) {
                showMessage(passwordModalMessage, 'Error: No se pudo identificar al usuario actual', true);
            }
            return;
        }
        
        // Enviar solicitud para cambiar contraseña
        await changePassword(currentUser.id, {
            currentPassword,
            newPassword
        });
    });
 }
 
 // Event listener para el formulario de edición de usuario
 if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userIdInput = document.getElementById('edit-user-id');
        const nombreInput = document.getElementById('edit-nombre');
        const apellidoInput = document.getElementById('edit-apellido');
        
        if (!userIdInput || !nombreInput || !apellidoInput) {
            if (editModalMessage) {
                showMessage(editModalMessage, 'Error: Faltan campos en el formulario', true);
            }
            return;
        }
        
        const userId = userIdInput.value;
        const nombre = nombreInput.value.trim();
        const apellido = apellidoInput.value.trim();
        
        // Validaciones
        if (!nombre || !apellido) {
            if (editModalMessage) {
                showMessage(editModalMessage, 'Nombre y apellido son obligatorios', true);
            }
            return;
        }
        
        // Enviar solicitud para actualizar usuario
        await updateUser(userId, {
            nombre,
            apellido
        });
    });
 }
 
 // Función para cerrar sesión
 function logout() {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Mostrar formularios y ocultar dashboard
    if (authForms) authForms.classList.remove('hidden');
    if (userDashboard) userDashboard.classList.add('hidden');
    
    // Asegurarse de que los modales estén ocultos
    if (editUserModal) editUserModal.classList.add('hidden');
    if (passwordModal) passwordModal.classList.add('hidden');
    if (loginHistoryModal) loginHistoryModal.classList.add('hidden');
    
    // Limpiar formularios
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    
    // Resetear pestañas
    if (loginTab) loginTab.click();
 }
 
 // Event listener para cerrar sesión
 if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
 }
 
 // Event listener para abrir modal de cambio de contraseña
 if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
        if (passwordModal && passwordModalMessage) {
            passwordModal.classList.remove('hidden');
            passwordModalMessage.style.display = 'none';
            if (changePasswordForm) changePasswordForm.reset();
        }
    });
 }
 
 // Event listeners para cerrar modales
 if (closeModalBtns) {
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (passwordModal) passwordModal.classList.add('hidden');
            if (editUserModal) editUserModal.classList.add('hidden');
            if (loginHistoryModal) loginHistoryModal.classList.add('hidden');
        });
    });
 }
 
 // Cerrar modal al hacer clic fuera del contenido
 window.addEventListener('click', (e) => {
    if (passwordModal && e.target === passwordModal) {
        passwordModal.classList.add('hidden');
    }
    if (editUserModal && e.target === editUserModal) {
        editUserModal.classList.add('hidden');
    }
    if (loginHistoryModal && e.target === loginHistoryModal) {
        loginHistoryModal.classList.add('hidden');
    }
 });
 
 // Agregar delegación de eventos para el botón de GPS
 document.addEventListener('click', function(event) {
    // Verificar si el clic fue en el botón GPS o alguno de sus elementos internos
    let target = event.target;
    while (target != null) {
        if (target.id === 'gps-dashboard-btn') {
            console.log('Botón GPS clickeado a través de delegación');
            window.location.href = 'gps.html';
            break;
        }
        target = target.parentElement;
    }
 });
 
 // Verificar si el usuario ya tiene sesión iniciada al cargar la página
 document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que los modales estén ocultos al inicio
    if (editUserModal) editUserModal.classList.add('hidden');
    if (passwordModal) passwordModal.classList.add('hidden');
    if (loginHistoryModal) loginHistoryModal.classList.add('hidden');
    
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