
import { Server } from "socket.io";
import gameSocketHandler from "../handlers/sockets-handlers/gameSocketHandler.js";
import globalSocketHandler from "../handlers/sockets-handlers/globalSocketHandler.js";


  const createSocketConnection = (server)=>{
    const corsUrl = process.env.CORS_URL



    const io = new Server(server, {
        cors:{
          origin:corsUrl,
          methods:['GET', 'POST']
        }
      })

    io.on('connection',(socket)=>{  

        gameSocketHandler(socket)
        globalSocketHandler(socket)

      
      })
  }

  export default createSocketConnection
  