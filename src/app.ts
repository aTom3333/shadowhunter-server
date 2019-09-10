import {Server} from 'http';
import express, {Request, Response} from 'express';
import sio, {Socket} from 'socket.io';

import app_config from './config/app_config';
import {RoomManager} from "./server/RoomManager";
import waitFor from "./common/Utility/waitForSocket";

const app = express();
app.use(express.json());
const server = new Server(app);
const io = sio(server);

const roomManager = new RoomManager(app, io);

io.on("connection", async (socket: Socket) => {
    const data = await waitFor(socket, 'request:joinroom');
    roomManager.addToRoom(data.room, data.name, socket);
});

server.listen(app_config.port);
