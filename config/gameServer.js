import { v4 } from "uuid";

  

class GameServer {
  constructor(io) {
    this.io = io;
    this.waitingPlayers = [];
    this.playingPlayersData = {};
    this.rooms = {};
    this.playerToRoomMap = {}
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  handleConnection = (socket) => {
    socket.on('user_ready_to_play', this.playersWantToPlayHandler(socket));
    socket.on('create_room', this.createRoom(socket));
    socket.on('disconnect', this.handleDisconnect(socket));
    socket.on('player_data',this.handleUserData(socket))

};

  playersWantToPlayHandler = (socket) => () => {

    this.waitingPlayers.push(socket.id);
    const roomCapacity = 2; // Change to 4 for room capacity
    if (this.waitingPlayers.length >= roomCapacity) {


      const matchRoomName = 'match_' + v4();
      const players = this.waitingPlayers.splice(0, roomCapacity);
      

      this.rooms[matchRoomName] = {}

      players.forEach((player) => {
        this.playerToRoomMap[player] = matchRoomName
        this.io.sockets.sockets.get(player).join(matchRoomName);
      });
      
      // Emit the match found event
      this.io.to(matchRoomName).emit('match_found', matchRoomName);
      

      // Start the game in this room
      // You should implement your game logic here
    }
  };

  handleUserData =  (socket) => (userData) => {
    console.log(this.rooms)
    const roomId = this.playerToRoomMap[socket.id]
    
    this.rooms[roomId][socket.id] = userData; // Store player data for the specific room and player

    // Emit the updated data for all players in the match room
    this.io.to(roomId).emit('room_players_data', this.rooms[roomId]);

  };

  createRoom = (socket) => (roomData) => {
    if (!this.rooms[roomData.roomName]) {
      this.rooms[roomData.roomName] = { name: roomData.roomName, createdBy: socket.id };
      socket.join(roomData.roomName);
      socket.emit('room_created', `You have created/joined room: ${roomData.roomName}`);
    } else {
      socket.emit('room_created', `Room already exists: ${roomData.roomName}`);
    }
  };

  handleDisconnect = (socket) => () => {
    console.log(this.rooms)
    // Remove the user from waitingPlayers
    const index = this.waitingPlayers.indexOf(socket.id);
    if (index !== -1) {
      this.waitingPlayers.splice(index, 1);
    }

    // Handle user disconnection from activeRooms
    const roomId = this.playerToRoomMap?.[socket.id]
    const isUserInRoom = this.rooms?.[roomId]?.[socket.id]
    if (isUserInRoom) {
      delete this.rooms?.[roomId]?.[socket.id]

          if (Object.keys(this.rooms[roomId]).length === 0) {
          delete this.rooms[roomId];
        }

    }
    
    this.io.to(roomId).emit('player_disconnected', socket.id);
    console.log(this.rooms)

  };

}

export default GameServer;
