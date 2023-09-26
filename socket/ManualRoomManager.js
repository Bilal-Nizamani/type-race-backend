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

    this.io.on("connection", (socket) => {
      socket.on("disconnect", () => this.handleDisconnect(socket));

      socket.on("manual_leave_room", () => {
        this.leaveRoom(socket);
      });

      socket.on("manual_join_room", (roomId) => {
        this.joinRoom(socket, roomId);
      });

      socket.on("manual_start_race", () => {
        this.startCounting(socket);
      });

      socket.on("player_info", (playerInfo) => {
        console.log("beignCAlled");
        let copyPlayerInfo = { ...playerInfo };
        copyPlayerInfo["playerId"] = socket.id;
        copyPlayerInfo["status"] = "not-in-room";
        copyPlayerInfo["roomId"] = null;
        copyPlayerInfo["role"] = "idle";
        this.connectedPlayersInfo.set(socket.id, copyPlayerInfo);
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

      // socket.on("manual_kick_player");
      // socket.on("manual_get_all_messages");
      socket.on("manual_new_message", () => {
        this.handleNewMessage();
      });
      // socket.on("manual_delete_message");
      // socket.on("manual_edit_message");
    });
  }

  // new messgae
  handleNewMessage() {
    console.log("new message");
  }
  // Create a room manually
  createRoom(hostSocket, roomInfo) {
    let hostData = this.connectedPlayersInfo.get(hostSocket.id);
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

    if (!room) {
      socket.emit("room_not_found", roomId);
      return;
    }

    if (room.members.length > 4) {
      // Game has already started or room is full
      socket.emit("room_full", roomId);
      return;
    }
    const player = this.connectedPlayersInfo.get(socket.id);
    //  Add the player to the room
    room.members[socket.id] = player;

    //  Notify the player that they successfully joined the room
    player.status = "waiting";
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

  startCounting(hostSocket, roomId) {
    let room = this.waitingRooms.get(roomId);
    if (room && room.hostId === hostSocket.id) {
      this.countingRooms.set(roomId, room);
      this.waitingRooms.delete(roomId);
      this.roomCounters.set(
        roomId,
        new GameStartCounter(this.io, roomId, this.startGame, hostSocket.id, 10)
      );
    }
  }

  stopCounting(hostSocket, roomId) {
    let room = this.countingRooms.get(roomId);

    if (room && hostSocket.id === room.hostId) {
      this.waitingRooms.set(roomId, room);
      this.countingRooms.delete(roomId);
      this.io.emit("room_created");
    }
  }

  updateRoom(rooms, player, socket) {
    // let waitingRoom = this.waitingRooms.get(player.roomId);
    let room = rooms.get(player.roomId);
    console.log("leave room");
    if (room) {
      if (player.role === "host") {
        player.role = "idle";
        const playersKeys = Object.keys(room.members);
        if (playersKeys.length > 0) {
          room.host = room.members[playersKeys[0]];
          delete room.members[playersKeys[0]];
          this.connectedPlayersInfo.get(playersKeys[0]).role = "host";
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
    let player = this.connectedPlayersInfo.get(socket.id);

    if (player.status === "in-game") {
      // let activeRoom = this.activeRooms.get(player.roomId);
      this.updateRoom(this.activeRooms, player);
    } else if (player.status === "waiting") {
      this.updateRoom(this.waitingRooms, player, socket);

      player.status = "not-in-room";
    } else if (player.status === "counting") {
      updateRoom(this.countingRooms, player, socket);
    } else {
      console.log("dont know what");
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
