import {Player} from "../Player";
import {Room} from "../Room";
import {TurnStep} from "../../common/Game/Board";
import {Power} from "../../common/Game/Character";

export interface ServerPower extends Power {
    execute(room: Room, self: Player): Promise<void>;
}

export const powers: {
    caprice: ServerPower;
    amourMaternel: ServerPower;
    braquage: ServerPower;
    braquageExtension: ServerPower;
    ohMyGod: ServerPower;
    stigmates: ServerPower;
    festinSanglant: ServerPower;
    desespoir: ServerPower;
    pilleurDeTombes: ServerPower;
    exorcisme: ServerPower;
    teleportation: ServerPower;
    foudre: ServerPower;
    soinsParticuliers: ServerPower;
    demolition: ServerPower;
    bouclierFantome: ServerPower;
    necromancie: ServerPower;
    contreattaque: ServerPower;
    rayonDOutremonde: ServerPower;
    imitation: ServerPower;
    chantDeGuerre: ServerPower;
    morsure: ServerPower;
} = {
    caprice: {
        name: "Caprice",
        description: "Au début de votre tour, changez votre condition de victoire par «Le joueur à votre gauche gagne.»",
        async execute(room: Room, self: Player) {
            //todo caprice
        }
    },
    amourMaternel: {
        name: "Amour maternel",
        description: "Soignez toutes vos blessures.",
        async execute(room: Room, self: Player) {
            //todo amourMaternel
        }
    },
    braquage: {
        name: "Braquage",
        description: "Si vous infligez au moins 2 Blessures à un personnage lors d'une attaque, vous pouvez lui voler une carte équipement au lieu de lui infliger des Blessures.",
        async execute(room: Room, self: Player) {
            //todo braquage
        }
    },
    braquageExtension: {
        name: "Braquage",
        description: "Si vous tuez un personnage, vous pouvez prendre toutes ses cartes équipement.",
        async execute(room: Room, self: Player) {
            //todo braquage
        }
    },
    ohMyGod: {
        name: "Oh my god !",
        description: "Si vous tuez un personnage de 12 Points de Vie ou moins, vous devez révéler votre identité.",
        async execute(room: Room, self: Player) {
            //todo ohMyGod
        }
    },
    stigmates: {
        name: "Stigmates",
        description: "Guérissez de 1 Blessure au début de votre tour.",
        async execute(room: Room, self: Player) {
            //todo stigmates
        }
    },
    festinSanglant: {
        name: "Festin sanglant",
        description: "Après votre attaque, vous pouvez vous infliger 2 Blessures afin d'attaquer de nouveau le même joueur.",
        async execute(room: Room, self: Player) {
            //todo festinSanglant
        }
    },
    desespoir: {
        name: "Désespoir",
        description: "Dès qu'un personnage meurt, vous devez révéler votre identité.",
        async execute(room: Room, self: Player) {
            //todo desespoir
        }
    },
    pilleurDeTombes: {
        name: "Pilleur de tombes",
        description: "Récupérez dans la défausse la carte équipement de votre choix.",
        async execute(room: Room, self: Player) {
            //todo pilleurDeTombes
        }
    },
    exorcisme: {
        name: "Exorcisme",
        description: "Au début de votre tour, vous pouvez désigner un joueur. Il perd sa capacité spéciale jusqu'à la fin de la partie.",
        async execute(room: Room, self: Player) {
            //todo exorcisme
        }
    },
    teleportation: {
        name: "Téléportation",
        description: "Pour vous déplacer, vous pouvez lancer normalement les dés, ou vous déplacer sur la carte Lieu adjacente.",
        async execute(room: Room, self: Player) {
            //todo teleportation
        }
    },
    foudre: {
        name: "Foudre",
        description: "Au début de votre tour, choisissez un joueur et infligez-lui autant de Blessures que le résultat d'un dé à 6 faces.",
        async execute(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;

            if (board.currentTurn.character.id !== state.id || board.currentTurn.step !== TurnStep.Start || self.character.powerUsed)
                return; // Power not usable

            if (await self.askYesNo('Utiliser votre pouvoir ?')) {
                // TODO Reveal
                /*
                if(!state.revealed)
                    room.revealPlayer(self);
                 */
                // Player alive and not self
                const targetPlayers = room.players.filter(p => !p.character.dead && p.character.id !== state.id);
                const targetedPlayer = await self.choosePlayer('Sur qui la foudre va-t-elle se déchainer ?', targetPlayers);
                const damage = room.d6();
                room.applyDamage(targetedPlayer, damage);
                self.character.powerUsed = true;
            }
        }
    },
    soinsParticuliers: {
        name: "Soins particuliers",
        description: "Au début de votre tour, placez le marquer de Blessures d'un joueur sur 7.",
        async execute(room: Room, self: Player) {
            //todo soinsParticuliers
        }
    },
    demolition: {
        name: "Démolition",
        description: "Au début de votre tour, choisissez un joueur et infligez-lui autant de Blessures que le résultat d'un dé à 4 faces.",
        async execute(room: Room, self: Player) {
            //todo demolition
        }
    },
    bouclierFantome: {
        name: "Bouclier fantôme",
        description: "Ce pouvoir peut s'activer à la fin de votre tour. Vous ne subissez aucune Blessure jusqu'au début de votre prochain tour.",
        async execute(room: Room, self: Player) {
            //todo bouclierFantome
        }
    },
    necromancie: {
        name: "Nécromancie",
        description: "Vous pouvez rejouer autant de fois qu'il y a de personnages morts.",
        async execute(room: Room, self: Player) {
            //todo necromancie
        }
    },
    contreattaque: {
        name: "Contre-attaque",
        description: "Après avoir subi l'attaque d'un joueur, vous pouvez contre-attaquer immédiatement.",
        async execute(room: Room, self: Player) {
            //todo contreattaque
        }
    },
    rayonDOutremonde: {
        name: "Rayon d'Outremonde",
        description: "Au début de votre tour, vous pouvez infliger 3 Blessures à un joueur présent dans le Lieu Porte de l'Outremonde.",
        async execute(room: Room, self: Player) {
            //todo rayonDOutremonde
        }
    },
    imitation: {
        name: "Imitation",
        description: "Vous pouvez mentir (sans avoir à révéler votre identité) lorsqu'on vous donne une carte Vision.",
        async execute(room: Room, self: Player) {
            //todo imitation
        }
    },
    chantDeGuerre: {
        name: "Chant de guerre",
        description: "Quand vous attaquez, lancez seulement le dé à 4 faces pour déterminer les dégats.",
        async execute(room: Room, self: Player) {
            //todo chantDeGuerre
        }
    },
    morsure: {
        name: "Morsure",
        description: "Si vous attaquez un joueur et lui infligez des Blessures, soignez immédiatement 2 de vos Bléssures.",
        async execute(room: Room, self: Player) {
            //todo morsure
        }
    },

};
