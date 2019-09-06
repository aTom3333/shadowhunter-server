import {Socket} from "socket.io";
import {CharacterState} from "../common/CharacterState";


class Player {
    socket: Socket;
    name: string;
    character: CharacterState;
}
