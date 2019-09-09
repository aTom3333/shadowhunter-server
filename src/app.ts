import {Server} from 'http';
import express, {Request, Response} from 'express';
import sio, {Socket} from 'socket.io';

import app_config from './config/app_config';
import {RoomManager} from "./server/RoomManager";

const app = express();
app.use(express.json());
const server = new Server(app);
const io = sio(server);

const roomManager = new RoomManager(app);

io.on("connection", (socket: Socket) => {
    socket.emit('youpla');
});

server.listen(app_config.port);
