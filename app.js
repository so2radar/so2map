// ========================================================
// 1. ИНИЦИАЛИЗАЦИЯ ИГРОВОЙ КАРТЫ (LEAFLET)
// ========================================================

// Используем плоскую систему координат (L.CRS.Simple) для игровых осей X/Y
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomControl: true
});

// Границы игровой сетки координат (от [0,0] до [1000,1000])
// В будущем эти значения калибруются под масштабы конкретных карт
const bounds = [[0, 0], [1000, 1000]];
let currentOverlay = null;

// Хранилище активных маркеров на карте (ID -> объект маркера Leaflet)
const markers = {};

// Функция динамической смены фонового изображения карты
function loadMap(mapName) {
    if (currentOverlay) {
        map.removeLayer(currentOverlay);
    }
   
    // Словарь путей ко всему соревновательному пулу (7 карт)
    // Картинки должны лежать в папке maps/ рядом с вашими файлами
    const mapImages = {
        'province': 'maps/province.png',
        'rust': 'maps/rust.png',
        'sand_yards': 'maps/sand_yards.png',
        'zone_9': 'maps/zone_9.png',
        'sakura': 'maps/sakura.png',
        'breeze': 'maps/breeze.png',
        'dune': 'maps/dune.png'
    };

    currentOverlay = L.imageOverlay(mapImages[mapName], bounds).addTo(map);
    map.fitBounds(bounds);
}

// Загружаем дефолтную карту из селектора при старте
loadMap(document.getElementById('map-select').value);

// Отслеживаем переключение карт пользователем
document.getElementById('map-select').addEventListener('change', (e) => {
    loadMap(e.target.value);
    // Очищаем старые маркеры при смене локации, чтобы не путаться
    for (let id in markers) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});

// Функция обновления или создания маркера игрока
function updateMarker(id, lat, lng, isMe = false) {
    if (!markers[id]) {
        // Создаем маркер, если его нет. Для себя можно кастомизировать цвет/иконку в будущем
        markers[id] = L.marker([lat, lng]).addTo(map);
        const nameTag = isMe ? "Я" : `Напарник (${id.substring(0, 4)})`;
        markers[id].bindTooltip(nameTag, { permanent: true, direction: 'top', offset: [0, -10] });
    } else {
        // Если маркер уже есть — плавно меняем его координаты
        markers[id].setLatLng([lat, lng]);
    }
}

// ==========================================
// 2. СЕТЕВАЯ ЛОГИКА (WEBSOCKETS / SOCKET.IO)
// ==========================================
const socket = io('https://so2-radar.onrender.com');

// Генератор красивого UUID-идентификатора взамен PeerJS
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const myId = generateUUID();

// Как только сокет успешно соединился с сервером Render
socket.on('connect', () => {
    idDisplay.textContent = myId;
    // Регистрируем комнату на сервере под нашим ID
    socket.emit('create-room', myId);
});

// Когда напарник подключился к нам (или мы к нему)
socket.on('paired', () => {
    statusDisplay.textContent = "Статус: Подключено к напарнику";
    statusDisplay.style.color = "#00ff88";
});

// Обработка клика по кнопке "Подключиться к напарнику"
connectBtn.addEventListener('click', () => {
    const targetId = targetIdInput.value.trim();
    if (targetId) {
        socket.emit('join-room', targetId);
        statusDisplay.textContent = "Статус: Подключено к напарнику";
        statusDisplay.style.color = "#00ff88";
    }
});

// Получение координат от напарника через сервер
socket.on('update-location', (data) => {
    // Берем твою готовую логику отрисовки маркера
    const partnerId = "partner_device";
    if (!markers[partnerId]) {
        markers[partnerId] = L.marker([data.lat, data.lng]).addTo(map);
        markers[partnerId].bindTooltip("Напарник", { permanent: true, direction: 'top' });
    } else {
        markers[partnerId].setLatLng([data.lat, data.lng]);
    }
});

// ========================================================
// 3. ОТПРАВКА И ТЕСТИРОВАНИЕ ДАННЫХ
// ========================================================

// Функция для трансляции своей позиции напарнику
function broadcastMyPosition(lat, lng) {
    // Отображаем себя на своей карте (используем наш новый UUID-идентификатор)
    updateMarker(myId, lat, lng, true);

    // Мгновенно шлём координаты на сервер Render через веб-сокет
    socket.emit('send-location', { 
        lat: lat, 
        lng: lng 
    });
}

// ТЕСТОВЫЙ РЕЖИМ КЛИКА: Клик по карте симулирует перемещение персонажа
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
