import {Location} from "../../common/Game/CharacterState";
import {Room} from "../Room";
import {Player} from "../Player";
import {AddDices} from "../../common/Event/DiceResult";


export interface ServerLocation extends Location {
    apply(room: Room, player: Player): void;
}

export function diceForMove(room: Room, player: Player): AddDices {
    let result = room.addDices();
    while(result.finalValue() === 7 || player.character.location.numbers.includes(result.finalValue()))
        result = room.addDices();
    return result;
}

export const locations: Array<ServerLocation> = [
    {
        name: "Monastère",
        description: "Vous Pouvez piocher une carte Lumière.",
        numbers: [6],
        apply(room: Room, player: Player) {
            // TODO Implement
        }
    }
];
