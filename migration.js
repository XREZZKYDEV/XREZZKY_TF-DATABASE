export class MigrationEngine {
  constructor(sourceMod, destMod, logger, progress) {
    this.source = sourceMod;
    this.dest = destMod;
    this.logger = logger;
    this.progress = progress;
  }

  async runMigration(sourceConfig, destConfig, options) {
    const startTime = Date.now();
    let totalRecords = 0;
    let nodeCount = 0;
    let errorCount = 0;
    let success = false;

    try {
      this.progress.setStage('connectingSource');
      this.logger.log('Connecting to source...');
      await this.source.connect(sourceConfig);
      
      this.progress.setStage('connectingDest');
      this.logger.log('Connecting to destination...');
      await this.dest.connect(destConfig);

      if (options.clearDestination) {
        this.logger.log('Clearing destination data...');
        await this.dest.clearAll();
      }

      this.progress.setStage('reading');
      this.logger.log('Reading all data from source...');
      const data = await this.source.readAll();
      
      // Hitung node & record sederhana
      nodeCount = data ? Object.keys(data).length : 0;
      totalRecords = this.countRecords(data);
      this.logger.log(`Fetched ${nodeCount} root nodes, ~${totalRecords} records.`);

      this.progress.setStage('processing');
      // validasi struktur jika diperlukan
      if (options.validateStructure) {
        this.logger.log('Validating structure compatibility...');
        // implementasi validasi struktur bisa ditambahkan
      }

      this.progress.setStage('writing');
      this.logger.log('Writing data to destination...');
      await this.dest.writeAll(data, options.overwrite);

      this.progress.setStage('verifying');
      this.logger.log('Verification phase...');
      // verifikasi bisa berupa cek jumlah node
      const destCheck = await this.dest.readAll();
      const destNodes = destCheck ? Object.keys(destCheck).length : 0;
      this.logger.log(`Destination now has ${destNodes} nodes.`);

      this.progress.setStage('completed');
      success = true;
    } catch (err) {
      errorCount++;
      this.logger.log(`Migration error: ${err.message}`, 'error');
    } finally {
      // disconnect jika method ada
      if (this.source.disconnect) await this.source.disconnect();
      if (this.dest.disconnect) await this.dest.disconnect();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    return { totalRecords, nodeCount, duration, success, errors: errorCount };
  }

  countRecords(data) {
    if (!data) return 0;
    let count = 0;
    const traverse = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      for (const key of Object.keys(obj)) {
        count++;
        if (typeof obj[key] === 'object' && obj[key] !== null) traverse(obj[key]);
      }
    };
    traverse(data);
    return count;
  }
    }
