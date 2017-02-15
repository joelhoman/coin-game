const { clamp, randomPoint, permutation } = require('./gameutil');
const redis = require('redis').createClient();

const WIDTH = 64;
const HEIGHT = 64;
const MAX_PLAYER_NAME_LENGTH = 32;
const NUM_COINS = 100;

const database = {
  scores: {},
  usednames: new Set(),
  coins: {},
};

exports.addPlayer = (name) => {
  redis.sismember('usednames', name, function (err, reply) {
    if (name.length === 0 || name.length > MAX_PLAYER_NAME_LENGTH || reply) {
      return false;
    } else {
      redis.sadd('usednames', name);
      redis.hset('players', `player:${name}`, randomPoint(WIDTH, HEIGHT).toString());
      redis.zadd('scores', 0, name);
      return true;
    }
  });
  // database.usednames.add(name);
  // database[`player:${name}`] = randomPoint(WIDTH, HEIGHT).toString();
  // database.scores[name] = 0;
  // return true;
};

function placeCoins() {
  permutation(WIDTH * HEIGHT).slice(0, NUM_COINS).forEach((position, i) => {
    const coinValue = (i < 50) ? 1 : (i < 75) ? 2 : (i < 95) ? 5 : 10;
    const index = `${Math.floor(position / WIDTH)},${Math.floor(position % WIDTH)}`;
    database.coins[index] = coinValue;
  });
}

// Return only the parts of the database relevant to the client. The client only cares about
// the positions of each player, the scores, and the positions (and values) of each coin.
// Note that we return the scores in sorted order, so the client just has to iteratively
// walk through an array of name-score pairs and render them.
exports.state = () => {
  const positions = Object.entries(database)
    .filter(([key]) => key.startsWith('player:'))
    .map(([key, value]) => [key.substring(7), value]);
  const scores = Object.entries(database.scores);
  scores.sort(([, v1], [, v2]) => v1 < v2);
  return {
    positions,
    scores,
    coins: database.coins,
  };
};

exports.move = (direction, name) => {
  const delta = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }[direction];
  if (delta) {
    const playerKey = `player:${name}`;
    const [x, y] = database[playerKey].split(',');
    const [newX, newY] = [clamp(+x + delta[0], 0, WIDTH - 1), clamp(+y + delta[1], 0, HEIGHT - 1)];
    const value = database.coins[`${newX},${newY}`];
    if (value) {
      database.scores[name] += value;
      delete database.coins[`${newX},${newY}`];
    }
    database[playerKey] = `${newX},${newY}`;

    // When all coins collected, generate a new batch.
    if (Object.keys(database.coins).length === 0) {
      placeCoins();
    }
  }
};

redis.on('error', (err) => {
  console.error('Error: ${err}');
});

placeCoins();
