const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');
const dotenv = require('dotenv');
const migrationRoutes = require('./routes/migration');
const { errorHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();
expressWs(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', migrationRoutes);

// WebSocket for real-time logs
app.ws('/api/logs-stream', (ws, req) => {
  const migrationId = req.query.migrationId;
  
  if (!migrationId) {
    ws.close(1008, 'Migration ID required');
    return;
  }
  
  // Store WebSocket connection
  const { MigrationLogger } = require('./logger/migrationLogger');
  MigrationLogger.addWebSocketClient(migrationId, ws);
  
  ws.on('close', () => {
    MigrationLogger.removeWebSocketClient(migrationId, ws);
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Database Migration Tool running on port ${PORT}`);
});

module.exports = app;
