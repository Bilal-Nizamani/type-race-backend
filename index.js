import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import GameServer from "./socket/GameServer.js";
import cors from "cors";
import { Server } from "socket.io";
import { createMongoConnection } from "./config/database.js";

// import setSocketRedisAdapter from "./config/setSocketRedisAdapter.js";

dotenv.config();

const port = process.env.PORT;

const app = express();
app.use(cors());
const server = createServer(app);
createMongoConnection();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const gameServer = new GameServer(io);

const serverIsRunning = () => {
  console.log("Server is running", port);
};

server.listen(port, serverIsRunning);
