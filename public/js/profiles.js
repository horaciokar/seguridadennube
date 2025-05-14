// Configuración de la API
const API_URL = 'https://seguridadenredes.ddns.net/api';

// Referencias a elementos del DOM
const profilesDashboard = document.getElementById('profiles-dashboard');
const profilesMessage = document.getElementById('profiles-message');
const profilesUserName = document.getElementById('profiles-user-name');
const profilesList = document.getElementById('profiles-list');
const logoutBtnProfiles = document.getElementById('logout-btn-profiles');
const roleModal = document.getElementById('role-modal');
const changeRoleForm = document.getElementById('change-role-form');
const roleUserIdInput = document.getElementById('role-user-id');
const userDetailsText = document.getElementById('user-details');
const roleSelect = document.getElementById('role-select');
const roleModalMessage = document.getElementById('role-modal-message');
const closeModalBtns = document.querySelectorAll('.close-modal');

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

// Función para abrir el modal de cambio de rol
function openRoleModal(userId, userName, userEmail, currentRole) {
    if (!roleModal) return;
    
    roleUserIdInput.value = userId;
    userDetailsText.textContent = `${userName} (${userEmail})`;
    roleSelect.value = currentRole;
    
    // Resetear mensajes
    if (roleModalMessage) {
        roleModalMessage.style.display = 'none';
    }
    
    // Mostrar el modal
    roleModal.classList.remove('hidden');
}

// Función para cargar los usuarios y sus roles
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        showMessage(profilesMessage, 'Cargando usuarios...', false);
        
        const response = await fetch(`${API_URL}/users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(e => ({ message: `Error al procesar respuesta: ${e.message}` }));
            console.error('Error de API en loadUsers:', errorData);
            throw new Error(errorData.message || `Error al cargar usuarios: ${response.status}`);
        }
        
        const users = await response.json();
        
        // Limpiar lista actual
        profilesList.innerHTML = '';
        
        // Mostrar usuarios en la tabla
        if (users.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="8" class="text-center">No hay usuarios registrados</td>';
            profilesList.appendChild(emptyRow);
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
                    <td><span class="role-badge ${user.role || 'viewer'}">${user.role || 'viewer'}</span></td>
                    <td>${fechaRegistro}</td>
                    <td>${ultimoAcceso}</td>
                    <td class="action-column">
                        ${currentUser.id === user.id ? 
                            '<span class="current-user-badge">Tú</span>' : 
                            `<button class="btn-edit-role" data-id="${user.id}" data-name="${user.nombre} ${user.apellido}" data-email="${user.email}" data-role="${user.role || 'viewer'}">Cambiar Rol</button>`}
                    </td>
                `;
                
                profilesList.appendChild(row);
                
                // Añadir event listeners a los botones si no es el usuario actual
                if (currentUser.id !== user.id) {
                    // Botón cambiar rol
                    const roleButton = row.querySelector('.btn-edit-role');
                    if (roleButton) {
                        roleButton.addEventListener('click', function() {
                            const userId = this.getAttribute('data-id');
                            const userName = this.getAttribute('data-name');
                            const userEmail = this.getAttribute('data-email');
                            const userRole = this.getAttribute('data-role');
                            openRoleModal(userId, userName, userEmail, userRole);
                        });
                    }
                }
            });
        }
        
        showMessage(profilesMessage, 'Usuarios cargados correctamente', false);
        
    } catch (error) {
        console.error('Error detallado en loadUsers:', error);
        showMessage(profilesMessage, `Error: ${error.message}`, true);
    }
}

// Función para cambiar el rol de un usuario
async function changeUserRole(userId, newRole) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        showMessage(roleModalMessage, 'Actualizando rol...', false);
        
        const response = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(e => ({ message: `Error al procesar respuesta: ${e.message}` }));
            console.error('Error de API en changeUserRole:', errorData);
            throw new Error(errorData.message || `Error al actualizar rol: ${response.status}`);
        }
        
        showMessage(roleModalMessage, 'Rol actualizado correctamente', false);
        
        // Cerrar el modal después de 2 segundos
        setTimeout(() => {
            roleModal.classList.add('hidden');
            // Recargar la lista de usuarios
            loadUsers();
        }, 2000);
        
    } catch (error) {
        console.error('Error detallado en changeUserRole:', error);
        showMessage(roleModalMessage, `Error: ${error.message}`, true);
    }
}

// Verificar si es un administrador al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        console.log('Token usado en la verificación:', token);
        
        // Verificar el rol del usuario
        const response = await fetch(`${API_URL}/users/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(e => ({ message: `Error al procesar respuesta: ${e.message}` }));
            console.error('Error de API en verificación de rol:', errorData);
            console.error('Estado de la respuesta:', response.status);
            console.error('Headers de respuesta:', Object.fromEntries([...response.headers]));
            
            showMessage(profilesMessage, `Error: ${errorData.message || 'No se pudo verificar el rol del usuario'}`, true);
            
            // No redirigir inmediatamente para ver el mensaje
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 5000); // Esperar 5 segundos para poder ver el mensaje de error
            return;
        }
        
        const userData = await response.json();
        console.log('Datos del usuario:', userData);
        
        // Si no es administrador, redirigir al dashboard
        if (userData.role !== 'admin') {
            showMessage(profilesMessage, 'No tienes permisos para acceder a esta sección', true);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Mostrar nombre de usuario
        const userObj = JSON.parse(user);
        profilesUserName.textContent = `${userObj.nombre} ${userObj.apellido}`;
        
        // Cargar usuarios
        loadUsers();
        
    } catch (error) {
        console.error('Error detallado en verificación de rol:', error);
        showMessage(profilesMessage, `Error: ${error.message}`, true);
        
        // No redirigir inmediatamente para ver el mensaje
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 5000);
    }
});

// Event listener para cambiar rol
changeRoleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = roleUserIdInput.value;
    const newRole = roleSelect.value;
    
    if (!userId || !newRole) {
        showMessage(roleModalMessage, 'Error: Faltan datos para cambiar el rol', true);
        return;
    }
    
    await changeUserRole(userId, newRole);
});

// Event listener para cerrar sesión
logoutBtnProfiles.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

// Event listeners para cerrar modales
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        roleModal.classList.add('hidden');
    });
});

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', (e) => {
    if (e.target === roleModal) {
        roleModal.classList.add('hidden');
    }
});