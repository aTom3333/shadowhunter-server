import {Character, Faction} from "../../common/Game/Character";
import {powers} from "./Powers";
import {victoryConditions} from "./VictoryConditions";


export const characters: Array<Character> = [
    new Character(
        'Franklin',
        Faction.Hunter,
        12,
        powers.thunder,
        victoryConditions.hunter
    ),
    // TODO temp
    new Character(
        'Dark Franklin',
        Faction.Shadow,
        12,
        powers.thunder,
        victoryConditions.shadow
    ),
    new Character(
        'Neutral Franklin',
        Faction.Neutral,
        12,
        powers.thunder,
        victoryConditions.allie
    )
];
