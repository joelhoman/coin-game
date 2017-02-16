const express = require('express');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const game = require('./server/game');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});

io.on('connection', (socket) => {
  const nameListener = (name) => {
    const trimmedName = name.trim();
    game.addPlayer(trimmedName, (err, validName) => {
      if (validName) {
        io.to(socket.id).emit('welcome');
        game.state((err2, state) => {
          io.emit('state', state);
        });
        socket.removeListener('name', nameListener);
        socket.on('move', (direction) => {
          game.move(direction, trimmedName, () => {
            game.state((err2, state) => {
              io.emit('state', state);
            });
          });
        });
      } else {
        io.to(socket.id).emit('badname', trimmedName);
      }
    });
  };
  socket.on('name', nameListener);
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
