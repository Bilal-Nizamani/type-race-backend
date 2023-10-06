class ManualRoomGameServer {
  constructor(io, roomCapacity) {
    this.io = io;
    io.on("connection", (socket) => {
      console.log("connected");
      socket.on("disconnect", () => this.handleDisconnect(socket));

      socket.on("player_data", (userData) =>
        this.handlePlayerData(socket, userData)
      );
      // Listen for the 'timerChanged' event
    });
    this.manualRoomManager = new ManualRoomManager(io, 5);
  }

  handleDisconnect(socket) {
    // Delegate disconnect handling to the RoomManager
    console.log("disconeted");
    this.manualRoomManager.leaveRoom(socket.id, socket);
  }

  handPlayerDataWpm(duration, roomId) {
    let playersData = this.manualRoomManager.playingPlayersData.get(roomId);
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
      const player = this.manualRoomManager.connectedPlayersInfo.get(id);

      if (
        player?.status === this.manualRoomManager.allStatus.inGame ||
        player?.status === this.manualRoomManager.allStatus.countDown
      ) {
        const roomId = player.roomId;

        // let currRoomSecondEventEmitter =
        //   this.manualRoomManager.roomsSecondEventEmitter.get(roomId);

        // if (
        //   currRoomSecondEventEmitter &&
        //   !currRoomSecondEventEmitter?.listenerAdded
        // ) {
        //   currRoomSecondEventEmitter.eventEmitter.on(
        //     "timerChanged",
        //     ({ duration }) => {
        //       let playersData = this.handPlayerDataWpm(
        //         duration,
        //         roomId
        //       ).playersData;

        //       this.io.to(roomId).emit("room_players_data", playersData);
        //     }
        //   );
        //   // Set the listenerAdded flag to true
        //   currRoomSecondEventEmitter.listenerAdded = true;
        // }
        // / / / / / / / / / / / / / / / /// / / / / /// / / / /
        ///  listening to the event from room timer per second
        let playersData = this.manualRoomManager.playingPlayersData.get(roomId);
        let allPlayersCompletedRace = [];
        playersData[id] = userData;
        let timer = this.manualRoomManager.roomsTimers.get(roomId);
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

          this.manualRoomManager.roomsTimers.get(roomId).gameEnded(roomId);
        }
      }
    } catch (err) {
      console.log(err);
    }
  };
}

export default ManualRoomGameServer;
