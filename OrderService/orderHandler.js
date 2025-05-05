// orderService.js
const amqp = require("amqplib");

async function sendOrderPlacedMessage() {
  const connection = await amqp.connect("amqp://rabbitmq");
  const channel = await connection.createChannel();

  await channel.assertExchange("order_events", "direct", { durable: true });

  const msg = {
    orderId: "12345",
    userId: "user001",
    total: 100000,
    items: ["item1", "item2"],
    status: "PENDING_PAYMENT",
  };

  channel.publish(
    "order_events",
    "order.placed",
    Buffer.from(JSON.stringify(msg)),
    { persistent: true } // Giữ message nếu RabbitMQ restart
  );

  console.log("📤 Sent order.placed:", msg);
  setTimeout(() => {
    connection.close();
  }, 500);
}

module.exports = sendOrderPlacedMessage;
