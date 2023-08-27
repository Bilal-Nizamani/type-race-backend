import express from "express";
import { createServer } from "http";
import dotenv from  'dotenv'
dotenv.config()
import createSocketConnection from "./config/socket.js";

const port = process.env.PORT;


const app = express();

const server = createServer(app);

createSocketConnection(server)

const serverIsRunning = () => {
  console.log('Server is running', port);
}

server.listen(port, serverIsRunning);
