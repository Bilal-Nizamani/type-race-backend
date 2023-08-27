

const gameSocketHandler = (socket)=>{
    console.log(`user is connected ${socket.id}` )
      
    socket.on('game_started',(data)=>{
      console.log(`game is started ${data.isGameStarted}`)
    })
    socket.on('randomNumber',(data)=>{
          socket.broadcast.emit('receive_message',{number:data.rdmNumber})
    })

}

export default gameSocketHandler