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

// Функция для смены карты из выпадающего списка
function changeMap(mapName) {
    if (mapImageOverlay) {
        map.removeLayer(mapImageOverlay);
    }
    // ИСПРАВЛЕНО: Картинки лежат в папке maps/ и имеют расширение .png
    const imageUrl = `maps/${mapName}.png`; 
    mapImageOverlay = L.imageOverlay(imageUrl, currentMapBounds).addTo(map);
    map.fitBounds(currentMapBounds);
}

// Слушатель переключения карт в меню
const mapSelect = document.getElementById('map-select');
if (mapSelect) {
    mapSelect.addEventListener('change', (e) => {
        changeMap(e.target.value);
    });
    // Загружаем стартовую карту
    changeMap(mapSelect.value);
}

const markers = {};

// Функция отображения маркеров на карте
function updateMarker(id, lat, lng, isMe = false) {
    if (!markers[id]) {
        markers[id] = L.marker([lat, lng]).addTo(map);
        markers[id].bindTooltip(isMe ? "Вы" : "Напарник", { permanent: true, className: "my-label", offset: [0, 0] });
    } else {
        markers[id].setLatLng([lat, lng]);
    }
}

// ==========================================
// 2. СЕТЕВАЯ ЛОГИКА (SOCKET.IO)
// ==========================================
const socket = io('https://so2-radar.onrender.com');

// Глобальная переменная, где храним ID напарника, к которому подключились
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

// При подключении к серверу — автоматически заходим в комнату своего же ID,
// чтобы напарник мог слать нам данные по этому идентификатору
socket.on('connect', () => {
    socket.emit('join-room', myId);
});

// Кнопка "Подключиться к напарнику"
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            activePartnerId = targetId; // Запоминаем, кому отправлять координаты
            
            // Меняем статус на зеленый
            statusDisplay.textContent = "Статус: Подключено (WebSocket)";
            statusDisplay.style.color = "#00ffaa";
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Получение координат от напарника с сервера Render
socket.on('update-location', (data) => {
    // Отрисовываем метку напарника, используя его реальный ID
    updateMarker(data.senderId, data.lat, data.lng, false);
});

// ==========================================
// 3. ОТПРАВКА И ТЕСТИРОВАНИЕ ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    // Отображаем себя на своей собственной карте
    updateMarker(myId, lat, lng, true);

    // Шлём координаты, только если ввели ID напарника
    if (activePartnerId) {
        socket.emit('send-location', {
            room: activePartnerId, // Сервер отправит это в комнату напарника
            senderId: myId,        // Чтобы напарник знал, чей это маркер
            lat: lat,
            lng: lng
        });
    }
}

// ТЕСТОВЫЙ РЕЖИМ КЛИКА: Клик по карте симулирует твое перемещение
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
