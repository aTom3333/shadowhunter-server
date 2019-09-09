import {Socket} from "socket.io";
import {CharacterState} from "../common/Game/CharacterState";


export class Player {
    sockets: Array<Socket>;
    name: string;
    character: CharacterState;

    constructor(name: string) {
        this.name = name;
        this.sockets = [];
    }
}
