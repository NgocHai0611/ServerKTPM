// paymentService.js
const amqp = require("amqplib");

async function startPaymentConsumer() {
  const connection = await amqp.connect("amqp://localhost");
  const channel = await connection.createChannel();

  await channel.assertExchange("order_events", "direct", { durable: true });

  const q = await channel.assertQueue("payment_queue", { durable: true });

  await channel.bindQueue(q.queue, "order_events", "order.placed");

  console.log("⏳ Waiting for order.placed in payment_queue...");
  channel.consume(
    q.queue,
    async (msg) => {
      const order = JSON.parse(msg.content.toString());
      console.log("✅ Received order:", order);

      // Fake xử lý thanh toán
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`💳 Thanh toán thành công cho đơn hàng ${order.orderId}`);

      channel.ack(msg); // Xác nhận đã xử lý xong
    },
    { noAck: false }
  );
}

module.exports = startPaymentConsumer();
