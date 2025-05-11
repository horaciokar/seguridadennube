// Configuración de la API
const API_URL = 'https://seguridadenredes.ddns.net/api';

// Referencias a elementos del DOM
let map;
let currentMarkers = [];
let selectedDevice = null;
let deviceLocations = {};
let trackedDevices = {};
let devicePathPolylines = {};
let isTracking = false;
let updateTimer = null;
let deviceRefreshTimer = null;
let updateInterval = 10000; // 10 segundos por defecto

// Función para inicializar la página
document.addEventListener('DOMContentLoaded', () => {
    // Verificar la sesión
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        // Redirigir a la página de inicio de sesión si no hay sesión
        window.location.href = 'index.html';
        return;
    }
    
    // Inicializar el mapa
    initMap();
    
    // Configurar controles y eventos de la página
    setupControls();
    
    // Cargar lista de dispositivos
    loadDevices();
    
    // Iniciar actualización automática
    startAutoUpdate();
});

// Función para inicializar el mapa
function initMap() {
    try {
        // Coordenadas iniciales (Medellín, Colombia)
        const initialLat = 6.244203;
        const initialLng = -75.581215;
        
        // Crear el mapa
        map = L.map('map').setView([initialLat, initialLng], 13);
        
        // Añadir capa de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        console.log('Mapa inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar el mapa:', error);
        showMessage(document.getElementById('map-message'), 'Error al inicializar el mapa: ' + error.message, true);
    }
}

// Configurar controles y eventos
function setupControls() {
    // Botón de actualizar
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshData();
        });
    }
    
    // Selector de dispositivos
    const deviceSelect = document.getElementById('device-select');
    if (deviceSelect) {
        deviceSelect.addEventListener('change', function() {
            selectedDevice = this.value !== 'all' ? this.value : null;
            refreshData();
        });
    }
    
    // Botón de seguimiento
    const trackBtn = document.getElementById('track-btn');
    if (trackBtn) {
        trackBtn.addEventListener('click', () => {
            toggleTracking();
        });
    }
    
    // Selector de intervalo
    const intervalSelect = document.getElementById('interval-select');
    if (intervalSelect) {
        intervalSelect.addEventListener('change', function() {
            updateInterval = parseInt(this.value);
            if (isTracking) {
                stopAutoUpdate();
                startAutoUpdate();
            }
        });
    }
    
    // Botón de volver al panel principal
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Botón de cerrar sesión
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
    
    // Botón de configuración de SDR
    const sdrSettingsBtn = document.getElementById('sdr-settings-btn');
    if (sdrSettingsBtn) {
        sdrSettingsBtn.addEventListener('click', () => {
            openSdrSettingsModal();
        });
    }
    
    // Formulario de configuración SDR
    const sdrSettingsForm = document.getElementById('sdr-settings-form');
    if (sdrSettingsForm) {
        sdrSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSdrSettings();
        });
    }
    
    // Botones para cerrar modales
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// Función para cargar la lista de dispositivos
async function loadDevices() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        const deviceSelect = document.getElementById('device-select');
        const deviceList = document.getElementById('device-list');
        
        if (!deviceSelect || !deviceList) {
            throw new Error('Elementos del DOM no encontrados');
        }
        
        showMessage(document.getElementById('sdr-message'), 'Cargando dispositivos...', false);
        
        const response = await fetch(`${API_URL}/gps/devices`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar dispositivos: ${response.status}`);
        }
        
        const devices = await response.json();
        
        // Limpiar selector y lista
        deviceSelect.innerHTML = '<option value="all">Todos los dispositivos</option>';
        deviceList.innerHTML = '';
        
        // Actualizar UI con los dispositivos
        if (devices.length === 0) {
            deviceList.innerHTML = '<div class="no-devices">No hay dispositivos registrados</div>';
        } else {
            devices.forEach(device => {
                // Añadir al selector
                const option = document.createElement('option');
                option.value = device.device_id;
                option.textContent = `${device.device_id} (${device.total_records} registros)`;
                deviceSelect.appendChild(option);
                
                // Añadir a la lista
                const deviceItem = document.createElement('div');
                deviceItem.className = 'device-item';
                deviceItem.innerHTML = `
                    <div class="device-name">${device.device_id}</div>
                    <div class="device-status">
                        <span class="status-dot ${isDeviceActive(device.last_record) ? 'active' : 'inactive'}"></span>
                        ${isDeviceActive(device.last_record) ? 'Activo' : 'Inactivo'}
                    </div>
                    <div class="device-stats">
                        <div>Registros: ${device.total_records}</div>
                        <div>Último reporte: ${formatDate(device.last_record)}</div>
                    </div>
                    <div class="device-actions">
                        <button class="btn-track" data-id="${device.device_id}">
                            ${trackedDevices[device.device_id] ? 'Dejar de seguir' : 'Seguir'}
                        </button>
                        <button class="btn-center" data-id="${device.device_id}">Centrar</button>
                        <button class="btn-history" data-id="${device.device_id}">Historial</button>
                    </div>
                `;
                deviceList.appendChild(deviceItem);
                
                // Event listeners para los botones
                const trackBtn = deviceItem.querySelector('.btn-track');
                if (trackBtn) {
                    trackBtn.addEventListener('click', function() {
                        const deviceId = this.getAttribute('data-id');
                        toggleDeviceTracking(deviceId);
                        this.textContent = trackedDevices[deviceId] ? 'Dejar de seguir' : 'Seguir';
                    });
                }
                
                const centerBtn = deviceItem.querySelector('.btn-center');
                if (centerBtn) {
                    centerBtn.addEventListener('click', function() {
                        const deviceId = this.getAttribute('data-id');
                        centerOnDevice(deviceId);
                    });
                }
                
                const historyBtn = deviceItem.querySelector('.btn-history');
                if (historyBtn) {
                    historyBtn.addEventListener('click', function() {
                        const deviceId = this.getAttribute('data-id');
                        showDeviceHistory(deviceId);
                    });
                }
            });
        }
        
        showMessage(document.getElementById('sdr-message'), 'Dispositivos cargados correctamente', false);
        
        // Cargar la información más reciente de los dispositivos
        await loadLatestDeviceData();
        
    } catch (error) {
        console.error('Error:', error);
        showMessage(document.getElementById('sdr-message'), `Error: ${error.message}`, true);
    }
}

// Cargar los datos más recientes de los dispositivos
async function loadLatestDeviceData() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        const response = await fetch(`${API_URL}/gps/latest`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar datos recientes: ${response.status}`);
        }
        
        const latestData = await response.json();
        
        // Limpiar marcadores actuales
        clearMarkers();
        
        // Añadir los nuevos marcadores
        latestData.forEach(device => {
            addDeviceMarker(device);
        });
        
        // Actualizar información de la interfaz
        updateDeviceInfo(latestData);
        
    } catch (error) {
        console.error('Error:', error);
        showMessage(document.getElementById('sdr-message'), `Error: ${error.message}`, true);
    }
}

// Función para cargar los datos GPS
async function loadGpsData() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        // Construir URL con filtros
        let url = `${API_URL}/gps?limit=500`;
        
        if (selectedDevice) {
            url += `&device=${selectedDevice}`;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar datos GPS: ${response.status}`);
        }
        
        const gpsData = await response.json();
        
        // Si solo estamos mostrando un dispositivo, actualizar su historial
        if (selectedDevice) {
            displayDevicePath(selectedDevice, gpsData);
        } else {
            // Mostrar solo el último punto para cada dispositivo
            const deviceGroups = groupByDevice(gpsData);
            Object.keys(deviceGroups).forEach(deviceId => {
                // Ordenar por fecha, más reciente primero
                const sortedData = deviceGroups[deviceId].sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
                
                // Mostrar solo el punto más reciente si no estamos siguiendo este dispositivo
                if (!trackedDevices[deviceId]) {
                    addDeviceMarker(sortedData[0]);
                } else {
                    // Si estamos siguiendo este dispositivo, mostrar su camino
                    displayDevicePath(deviceId, sortedData);
                }
            });
        }
        
        // Actualizar tabla de datos si existe
        updateGpsDataTable(gpsData);
        
    } catch (error) {
        console.error('Error:', error);
        showMessage(document.getElementById('sdr-message'), `Error: ${error.message}`, true);
    }
}

// Agrupar datos por dispositivo
function groupByDevice(data) {
    return data.reduce((groups, item) => {
        const key = item.device_id;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

// Añadir marcador para un dispositivo
function addDeviceMarker(device) {
    if (!device || !device.latitude || !device.longitude) return;
    
    const lat = parseFloat(device.latitude);
    const lng = parseFloat(device.longitude);
    
    if (isNaN(lat) || isNaN(lng)) return;
    
    // Guardar la ubicación para referencias futuras
    deviceLocations[device.device_id] = { lat, lng };
    
    // Crear un icono personalizado
    const deviceIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-content">
                <div class="marker-icon ${isDeviceActive(device.created_at) ? 'active' : 'inactive'}"></div>
                <div class="marker-label">${device.device_id}</div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
    
    // Crear el marcador
    const marker = L.marker([lat, lng], {
        icon: deviceIcon,
        title: device.device_id
    }).addTo(map);
    
    // Información adicional al hacer clic en el marcador
    const popupContent = `
        <div class="marker-popup">
            <h3>${device.device_id}</h3>
            <p><strong>Última actualización:</strong> ${formatDate(device.created_at)}</p>
            <p><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            ${device.altitude ? `<p><strong>Altitud:</strong> ${device.altitude.toFixed(1)} m</p>` : ''}
            ${device.speed ? `<p><strong>Velocidad:</strong> ${(device.speed * 3.6).toFixed(1)} km/h</p>` : ''}
            ${device.battery ? `<p><strong>Batería:</strong> ${device.battery.toFixed(1)}%</p>` : ''}
            ${device.satellites ? `<p><strong>Satélites:</strong> ${device.satellites}</p>` : ''}
            <div class="popup-actions">
                <button class="popup-btn" onclick="centerOnDevice('${device.device_id}')">Centrar</button>
                <button class="popup-btn" onclick="toggleDeviceTracking('${device.device_id}')">
                    ${trackedDevices[device.device_id] ? 'Dejar de seguir' : 'Seguir'}
                </button>
                <button class="popup-btn" onclick="showDeviceHistory('${device.device_id}')">Historial</button>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Añadir a la lista de marcadores actuales
    currentMarkers.push(marker);
}

// Mostrar el camino de un dispositivo
function displayDevicePath(deviceId, data) {
    // Eliminar el camino anterior si existe
    if (devicePathPolylines[deviceId]) {
        map.removeLayer(devicePathPolylines[deviceId]);
    }
    
    // Ordenar datos por fecha (más antiguo primero para el camino)
    const sortedData = [...data].sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
    );
    
    // Crear un array de coordenadas para la polilínea
    const pathCoords = sortedData.map(point => [
        parseFloat(point.latitude),
        parseFloat(point.longitude)
    ]);
    
    // Validar que hay al menos dos puntos para la polilínea
    if (pathCoords.length >= 2) {
        // Crear la polilínea
        const polyline = L.polyline(pathCoords, {
            color: getDeviceColor(deviceId),
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1
        }).addTo(map);
        
        // Guardar referencia a la polilínea
        devicePathPolylines[deviceId] = polyline;
    }
    
    // Añadir marcador para el punto más reciente
    if (sortedData.length > 0) {
        addDeviceMarker(sortedData[sortedData.length - 1]);
    }
}

// Obtener un color para un dispositivo
function getDeviceColor(deviceId) {
    // Generar un color basado en el hash del ID del dispositivo
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
        hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// Actualizar tabla de datos GPS
function updateGpsDataTable(data) {
    const dataTable = document.getElementById('gps-data-table');
    const tableBody = document.getElementById('gps-data-body');
    
    if (!dataTable || !tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Mostrar los datos más recientes primero
    const sortedData = [...data].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Llenar la tabla
    sortedData.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.device_id}</td>
            <td>${formatDate(record.created_at)}</td>
            <td>${parseFloat(record.latitude).toFixed(6)}</td>
            <td>${parseFloat(record.longitude).toFixed(6)}</td>
            <td>${record.altitude ? parseFloat(record.altitude).toFixed(1) + ' m' : 'N/A'}</td>
            <td>${record.speed ? (parseFloat(record.speed) * 3.6).toFixed(1) + ' km/h' : 'N/A'}</td>
            <td>${record.satellites || 'N/A'}</td>
            <td>${record.battery ? parseFloat(record.battery).toFixed(1) + '%' : 'N/A'}</td>
            <td>
                <button class="btn-center-small" onclick="centerOnCoordinates(${record.latitude}, ${record.longitude})">
                    <i class="fas fa-crosshairs"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Mostrar u ocultar la tabla según si hay datos
    if (sortedData.length > 0) {
        dataTable.classList.remove('hidden');
    } else {
        dataTable.classList.add('hidden');
    }
}

// Actualizar información de dispositivos en la interfaz
function updateDeviceInfo(latestData) {
    const deviceStats = document.getElementById('device-stats');
    
    if (!deviceStats) return;
    
    // Calcular estadísticas
    const totalDevices = latestData.length;
    const activeDevices = latestData.filter(device => 
        isDeviceActive(device.created_at)
    ).length;
    
    // Actualizar el panel de estadísticas
    deviceStats.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${totalDevices}</div>
            <div class="stat-label">Dispositivos</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${activeDevices}</div>
            <div class="stat-label">Activos</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${totalDevices - activeDevices}</div>
            <div class="stat-label">Inactivos</div>
        </div>
    `;
    
    // Actualizar botones de seguimiento en la lista de dispositivos
    document.querySelectorAll('.btn-track').forEach(btn => {
        const deviceId = btn.getAttribute('data-id');
        btn.textContent = trackedDevices[deviceId] ? 'Dejar de seguir' : 'Seguir';
    });
}

// Mostrar historial de un dispositivo
async function showDeviceHistory(deviceId) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No hay token disponible');
        }
        
        // Mostrar modal de historial
        const historyModal = document.getElementById('history-modal');
        const historyTitle = document.getElementById('history-title');
        const historyBody = document.getElementById('history-body');
        
        if (!historyModal || !historyTitle || !historyBody) {
            throw new Error('Elementos del modal no encontrados');
        }
        
        // Actualizar título
        historyTitle.textContent = `Historial de ${deviceId}`;
        
        // Mostrar mensaje de carga
        historyBody.innerHTML = '<div class="loading">Cargando historial...</div>';
        historyModal.classList.remove('hidden');
        
        // Cargar datos
        const url = `${API_URL}/gps?device=${deviceId}&limit=100`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error al cargar historial: ${response.status}`);
        }
        
        const historyData = await response.json();
        
        // Mostrar los datos
        if (historyData.length === 0) {
            historyBody.innerHTML = '<div class="no-data">No hay registros para este dispositivo</div>';
        } else {
            // Ordenar por fecha, más reciente primero
            const sortedData = historyData.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            );
            
            // Crear tabla de historial
            const table = document.createElement('table');
            table.className = 'history-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Fecha y Hora</th>
                        <th>Latitud</th>
                        <th>Longitud</th>
                        <th>Altitud</th>
                        <th>Velocidad</th>
                        <th>Batería</th>
                        <th>Satélites</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            
            const tbody = table.querySelector('tbody');
            
            sortedData.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDate(record.created_at)}</td>
                    <td>${parseFloat(record.latitude).toFixed(6)}</td>
                    <td>${parseFloat(record.longitude).toFixed(6)}</td>
                    <td>${record.altitude ? parseFloat(record.altitude).toFixed(1) + ' m' : 'N/A'}</td>
                    <td>${record.speed ? (parseFloat(record.speed) * 3.6).toFixed(1) + ' km/h' : 'N/A'}</td>
                    <td>${record.battery ? parseFloat(record.battery).toFixed(1) + '%' : 'N/A'}</td>
                    <td>${record.satellites || 'N/A'}</td>
                    <td>
                        <button class="btn-center-small" onclick="centerOnCoordinates(${record.latitude}, ${record.longitude})">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Añadir botón para mostrar el camino
            const mapBtn = document.createElement('button');
            mapBtn.className = 'btn btn-primary';
            mapBtn.textContent = 'Mostrar en el Mapa';
            mapBtn.addEventListener('click', () => {
                // Centrar en dispositivo
                centerOnDevice(deviceId);
                
                // Mostrar camino
                displayDevicePath(deviceId, historyData);
                
                // Cerrar modal
                historyModal.classList.add('hidden');
            });
            
            // Limpiar y añadir el contenido
            historyBody.innerHTML = '';
            historyBody.appendChild(table);
            historyBody.appendChild(mapBtn);
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        const historyBody = document.getElementById('history-body');
        if (historyBody) {
            historyBody.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        }
    }
}

// Centrar mapa en un dispositivo
function centerOnDevice(deviceId) {
    const location = deviceLocations[deviceId];
    if (location) {
        centerOnCoordinates(location.lat, location.lng);
    } else {
        showMessage(document.getElementById('sdr-message'), 'No se encontró ubicación para este dispositivo', true);
    }
}

// Centrar mapa en coordenadas
function centerOnCoordinates(lat, lng) {
    if (!map) return;
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) return;
    
    map.setView([latitude, longitude], 15);
}

// Alternar seguimiento de dispositivo
function toggleDeviceTracking(deviceId) {
    trackedDevices[deviceId] = !trackedDevices[deviceId];
    
    // Actualizar botones
    document.querySelectorAll(`.btn-track[data-id="${deviceId}"]`).forEach(btn => {
        btn.textContent = trackedDevices[deviceId] ? 'Dejar de seguir' : 'Seguir';
    });
    
    // Actualizar datos para mostrar camino si ahora se está siguiendo
    if (trackedDevices[deviceId]) {
        const loadDeviceData = async () => {
            try {
                const token = localStorage.getItem('token');
                
                if (!token) {
                    throw new Error('No hay token disponible');
                }
                
                const url = `${API_URL}/gps?device=${deviceId}&limit=100`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Error al cargar datos: ${response.status}`);
                }
                
                const deviceData = await response.json();
                
                // Mostrar camino
                displayDevicePath(deviceId, deviceData);
                
                // Centrar en dispositivo
                centerOnDevice(deviceId);
                
            } catch (error) {
                console.error('Error:', error);
                showMessage(document.getElementById('sdr-message'), `Error: ${error.message}`, true);
            }
        };
        
        loadDeviceData();
    } else {
        // Si se deja de seguir, eliminar el camino
        if (devicePathPolylines[deviceId]) {
            map.removeLayer(devicePathPolylines[deviceId]);
            delete devicePathPolylines[deviceId];
        }
        
        // Recargar datos para mostrar solo marcadores actuales
        refreshData();
    }
}

// Alternar modo de seguimiento automático
function toggleTracking() {
    isTracking = !isTracking;
    
    const trackBtn = document.getElementById('track-btn');
    if (trackBtn) {
        trackBtn.textContent = isTracking ? 'Detener Seguimiento' : 'Iniciar Seguimiento';
        trackBtn.classList.toggle('active', isTracking);
    }
    
    if (isTracking) {
        startAutoUpdate();
    } else {
        stopAutoUpdate();
    }
}

// Iniciar actualización automática
function startAutoUpdate() {
    stopAutoUpdate(); // Detener cualquier timer existente
    
    // Actualizar datos inmediatamente
    refreshData();
    
    // Configurar actualizaciones periódicas
    updateTimer = setInterval(() => {
        refreshData();
    }, updateInterval);
    
    // Actualizar lista de dispositivos cada 2 minutos
    deviceRefreshTimer = setInterval(() => {
        loadDevices();
    }, 120000);
}

// Detener actualización automática
function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
    
    if (deviceRefreshTimer) {
        clearInterval(deviceRefreshTimer);
        deviceRefreshTimer = null;
    }
}

// Refrescar datos
function refreshData() {
    loadGpsData();
}

// Limpiar marcadores del mapa
function clearMarkers() {
    currentMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    
    currentMarkers = [];
}

// Verificar si un dispositivo está activo (reportó en las últimas 24 horas)
function isDeviceActive(timestamp) {
    if (!timestamp) return false;
    
    const lastReport = new Date(timestamp);
    const now = new Date();
    const hoursDiff = (now - lastReport) / (1000 * 60 * 60);
    
    return hoursDiff <= 24;
}

// Formatear fecha en formato legible
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

// Mostrar mensaje en la interfaz
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

// Abrir modal de configuración de SDR
function openSdrSettingsModal() {
    const sdrSettingsModal = document.getElementById('sdr-settings-modal');
    if (!sdrSettingsModal) return;
    
    // Cargar configuración actual
    const serverUrlInput = document.getElementById('sdr-server-url');
    const serverPortInput = document.getElementById('sdr-server-port');
    const apiKeyInput = document.getElementById('sdr-api-key');
    
    // Intentar cargar la configuración guardada
    const sdrConfig = JSON.parse(localStorage.getItem('sdrConfig') || '{}');
    
    if (serverUrlInput) serverUrlInput.value = sdrConfig.serverUrl || '';
    if (serverPortInput) serverPortInput.value = sdrConfig.serverPort || '';
    if (apiKeyInput) apiKeyInput.value = sdrConfig.apiKey || '';
    
    // Mostrar el modal
    sdrSettingsModal.classList.remove('hidden');
}

// Guardar configuración de SDR
function saveSdrSettings() {
    const serverUrlInput = document.getElementById('sdr-server-url');
    const serverPortInput = document.getElementById('sdr-server-port');
    const apiKeyInput = document.getElementById('sdr-api-key');
    
    if (!serverUrlInput || !serverPortInput || !apiKeyInput) return;
    
    const serverUrl = serverUrlInput.value.trim();
    const serverPort = serverPortInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    // Validar URL
    if (!serverUrl) {
        showMessage(document.getElementById('sdr-settings-message'), 'La URL del servidor es obligatoria', true);
        return;
    }
    
    // Guardar configuración
    const sdrConfig = {
        serverUrl,
        serverPort,
        apiKey
    };
    
    localStorage.setItem('sdrConfig', JSON.stringify(sdrConfig));
    
    // Mostrar mensaje de éxito
    showMessage(document.getElementById('sdr-settings-message'), 'Configuración guardada correctamente', false);
    
    // Cerrar modal después de 2 segundos
    setTimeout(() => {
        const sdrSettingsModal = document.getElementById('sdr-settings-modal');
        if (sdrSettingsModal) sdrSettingsModal.classList.add('hidden');
    }, 2000);
}

// Cerrar sesión
function logout() {
    // Detener actualizaciones
    stopAutoUpdate();
    
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirigir a la página de inicio de sesión
    window.location.href = 'index.html';
}

// Exponer funciones globalmente para uso en eventos inline
window.centerOnDevice = centerOnDevice;
window.centerOnCoordinates = centerOnCoordinates;
window.toggleDeviceTracking = toggleDeviceTracking;
window.showDeviceHistory = showDeviceHistory;
window.openSdrSettingsModal = openSdrSettingsModal;
window.saveSdrSettings = saveSdrSettings;