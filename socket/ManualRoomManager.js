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
    this.players = new Map(); // Store player information

    this.io.on("connection", (socket) => {
      socket.on("disconnect", () => this.handleDisconnect(socket));

      socket.on("manual_leave_room", () => {
        this.leaveRoom(socket);
      });

      socket.on("manual_join_room", (roomInfo) => {
        this.joinRoom(socket, roomInfo);
      });

      socket.on("manual_start_race", () => {
        this.startCounting(socket);
      });
      socket.on("player_info", (playerInfo) => {
        console.log("beignCAlled");
        let copyPlayerInfo = { ...playerInfo };
        copyPlayerInfo["playerId"] = socket.id;
        this.connectedPlayersInfo.set(socket.id, copyPlayerInfo);
      });

      socket.on("manual_create_room", (roomInfo) => {
        this.createRoom(socket, roomInfo);
      });

      socket.on("get_all_rooms", () => {
        socket.emit("get_rooms", {
          activeRooms: Array.from(this.activeRooms),
          waitingRooms: Array.from(this.waitingRooms),
          roomsInCounting: Array.from(this.countingRooms),
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
    const roomId = v4(); // Generate a unique room ID using uuid/v4
    const room = {
      id: roomId,
      roomName: roomInfo.roomName,
      host: this.connectedPlayersInfo.get(hostSocket.id),
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
    hostSocket.broadcast.emit("new_room_added", room);
    hostSocket.emit("room_created", room);
  }

  // Player can join a room
  joinRoom(socket, roomId) {
    console.log("joining Room");
    const room = this.waitingRooms.get(roomId);

    if (!room) {
      // Room doesn't exist
      socket.emit("room_not_found", roomId);
      return;
    }

    if (room.roomFull) {
      // Game has already started or room is full
      socket.emit("room_full", roomId);
      return;
    }

    //  Add the player to the room
    room.members.add(socket.id);

    //  Notify the player that they successfully joined the room
    socket.emit("room_joined", roomId);
    if (room.members.size >= this.roomCapacity) {
      room.roomFull = true;
    } // // Notify all members of the room that a new player joined
    this.io.to(roomId).emit("player_joined", socket.id);
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

  // Player can leave the room
  leaveRoom(socket, roomId) {
    console.log("leaving room");
    // const room = this.rooms.get(roomId);
    // if (!room) {
    //   // Room doesn't exist
    //   socket.emit("room_not_found", roomId);
    //   return;
    // }
    // // Remove the player from the room
    // room.members.delete(socket.id);
    // // Notify all members of the room that the player left
    // this.io.to(roomId).emit("player_left", socket.id);
    // if (room.members.size === 0) {
    //   // Room is empty, delete it
    //   this.rooms.delete(roomId);
    // } else if (room.host === socket.id) {
    //   // Host left, assign a new host
    //   const newHostId = Array.from(room.members)[0]; // Assign the first member as the new host
    //   if (newHostId) {
    //     room.host = newHostId;
    //     // Notify the new host that they are now the host
    //     this.io.to(newHostId).emit("you_are_host", roomId);
    //   }
    // }
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    console.log("disconeted");
    // this.roomsManager.leaveRoom(socket.id, socket);
  }

  // Implement other methods as needed, e.g., kickMember, etc.
}
export default ManualRoomManager;
