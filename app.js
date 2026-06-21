// ==========================================
// 1. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
// ==========================================
const idDisplay = document.getElementById('my-id');
const statusDisplay = document.getElementById('connection-status');
const connectBtn = document.getElementById('connect-btn');
const targetIdInput = document.getElementById('target-id');
const mapSelect = document.getElementById('map-select');

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ КАРТЫ И ЗВУКА
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

// --- НОВАЯ ФУНКЦИЯ: ЗВУКОВОЙ ПИНГ ---
function playPingSound() {
    try {
        // Создаем встроенный синтезатор звука
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Настраиваем резкий, короткий звук, похожий на радар
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Высокая частота
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        
        // Настраиваем громкость и затухание
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1); // Звук длится всего 0.1 секунды
    } catch(e) {
        console.log('Звук не поддерживается или заблокирован до первого клика');
    }
}

// ==========================================
// 3. ЛОГИКА МЕТОК (АВТО-УДАЛЕНИЕ И УДАЛЕНИЕ ПО КЛИКУ)
// ==========================================
const markers = {}; 

function addMarker(id, lat, lng, markerUid, isMe = false) {
    if (!markers[id]) {
        markers[id] = [];
    }

    // Если вдруг накопилось 5 (хотя они теперь и так удаляются сами)
    if (markers[id].length >= 5) {
        const oldestMarker = markers[id].shift();
        map.removeLayer(oldestMarker);
    }

    const newMarker = L.marker([lat, lng]).addTo(map);
    newMarker.bindTooltip(isMe ? "Вы" : "Напарник", { permanent: true, className: "my-label", offset: [0, 0] });
    
    newMarker.markerUid = markerUid;
    newMarker.ownerId = id;

    // Ручное удаление (если нужно удалить быстрее, чем за 4 секунды)
    newMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        removeSingleMarker(id, markerUid);
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

    // --- НОВАЯ ФУНКЦИЯ: АВТОМАТИЧЕСКОЕ ИСЧЕЗНОВЕНИЕ ---
    // Ровно через 4000 мс (4 секунды) метка удалится сама
    setTimeout(() => {
        removeSingleMarker(id, markerUid);
    }, 4000);
}

function removeSingleMarker(ownerId, markerUid) {
    if (markers[ownerId]) {
        const index = markers[ownerId].findIndex(m => m.markerUid === markerUid);
        if (index !== -1) {
            map.removeLayer(markers[ownerId][index]); 
            markers[ownerId].splice(index, 1);       
        }
    }
}

// ==========================================
// 4. СЕТЕВАЯ ЛОГИКА Sockets
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
            alert('ID напарника сохранен! Метки будут исчезать через 4 сек.');
            
            // Запускаем пустой звук один раз при подключении, 
            // чтобы браузер дал разрешение на воспроизведение аудио
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtx.resume();
        } else {
            alert('Сначала вставьте ID напарника!');
        }
    });
}

// Прием сетевых пакетов от напарника
socket.on('update-location', (data) => {
    if (data.action === 'delete-marker') {
        removeSingleMarker(data.targetOwnerId, data.targetMarkerUid);
    } else {
        addMarker(data.senderId, data.lat, data.lng, data.markerUid, false);
        
        // --- ПРОИГРЫВАЕМ ЗВУК, КОГДА ПРИШЛА МЕТКА ---
        playPingSound(); 
    }
});

// ==========================================
// 5. ОТПРАВКА ДАННЫХ
// ==========================================
function broadcastMyPosition(lat, lng) {
    const markerUid = generateUUID();
    addMarker(myId, lat, lng, markerUid, true);

    if (activePartnerId) {
        socket.emit('send-location', {
            room: activePartnerId, 
            senderId: myId,        
            lat: lat,
            lng: lng,
            markerUid: markerUid 
        });
    }
}

map.on('click', (e) => {
    broadcastMyPosition(e.latlng.lat, e.latlng.lng);
});
