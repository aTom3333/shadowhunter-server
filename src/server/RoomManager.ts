import {Application, Request, Response} from 'express';
import Room from './Room';
import {makeFailureResponse, makeSuccessResponse} from "./JsonResponseHelper";

export default class RoomManager {
    room: Array<Room>;

    constructor(app: Application) {
        this.room = [];
        this.registerApi(app);
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

            const newRoom = new Room(data.name);
            this.room.push(newRoom);

            const response = makeSuccessResponse('Room created successfully', newRoom.serialize());
            res.json(response);
        });

        // TODO Add join
    }
}
