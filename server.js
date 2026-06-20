const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Настройка CORS, чтобы GitHub Pages мог подключаться без блокировок
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Вход в личную комнату по ID
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Пользователь вошел в комнату: ${roomId}`);
    });

    // Пересылка координат конкретному напарнику
    socket.on('send-location', (data) => {
        // data содержит: { room: 'ID_напарника', senderId: 'мой_ID', lat: X, lng: Y }
        socket.to(data.room).emit('update-location', data);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер работает на порту ${PORT}`);
});
