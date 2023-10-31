import express from "express";
import { createServer } from "http";
import GameServer from "./socket/GameServer.js";
import cors from "cors";
import { Server } from "socket.io";
import { createMongoConnection } from "./config/database.js";
import dotenv from "dotenv";
import router from "./routes/index.js";
import passport from "passport";
dotenv.config();
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;

createMongoConnection(dbUrl);
// import "./models/user";
import configurePassport from "./config/passport.js";
configurePassport(passport);

// import setSocketRedisAdapter from "./config/setSocketRedisAdapter.js";
const app = express();

app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const gameServer = new GameServer(io);

app.use(router);
const serverIsRunning = () => {
  console.log("Server is running", port);
};

server.listen(port, serverIsRunning);
