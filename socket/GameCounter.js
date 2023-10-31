class GameStartCounter {
  constructor(io, roomId) {
    this.io = io;
    this.roomId = roomId;
    this.timer = null;
  }

  start(countdown, countingType, onGameStart) {
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (countingType === "room-counting")
          this.io.to(this.roomId).emit("room_countdown_timer", countdown);
        else this.io.to(this.roomId).emit("countdown_timer", countdown);

        if (countdown === 0) {
          clearInterval(this.timer);
          this.timer = null;
          if (countingType === "room-counting") {
            const roomSocket = this.io.to(this.roomId);
            roomSocket.emit("start_game", {});
          } else {
            onGameStart(this.roomId);
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
