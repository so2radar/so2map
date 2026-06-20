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

function changeMap(mapName) {
    if (mapImageOverlay) {
        map.removeLayer(mapImageOverlay);
    }
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
// 2. СЕТЕВАЯ ЛОГИКА (P2P через PEERJS)
// ==========================================
// Подключаемся к надежному публичному серверу PeerJS
const peer = new Peer(); 

let currentConnection = null;

const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');

// Когда облако выдало нам уникальный ID
peer.on('open', (id) => {
    if (idDisplay) idDisplay.textContent = id;
});

// Настройка событий для текущего соединения
function setupConnection(conn) {
    conn.on('open', () => {
        statusDisplay.textContent = "Статус: Подключено (P2P)";
        statusDisplay.style.color = "#00ffaa";
    });

    // Когда получаем данные от напарника
    conn.on('data', (data) => {
        if (data.type === 'location') {
            // Рисуем метку напарника
            updateMarker('partner', data.lat, data.lng, false);
        }
    });
    
    conn.on('close', () => {
        statusDisplay.textContent = "Статус: Отключен";
        statusDisplay.style.color = "#ff4d4d";
    });
}

// Если напарник инициировал подключение к нам
peer.on('connection', (conn) => {
    currentConnection = conn;
    setupConnection(conn);
});

// Если мы нажимаем кнопку "Подключиться"
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            statusDisplay.textContent = "Подключение...";
            statusDisplay.style.color = "#ffaa00";
            
            // Стучимся к напарнику по его ID
            currentConnection = peer.connect(targetId);
            setupConnection(currentConnection);
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// ==========================================
// 3. ОТПРАВКА ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    // Рисуем себя на своей карте
    updateMarker('me', lat, lng, true);

    // Если связь установлена — отправляем координаты пакетным сообщением
    if (currentConnection && currentConnection.open) {
        currentConnection.send({
            type: 'location',
            lat: lat,
            lng: lng
        });
    }
}

// ТЕСТ: Клик по карте имитирует твои шаги в игре
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
