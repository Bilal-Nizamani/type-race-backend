import { v4 } from "uuid";

/**  
*?RoomTimer    || handles every single room timer
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
    // changed to set to prevent users from being duplicate
    this.waitingPlayers = new Set();
    this.playingPlayersData = {};
    this.rooms = {};
    this.playerToRoomMap = {};
    this.roomsTimer = {};
    this.io.on("connection", (socket) => this.handleConnection(socket));
  }

  handleConnection = (socket) => {
    socket.on("user_ready_to_play", this.playersWantToPlayHandler(socket));
    socket.on("disconnect", this.handleDisconnect(socket));
    socket.on("player_data", this.handleUserData(socket));
  };

  playersWantToPlayHandler = (socket) => () => {
    this.waitingPlayers.add(socket.id); // Changed to add
    const roomCapacity = 2; // Change to 4 for room capacity
    if (this.waitingPlayers.size >= roomCapacity) {
      // Changed to size

      const matchRoomName = "match_" + v4();
      // Iterate over waitingPlayers and add to players array
      const players = [...this.waitingPlayers].splice(0, roomCapacity);

      // Remove selected players from waitingPlayers
      for (const player of players) {
        this.waitingPlayers.delete(player);
      }
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
        this.roomsTimer[matchRoomName] = new RoomTimer(
          this.io,
          300,
          this.handleEmitEverySeconds
        );
        this.roomsTimer[matchRoomName].start(matchRoomName);
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
    let room = this.rooms[roomId];
    room[socket.id] = userData; // Store player data for the specific room and player
    let timer = this.roomsTimer?.[roomId]?.duration;
    if (timer) {
      for (const property in room) {
        room[property].wpm = Math.floor(
          (room[property].arrayOfwrittenWords.length / (300 - timer)) * 60
        );
      }
    }
    // Emit the updated data for all players in the match room
    this.io.to(roomId).emit("room_players_data", room);
  };

  handleDisconnect = (socket) => () => {
    // Remove the user from waitingPlayers
    this.waitingPlayers.delete(socket.id);

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
