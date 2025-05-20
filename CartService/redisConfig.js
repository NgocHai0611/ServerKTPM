const { createClient } = require("redis");

const client = createClient({
  username: "default",
  password: "jHiZSko9dN0YQpFdFXb8d0I7XLqi6ZbI",
  socket: {
    host: "redis-11346.c98.us-east-1-4.ec2.redns.redis-cloud.com",
    port: 11346,
    tls: {}, // Thay vì true thì để object rỗng
  },
});

client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

function connectRedis() {
  return client.connect();
}

module.exports = {
  client,
  connectRedis,
};
