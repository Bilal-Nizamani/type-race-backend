import { v4 } from "uuid";

class ManualRoomManager {
  constructor(io, roomCapacity) {
    this.io = io;

    io.on("connection", (socket) => {
      socket.on("manual_leave_room", () => {
        this.leaveRoom(socket);
      });
      socket.on("manual_join_room", () => {
        this.joinRoom(socket);
      });
      socket.on("manual_start_race", () => {
        this.startGame(socket);
      });
      socket.on("manual_create_room", () => {
        this.createRoom(socket);
      });
      socket.on("manual_get_all_rooms", () => {
        this.getAllRooms(socket);
      });
      // socket.on("manual_kick_player");
      // socket.on("manual_get_all_messages");
      socket.on("manual_new_message", () => {
        this.handleNewMessage();
      });
      // socket.on("manual_delete_message");
      // socket.on("manual_edit_message");
    });

    this.roomCapacity = roomCapacity || 4;
    this.rooms = new Map(); // Store rooms
    this.players = new Map(); // Store player information
  }

  // new messgae
  handleNewMessage() {
    console.log("new message");
  }
  // Create a room manually
  createRoom(hostSocket) {
    console.log("creating room");
    // const roomId = v4(); // Generate a unique room ID using uuid/v4
    // const room = {
    //   id: roomId,
    //   host: hostSocket.id,
    //   members: new Set([hostSocket.id]),
    //   status: "waiting", // Status: waiting, counting, inGame
    //   gameStarted: false, // Track if the game has started
    // };

    // this.rooms.set(roomId, room);

    // // Notify the host that the room was created successfully
    // hostSocket.emit("room_created", roomId);

    // // Join the host to the room
    // hostSocket.join(roomId);
  }

  handleGetRoomMessages(socket) {
    socket.emit("get_all_messages");
  }

  handleGetAllRooms(socket) {
    socket.emit("get_all_rooms");
  }

  // Host can start the game with counting
  startGame(hostSocket, roomId) {
    console.log("starting game");
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

  // Player can join a room
  joinRoom(socket, roomId) {
    console.log("joining Room");
    // const room = this.rooms.get(roomId);

    // if (!room) {
    //   // Room doesn't exist
    //   socket.emit("room_not_found", roomId);
    //   return;
    // }

    // if (room.gameStarted || room.members.size >= this.roomCapacity) {
    //   // Game has already started or room is full
    //   socket.emit("room_full", roomId);
    //   return;
    // }

    // // Add the player to the room
    // room.members.add(socket.id);

    // // Notify the player that they successfully joined the room
    // socket.emit("room_joined", roomId);

    // // Notify all members of the room that a new player joined
    // this.io.to(roomId).emit("player_joined", socket.id);
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

  // Implement other methods as needed, e.g., kickMember, etc.
}
export default ManualRoomManager;
