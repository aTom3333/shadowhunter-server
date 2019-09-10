import {Application, Request, Response} from 'express';
import {Room} from './Room';
import {makeFailureResponse, makeSuccessResponse} from "./JsonResponseHelper";
import {Player} from "./Player";
import {Server, Socket} from "socket.io";


export class RoomManager {
    room: Array<Room>;
    io: Server;

    constructor(app: Application, io: Server) {
        this.room = [];
        this.registerApi(app);
        this.io = io;
    }

    private registerApi(app: Application) {
        app.get('/list', (req: Request, res: Response) => {
            const response = makeSuccessResponse('Room list retrieved successfully', this.room.map(r => r.serialize()));
            res.json(response);
        });

        app.post('/create', (req: Request, res: Response) => {
            const data = req.body;
            if(this.room.find(r => r.name === data.name)) { // The room already exists
                const response = makeFailureResponse('A room with this name already exists');
                res.json(response);
                return;
            }

            const newRoom = new Room(data.name, this.io);
            this.room.push(newRoom);

            const response = makeSuccessResponse('Room created successfully', newRoom.serialize());
            res.json(response);
        });

        app.post('/join', (req: Request, res: Response) => {
            const data = req.body;
            const room_idx = this.room.findIndex(r => r.name === data.room.name);

            if(!this.room[room_idx].players.find(p => p.name === data.name)) {
                const newPlayer = new Player(data.name);
                this.room[room_idx].addPlayer(newPlayer);
            }

            const response = makeSuccessResponse('Successfully entered the room', this.room[room_idx].serializeState());
            res.json(response);
        });
    }

    public addToRoom(room: any, name: string, socket: Socket) {
        // TODO Error handling
        const enteredRoom = this.room.find(r => r.name === room.name);
        enteredRoom.enters(name, socket);
    }
}
