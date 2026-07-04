export class ProgressManager {
  constructor(fillElement, statusElement) {
    this.fill = fillElement;
    this.status = statusElement;
    this.steps = {
      connectingSource: 5,
      connectingDest: 10,
      reading: 25,
      processing: 50,
      writing: 75,
      verifying: 90,
      completed: 100
    };
  }

  setStage(stage) {
    const percent = this.steps[stage] || 0;
    this.fill.style.width = `${percent}%`;
    const labels = {
      connectingSource: '🔗 Connecting Source',
      connectingDest: '🔗 Connecting Destination',
      reading: '📖 Reading Data',
      processing: '⚙️ Processing',
      writing: '✍️ Writing Data',
      verifying: '✅ Verifying',
      completed: '🏁 Completed'
    };
    this.status.textContent = labels[stage] || stage;
  }

  reset() {
    this.fill.style.width = '0%';
    this.status.textContent = '⚪ Ready';
  }
}
