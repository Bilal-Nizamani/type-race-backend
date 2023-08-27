import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from  'dotenv'

dotenv.config()



// const databaseUrl = process.env.DATABASE_URL;

const corsUrl = process.env.CORS_URL
const port = process.env.PORT;

const app = express();
const server = createServer(app);



const io = new Server(server, {
  cors:{
    origin:corsUrl,
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
  console.log('Server is running', port);
}

server.listen(port, serverIsRunning);
