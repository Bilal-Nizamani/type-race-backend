import express from "express";
import { createServer } from "http";
import GameServer from "./socket/GameServer.js";
import cors from "cors";
import { Server } from "socket.io";
import { createMongoConnection } from "./config/database.js";
import dotenv from "dotenv";
import router from "./routes/index.js";
import passport from "passport";
import configurePassport from "./config/passport.js";

dotenv.config();
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
createMongoConnection(dbUrl);
configurePassport(passport);

const app = express();

app.use(cors());

// import setSocketRedisAdapter from "./config/setSocketRedisAdapter.js";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Instead of using body-parser middleware, use the new Express implementation of the same thing
app.use(passport.initialize());

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
