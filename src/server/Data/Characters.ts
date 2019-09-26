import {Character, Faction} from "../../common/Game/Character";
import {powers} from "./Powers";
import {victoryConditions} from "./VictoryConditions";


export const characters: Array<Character> = [
    new Character(
        'Franklin',
        Faction.Hunter,
        12,
        powers.foudre,
        victoryConditions.hunter
    ),
    // TODO temp
    new Character(
        'Dark Franklin',
        Faction.Shadow,
        12,
        powers.foudre,
        victoryConditions.shadow
    ),
    new Character(
        'Neutral Franklin',
        Faction.Neutral,
        12,
        powers.foudre,
        victoryConditions.allie
    ),
    // auto-generated
    new Character(
        "Agnès",
        Faction.Neutral,
        8,
        powers.caprice,
        victoryConditions.agnes,
        true
    ),
    new Character(
        "Allie",
        Faction.Neutral,
        8,
        powers.amourMaternel,
        victoryConditions.allie
    ),
    new Character(
        "Bob",
        Faction.Neutral,
        10,
        powers.braquage,
        victoryConditions.bob
    ),
    new Character(
        "Bob",
        Faction.Neutral,
        10,
        powers.braquageExtension,
        victoryConditions.bob,
        true
    ),
    new Character(
        "Bryan",
        Faction.Neutral,
        10,
        powers.ohMyGod,
        victoryConditions.bryan,
        true
    ),
    new Character(
        "Catherine",
        Faction.Neutral,
        11,
        powers.stigmates,
        victoryConditions.catherine,
        true
    ),
    new Character(
        "Charles",
        Faction.Neutral,
        11,
        powers.festinSanglant,
        victoryConditions.charles
    ),
    new Character(
        "Daniel",
        Faction.Neutral,
        13,
        powers.desespoir,
        victoryConditions.daniel
    ),
    new Character(
        "David",
        Faction.Neutral,
        13,
        powers.pilleurDeTombes,
        victoryConditions.david,
        true
    ),
    new Character(
        "Ellen",
        Faction.Hunter,
        10,
        powers.exorcisme,
        victoryConditions.hunter,
        true
    ),
    new Character(
        "Emi",
        Faction.Hunter,
        10,
        powers.teleportation,
        victoryConditions.hunter
    ),
    new Character(
        "Franklin",
        Faction.Hunter,
        12,
        powers.foudre,
        victoryConditions.hunter
    ),
    new Character(
        "Fu-Ka",
        Faction.Hunter,
        12,
        powers.soinsParticuliers,
        victoryConditions.hunter,
        true
    ),
    new Character(
        "Georges",
        Faction.Hunter,
        14,
        powers.demolition,
        victoryConditions.hunter
    ),
    new Character(
        "Gregor",
        Faction.Hunter,
        14,
        powers.bouclierFantome,
        victoryConditions.hunter,
        true
    ),
    new Character(
        "Liche",
        Faction.Shadow,
        14,
        powers.necromancie,
        victoryConditions.shadow,
        true
    ),
    new Character(
        "Loup-garou",
        Faction.Shadow,
        14,
        powers.contreattaque,
        victoryConditions.shadow
    ),
    new Character(
        "Momie",
        Faction.Shadow,
        11,
        powers.rayonDOutremonde,
        victoryConditions.shadow,
        true
    ),
    new Character(
        "Métamorphe",
        Faction.Shadow,
        11,
        powers.imitation,
        victoryConditions.shadow
    ),
    new Character(
        "Valkyrie",
        Faction.Shadow,
        13,
        powers.chantDeGuerre,
        victoryConditions.shadow,
        true
    ),
    new Character(
        "Vampire",
        Faction.Shadow,
        13,
        powers.morsure,
        victoryConditions.shadow
    )
];
