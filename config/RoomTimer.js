/** 
* ?SOCKET.IO REQUEST
  
*?RoomTimer    || handles every single room timer
 timer_update  ||| emits every second game duration
 time_up       ||| emits when timer is reached its duration
*/

class RoomTimer {
  constructor(io, duration, roomName, endGame, eventEmitter) {
    this.io = io;
    this.duration = duration;
    this.endGame = endGame;
    this.timerInterval = null;
    this.roomName = roomName;
    this.eventEmitter = eventEmitter; // Create an event emitter
  }

  start() {
    this.timerInterval = setInterval(() => {
      this.duration--;

      this.io.to(this.roomName).emit("timer_update", this.duration);

      // node.js event emitter that emitted every second for every room
      this.eventEmitter.emit("timerChanged", {
        duration: this.duration,
        roomName: this.roomName,
      });

      if (this.duration <= 0) {
        this.stop();
      }
    }, 1000);
  }
  gameEnded() {
    this.io.to(this.roomName).emit("game_completed", "game completed");
    this.clearTimer();
  }

  stop() {
    this.io.to(this.roomName).emit("time_up", "time_up");
    this.clearTimer();
  }
  clearTimer() {
    this.endGame(this.roomName);
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }
}

export default RoomTimer;
