// Configuración de la API
const API_URL = 'https://seguridadenredes.ddns.net/api';

// Referencias a elementos del DOM
const gpsDashboard = document.getElementById('gps-dashboard');
const gpsMessage = document.getElementById('gps-message');
const gpsUserName = document.getElementById('gps-user-name');
const deviceSelect = document.getElementById('device-select');
const dateStart = document.getElementById('date-start');
const dateEnd = document.getElementById('date-end');
const limitSelect = document.getElementById('limit-select');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const mapViewBtn = document.getElementById('map-view-btn');
const tableViewBtn = document.getElementById('table-view-btn');
const mapContainer = document.getElementById('map-container');
const tableContainer = document.getElementById('table-container');
const gpsDataList = document.getElementById('gps-data-list');
const backToUsersBtn = document.getElementById('back-to-users-btn');
const logoutBtnGps = document.getElementById('logout-btn-gps');
const gpsDetailModal = document.getElementById('gps-detail-modal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const deviceInfo = document.getElementById('device-info');
const deviceDetails = document.getElementById('device-details');

// Variables globales
let map = null;
let markers = [];
let paths = [];
let gpsDataCache = [];
let currentDevice = '';
let deviceColors = {};

// Colores para diferentes dispositivos
const colorPalette = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
];

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

// Función para convertir timestamp GPS
function convertGpsTimestamp(timestamp, date) {
  if (!timestamp || !date) return 'N/A';
  
  try {
    // Análisis de fecha: DDMMYY -> YYYY-MM-DD
    const day = Math.floor(date / 10000);
    const month = Math.floor((date % 10000) / 100) - 1; // Meses en JS son 0-11
    const year = 2000 + (date % 100); // Asumimos años 2000+
    
    // Análisis de tiempo: HHMMSS.SS -> HH:MM:SS
    const hour = Math.floor(timestamp / 10000);
    const minute = Math.floor((timestamp % 10000) / 100);
    const second = timestamp % 100;
    
    const dateObj = new Date(year, month, day, hour, minute, second);
    return dateObj.toLocaleString();
  } catch (e) {
    console.error('Error al convertir timestamp GPS:', e);
    return 'N/A';
  }
}

// Función para inicializar el mapa
function initMap() {
  if (map) {
    map.remove();
  }
  
  map = L.map('gps-map').setView([-34.603722, -58.381592], 12); // Default: Buenos Aires
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Agregar controles de zoom
  map.zoomControl.setPosition('bottomright');
}

// Función para cargar los dispositivos
async function loadDevices() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No hay token disponible');
    }
    
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
    
    // Limpiar selector
    deviceSelect.innerHTML = '<option value="">Todos los dispositivos</option>';
    
    // Asignar colores a dispositivos
    devices.forEach((device, index) => {
      const colorIndex = index % colorPalette.length;
      deviceColors[device.device_id] = colorPalette[colorIndex];
      
      const option = document.createElement('option');
      option.value = device.device_id;
      option.textContent = `${device.device_id} (${device.total_records} registros)`;
      deviceSelect.appendChild(option);
    });
    
    return devices;
  } catch (error) {
    console.error('Error:', error);
    showMessage(gpsMessage, error.message, true);
    return [];
  }
}

// Función para cargar datos GPS
async function loadGpsData() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No hay token disponible');
    }
    
    // Construir URL con parámetros
    let url = `${API_URL}/gps?limit=${limitSelect.value}`;
    
    if (deviceSelect.value) {
      url += `&device=${deviceSelect.value}`;
      currentDevice = deviceSelect.value;
    } else {
      currentDevice = '';
    }
    
    if (dateStart.value) {
      url += `&start=${dateStart.value}`;
    }
    
    if (dateEnd.value) {
      url += `&end=${dateEnd.value}`;
    }
    
    showMessage(gpsMessage, 'Cargando datos GPS...', false);
    
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
    
    const data = await response.json();
    
    // Guardar datos en caché
    gpsDataCache = data;
    
    // Mostrar datos
    renderTable(data);
    renderMap(data);
    
    showMessage(gpsMessage, `${data.length} registros GPS cargados.`, false);
    
    return data;
  } catch (error) {
    console.error('Error:', error);
    showMessage(gpsMessage, error.message, true);
    return [];
  }
}

// Función para renderizar datos en la tabla
function renderTable(data) {
  // Limpiar tabla
  gpsDataList.innerHTML = '';
  
  if (data.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="11" class="text-center">No hay datos GPS disponibles</td>';
    gpsDataList.appendChild(emptyRow);
    return;
  }
  
  // Ordenar datos por fecha (más reciente primero)
  data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Agregar filas a la tabla
  data.forEach(point => {
    const row = document.createElement('tr');
    
    // Formatear fecha GPS y batería
    const gpsDateTime = point.gps_timestamp && point.gps_date 
      ? convertGpsTimestamp(point.gps_timestamp, point.gps_date) 
      : formatDate(point.created_at);
    
    const battery = point.battery ? `${point.battery.toFixed(1)}%` : 'N/A';
    
    row.innerHTML = `
      <td>${point.id}</td>
      <td>${point.device_id}</td>
      <td>${point.latitude.toFixed(6)}</td>
      <td>${point.longitude.toFixed(6)}</td>
      <td>${point.altitude ? point.altitude.toFixed(1) : 'N/A'}</td>
      <td>${point.speed ? point.speed.toFixed(1) : 'N/A'}</td>
      <td>${point.satellites || 'N/A'}</td>
      <td>${point.hdop ? point.hdop.toFixed(2) : 'N/A'}</td>
      <td>${battery}</td>
      <td>${gpsDateTime}</td>
      <td>
        <button class="btn-view-map" data-id="${point.id}">Ver en Mapa</button>
      </td>
    `;
    
    gpsDataList.appendChild(row);
    
    // Agregar event listener al botón
    const viewButton = row.querySelector('.btn-view-map');
    viewButton.addEventListener('click', () => {
      showPointDetail(point);
    });
  });
}

// Función para mostrar detalles de un punto
function showPointDetail(point) {
  const pointDetailMap = document.getElementById('point-detail-map');
  const pointDetails = document.getElementById('point-details');
  
  // Crear o reinicializar el mapa de detalle
  if (window.detailMap) {
    window.detailMap.remove();
  }
  
  window.detailMap = L.map('point-detail-map').setView([point.latitude, point.longitude], 16);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(window.detailMap);
  
  // Agregar marcador
  L.marker([point.latitude, point.longitude]).addTo(window.detailMap);
  
  // Llenar detalles
  const gpsDateTime = point.gps_timestamp && point.gps_date 
    ? convertGpsTimestamp(point.gps_timestamp, point.gps_date) 
    : formatDate(point.created_at);
  
  const battery = point.battery ? `${point.battery.toFixed(1)}%` : 'N/A';
  
  pointDetails.innerHTML = `
    <p><strong>ID:</strong> ${point.id}</p>
    <p><strong>Dispositivo:</strong> ${point.device_id}</p>
    <p><strong>Latitud:</strong> ${point.latitude.toFixed(6)}</p>
    <p><strong>Longitud:</strong> ${point.longitude.toFixed(6)}</p>
    <p><strong>Altitud:</strong> ${point.altitude ? point.altitude.toFixed(1) + ' m' : 'N/A'}</p>
    <p><strong>Velocidad:</strong> ${point.speed ? point.speed.toFixed(1) + ' km/h' : 'N/A'}</p>
    <p><strong>Satélites:</strong> ${point.satellites || 'N/A'}</p>
    <p><strong>Precisión:</strong> ${point.hdop ? point.hdop.toFixed(2) : 'N/A'}</p>
    <p><strong>Batería:</strong> ${battery}</p>
    <p><strong>Fecha y Hora:</strong> ${gpsDateTime}</p>
    <p><strong>Registro:</strong> ${formatDate(point.created_at)}</p>
  `;
  
  // Mostrar modal
  gpsDetailModal.classList.remove('hidden');
}

// Función para renderizar datos en el mapa
function renderMap(data) {
  if (!map) {
    initMap();
  }
  
  // Limpiar marcadores y rutas existentes
  markers.forEach(marker => marker.remove());
  paths.forEach(path => path.remove());
  markers = [];
  paths = [];
  
  if (data.length === 0) {
    return;
  }
  
  // Agrupar datos por dispositivo
  const deviceGroups = {};
  
  data.forEach(point => {
    if (!deviceGroups[point.device_id]) {
      deviceGroups[point.device_id] = [];
    }
    deviceGroups[point.device_id].push(point);
  });
  
  // Para cada dispositivo, ordenar y crear ruta y marcadores
  Object.keys(deviceGroups).forEach(deviceId => {
    const deviceData = deviceGroups[deviceId];
    const deviceColor = deviceColors[deviceId] || '#3388ff';
    
    // Ordenar puntos por tiempo
    deviceData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Crear array de coordenadas para la ruta
    const routePoints = deviceData.map(point => [point.latitude, point.longitude]);
    
    // Crear línea para la ruta
    if (routePoints.length > 1) {
      const polyline = L.polyline(routePoints, {
        color: deviceColor,
        weight: 3,
        opacity: 0.7,
        className: 'device-path'
      }).addTo(map);
      
      paths.push(polyline);
    }
    
    // Crear marcadores para cada punto
    deviceData.forEach((point, index) => {
      const isLatest = index === deviceData.length - 1;
      
      // Personalizar marcador
      const deviceIcon = L.divIcon({
        className: 'device-marker',
        html: `
          <div class="device-icon ${isLatest ? 'latest-point' : ''}" style="background-color: ${deviceColor};">
            ${isLatest ? '<i>⚡</i>' : (index + 1)}
          </div>
          ${isLatest ? `<div class="device-label">${deviceId}</div>` : ''}
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      const marker = L.marker([point.latitude, point.longitude], { icon: deviceIcon }).addTo(map);
      
      // Agregar popup con información
      const gpsDateTime = point.gps_timestamp && point.gps_date 
        ? convertGpsTimestamp(point.gps_timestamp, point.gps_date) 
        : formatDate(point.created_at);
      
      marker.bindPopup(`
        <strong>${deviceId}</strong><br>
        Lat: ${point.latitude.toFixed(6)}<br>
        Lon: ${point.longitude.toFixed(6)}<br>
        ${point.speed ? 'Velocidad: ' + point.speed.toFixed(1) + ' km/h<br>' : ''}
        ${point.battery ? 'Batería: ' + point.battery.toFixed(1) + '%<br>' : ''}
        Fecha: ${gpsDateTime}<br>
        <button class="btn-view-details" data-id="${point.id}">Ver Detalles</button>
      `);
      
      // Agregar event listener al botón del popup
      marker.on('popupopen', function() {
        document.querySelector(`.btn-view-details[data-id="${point.id}"]`).addEventListener('click', function() {
          showPointDetail(point);
        });
      });
      
      markers.push(marker);
    });
  });
  
  // Ajustar vista a todos los puntos
  if (markers.length > 0) {
    const group = new L.featureGroup(markers);
    map.fitBounds(group.getBounds());
    
    // Mostrar información del último punto del dispositivo actualmente seleccionado
    updateDeviceInfo();
  }
}

// Función para actualizar la información del dispositivo
function updateDeviceInfo() {
  if (!currentDevice || !deviceSelect.value) {
    deviceInfo.classList.add('hidden');
    return;
  }
  
  const deviceData = gpsDataCache.filter(point => point.device_id === currentDevice);
  
  if (deviceData.length === 0) {
    deviceInfo.classList.add('hidden');
    return;
  }
  
  // Ordenar por fecha (más reciente primero)
  deviceData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Obtener el último punto
  const latestPoint = deviceData[0];
  
  // Calcular tiempo transcurrido
  const timeDiff = Math.floor((new Date() - new Date(latestPoint.created_at)) / 1000 / 60); // en minutos
  let timeAgo;
  
  if (timeDiff < 60) {
    timeAgo = `${timeDiff} minutos`;
  } else if (timeDiff < 1440) {
    timeAgo = `${Math.floor(timeDiff / 60)} horas`;
  } else {
    timeAgo = `${Math.floor(timeDiff / 1440)} días`;
  }
  
  // Mostrar información
  deviceDetails.innerHTML = `
    <p><strong>Último reporte:</strong> ${formatDate(latestPoint.created_at)} (hace ${timeAgo})</p>
    <p><strong>Coordenadas:</strong> ${latestPoint.latitude.toFixed(6)}, ${latestPoint.longitude.toFixed(6)}</p>
    <p><strong>Velocidad:</strong> ${latestPoint.speed ? latestPoint.speed.toFixed(1) + ' km/h' : 'N/A'}</p>
    <p><strong>Batería:</strong> ${latestPoint.battery ? latestPoint.battery.toFixed(1) + '%' : 'N/A'}</p>
    <p><strong>Altitud:</strong> ${latestPoint.altitude ? latestPoint.altitude.toFixed(1) + ' m' : 'N/A'}</p>
    <p><strong>Precisión:</strong> ${latestPoint.hdop ? 'HDOP ' + latestPoint.hdop.toFixed(2) : 'N/A'}</p>
    <p><strong>Satélites:</strong> ${latestPoint.satellites || 'N/A'}</p>
    <button class="btn-view-all">Ver todos los puntos</button>
  `;
  
  // Event listener para el botón
  deviceDetails.querySelector('.btn-view-all').addEventListener('click', () => {
    showAllPointsForDevice(currentDevice);
  });
  
  deviceInfo.classList.remove('hidden');
}

// Función para mostrar todos los puntos de un dispositivo
function showAllPointsForDevice(deviceId) {
  deviceSelect.value = deviceId;
  loadGpsData();
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'index.html';
    return;
  }
  
  // Mostrar nombre de usuario
  const userData = JSON.parse(user);
  gpsUserName.textContent = `${userData.nombre} ${userData.apellido}`;
  
  // Inicializar mapa
  initMap();
  
  // Cargar dispositivos
  await loadDevices();
  
  // Cargar datos iniciales
  await loadGpsData();
  
  // Establecer fecha actual en filtro fin
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  dateEnd.value = formattedDate;
  
  // Establecer fecha inicial (1 semana atrás)
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  dateStart.value = lastWeek.toISOString().split('T')[0];
});

// Event listener para botón de filtros
applyFiltersBtn.addEventListener('click', () => {
  loadGpsData();
});

// Event listeners para cambiar entre vistas
mapViewBtn.addEventListener('click', () => {
  mapViewBtn.classList.add('active');
  tableViewBtn.classList.remove('active');
  mapContainer.classList.remove('hidden');
  tableContainer.classList.add('hidden');
  
  // Re-renderizar mapa
  renderMap(gpsDataCache);
});

tableViewBtn.addEventListener('click', () => {
  tableViewBtn.classList.add('active');
  mapViewBtn.classList.remove('active');
  tableContainer.classList.remove('hidden');
  mapContainer.classList.add('hidden');
});

// Event listener para volver al panel de usuarios
backToUsersBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Event listener para cerrar sesión
logoutBtnGps.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});

// Event listeners para cerrar modales
closeModalBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    gpsDetailModal.classList.add('hidden');
  });
});

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener('click', (e) => {
  if (e.target === gpsDetailModal) {
    gpsDetailModal.classList.add('hidden');
  }
});

// Event listener para cambios en el selector de dispositivo
deviceSelect.addEventListener('change', () => {
  currentDevice = deviceSelect.value;
  updateDeviceInfo();
});

// Actualizar cada minuto para mantener la información "hace X minutos" actualizada
setInterval(updateDeviceInfo, 60000);