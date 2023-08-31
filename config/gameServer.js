import { v4 } from "uuid";

/**  
*?RoomTimer  || handles every single room timer
 timer_update  ||| emits every second game duration
 time_up       ||| emits when timer is reached its duration
*/

/** 
*?GamerServer
 user_ready_to_play||| emits every second game duration
 player_data       ||| emits when timer is reached its duration
 game_started      ||| it listens on game_sarted to get track of when game is started
 match_found       |||  when room length reached and room is joined it sends match_found to frontend
 room_players_data ||| emits when ever all users data when ever data is changed
*/

class RoomTimer {
  constructor(io, duration, callback) {
    this.io = io;
    this.duration = duration;
    this.callback = callback;
    this.timerInterval = null;
    this.roomName = null;
  }

  start(roomName) {
    this.roomName = roomName;
    this.timerInterval = setInterval(() => {
      this.duration--;

      if (this.duration <= 0) {
        this.stop();
        // call_back_funtion
        if (typeof this.callback === "function") {
          this.callback(roomName);
        }
      }
      this.io.to(roomName).emit("timer_update", this.duration);
    }, 1000);
  }

  stop() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.io.to(this.roomName).emit("time_up", "time_up");
  }
}

class GameServer {
  constructor(io) {
    this.io = io;
    this.waitingPlayers = [];
    this.playingPlayersData = {};
    this.rooms = {};
    this.playerToRoomMap = {};
    this.io.on("connection", (socket) => this.handleConnection(socket));
  }

  handleConnection = (socket) => {
    socket.on("user_ready_to_play", this.playersWantToPlayHandler(socket));
    socket.on("disconnect", this.handleDisconnect(socket));
    socket.on("player_data", this.handleUserData(socket));
  };

  playersWantToPlayHandler = (socket) => () => {
    this.waitingPlayers.push(socket.id);
    const roomCapacity = 4; // Change to 4 for room capacity
    if (this.waitingPlayers.length >= roomCapacity) {
      let timer = "";

      const matchRoomName = "match_" + v4();
      const players = this.waitingPlayers.splice(0, roomCapacity);

      this.rooms[matchRoomName] = {};

      players.forEach((player) => {
        this.playerToRoomMap[player] = matchRoomName;
        this.io.sockets.sockets.get(player).join(matchRoomName);
      });

      // Emit the match found event
      this.io
        .to(matchRoomName)
        .emit("match_found", "lets check your typing speed how much you score");

      socket.on("game_started", (data) => {
        // Handle the "game_started" event from clients in this room
        // You can start the timer here
        timer = new RoomTimer(this.io, 300, this.handleEmitEverySeconds);
        timer.start(matchRoomName);
      });

      // Start the game in this room
      // You should implement your game logic here
    }
  };
  handleEmitEverySeconds = (roomName) => {
    this.io.to(roomName).emit();
  };

  // handling user data if anything changed
  handleUserData = (socket) => (userData) => {
    const roomId = this.playerToRoomMap[socket.id];
    this.rooms[roomId][socket.id] = userData; // Store player data for the specific room and player

    // Emit the updated data for all players in the match room
    socket.to(roomId).emit("room_players_data", this.rooms[roomId]);
  };

  handleDisconnect = (socket) => () => {
    // Remove the user from waitingPlayers
    const index = this.waitingPlayers.indexOf(socket.id);
    if (index !== -1) {
      this.waitingPlayers.splice(index, 1);
    }

    // Handle user disconnection from activeRooms
    const roomId = this.playerToRoomMap?.[socket.id];
    const isUserInRoom = this.rooms?.[roomId]?.[socket.id];
    if (isUserInRoom) {
      delete this.rooms?.[roomId]?.[socket.id];

      if (Object.keys(this.rooms[roomId]).length === 0) {
        delete this.rooms[roomId];
      }
      this.io.to(roomId).emit("player_disconnected", socket.id);
    }
  };
}

export default GameServer;
