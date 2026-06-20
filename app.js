// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ (Leaflet)
// ==========================================
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2
});

let currentMapBounds = [[0, 0], [1000, 1000]];
let mapImageOverlay = null;

// Функция для смены карты
function changeMap(mapName) {
    if (mapImageOverlay) {
        map.removeLayer(mapImageOverlay);
    }
    // Картинки берутся из папки maps/ в формате .png
    const imageUrl = `maps/${mapName}.png`; 
    mapImageOverlay = L.imageOverlay(imageUrl, currentMapBounds).addTo(map);
    map.fitBounds(currentMapBounds);
}

const mapSelect = document.getElementById('map-select');
if (mapSelect) {
    mapSelect.addEventListener('change', (e) => {
        changeMap(e.target.value);
    });
    changeMap(mapSelect.value);
}

const markers = {};

function updateMarker(id, lat, lng, isMe = false) {
    if (!markers[id]) {
        markers[id] = L.marker([lat, lng]).addTo(map);
        markers[id].bindTooltip(isMe ? "Вы" : "Напарник", { permanent: true, className: "my-label", offset: [0, 0] });
    } else {
        markers[id].setLatLng([lat, lng]);
    }
}

// ==========================================
// 2. СЕТЕВАЯ ЛОГИКА (SOCKET.IO ЧЕРЕЗ RENDER)
// ==========================================
// Подключаемся к твоему серверу
const socket = io('https://so2-radar.onrender.com');

let activePartnerId = null;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');

const myId = generateUUID();
if (idDisplay) idDisplay.textContent = myId;

// Автоматически заходим в свою "комнату" на сервере
socket.on('connect', () => {
    socket.emit('join-room', myId);
});

// Кнопка "Подключиться"
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            activePartnerId = targetId; 
            
            statusDisplay.textContent = "Статус: Подключено (Сервер)";
            statusDisplay.style.color = "#00ffaa";
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Получение координат с сервера
socket.on('update-location', (data) => {
    updateMarker(data.senderId, data.lat, data.lng, false);
});

// ==========================================
// 3. ОТПРАВКА ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    updateMarker(myId, lat, lng, true);

    if (activePartnerId) {
        socket.emit('send-location', {
            room: activePartnerId, 
            senderId: myId,        
            lat: lat,
            lng: lng
        });
    }
}

// Тест: Клик по карте
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
