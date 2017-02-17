const { clamp, randomPoint, permutation } = require('./gameutil');
const redis = require('redis').createClient();

const WIDTH = 64;
const HEIGHT = 64;
const MAX_PLAYER_NAME_LENGTH = 32;
const NUM_COINS = 100;
const PLAYER_EXPIRE_TIME = 300;

exports.addPlayer = (name, callback) => {
  const storedName = `player:${name}`;
  redis.exists(storedName, (err, reply) => {
    if (name.length === 0 || name.length > MAX_PLAYER_NAME_LENGTH || reply) {
      return callback(null, false);
    }
    redis.set(storedName, randomPoint(WIDTH, HEIGHT).toString(), () => {
      redis.expire(storedName, PLAYER_EXPIRE_TIME);
    });
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
  redis.keys('player:*', (err1, reply1) => {
    const positions = {};
    reply1.forEach((name) => {
      redis.get(name, (err2, reply2) => {
        positions[name.substring(7)] = reply2;
      });
    });
    redis.zrevrange('scores', 0, -1, 'withscores', (err3, reply3) => {
      const scores = [];
      for (let i = 0; i < reply3.length; i += 2) {
        scores.push([reply3[i], reply3[i + 1]]);
      }
      redis.hgetall('coins', (err4, reply4) => {
        const coins = reply4;
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
  const storedName = `player:${name}`;
  if (delta) {
    redis.get(storedName, (err1, reply1) => {
      const [x, y] = reply1.split(',');
      const [newX, newY] = [clamp(+x + delta[0], 0, WIDTH - 1),
        clamp(+y + delta[1], 0, HEIGHT - 1)];
      const playerLocation = `${newX},${newY}`;
      redis.hget('coins', playerLocation, (err2, reply2) => {
        if (reply2) {
          redis.zincrby('scores', reply2, name);
          redis.hdel('coins', playerLocation);
        }
        redis.set(storedName, playerLocation, () => {
          redis.expire(storedName, PLAYER_EXPIRE_TIME);
        });
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
  return null;
});

placeCoins();
