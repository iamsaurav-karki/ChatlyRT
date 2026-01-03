const cassandra = require('cassandra-driver');

const contactPoints = (process.env.CASSANDRA_HOSTS || 'localhost:9042').split(',').map(host => {
  const [hostname, port] = host.split(':');
  return { host: hostname, port: port ? parseInt(port) : 9042 };
});

const client = new cassandra.Client({
  contactPoints: contactPoints.map(cp => cp.host),
  localDataCenter: 'datacenter1',
  keyspace: 'chatly',
  socketOptions: {
    connectTimeout: 10000
  }
});

client.on('log', (level, className, message, furtherInfo) => {
  if (level === 'error') {
    console.error(`Cassandra ${level}: ${message}`, furtherInfo);
  }
});

// Connect to Cassandra
const connectCassandra = async () => {
  try {
    await client.connect();
    console.log('Connected to Cassandra');
  } catch (error) {
    console.error('Error connecting to Cassandra:', error);
    // Retry connection after delay
    setTimeout(connectCassandra, 5000);
  }
};

connectCassandra();

module.exports = client;

