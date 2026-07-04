const { Pool } = require('pg');

class DatabaseConfig {
  static createPool(config) {
    return new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  static async testConnection(config) {
    const pool = this.createPool(config);
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT version()');
      client.release();
      await pool.end();
      return { success: true, version: result.rows[0].version };
    } catch (error) {
      await pool.end();
      return { success: false, error: error.message };
    }
  }
}

module.exports = DatabaseConfig;
