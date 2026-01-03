const { consumer } = require('../config/kafka');
const Message = require('../models/Message');

const startKafkaConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'chat-messages', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          
          // Skip if message was already saved directly (from socketService)
          if (messageData.alreadySaved) {
            console.log(`Message already saved, skipping Kafka consumer save: ${messageData.messageId}`);
            return;
          }
          
          // Save message to Cassandra (with default deletion fields)
          // This handles messages from other sources or retries
          await Message.create(
            messageData.senderId,
            messageData.receiverId,
            messageData.content || '',
            messageData.attachmentUrl || null,
            messageData.attachmentType || null,
            messageData.attachmentName || null
          );

          console.log(`Message saved to Cassandra via Kafka: ${messageData.chatId}`);
        } catch (error) {
          console.error('Error processing Kafka message:', error);
        }
      }
    });

    console.log('Kafka consumer started');
  } catch (error) {
    console.error('Error starting Kafka consumer:', error);
  }
};

module.exports = startKafkaConsumer;

