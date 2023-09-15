import { v4 } from "uuid";
import EventEmitter from "events";

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
function cleanString(inputString) {
  // Replace multiple spaces with a single space
  let cleanedString = inputString.replace(/\s+/g, " ");
  // Remove leading and trailing spaces
  cleanedString = cleanedString.trim();
  return cleanedString;
}
class RoomManager {
  constructor(io, roomCapacity) {
    this.io = io;
    this.roomCapacity = roomCapacity || 4;
    this.waitingRooms = new Map(); // Store waiting rooms
    this.activeRooms = new Map(); // Store active rooms
    this.playersData = new Map();
    this.roomCounters = new Map();
    this.roomsTimers = new Map();
    this.roomsSecondEventEmitter = new Map();
    this.raceText = "the heart of a bustling the  ";
    this.playingPlayersData = new Map();
    this.allStatus = {
      countDown: "count-down",
      waiting: "waiting",
      completed: "completed",
      inGame: "in-game",
      idle: "idle",
      entranceClosed: "entrance-closed",
    };
  }

  userReadyToPlay(socket) {
    const socketId = socket.id;
    // Check if the user is already in a game (in-game status)
    const isInRoom = this.isInRoom(socketId);
    const availableRoom = this.findAvailableRoom();
    if (isInRoom) return "already in game";

    if (availableRoom) {
      this.joinRoom(availableRoom, socket);
      this.startCountdown(availableRoom, socketId);
      this.playersData.set(socketId, {
        status: this.allStatus.countDown,
        roomId: availableRoom,
      });
    } else {
      const newRoomId = this.createRoom();
      this.joinRoom(newRoomId, socket);
      this.playersData.set(socketId, {
        status: "waiting",
        roomId: newRoomId,
      });
      this.io.to(socketId).emit("waiting");
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
  joinRoom(roomId, socket) {
    // Add the player's socketId to the room's players Set
    this.waitingRooms.get(roomId).players.add(socket.id);

    // Check if the room is not full and the user is not already in the room
    // Emit a "player_joined" event to notify clients in the room that a player has joined
    socket.join(roomId);
    this.io
      .to(roomId)
      .emit("player_joined", "I join you go Iam you you are not me");
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
      if (status === this.allStatus.inGame) {
        delete this.playingPlayersData.get(roomId)[socketId];
        this.io
          .to(roomId)
          .emit("room_players_data", this.playingPlayersData.get(roomId));
      }

      // deleting user from socket.io rooms
      socket.leave(roomId);
      // Remove the player from the room
      room.players.delete(socketId);

      // Notify clients in the room that the player left
      this.io.to(roomId).emit("player_left", socketId);

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
          this.roomsTimers.get(roomId).stop();
          this.roomsTimers.delete(roomId);
          this.roomsSecondEventEmitter.delete(roomId);
        }
        this.io.sockets.adapter.rooms.delete(roomId);
      }
    }

    // Remove the player from the playersData Map
    this.playersData.delete(socketId);
  }

  startGame(roomId) {
    const room = this.waitingRooms.get(roomId);
    this.roomsSecondEventEmitter.set(roomId, {
      eventEmitter: new EventEmitter(),
      listenerAdded: false,
    });
    let roomSecondEvent = this.roomsSecondEventEmitter.get(roomId);

    const roomTimer = new RoomTimer(
      this.io,
      200,
      roomId,
      this.endGame,
      roomSecondEvent.eventEmitter
    );
    this.roomsTimers.set(roomId, roomTimer);

    this.io.to(roomId).emit("counting_completed", {});
    if (room) {
      room.status = this.allStatus.inGame;
      room.timer = this.allStatus.completed;

      this.setPlayersStatus(room, this.allStatus.inGame);
    }
    this.activeRooms.set(roomId, room);
    this.waitingRooms.delete(roomId);
    this.roomsTimers.get(roomId).start();
  }

  endGame = (roomId) => {
    const room = this.activeRooms.get(roomId);
    if (room) {
      this.roomsTimers.delete(roomId);
      this.setPlayersStatus(room, this.allStatus.idle);
      this.io.sockets.adapter.rooms.delete(roomId);
      this.activeRooms.delete(roomId);
    }
  };

  stopCountdown(roomId) {
    const room = this.waitingRooms.get(roomId);
    // Get the userId of the player left alone in the room
    this.setPlayersStatus(room, this.allStatus.waiting);
    // Change the room status to this
    room.status = this.allStatus.waiting;
    this.io.to(roomId).emit("left_alone", 0);
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
      let plyrData = {};
      room.players.forEach((playerId) => {
        plyrData[playerId] = {};
      });
      this.playingPlayersData.set(roomId, plyrData);
      this.io.to(roomId).emit("match_found", cleanString(this.raceText));
    }

    if (room && room.players.size > 1 && !room.timer) {
      // Check if there are more than one player and the timer is not already running
      room.status = this.allStatus.countDown;

      room.timer = 4;
      // this.io.to(roomId).emit("match_found", this.raceText);

      this.roomCounters.set(
        roomId,
        setInterval(() => {
          this.io.to(roomId).emit("countdown_timer", room.timer);
          if (room.timer === 3) {
            room.status = this.allStatus.entranceClosed;
          }
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
    this.roomsManager = new RoomManager(io, roomCapacity); // Mapping of room IDs to timers
    io.on("connection", (socket) => {
      socket.on("user_ready_to_play", () => this.handleUserReadyToPlay(socket));
      socket.on("disconnect", () => this.handleDisconnect(socket));
      socket.on("leave_room", () => {
        this.handleLeaveRoom(socket);
      });
      socket.on("player_data", (userData) =>
        this.handlePlayerData(socket, userData)
      );
      // Listen for the 'timerChanged' event
    });
  }

  handleUserReadyToPlay(socket) {
    // Delegate room management to the RoomManager
    this.roomsManager.userReadyToPlay(socket);
  }
  handleLeaveRoom(socket) {
    this.roomsManager.leaveRoom(socket.id, socket);
    socket.emit("room_left", "");
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    this.roomsManager.leaveRoom(socket.id, socket);
  }

  handPlayerDataWpm(duration, roomId) {
    let playersData = this.roomsManager.playingPlayersData.get(roomId);
    let allPlayersCompletedRace = [];
    for (const property in playersData) {
      let plData = playersData[property];
      allPlayersCompletedRace.push(plData.isRaceCompleted);

      if (!plData?.isRaceCompleted && plData?.arrayOfwrittenWords?.length > 0) {
        plData.wpm = Math.floor(
          (plData.arrayOfwrittenWords.length / (200 - duration)) * 60
        );
      } else if (playersData[property]?.arrayOfwrittenWords?.length < 1) {
        playersData[property].wpm = 0;
      }
    }

    return { playersData, allPlayersCompletedRace };
  }
  updatePlacesBasedOnWPM(data) {
    const participants = Object.keys(data);

    participants.sort((a, b) => data[b].wpm - data[a].wpm);

    for (let i = 0; i < participants.length; i++) {
      data[participants[i]].place = i + 1;
    }

    return data;
  }
  handlePlayerData = (socket, userData) => {
    try {
      const id = socket.id;
      const player = this.roomsManager.playersData.get(id);

      if (
        player?.status === this.roomsManager.allStatus.inGame ||
        player?.status === this.roomsManager.allStatus.countDown
      ) {
        const roomId = player.roomId;

        let currRoomSecondEventEmitter =
          this.roomsManager.roomsSecondEventEmitter.get(roomId);

        if (
          currRoomSecondEventEmitter &&
          !currRoomSecondEventEmitter?.listenerAdded
        ) {
          currRoomSecondEventEmitter.eventEmitter.on(
            "timerChanged",
            ({ duration }) => {
              let playersData = this.handPlayerDataWpm(
                duration,
                roomId
              ).playersData;

              this.io.to(roomId).emit("room_players_data", playersData);
            }
          );

          // Set the listenerAdded flag to true
          currRoomSecondEventEmitter.listenerAdded = true;
        }
        // / / / / / / / / / / / / / / / /// / / / / /// / / / /
        ///  listening to the event from room timer per second
        let playersData = this.roomsManager.playingPlayersData.get(roomId);
        let allPlayersCompletedRace = [];
        playersData[id] = userData;
        let timer = this.roomsManager.roomsTimers.get(roomId);
        if (timer) {
          const duration = timer.duration;
          const playerDataNdAllPlyrsCmpltdRace = this.handPlayerDataWpm(
            duration,
            roomId
          );
          playersData = playerDataNdAllPlyrsCmpltdRace.playersData;
          allPlayersCompletedRace =
            playerDataNdAllPlyrsCmpltdRace.allPlayersCompletedRace;
        }

        // Emit the updated data for all players in the match room
        this.io.to(roomId).emit("room_players_data", playersData);

        if (
          allPlayersCompletedRace.length > 0 &&
          allPlayersCompletedRace.every(Boolean)
        ) {
          this.io
            .to(roomId)
            .emit(
              "room_players_data",
              this.updatePlacesBasedOnWPM(playersData)
            );

          this.roomsManager.roomsTimers.get(roomId).gameEnded(roomId);
        }
      }
    } catch (err) {
      console.log(err);
    }
  };
}

export default GameServer;
export { RoomManager, RoomTimer };
