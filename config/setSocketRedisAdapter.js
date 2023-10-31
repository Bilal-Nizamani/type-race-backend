import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";

const setSocketRedisAdapter = async (server, corsUrl) => {
  try {
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
    console.log("before connections");

    const pubClient = createClient({ url: "redis://localhost:6379" });
    pubClient.on("error", (err) => console.log("Redis Client Error", err));
    const subClient = pubClient.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      return io;
    });
  } catch (err) {
    console.error("Error setting up Redis adapter:", err);
    // throw err; // Optionally throw the error
    return null; // Or return null to indicate failure
  }
};

export default setSocketRedisAdapter;
createClient({
  username: "type-race-redis", // use your Redis user. More info https://redis.io/docs/management/security/acl/
  socket: {
    host: "my-redis.cloud.redislabs.com",
    port: 6379,
    tls: true,
    key: readFileSync("./redis_user_private.key"),
    cert: readFileSync("./redis_user.crt"),
    ca: [readFileSync("./redis_ca.pem")],
  },
});
