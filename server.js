const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();

// Просто заглушка, чтобы проверить, что сервер работает
app.get('/', (req, res) => res.send('Сервер радара активен!'));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('Личный сервер запущен');
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);

