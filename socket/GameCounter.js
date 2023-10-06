class GameStartCounter {
  constructor(io, roomId, onGameStart, hostId) {
    this.io = io;
    this.roomId = roomId;
    this.onGameStart = onGameStart;
    this.timer = null;
  }

  start(countdown, countingType) {
    console.log(countingType, this.timer);
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.io.to(this.roomId).emit("countdown_timer", countdown);
        if (countdown === 0) {
          clearInterval(this.timer);
          this.timer = null;

          if (countingType === "room-counting") {
            this.onGameStart(this.roomId);
            this.io.to(this.roomId).emit("start_game", countdown);
          } else {
            this.io.to(this.roomId).emit("counting_completed", countdown);
          }
        } else {
          countdown -= 1;
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
