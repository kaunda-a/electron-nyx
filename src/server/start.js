// Disable SSL certificate validation for local development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const nyxServer = require('./app');

// Start server on port 3000
nyxServer.start(3000).then(() => {
  console.log('Server started successfully on port 3000');
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});