export class Logger {
  constructor(containerElement) {
    this.container = containerElement;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${message}`;
    this.container.textContent += formatted + '\n';
    this.container.scrollTop = this.container.scrollHeight;
    console.log(`[${type}] ${message}`);
  }

  clear() {
    this.container.textContent = '';
  }
}
