(() => {
  const socket = io(); // eslint-disable-line no-undef
  const canvas = document.querySelector('canvas');
  const tableBody = document.querySelector('tbody');

  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const CELL_SIZE = 10;
  const HALF_CELL_SIZE = CELL_SIZE / 2;

  function clearCanvas() {
    ctx.clearRect(0, 0, 640, 640);
  }

  function fillCell(row, column, text, textColor, backgroundColor) {
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(row * CELL_SIZE, column * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    ctx.fillStyle = textColor;
    ctx.fillText(text, (row * CELL_SIZE) + HALF_CELL_SIZE, (column * CELL_SIZE) + HALF_CELL_SIZE);
  }

  function drawPlayers(gameState) {
    Object.entries(gameState.positions).forEach(([name, position]) => {
      fillCell(...position.split(','), name[0].toUpperCase(), 'white', '#60c');
    });
  }

  function drawCoins(gameState) {
    Object.entries(gameState.coins).forEach(([position, coinValue]) => {
      fillCell(...position.split(','), coinValue, 'black');
    });
  }

  function drawScores(gameState) {
    document.querySelectorAll('tr.score').forEach(e => e.remove());
    gameState.scores.forEach(([name, score]) => {
      const tableRow = document.createElement('tr');
      tableRow.innerHTML = `<td>${name}<td>${score}`;
      tableRow.className = 'score';
      tableBody.appendChild(tableRow);
    });
  }

  function renderBoard(gameState) {
    clearCanvas();
    drawCoins(gameState);
    drawPlayers(gameState);
    drawScores(gameState);
  }

  document.querySelector('button').addEventListener('click', () => {
    socket.emit('name', document.querySelector('#name').value);
  });

  document.addEventListener('keydown', (e) => {
    const command = { 38: 'U', 40: 'D', 37: 'L', 39: 'R' }[e.keyCode];
    if (command) {
      socket.emit('move', command);
      e.preventDefault();
    }
  });

  socket.on('badname', (name) => {
    document.querySelector('.error').innerHTML = `Name ${name} too short, too long, or taken`;
  });

  socket.on('welcome', () => {
    document.querySelector('div#lobby').style.display = 'none';
    document.querySelector('div#game').style.display = 'block';
  });

  socket.on('state', renderBoard);
})();
