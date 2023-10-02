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
          this.timer = null;
          this.onGameStart(this.roomId);
          this.io.to(this.roomId).emit("start_game", this.countdown);
        } else {
          this.countdown -= 1;
        }
      }, 1000);
    }
  }
  cancelCounting() {
    this.io.to(this.roomId).emit("time_stoped", "time stoped ");
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export default GameStartCounter;
