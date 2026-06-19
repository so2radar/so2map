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

// ========================================================
// 2. СЕТЕВАЯ ЛОГИКА P2P (PEERJS)
// ========================================================

const peer = new Peer(undefined, {
    host: 'so2-radar.onrender.com',
    port: 443,
    secure: true,
    path: '/peerjs',
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.yandex.ru:3478' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
});

let currentConnection = null;

const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');

// Когда сервер PeerJS сгенерировал уникальный ID для этого устройства
peer.on('open', (id) => {
    idDisplay.textContent = id;
});

// Слушаем входящие подключения от напарника
peer.on('connection', (conn) => {
    setupConnection(conn);
});

// Логика нажатия на кнопку "Подключиться к напарнику"
connectBtn.addEventListener('click', () => {
    const targetId = targetIdInput.value.trim();
    if (!targetId) return;
   
    statusDisplay.textContent = 'Статус: Подключение...';
    statusDisplay.style.color = '#ffaa00';
   
    const conn = peer.connect(targetId);
    setupConnection(conn);
});

// Централизованная обработка открытого канала данных
function setupConnection(conn) {
    currentConnection = conn;
   
    conn.on('open', () => {
        statusDisplay.textContent = 'Статус: Подключено к напарнику';
        statusDisplay.style.color = '#00ffaa';
    });

    // Прием пакетов с координатами
    conn.on('data', (data) => {
        try {
            // Проверяем, на одной ли мы карте с напарником
            const activeMap = document.getElementById('map-select').value;
            if (data.map === activeMap) {
                updateMarker(data.id, data.lat, data.lng, false);
            }
        } catch (e) {
            console.error("Ошибка обработки пакета координат:", e);
        }
    });

    // Если напарник отключился или закрыл вкладку
    conn.on('close', () => {
        statusDisplay.textContent = 'Статус: Отключен';
        statusDisplay.style.color = '#ff4d4d';
        if (markers[conn.peer]) {
            map.removeLayer(markers[conn.peer]);
            delete markers[conn.peer];
        }
    });
}

// ========================================================
// 3. ОТПРАВКА И ТЕСТИРОВАНИЕ ДАННЫХ
// ========================================================

// Функция для трансляции своей позиции напарнику
function broadcastMyPosition(lat, lng) {
    // Отображаем себя на своей же карте
    updateMarker(peer.id, lat, lng, true);

    // Если сеть установлена — отправляем пакет напарнику
    if (currentConnection && currentConnection.open) {
        const payload = {
            id: peer.id,
            lat: lat,
            lng: lng,
            map: document.getElementById('map-select').value
        };
        currentConnection.send(payload);
    }
}

// ТЕСТОВЫЙ РЕЖИМ КЛИКА: Клик по карте симулирует перемещение персонажа
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
