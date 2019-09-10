import {Board} from "../common/Game/Board";
import {Player} from "./Player";
import {Namespace, Server, Socket} from "socket.io";


export class Room {
    name: string;
    board: Board;
    players: Array<Player>;
    lastAction: Date;
    io: Server;

    constructor(name: string, io: Server) {
        this.name = name;
        this.players = [];
        this.io = io;
    }

    private updateTS() {
        this.lastAction = new Date(Date.now());
    }

    serialize() {   // TODO Return a common protocol Room when defined
        return {name: this.name};
    }

    serializeState() {
        return {
            board: this.board,
            players: this.players.map(p => { return { id: p.character?p.character.id:undefined, name: p.name }; })
        }; // TODO Return a common protocol that describe the whole game
    }

    addPlayer(newPlayer: Player) {
        this.players.push(newPlayer);
        this.updateTS();
    }

    getRoomNamespace(): Namespace {
        return this.io.in(this.name);
    }

    enters(name: string, socket: Socket) {
        const player_id = this.players.findIndex(p => p.name === name);
        this.players[player_id].addSocket(socket);
        socket.join(this.name);
        this.getRoomNamespace().emit('update:playerjoined', { name });
        this.updateTS();
    }
}
