require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cassandra = require('./config/database');
const { producer } = require('./config/kafka');
const startKafkaConsumer = require('./services/kafkaConsumer');
const setupSocketIO = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/reactions', require('./routes/reactions'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/uploads', express.static('uploads')); // Serve uploaded files

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize services
const initializeServices = async () => {
  try {
    // Wait for Cassandra to be ready
    let cassandraReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        await cassandra.execute('SELECT now() FROM system.local');
        cassandraReady = true;
        console.log('Cassandra is ready');
        break;
      } catch (error) {
        console.log(`Waiting for Cassandra... (${i + 1}/30)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!cassandraReady) {
      throw new Error('Cassandra not ready after 60 seconds');
    }

    // Connect to Kafka producer
    await producer.connect();
    console.log('Kafka producer connected');

    // Start Kafka consumer
    await startKafkaConsumer();

    // Setup Socket.IO
    setupSocketIO(io);

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
  }
};

// Initialize on startup
initializeServices();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await producer.disconnect();
  await cassandra.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

