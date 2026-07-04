const express = require('express');
const router = express.Router();
const migrationController = require('../controllers/migrationController');
const { validateMigrationRequest, validateConnectionTest } = require('../middleware/validation');

// Test connection
router.post('/test-connection', validateConnectionTest, migrationController.testConnection);

// Start migration
router.post('/start-migration', validateMigrationRequest, migrationController.startMigration);

// Get migration progress
router.get('/progress/:migrationId', migrationController.getProgress);

// Get migration logs
router.get('/logs/:migrationId', migrationController.getLogs);

// Get migration status
router.get('/status/:migrationId', migrationController.getStatus);

// Cancel migration
router.post('/cancel/:migrationId', migrationController.cancelMigration);

module.exports = router;
