import { v4 } from "uuid";

/** 
* ?SOCKET.IO REQUEST
  
*?RoomTimer    || handles every single room timer
 timer_update  ||| emits every second game duration
 time_up       ||| emits when timer is reached its duration
*/
/**  
*?Counter      || handles every single room start counter
 counter_update  ||| emits every second roomCounters run
 *!callBack
 this.callback ||| (1) calling call back funtion when counter is completed 
                   (2) stop function is called from GameServer Class if only one player is left in rooms
*/

/** 
*?GamerServer      || handles games mani logic
 user_ready_to_play||| emits every second game duration
 player_data       ||| emits when timer is reached its duration
 game_started      ||| it listens on game_sarted to get track of when game is started
 match_found       |||  when room length reached and room is joined it sends match_found to frontend
 room_players_data ||| emits when ever all users data when ever data is changed
*/

class RoomTimer {
  constructor(io, duration, roomName, callback) {
    this.io = io;
    this.duration = duration;
    this.callback = callback;
    this.timerInterval = null;
    this.roomName = roomName;
  }

  start() {
    this.timerInterval = setInterval(() => {
      this.duration--;

      if (this.duration <= 0) {
        this.stop();
      }
      this.callback(this.roomName);
      this.io.to(this.roomName).emit("timer_update", this.duration);
    }, 1000);
  }

  stop() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.io.to(this.roomName).emit("time_up", "time_up");
  }
}

class RoomStartCounter {
  constructor(io, counterCount, roomName, callback) {
    this.io = io;
    this.counterCount = counterCount;
    this.callback = callback;
    this.timerInterval = null;
    this.roomName = roomName;
  }

  start() {
    this.timerInterval = setInterval(() => {
      if (this.counterCount <= 0) {
        this.stop();
        return;
      }
      this.io.to(this.roomName).emit("counter_update", this.counterCount);
      this.counterCount--;
    }, 1000);
  }

  stop() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.callback(this.roomName);
    // this.io.to(this.roomName).emit("players_left", "Only you are in the Room");
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
    this.roomsCounters = {};
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

      this.roomsCounters[matchRoomName] = new RoomStartCounter(
        this.io,
        5,
        matchRoomName,
        this.handleCounterEnd
      );

      this.roomsCounters[matchRoomName].start();

      socket.on("game_started", (data) => {
        // Handle the "game_started" event from clients in this room
        // You can start the timer here
        this.roomsTimer[matchRoomName] = new RoomTimer(
          this.io,
          300,
          matchRoomName,
          this.hndlRomScndsTim
        );
        this.roomsTimer[matchRoomName].start();
      });
      // Start the game in this room
      // You should implement your game logic here
    }
  };

  handleCounterEnd = (roomId) => {
    delete this.roomsCounters[roomId];
    this.io.to(roomId).emit("counting_completed", "countingIsCompleted");
  };

  hndlRomScndsTim = (roomName) => {
    let userData;
    let socketIdKey;
    for (const key in this.rooms[roomName]) {
      userData = this.rooms[roomName]?.[key];
      socketIdKey = key;
      break;
    }
    let handleUserData = this.handleUserData("");
    handleUserData(userData, socketIdKey, roomName);
  };

  handleUserData = (socket) => (userData, socketIdKey, roomName) => {
    let id;
    let roomId;
    let room;
    if (roomName && socketIdKey) {
      id = socketIdKey;
      roomId = roomId;
      room = this.rooms[roomName];
    } else {
      id = socket.id;
      roomId = this.playerToRoomMap[socket.id];
      room = this.rooms[roomId];
    }
    const allPlayersCompletedRace = [];
    room[id] = userData; // Store player data for the specific room and player
    let timer = this.roomsTimer?.[roomId]?.duration;
    if (timer) {
      for (const property in room) {
        allPlayersCompletedRace.push(room[property].isRaceCompleted);
        if (!room[property].isRaceCompleted) {
          room[property].wpm = Math.floor(
            (room[property].arrayOfwrittenWords.length / (300 - timer)) * 60
          );
        }
      }
    }
    // Emit the updated data for all players in the match room
    this.io.to(roomId).emit("room_players_data", room);
    if (
      allPlayersCompletedRace.length > 0 &&
      allPlayersCompletedRace.every(Boolean)
    ) {
      this.roomsTimer[roomId].stop();
      delete this.rooms[roomId];
    }
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
      // const rommPlayers = this.io.sockets.adapter.rooms.get(roomId);
      // if (rommPlayers.size < 1) delete this.roomsCounters[this.roomId];
    }
  };
}

export default GameServer;
