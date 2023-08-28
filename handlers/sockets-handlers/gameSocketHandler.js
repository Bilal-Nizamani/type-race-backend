
const waitingPlayers = [];
const playingPlayersData = {};

const gameSocketHandler = (socket, io) => {
  const rooms = { bilal: 'f', bool: 'ss' };

  const playersWantToPlayHadler =  () => {
    waitingPlayers.push(socket.id);


    const roomCapacity = 2;
    
    if (waitingPlayers.length >= roomCapacity) {
      const players = waitingPlayers.splice(0, roomCapacity);

      const matchRoomName = `match_${players[0]}_${players[1]}`;

    socket.on('player_data', (data) => {
        if (!playingPlayersData[matchRoomName]) {
          playingPlayersData[matchRoomName] = {};
        }
        playingPlayersData[matchRoomName][socket.id] = data;
  
        // Emit the updated data for all players in the match room
        io.to(matchRoomName).emit('room_players_data', playingPlayersData[matchRoomName]);
      });
      players.forEach((player) => {
        io.sockets.sockets.get(player).join(matchRoomName);
      });

      // Set up listener for player data
      

      // Emit the match found event
      io.to(matchRoomName).emit('match_found', matchRoomName);
    }
  };


      socket.on('user_ready_to_play',playersWantToPlayHadler)





      socket.on('create_room', (roomData) => {
        const romeExist  =   Object.keys(rooms).includes(roomData.roomName)
          if(!romeExist){
              rooms[roomData.roomName] = { name: roomData.roomName, userName:roomData.userName,  createdBy: socket.id };
              socket.join(roomData.roomName);
  
              socket.emit('room_created', `You have created/joined room: ${roomData.roomName}`);
  
          }else{
              socket.emit('room_created', `room already exist: ${roomData.roomName}`);
  
          }
        });

        socket.on('disconnect', () => {
            const index = waitingPlayers.indexOf(socket.id);
            if (index !== -1) {
              waitingPlayers.splice(index, 1);
            }
          });

}

export default gameSocketHandler