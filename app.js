// ==========================================
// 1. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА (Исправлено!)
// ==========================================
const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');
const mapSelect = document.getElementById('map-select');

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ==========================================
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2
});

let currentMapBounds = [[0, 0], [1000, 1000]];
let mapImageOverlay = null;

function changeMap(mapName) {
    if (mapImageOverlay) {
        map.removeLayer(mapImageOverlay);
    }
    // Проверенный путь к твоим .png картинкам
    const imageUrl = `maps/${mapName}.png`; 
    mapImageOverlay = L.imageOverlay(imageUrl, currentMapBounds).addTo(map);
    map.fitBounds(currentMapBounds);
}

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
// 3. СЕТЕВАЯ ЛОГИКА Sockets
// ==========================================
const socket = io('https://so2-radar.onrender.com');
let activePartnerId = null;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const myId = generateUUID();
if (idDisplay) idDisplay.textContent = myId;

// Как только открыли сайт — подключаемся к серверу в свою комнату
socket.on('connect', () => {
    socket.emit('join-room', myId);
    if (statusDisplay) {
        statusDisplay.textContent = "Статус: Подключено к серверу";
        statusDisplay.style.color = "#00ffaa";
    }
});

socket.on('disconnect', () => {
    if (statusDisplay) {
        statusDisplay.textContent = "Статус: Ошибка сервера";
        statusDisplay.style.color = "#ff4d4d";
    }
});

// Клик по кнопке "Подключиться"
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            activePartnerId = targetId; 
            alert('ID напарника сохранен! Теперь кликайте по карте.');
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Прием координат от сервера
socket.on('update-location', (data) => {
    // Рисуем маркер напарника по его уникальному ID
    updateMarker(data.senderId, data.lat, data.lng, false);
});

// ==========================================
// 4. ОТПРАВКА ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    // Ставим маркер у себя на экране
    updateMarker(myId, lat, lng, true);

    // Если мы ввели ID напарника — пересылаем ему
    if (activePartnerId) {
        socket.emit('send-location', {
            room: activePartnerId, // В какую комнату шлем (напарнику)
            senderId: myId,        // Кто шлет
            lat: lat,
            lng: lng
        });
    }
}

// Клик по карте для теста
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
