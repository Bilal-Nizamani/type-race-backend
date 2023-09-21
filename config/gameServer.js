/** 
*?GamerServer      || handles games mani logic
 user_ready_to_play||| emits every second game duration
 player_data       ||| emits when timer is reached its duration
 game_started      ||| it listens on game_sarted to get track of when game is started
 match_found       |||  when room length reached and room is joined it sends match_found to frontend
 room_players_data ||| emits when ever all users data when ever data is changed
*/

import ManualRoomManager from "./ManualRoomManager.js";
import RoomManager from "./RoomManager.js";

class GameServer {
  constructor(io, roomCapacity) {
    this.io = io;
    this.manualRoomManager = new ManualRoomManager(io, 5);
    this.roomsManager = new RoomManager(io, roomCapacity); // Mapping of room IDs to timers
    io.on("connection", (socket) => {
      console.log(socket.id);
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
    console.log("user-ready-to-play");
    // Delegate room management to the RoomManager
    this.roomsManager.userReadyToPlay(socket);
  }
  handleLeaveRoom(socket) {
    this.roomsManager.leaveRoom(socket.id, socket);
    socket.emit("room_left", "");
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    console.log("disconeted");
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
