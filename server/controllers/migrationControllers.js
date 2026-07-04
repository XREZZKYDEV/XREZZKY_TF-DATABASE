const MigrationService = require('../services/migrationService');
const { MigrationLogger } = require('../logger/migrationLogger');
const { v4: uuidv4 } = require('uuid');

class MigrationController {
  async testConnection(req, res, next) {
    try {
      const { provider, config } = req.body;
      const result = await MigrationService.testConnection(provider, config);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async startMigration(req, res, next) {
    try {
      const migrationId = uuidv4();
      const { sourceProvider, sourceConfig, destProvider, destConfig, options } = req.body;
      
      // Validate providers
      if (!sourceProvider || !destProvider) {
        return res.status(400).json({ error: 'Source and destination providers are required' });
      }
      
      // Initialize logger for this migration
      MigrationLogger.createLogger(migrationId);
      
      // Start migration in background
      MigrationService.startMigration(migrationId, {
        sourceProvider,
        sourceConfig,
        destProvider,
        destConfig,
        options: options || {}
      }).catch(error => {
        MigrationLogger.log(migrationId, `Fatal error: ${error.message}`, 'error');
      });
      
      res.json({
        migrationId,
        message: 'Migration started successfully',
        status: 'running'
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgress(req, res, next) {
    try {
      const { migrationId } = req.params;
      const progress = MigrationService.getProgress(migrationId);
      
      if (!progress) {
        return res.status(404).json({ error: 'Migration not found' });
      }
      
      res.json(progress);
    } catch (error) {
      next(error);
    }
  }

  async getLogs(req, res, next) {
    try {
      const { migrationId } = req.params;
      const logs = MigrationLogger.getLogs(migrationId);
      
      if (!logs) {
        return res.status(404).json({ error: 'Migration logs not found' });
      }
      
      res.json({ logs });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req, res, next) {
    try {
      const { migrationId } = req.params;
      const status = MigrationService.getStatus(migrationId);
      
      if (!status) {
        return res.status(404).json({ error: 'Migration not found' });
      }
      
      res.json(status);
    } catch (error) {
      next(error);
    }
  }

  async cancelMigration(req, res, next) {
    try {
      const { migrationId } = req.params;
      const result = MigrationService.cancelMigration(migrationId);
      
      if (!result) {
        return res.status(404).json({ error: 'Migration not found' });
      }
      
      res.json({ message: 'Migration cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MigrationController();
