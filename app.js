// ==========================================
// 1. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
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

// ==========================================
// ЛОГИКА МЕТОК (ДО 5 ШТУК + УДАЛЕНИЕ ПО КЛИКУ)
// ==========================================
const markers = {}; // Хранилище массивов меток для каждого пользователя

function addMarker(id, lat, lng, markerUid, isMe = false) {
    if (!markers[id]) {
        markers[id] = [];
    }

    // Если меток уже 5, удаляем самую старую
    if (markers[id].length >= 5) {
        const oldestMarker = markers[id].shift();
        map.removeLayer(oldestMarker);
    }

    // Создаем новую метку
    const newMarker = L.marker([lat, lng]).addTo(map);
    newMarker.bindTooltip(isMe ? "Вы" : "Напарник", { permanent: true, className: "my-label", offset: [0, 0] });
    
    // Записываем в метку её уникальный ID, чтобы точно знать, какую удалять
    newMarker.markerUid = markerUid;
    newMarker.ownerId = id;

    // Слушатель клика ПО САМОЙ МЕТКЕ для её удаления
    newMarker.on('click', (e) => {
        // Обязательно останавливаем всплытие события, чтобы клик по метке не засчитался как клик по карте!
        L.DomEvent.stopPropagation(e);
        
        // Удаляем метку у себя на экране
        removeSingleMarker(id, markerUid);

        // Отправляем напарнику команду удалить эту же метку у себя
        if (activePartnerId) {
            socket.emit('send-location', {
                room: activePartnerId,
                action: 'delete-marker',
                targetOwnerId: id,
                targetMarkerUid: markerUid
            });
        }
    });

    markers[id].push(newMarker);
}

// Функция для удаления конкретного маркера с карты и из памяти
function removeSingleMarker(ownerId, markerUid) {
    if (markers[ownerId]) {
        // Находим индекс нужного маркера по его UID
        const index = markers[ownerId].findIndex(m => m.markerUid === markerUid);
        if (index !== -1) {
            map.removeLayer(markers[ownerId][index]); // Стираем с карты
            markers[ownerId].splice(index, 1);       // Удаляем из массива
        }
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

if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim();
        if (targetId) {
            activePartnerId = targetId; 
            alert('ID напарника сохранен! Теперь кликайте по карте. Клик по метке удаляет её.');
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Прием сетевых пакетов от сервера
socket.on('update-location', (data) => {
    // Если напарник прислал сигнал об удалении конкретной метки
    if (data.action === 'delete-marker') {
        removeSingleMarker(data.targetOwnerId, data.targetMarkerUid);
    } else {
        // Иначе это обычные координаты новой метки
        addMarker(data.senderId, data.lat, data.lng, data.markerUid, false);
    }
});

// ==========================================
// 4. ОТПРАВКА ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    // Генерируем уникальный ID для конкретно этой создаваемой метки
    const markerUid = generateUUID();

    // Ставим её у себя
    addMarker(myId, lat, lng, markerUid, true);

    // Шлем напарнику
    if (activePartnerId) {
        socket.emit('send-location', {
            room: activePartnerId, 
            senderId: myId,        
            lat: lat,
            lng: lng,
            markerUid: markerUid // Передаем UID, чтобы напарник мог её идентифицировать
        });
    }
}

// Клик по карте ставит новую метку
map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
