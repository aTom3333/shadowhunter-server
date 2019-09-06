import {Board} from "../common/Game/Board";


export default class Room {
    name: string;
    board: Board;

    constructor(name: string) {
        this.name = name;
    }

    serialize() {   // TODO Return a common protocol Room when defined
        return {name: this.name};
    }
}
