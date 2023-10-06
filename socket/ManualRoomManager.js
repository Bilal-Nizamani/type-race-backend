import { v4 } from "uuid";
import GameStartCounter from "./GameCounter.js";

class ManualRoomManager {
  constructor(io, roomCapacity) {
    this.io = io.of("/manual-rooms");

    this.roomCapacity = roomCapacity || 4;
    this.activeRooms = new Map(); // Store rooms
    this.waitingRooms = new Map();
    this.countingRooms = new Map();
    this.connectedPlayersInfo = new Map();
    this.roomCounters = new Map();
    this.allRoomsMessages = new Map();
    this.roles = {
      host: "host",
      idle: "idle",
      inRoom: "in-room",
    };
    this.status = {
      counting: "counting",
      waiting: "waiting",
      inGame: "in-game",
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
    if (this.connectedPlayersInfo.get(socket.id).data.status === "waiting") {
      const kickedPlayerSockect = this.connectedPlayersInfo.get(
        kickedPlayer.playerId
      ).socket;
      if (
        this.waitingRooms.get(kickedPlayer.roomId).host.playerId === socket.id
      ) {
        this.leaveRoom(kickedPlayerSockect, kickedPlayer.roomId);
      } else {
        console.log("you are not he host");
        return;
      }
      kickedPlayerSockect.emit("got_kicked", "you were kicked");
    }
  }

  // Create a room manually
  createRoom(hostSocket, roomInfo) {
    let hostData = this.connectedPlayersInfo.get(hostSocket.id)?.data;

    if (hostData.status !== this.status.notInRoom) return;

    hostData.roomId;
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
  startGame = (roomId) => {
    try {
      let room = this.countingRooms.get(roomId);
      this.changeStatusHandler(room, this.status.inGame);
      this.activeRooms.set(roomId, room);
      this.countingRooms.delete(roomId);

      if (!room) {
        throw new Error("Room Does not exist");
      }
      this.roomCounters.get(roomId).start(3, "game-counting");
      console.log(this.roomCounters.get(roomId).roomId);
    } catch (err) {
      console.log(err);
    }
  };

  changeStatusHandler(room, status) {
    Object.keys(room.members).forEach((key) => {
      room.members[key].status = status;
    });
    room.host.status = status;
    room.status = status;
  }

  startCounting(hostSocket) {
    const host = this.connectedPlayersInfo.get(hostSocket.id)?.data;
    const roomId = host.roomId;
    let room = this.waitingRooms.get(roomId);
    if (room && room.host.playerId === hostSocket.id && !room.timer) {
      this.changeStatusHandler(room, this.status.counting);

      this.countingRooms.set(roomId, room);
      this.waitingRooms.delete(roomId);

      this.roomCounters.set(
        roomId,
        new GameStartCounter(this.io, roomId, this.startGame, hostSocket.id)
      );
      this.roomCounters.get(roomId).start(3, "room-counting");
    }
  }
  handleCancelCounting(socket) {
    let player = this.connectedPlayersInfo.get(socket.id)?.data;
    let roomId = player.roomId;
    let room = this.countingRooms.get(roomId);
    this.changeStatusHandler(room, this.status.waiting);
    this.waitingRooms.set(roomId, room);
    this.countingRooms.delete(roomId);
    let counter = this.roomCounters.get(roomId);
    if (counter) counter.cancelCounting();
  }

  // stopCounting(hostSocket, roomId) {
  //   let room = this.countingRooms.get(roomId);

  //   if (room && hostSocket.id === room.hostId) {
  //     this.waitingRooms.set(roomId, room);
  //     this.countingRooms.delete(roomId);
  //     this.io.emit("room_created");
  //   }
  // }

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
      this.changeStatusHandler(room, this.status.waiting);
    }

    if (room) {
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
      } else if (player.status === this.status.waiting) {
        this.updateRoom(this.waitingRooms, player, socket);

        player.status = this.status.notInRoom;
      } else if (player.status === this.status.counting) {
        console.log("deleting from couting");
        this.updateRoom(this.countingRooms, player, socket);
        player.status = this.status.notInRoom;
      } else {
        console.log("dont know what");
      }
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
