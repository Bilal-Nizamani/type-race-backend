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
        copyPlayerInfo["status"] = "not-in-room";
        copyPlayerInfo["roomId"] = null;
        copyPlayerInfo["role"] = "idle";
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
      this.leaveRoom(kickedPlayerSockect, kickedPlayer.roomId);
    } else {
      console.log("you are not he host");
      return;
    }
    kickedPlayerSockect.emit("got_kicked", "you were kicked");
  }

  // Create a room manually
  createRoom(hostSocket, roomInfo) {
    let hostData = this.connectedPlayersInfo.get(hostSocket.id)?.data;

    if (hostData.status !== "not-in-room") return;

    hostData.roomId;
    const roomId = v4(); // Generate a unique room ID using uuid/v4
    hostData.roomId = roomId;
    hostData.role = "host";
    const room = {
      id: roomId,
      roomName: roomInfo.roomName,
      host: hostData,
      members: {},
      status: "waiting", // Status: waiting, counting, inGame
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
    hostData.status = "waiting";
  }

  // Player can join a room
  joinRoom(socket, roomId) {
    console.log("joining Room");
    const room = this.waitingRooms.get(roomId);

    console.log(this.waitingRooms);
    console.log(this.countingRooms);
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
    player.status = "waiting";
    player.role = "in-room";
    player.roomId = roomId;
    socket.emit("room_joined", room);
    socket.join(roomId);
    // / / // / // / //
    this.io.to(room.id).emit("room_data_changed", room);
    this.io.to(roomId).emit("someone_jonied_room", player.userName);
    // Notify all members of the room that a new player joined
    this.io.emit("room_data_updated", room);
    console.log("room-joined");
  }

  handleGetRoomMessages(socket) {
    socket.emit("get_all_messages");
  }

  // Host can start the game with counting
  startGame(hostSocket, roomId) {
    // const room = this.rooms.get(roomId);
    // if (!room) {
    //   // Room doesn't exist
    //   hostSocket.emit("room_not_found", roomId);
    //   return;
    // }
    // if (room.host !== hostSocket.id) {
    //   // Only the host can start the game
    //   hostSocket.emit("not_host", roomId);
    //   return;
    // }
    // if (room.members.size < 2) {
    //   // There must be at least two members to start the game
    //   hostSocket.emit("not_enough_players", roomId);
    //   return;
    // }
    // if (room.status === "counting") {
    //   // Counting is already in progress
    //   hostSocket.emit("counting_in_progress", roomId);
    //   return;
    // }
    // // Set status to counting
    // room.status = "counting";
    // // Notify all members of the room that counting has started
    // this.io.to(roomId).emit("counting_started");
    // // Implement your counting logic here
    // // You can use timers or other mechanisms for counting
    // // For example, simulate a 3-second countdown
    // let countdown = 3;
    // const countdownInterval = setInterval(() => {
    //   this.io.to(roomId).emit("countdown_timer", countdown);
    //   if (countdown <= 0) {
    //     // Stop the countdown and start the game
    //     clearInterval(countdownInterval);
    //     room.status = "inGame"; // Set status to inGame
    //     room.gameStarted = true; // Game is now started
    //     // Notify all members of the room that the game has started
    //     this.io.to(roomId).emit("game_started");
    //   }
    //   countdown--;
    // }, 1000);
  }

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
      this.changeStatusHandler(room, "counting");

      this.countingRooms.set(roomId, room);
      this.waitingRooms.delete(roomId);
      this.roomCounters.set(
        roomId,
        new GameStartCounter(this.io, roomId, this.startGame, hostSocket.id, 10)
      );
      this.roomCounters.get(roomId).start();
    }
  }
  handleCancelCounting(socket) {
    let player = this.connectedPlayersInfo.get(socket.id)?.data;
    let roomId = player.roomId;
    let room = this.countingRooms.get(roomId);
    this.changeStatusHandler(room, "waiting");
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

    if (room?.status === "counting") {
      if (playersKeys.length - 1 < 1) {
        this.countingRooms.delete(player.roomId);
        this.waitingRooms.set(player.roomId, room);
      }
      let counter = this.roomCounters.get(player.roomId);
      if (counter) counter.cancelCounting();
      this.changeStatusHandler(room, "waiting");
    }

    if (room) {
      if (player.role === "host") {
        player.role = "idle";
        if (playersKeys.length > 0) {
          room.host = room.members[playersKeys[0]];
          delete room.members[playersKeys[0]];
          this.connectedPlayersInfo.get(playersKeys[0]).data.role = "host";
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
      if (player.status === "in-game") {
        this.updateRoom(this.activeRooms, player, socket);
        player.status = "not-in-room";
      } else if (player.status === "waiting") {
        this.updateRoom(this.waitingRooms, player, socket);

        player.status = "not-in-room";
      } else if (player.status === "counting") {
        console.log("deleting from couting");
        this.updateRoom(this.countingRooms, player, socket);
        player.status = "not-in-room";
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
