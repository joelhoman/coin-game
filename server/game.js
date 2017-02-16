const { clamp, randomPoint, permutation } = require('./gameutil');
const redis = require('redis').createClient();

const WIDTH = 64;
const HEIGHT = 64;
const MAX_PLAYER_NAME_LENGTH = 32;
const NUM_COINS = 100;

exports.addPlayer = (name, callback) => {
  redis.hexists('players', name, (err, reply) => {
    if (name.length === 0 || name.length > MAX_PLAYER_NAME_LENGTH || reply) {
      return callback(null, false);
    }
    redis.hset('players', name, randomPoint(WIDTH, HEIGHT).toString());
    redis.zadd('scores', 0, name);
    return callback(null, true);
  });
};

function placeCoins() {
  permutation(WIDTH * HEIGHT).slice(0, NUM_COINS).forEach((position, i) => {
    const coinValue = (i < 50) ? 1 : (i < 75) ? 2 : (i < 95) ? 5 : 10;
    const index = `${Math.floor(position / WIDTH)},${Math.floor(position % WIDTH)}`;
    redis.hset('coins', index, coinValue);
  });
}

exports.state = (callback) => {
  redis.hgetall('players', (err1, reply1) => {
    const positions = reply1;
    redis.zrevrange('scores', 0, -1, 'withscores', (err2, reply2) => {
      const scores = [];
      for (let i = 0; i < reply2.length; i += 2) {
        scores.push([reply2[i], reply2[i + 1]]);
      }
      redis.hgetall('coins', (err3, reply3) => {
        const coins = reply3;
        return callback(null, {
          positions,
          scores,
          coins,
        });
      });
    });
  });
};

exports.move = (direction, name, callback) => {
  const delta = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }[direction];
  if (delta) {
    redis.hget('players', name, (err1, reply1) => {
      const [x, y] = reply1.split(',');
      const [newX, newY] = [clamp(+x + delta[0], 0, WIDTH - 1),
        clamp(+y + delta[1], 0, HEIGHT - 1)];
      const playerLocation = `${newX},${newY}`;
      redis.hget('coins', playerLocation, (err2, reply2) => {
        if (reply2) {
          redis.zincrby('scores', reply2, name);
          redis.hdel('coins', playerLocation);
        }
        redis.hset('players', name, playerLocation);
        redis.hlen('coins', (err3, reply3) => {
          if (!reply3) {
            placeCoins();
          }
          return callback();
        });
      });
    });
  }
};

redis.on('error', (err) => {
  console.error(`Error: ${err}`);
});

placeCoins();
