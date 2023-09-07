import { v4 } from "uuid";

/** 
* ?SOCKET.IO REQUEST
  
*?RoomTimer    || handles every single room timer
 timer_update  ||| emits every second game duration
 time_up       ||| emits when timer is reached its duration
*/
/**  
*?RoomMangaer      || handles rooms createion and joining 
  allStatus  ||| status are for the rooms and players  which state he is status is assigned to him or to the room
                 if in game @in_game waiting @waiting if countDown @count_down
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
  constructor(io, duration, roomName, roomDelete) {
    this.io = io;
    this.duration = duration;
    this.roomDelete = roomDelete;
    this.timerInterval = null;
    this.roomName = roomName;
  }

  start() {
    this.timerInterval = setInterval(() => {
      this.duration--;

      if (this.duration <= 0) {
        this.stop();
      }
      this.io.to(this.roomName).emit("timer_update", this.duration);
    }, 1000);
  }
  gameEnded() {
    this.clearTimer();
    this.io.to(this.roomName).emit("game_completed", "game completed");
  }

  stop() {
    this.clearTimer();
    this.io.to(this.roomName).emit("time_up", "time_up");
  }
  clearTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.roomDelete(this.roomName);
  }
}

class RoomManager {
  constructor(io, roomCapacity) {
    this.io = io;
    this.roomCapacity = roomCapacity || 4;
    this.waitingRooms = new Map(); // Store waiting rooms
    this.activeRooms = new Map(); // Store active rooms
    this.playersData = new Map();
    this.roomCounters = new Map();
    this.allStatus = {
      countDown: "count-down",
      waiting: "waiting",
      completed: "completed",
      inGame: "in-games",
    };
  }

  userReadyToPlay(socketId) {
    // Check if the user is already in a game (in-game status)
    const isInRoom = this.isInRoom(socketId);
    const availableRoom = this.findAvailableRoom();
    if (isInRoom) return "already in game";

    if (availableRoom) {
      this.joinRoom(availableRoom, socketId);
      this.startCountdown(availableRoom, socketId);
      this.playersData.set(socketId, {
        status: this.allStatus.countDown,
        roomId: availableRoom,
      });
    } else {
      const newRoomId = this.createRoom();
      this.joinRoom(newRoomId, socketId);
      this.playersData.set(socketId, {
        status: "waiting",
        roomId: newRoomId,
      });
    }
  }
  isInRoom(socketId) {
    // Check if the user is in an active room (in-game status)
    let status = this.playersData.get(socketId)?.status;
    if (
      status === this.allStatus.inGame ||
      status === this.allStatus.waiting ||
      status === this.allStatus.countDown
    ) {
      return true;
    }

    return false;
  }

  /**
   * Allows a player with the specified socketId to join a room with the given roomId.
   * @param {string} roomId - The ID of the room to join.
   * @param {string} socketId - The socket ID of the player to join the room.
   */
  joinRoom(roomId, socketId) {
    // Add the player's socketId to the room's players Set
    this.waitingRooms.get(roomId).players.add(socketId);

    // Check if the room is not full and the user is not already in the room
    // Emit a "player_joined" event to notify clients in the room that a player has joined
    this.io.to(roomId).emit("player-joined", socketId);
  }

  leaveRoom(socketId, socket) {
    // Get the player associated with the socketId
    const player = this.playersData.get(socketId);

    // If the player is not found, return
    if (!player) return; // Player not found

    // Extract the roomId and status of the player
    const roomId = player.roomId;
    const status = player.status;

    const isWaitingRoom =
      status === this.allStatus.countDown ||
      status === this.allStatus.waiting ||
      false;

    // Determine the room based on the player's status
    const room = isWaitingRoom
      ? this.waitingRooms.get(roomId)
      : this.activeRooms.get(roomId);
    // Check if the room exists and the player is in it
    if (room && room.players.has(socketId)) {
      // deleting user from socket.io rooms
      socket.leave(roomId);
      // Remove the player from the room
      room.players.delete(socketId);

      // Notify clients in the room that the player left
      this.io.to(roomId).emit("player-left", socketId);

      // If the player was in "count-down" status and there's only one player left in the room
      if (isWaitingRoom && room.players.size === 1) {
        // Stop the countdown
        this.stopCountdown(roomId, socketId);
      }

      // If the room is now empty, remove it
      if (room.players.size === 0) {
        if (isWaitingRoom) {
          this.waitingRooms.delete(roomId);
        } else if (status === this.allStatus.inGame) {
          this.activeRooms.delete(roomId);
        }
        this.io.sockets.adapter.rooms.delete(roomId);
      }
    }

    // Remove the player from the playersData Map
    this.playersData.delete(socketId);
  }

  startGame(roomId) {
    const room = this.waitingRooms.get(roomId);
    if (room) {
      room.status = this.allStatus.inGame;
      room.timer = this.allStatus.completed;

      this.setPlayersStatus(room, this.allStatus.inGame);
    }
    this.activeRooms.set(roomId, room);
    this.waitingRooms.delete(roomId);
  }

  endGame(roomId) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.status = this.allStatus.completed;
      this.setPlayersStatus(room, this.allStatus.completed);
    }
  }

  stopCountdown(roomId) {
    const room = this.waitingRooms.get(roomId);
    // Get the userId of the player left alone in the room
    this.setPlayersStatus(room, this.allStatus.waiting);
    // Change the room status to this
    room.status = this.allStatus.waiting;
    room.timer = null;
    clearInterval(this.roomCounters.get(roomId));
  }

  setPlayersStatus(room, status) {
    room.players.forEach((item) => {
      let oldVal = this.playersData.get(item);
      if (oldVal) {
        oldVal.status = status;
        this.playersData.set(item, oldVal);
      }
    });
  }

  startCountdown(roomId) {
    const room = this.waitingRooms.get(roomId);
    if (room && room.players.size > 1) {
      this.setPlayersStatus(room, this.allStatus.countDown);
    }
    if (room && room.players.size > 1 && !room.timer) {
      // Check if there are more than one player and the timer is not already running
      room.status = this.allStatus.countDown;
      room.timer = 10;

      this.roomCounters.set(
        roomId,
        setInterval(() => {
          this.io.to(roomId).emit("countdown-timer", room.timer);

          if (room.timer === 0) {
            clearInterval(this.roomCounters.get(roomId));
            this.startGame(roomId);
          } else {
            room.timer -= 1;
          }
        }, 1000)
      );
    }
  }

  createRoom() {
    const roomId = v4();
    const roomData = {
      id: roomId,
      players: new Set(),
      status: this.allStatus.waiting,
      timer: null,
    };
    this.waitingRooms.set(roomId, roomData);
    return roomId;
  }

  /**
   * Finds and returns an available room ID from the waitingRooms.
   * An available room is one that has not reached its capacity and has a status of "waiting" or "countdown."
   * @returns {string|null} The ID of an available room, or null if none is found.
   */
  findAvailableRoom() {
    // Iterate over the entries (key-value pairs) of the waitingRooms Map
    for (const [roomId, room] of this.waitingRooms.entries()) {
      // Check if the room has not reached its capacity
      if (
        room.players.size < this.roomCapacity &&
        // Check if the room status is "waiting" or "countdown"
        (room.status === this.allStatus.waiting ||
          room.status === this.allStatus.countDown)
      ) {
        // Return the ID of the first available room found
        return roomId;
      }
    }

    // Return null if no available room is found
    return null;
  }
}

class GameServer {
  constructor(io, roomCapacity) {
    this.io = io;
    this.roomsManager = new RoomManager(io, roomCapacity);
    this.roomTimers = new Map(); // Mapping of room IDs to timers

    io.on("connection", (socket) => {
      socket.on("user_ready_to_play", () => this.handleUserReadyToPlay(socket));
      socket.on("disconnect", () => this.handleDisconnect(socket));
      socket.on("player_data", (userData) =>
        this.handlePlayerData(socket, userData)
      );
    });
  }

  handleUserReadyToPlay(socket) {
    // Delegate room management to the RoomManager
    this.roomsManager.userReadyToPlay(socket.id);
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    this.roomsManager.leaveRoom(socket.id, socket);
  }

  handleUserData = (socket) => (userData) => {
    this.roomsManager.activeRooms;
    try {
      let id = socket.id;
      let roomId = this.playerToRoomMap[socket.id];
      let room = this.rooms[roomId];
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
        this.roomsTimer[roomId].gameEnded(roomId);
      }
    } catch (err) {
      console.log(err);
    }
  };
}

export default GameServer;
