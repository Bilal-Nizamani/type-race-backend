class GameStartCounter {
  constructor(io, roomId, onGameStart, hostId, countseconds) {
    this.io = io;
    this.roomId = roomId;
    this.onGameStart = onGameStart;
    this.timer = null;
    this.countdown = countseconds;
  }

  start() {
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.io.to(this.roomId).emit("countdown_timer", this.countdown);
        if (this.countdown === 0) {
          clearInterval(this.timer);
          this.onGameStart(this.roomId);
        } else {
          this.countdown -= 1;
        }
      }, 1000);
    }
  }
  cancelCounting(timeStoped) {
    timeStoped();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export default GameStartCounter;
