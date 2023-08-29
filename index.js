import express from "express";
import { createServer } from "http";
import dotenv from  'dotenv'
import GameServer from "./config/gameServer.js";
import cors from "cors"; // Import cors
import { Server } from "socket.io";
dotenv.config()

const port = process.env.PORT;


const app = express();
app.use(cors())

const server = createServer(app)
const corsUrl = process.env.CORS_URL

      const  io = new Server(server, {
    cors:{
        origin:corsUrl,
        methods:['GET', 'POST']
    }
    })
const gameServer = new GameServer(io)


const serverIsRunning = () => {
  console.log('Server is running', port);
}

server.listen(port, serverIsRunning);
