const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'chatly-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'chatly-consumer-group' });

module.exports = { producer, consumer, kafka };

