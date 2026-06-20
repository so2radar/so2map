// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ (Leaflet)
// ==========================================
// Создаем карту. Если у тебя были свои настройки CRS или зума — оставь их.
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2
});

let currentMapBounds = [[0, 0], [1000, 1000]]; // Примерные границы карты
let mapImageOverlay = null;

// Функция для смены карты из выпадающего списка
function changeMap(mapName) {
    if (mapImageOverlay) {
        map.removeLayer(mapImageOverlay);
    }
    // Здесь путь к картинкам твоих карт. Убедись, что папка называется правильно.
    const imageUrl = `${mapName}.jpg`; 
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
// Подключаемся к твоему серверу на Render
const socket = io('https://so2-radar.onrender.com');

// Функция для генерации уникального ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ПРИВЯЗКА К ИНТЕРФЕЙСУ (те самые потерянные строчки из консоли)
const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');

// Создаем твой ID и сразу выводим его на экран вместо "Генерация..."
const myId = generateUUID();
if (idDisplay) idDisplay.textContent = myId;

// Кнопка "Подключиться к напарнику"
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            // Меняем статус на зеленый
            statusDisplay.textContent = "Статус: Подключено (WebSocket)";
            statusDisplay.style.color = "#00ffaa";
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Получение координат от напарника с сервера
socket.on('update-location', (data) => {
    const partnerId = "partner_device";
    updateMarker(partnerId, data.lat, data.lng, false);
});

// ==========================================
// 3. ОТПРАВКА И ТЕСТИРОВАНИЕ ДАННЫХ
// ==========================================
// Функция для трансляции своей позиции
function broadcastMyPosition(lat, lng) {
    // Отображаем себя на своей карте
    updateMarker(myId, lat, lng, true);

    // Мгновенно шлём координаты на сервер Render
    socket.emit('send-location', {
        lat: lat,
        lng: lng
    });
}

// ТЕСТОВЫЙ РЕЖИМ КЛИКА: Клик по карте симулирует твое перемещение
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
