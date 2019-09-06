import {Server} from 'http';
import express, {Request, Response} from 'express';
import sio, {Socket} from 'socket.io';

import app_config from './config/app_config';

const app = express();
const server = new Server(app);
const io = sio(server);

app.get('/list', (req: Request, res: Response) => {
    res.json([]);
});

io.on("connection", (socket: Socket) => {
    //console.log(socket.client.request);
});

server.listen(app_config.port);
