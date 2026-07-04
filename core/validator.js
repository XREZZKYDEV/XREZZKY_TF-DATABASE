export class Validator {
  static validateConfigs(sourceKey, sourceConf, destKey, destConf) {
    if (!sourceKey || !destKey) return { valid: false, message: 'Provider harus dipilih.' };
    if (Object.values(sourceConf).some(v => !v)) return { valid: false, message: 'Isi semua field source.' };
    if (Object.values(destConf).some(v => !v)) return { valid: false, message: 'Isi semua field destination.' };
    if (sourceKey === destKey && JSON.stringify(sourceConf) === JSON.stringify(destConf)) {
      return { valid: false, message: 'Source & destination sama persis.' };
    }
    return { valid: true };
  }
}
