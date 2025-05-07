// Función para mostrar el historial de conexiones de un usuario
async function showLoginHistory(userId, userName, userEmail) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        // Mostrar información del usuario en el modal
        historyUserName.textContent = userName;
        historyUserEmail.textContent = userEmail;
        
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
        loginHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
}

// Función para cargar mi historial de conexiones
async function loadMyLoginHistory() {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!token || !user) {
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
        myLoginList.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
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
    loginHistoryModal.classList.add('hidden');
    
    // Asegurarse de que estamos en la pestaña de usuarios
    usersTab.click();
    
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
            emptyRow.innerHTML = '<td colspan="8" class="text-center">No hay usuarios registrados</td>';
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
                    <td>${user.ip_address || 'N/A'}</td>
                    <td class="action-column">
                        ${currentUser.id === user.id ? 
                            '<span class="current-user-badge">Tú</span>' : 
                            `<button class="btn-edit" data-id="${user.id}">Editar</button>
                             <button class="btn-history" data-id="${user.id}" data-name="${user.nombre} ${user.apellido}" data-email="${user.email}">Historial</button>
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
                    
                    // Botón historial
                    const historyButton = row.querySelector('.btn-history');
                    if (historyButton) {
                        historyButton.addEventListener('click', function() {
                            const userId = this.getAttribute('data-id');
                            const userName = this.getAttribute('data-name');
                            const userEmail = this.getAttribute('data-email');
                            showLoginHistory(userId, userName, userEmail);
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
    loginHistoryModal.classList.add('hidden');
    
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
        loginHistoryModal.classList.add('hidden');
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
    if (e.target === loginHistoryModal) {
        loginHistoryModal.classList.add('hidden');
    }
});

// Agregar botón para ir a GPS
const dashboardHeader = document.querySelector('.header-buttons');
if (dashboardHeader && document.getElementById('gps-dashboard-btn')) {
    document.getElementById('gps-dashboard-btn').addEventListener('click', () => {
        window.location.href = 'gps.html';
    });
}

// Verificar si el usuario ya tiene sesión iniciada al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que los modales estén ocultos al inicio
    editUserModal.classList.add('hidden');
    passwordModal.classList.add('hidden');
    loginHistoryModal.classList.add('hidden');
    
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