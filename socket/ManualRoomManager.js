import { v4 } from "uuid";
import GameStartCounter from "./GameCounter.js";
import RoomTimer from "./RoomTimer.js";
import EventEmitter from "events";
import texts from "../utils/ractTexts.js";
import { cleanString } from "../utils/serviceFunction.js";

class ManualRoomManager {
  constructor(io, roomCapacity) {
    this.io = io;
    this.roomCapacity = roomCapacity || 4;
    this.activeRooms = new Map(); // Store rooms
    this.waitingRooms = new Map();
    this.countingRooms = new Map();
    this.connectedPlayersInfo = new Map();
    this.roomCounters = new Map();
    this.allRoomsMessages = new Map();
    this.roomsTimers = new Map();
    this.playingPlayersData = new Map();
    this.roomsSecondEventEmitter = new Map();

    this.roles = {
      host: "host",
      idle: "idle",
      inRoom: "in-room",
    };
    this.status = {
      counting: "counting",
      waiting: "waiting",
      inGame: "in-game",
      checkingResult: "checking-result",
      notInRoom: "not-in-room",
    };

    this.io.on("connection", (socket) => {
      socket.on("disconnect", () => this.handleDisconnect(socket));

      socket.on("manual_leave_room", () => {
        this.leaveRoom(socket);
      });

      socket.on("manual_join_room", (roomId) => {
        this.joinRoom(socket, roomId);
      });

      socket.on("cancel_counting", () => {
        this.handleCancelCounting(socket);
      });

      socket.on("manual_start_race", () => {
        this.startCounting(socket);
      });
      socket.on("get_back_to_room", () => {
        this.handleGetBackToRoom(socket);
      });
      socket.on("racegame_mounted", () => {
        const player = this.connectedPlayersInfo.get(socket.id).data;

        if (
          player.role === this.roles.host &&
          player.status === this.status.counting
        )
          this.startGame(player.roomId);
      });

      socket.on("player_info", (playerInfo) => {
        let copyPlayerInfo = { ...playerInfo };
        copyPlayerInfo["playerId"] = socket.id;
        copyPlayerInfo["status"] = this.status.notInRoom;
        copyPlayerInfo["roomId"] = null;
        copyPlayerInfo["role"] = this.roles.idle;
        const playerData = { socket: socket, data: copyPlayerInfo };
        this.connectedPlayersInfo.set(socket.id, playerData);
      });

      socket.on("manual_create_room", (roomInfo) => {
        this.createRoom(socket, roomInfo);
      });

      socket.on("get_all_rooms", () => {
        socket.emit("get_rooms", {
          activeRooms: Object.fromEntries(this.activeRooms),
          waitingRooms: Object.fromEntries(this.waitingRooms),
          roomsInCounting: Object.fromEntries(this.countingRooms),
        });
      });
      socket.on("kick", (kickedPlayer) => {
        this.handlKickPlayer(socket, kickedPlayer);
      });

      // socket.on("manual_kick_player");
      // socket.on("manual_get_all_messages");
      socket.on("manual_new_message", (message) => {
        this.handleNewMessage(socket.id, message);
      });
      // socket.on("manual_delete_message");
      // socket.on("manual_edit_message");
    });
  }

  // new message
  handleNewMessage(sockeId, message) {
    let player = this.connectedPlayersInfo.get(sockeId)?.data;
    let updatedMessage = {
      playerId: player.playerId,
      name: player.name,
      message: message,
      userName: player.userName,
    };
    this.allRoomsMessages.get(player.roomId).push(updatedMessage);
    this.io.to(player.roomId).emit("new_message_added", updatedMessage);
  }
  handlKickPlayer(socket, kickedPlayer) {
    const kickedPlayerSockect = this.connectedPlayersInfo.get(
      kickedPlayer.playerId
    ).socket;
    if (
      this.waitingRooms.get(kickedPlayer.roomId).host.playerId === socket.id
    ) {
      let player = this.connectedPlayersInfo.get(kickedPlayer.playerId)?.data;
      player.status = "waiting";
      this.leaveRoom(kickedPlayerSockect);
    } else {
      console.log("you are not he host");
      return;
    }
    kickedPlayerSockect.emit("got_kicked", "you were kicked");
  }

  handleGetBackToRoom(socket) {
    let player = this.connectedPlayersInfo.get(socket.id).data;
    if (!player?.roomId) {
      socket.emit("game_left", {});

      return;
    }
    let room = this.waitingRooms.get(player.roomId);
    player.status = "waiting";
    if (player.role === "host") {
      room.host.status = this.status.waiting;
    } else room.members[socket.id].status = "waiting";
    this.io.emit("room_data_updated", room);
    socket.emit("game_left", {});
  }

  // Create a room manually
  createRoom(hostSocket, roomInfo) {
    let hostData = this.connectedPlayersInfo.get(hostSocket.id)?.data;

    if (hostData.status !== this.status.notInRoom) return;

    const roomId = v4(); // Generate a unique room ID using uuid/v4
    hostData.roomId = roomId;
    hostData.role = this.roles.host;
    const room = {
      id: roomId,
      roomName: roomInfo.roomName,
      host: hostData,
      members: {},
      status: this.status.waiting, // Status: waiting, counting, inGame
      gameStarted: false, // Track if the game has started
      timer: null,
      roomFull: false,
    };
    this.allRoomsMessages.set(roomId, []);
    this.waitingRooms.set(roomId, room);

    // Notify the host that the room was created successfully
    // Join the host to the room
    hostSocket.join(roomId);
    this.io.emit("new_room_added", room);
    hostSocket.emit("room_created", room);
    hostData.status = this.status.waiting;
  }

  // Player can join a room
  joinRoom(socket, roomId) {
    const room = this.waitingRooms.get(roomId);
    if (room.roomFull) return;

    if (!room) {
      socket.emit("room_not_found", roomId);
      return;
    }

    if (room.members.length > 4) {
      // Game has already started or room is full
      socket.emit("room_full", roomId);
      return;
    }
    const player = this.connectedPlayersInfo.get(socket.id).data;
    //  Add the player to the room
    room.members[socket.id] = player;
    if (Object.keys(room.members).length > 2) room.roomFull = true;
    //  Notify the player that they successfully joined the room
    player.status = this.status.waiting;
    player.role = this.roles.inRoom;
    player.roomId = roomId;
    socket.emit("room_joined", room);
    socket.join(roomId);

    this.io.to(room.id).emit("room_data_changed", room);
    this.io.to(roomId).emit("someone_jonied_room", player.userName);
    // Notify all members of the room that a new player joined
    this.io.emit("room_data_updated", room);
  }

  handleGetRoomMessages(socket) {
    socket.emit("get_all_messages");
  }

  // Host can start the game with counting
  startGame(roomId) {
    try {
      let room = this.countingRooms.get(roomId);
      this.changeStatusHandler(room, this.status.inGame, this.status.inGame);
      this.activeRooms.set(roomId, room);
      this.countingRooms.delete(roomId);
      let plyrData = { ...room.members, [room.host.playerId]: room.host };

      this.playingPlayersData.set(roomId, plyrData);
      if (!room) {
        throw new Error("Room Does not exist");
      }
      this.io
        .to(roomId)
        .emit(
          "match_found",
          cleanString(texts[Math.floor(Math.random() * texts.length)])
        );
      this.io.emit("room_data_updated", room);

      this.roomCounters
        .get(roomId)
        .start(3, "game-counting", this.startGameTimer);
    } catch (err) {
      console.log(err);
    }
  }
  endGame = (roomId) => {
    let room = this.activeRooms.get(roomId);
    if (room) {
      this.changeStatusHandler(
        room,
        this.status.checkingResult,
        this.status.waiting
      );
      room.status = "waiting";
      this.waitingRooms.set(roomId, room);
      this.activeRooms.delete(roomId);
      this.io.emit("room_data_updated", room);
    }
  };
  startGameTimer = (roomId) => {
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
    this.io.to(roomId).emit("counting_completed", "count");
    this.roomsTimers.set(roomId, roomTimer);

    this.roomsTimers.get(roomId).start();
  };

  changeStatusHandler(room, playersStatus, roomStatus) {
    try {
      Object.keys(room.members).forEach((key) => {
        room.members[key].status = playersStatus;
      });
      room.host.status = playersStatus;
      room.status = roomStatus;
    } catch (err) {
      console.log(err);
    }
  }

  startCounting(hostSocket) {
    const host = this.connectedPlayersInfo.get(hostSocket.id)?.data;
    const roomId = host.roomId;
    let room = this.waitingRooms.get(roomId);
    if (room && room.host.playerId === hostSocket.id && !room.timer) {
      this.changeStatusHandler(
        room,
        this.status.counting,
        this.status.counting
      );
      this.countingRooms.set(roomId, room);

      this.waitingRooms.delete(roomId);

      this.roomCounters.set(roomId, new GameStartCounter(this.io, roomId));
      this.io.emit("room_data_updated", room);
      this.roomCounters.get(roomId).start(3, "room-counting");
    }
  }
  handleCancelCounting(socket) {
    let player = this.connectedPlayersInfo.get(socket.id)?.data;
    let roomId = player.roomId;
    let room = this.countingRooms.get(roomId);
    this.changeStatusHandler(room, this.status.waiting, this.status.waiting);
    this.waitingRooms.set(roomId, room);
    this.countingRooms.delete(roomId);
    let counter = this.roomCounters.get(roomId);
    if (counter) counter.cancelCounting();
    this.io.emit("room_data_updated", room);
  }

  updateRoom(rooms, player, socket) {
    // let waitingRoom = this.waitingRooms.get(player.roomId);
    let room = rooms.get(player.roomId);
    const playersKeys = room?.members && Object.keys(room.members);

    if (room?.status === this.status.counting) {
      if (playersKeys.length - 1 < 1) {
        this.countingRooms.delete(player.roomId);
        this.waitingRooms.set(player.roomId, room);
      }
      let counter = this.roomCounters.get(player.roomId);
      if (counter) counter.cancelCounting();
      this.changeStatusHandler(room, this.status.waiting, this.status.waiting);
    }

    if (room) {
      room.roomFull = false;
      if (player.role === this.roles.host) {
        player.role = this.roles.host;
        if (playersKeys.length > 0) {
          room.host = room.members[playersKeys[0]];
          delete room.members[playersKeys[0]];
          this.connectedPlayersInfo.get(playersKeys[0]).data.role =
            this.roles.host;
          // host lef the room
          this.io.to(room.id).emit("room_data_changed", room);
          this.io.emit("room_data_updated", room);
        } else {
          console.log("deleting");
          this.io.emit("room_deleted", room);
          rooms.delete(player.roomId);
        }
      } else {
        delete room.members[player.playerId];

        // player left the room

        this.io.to(room.id).emit("room_data_changed", room);
        this.io.emit("room_data_updated", room);
      }
      socket.leave(room.id);
    } else {
      console.log("no room found");
    }
  }

  // Player can leave the room
  leaveRoom(socket) {
    console.log("leaving room");
    let player = this.connectedPlayersInfo.get(socket.id)?.data;
    if (player) {
      if (player.status === this.status.inGame) {
        this.updateRoom(this.activeRooms, player, socket);
        player.status = this.status.notInRoom;
        // deleting data playing players data if user left and then chekcing if there are nto players in room
        // delete the selecd playig room
        let playingRoom = this.playingPlayersData.get(player?.roomId);
        delete playingRoom[player.playerId];
        if (Object.keys(playingRoom).length < 1) {
          this.playingPlayersData.delete(player.roomId);
        }
      } else if (
        player.status === this.status.waiting ||
        player.status === this.status.checkingResult
      ) {
        this.updateRoom(this.waitingRooms, player, socket);

        player.status = this.status.notInRoom;
      } else if (player.status === this.status.counting) {
        console.log("deleting from couting");
        this.updateRoom(this.countingRooms, player, socket);
        player.status = this.status.notInRoom;
      } else {
        console.log("dont know what");
      }
      player.roomId = null;
    } else {
      console.log("no player");
    }
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    this.leaveRoom(socket);
    this.connectedPlayersInfo.delete(socket.id);
    console.log("disconeted");
    // this.roomsManager.leaveRoom(socket.id, socket);
  }

  // Implement other methods as needed, e.g., kickMember, etc.
}
export default ManualRoomManager;
