import RoomTimer from "./RoomTimer.js";
import { v4 } from "uuid";
import EventEmitter from "events";
import { cleanString } from "../utils/serviceFunction.js";

/**  
*?RoomMangaer      || handles rooms createion and joining 
  allStatus  ||| status are for the rooms and players  which state he is status is assigned to him or to the room
                 if in game @in_game waiting @waiting if countDown @count_down
 this.callback ||| (1) calling call back funtion when counter is completed 
                   (2) stop function is called from GameServer Class if only one player is left in rooms
*/
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
    this.raceText =
      "If you push someone too hard in one direction, they're just going to run three times faster in the other direction.";
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

      room.timer = 10;
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

export default RoomManager;
