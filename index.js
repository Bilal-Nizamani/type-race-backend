import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";


const app = express();
const server = createServer(app);



const io = new Server(server, {
  cors:{
    origin:'http://localhost:3000',
    methods:['GET', 'POST']
  }
})

io.on('connection',(socket)=>{  
  console.log(`user is connected ${socket.id}` )

  socket.on('game_started',(data)=>{
    console.log(`game is started ${data.isGameStarted}`)
  })
  socket.on('randomNumber',(data)=>{
    console.log(data)
        socket.broadcast.emit('receive_message',{number:data.rdmNumber})
  })
})

const serverIsRunning = () => {
  console.log('Server is running');
}

server.listen(3001, serverIsRunning);
