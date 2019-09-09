import {Board} from "../common/Game/Board";
import {Player} from "./Player";


export class Room {
    name: string;
    board: Board;
    players: Array<Player>;

    constructor(name: string) {
        this.name = name;
        this.players = [];
    }

    serialize() {   // TODO Return a common protocol Room when defined
        return {name: this.name};
    }

    serializeState() {
        return {
            board: this.board,
            players: this.players.map(p => { return { id: p.character.id, name: p.name }; })
        }; // TODO Return a common protocol that describe the whole game
    }

    addPlayer(newPlayer: Player) {
        this.players.push(newPlayer);
    }
}
