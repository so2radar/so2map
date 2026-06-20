const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Обязательно создаем HTTP-сервер вокруг Express
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем подключение с любых доменов (включая твой github.io)
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Когда игрок заходит на сайт, он создает комнату со своим уникальным ID
    socket.on('create-room', (roomId) => {
        socket.join(roomId);
        console.log(`Создана комната: ${roomId}`);
    });

    // Когда друг вводит твой ID, он подключается к этой же комнате
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Друг присоединился к комнате: ${roomId}`);
        // Уведомляем обоих участников в комнате, что связь установлена
        io.to(roomId).emit('paired');
    });

    // Получение координат от одного игрока и мгновенная пересылка напарнику
    socket.on('send-location', (coords) => {
        // Пересылаем координаты всем в этой комнате, кроме самого отправителя
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('update-location', coords);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
    });
});

// Запуск приложения на порту Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен и слушает порт ${PORT}`);
});
