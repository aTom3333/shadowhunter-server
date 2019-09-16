import {Player} from "../Player";
import {Room} from "../Room";
import {TurnStep} from "../../common/Game/Board";
import {Power} from "../../common/Game/Character";
import {emptyListener, Listeners} from "../TurnManager";

export interface ServerPower extends Power {
    listeners: Listeners;
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
    foudre: {
        name: "Foudre",
        description: "Au début de votre tour, choisissez un joueur et infligez-lui autant de Blessures que le résultat d'un dé à 6 faces.",
        listeners: {
            start: [{
                async call(data: void, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return; // Only act on own turn

                    if(self.character.dead || self.character.powerUsed)
                        return;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        // TODO Reveal
                        /*
                        if(!state.revealed)
                            room.revealPlayer(self);
                         */
                        self.character.powerUsed = true;

                        // Player alive and not self
                        const targetPlayers = room.players.filter(p => p.character).filter(p => !p.character.dead && p.character.id !== self.character.id);
                        const targetedPlayer = await self.choosePlayer('Sur qui la foudre va-t-elle se déchainer ?', targetPlayers);
                        const damage = room.d6();

                        await room.attackPlayer(self, targetedPlayer, damage.finalValue(), 'thunder');
                    }
                }
            }],
            ...emptyListener
        }
    },
    caprice: {
        name: "Caprice",
        description: "Au début de votre tour, changez votre condition de victoire par «Le joueur à votre gauche gagne.»",
        listeners: emptyListener // TODO caprice
    },
    amourMaternel: {
        name: "Amour maternel",
        description: "Soignez toutes vos blessures.",
        listeners: emptyListener // TODO amourMaternel
    },
    braquage: {
        name: "Braquage",
        description: "Si vous infligez au moins 2 Blessures à un personnage lors d'une attaque, vous pouvez lui voler une carte équipement au lieu de lui infliger des Blessures.",
        listeners: emptyListener // TODO braquage
    },
    braquageExtension: {
        name: "Braquage",
        description: "Si vous tuez un personnage, vous pouvez prendre toutes ses cartes équipement.",
        listeners: emptyListener // TODO braquage
    },
    ohMyGod: {
        name: "Oh my god !",
        description: "Si vous tuez un personnage de 12 Points de Vie ou moins, vous devez révéler votre identité.",
        listeners: emptyListener // TODO ohMyGod
    },
    stigmates: {
        name: "Stigmates",
        description: "Guérissez de 1 Blessure au début de votre tour.",
        listeners: emptyListener // TODO stigmates
    },
    festinSanglant: {
        name: "Festin sanglant",
        description: "Après votre attaque, vous pouvez vous infliger 2 Blessures afin d'attaquer de nouveau le même joueur.",
        listeners: emptyListener // TODO festinSanglant
    },
    desespoir: {
        name: "Désespoir",
        description: "Dès qu'un personnage meurt, vous devez révéler votre identité.",
        listeners: emptyListener // TODO desespoir
    },
    pilleurDeTombes: {
        name: "Pilleur de tombes",
        description: "Récupérez dans la défausse la carte équipement de votre choix.",
        listeners: emptyListener // TODO pilleurDeTombes
    },
    exorcisme: {
        name: "Exorcisme",
        description: "Au début de votre tour, vous pouvez désigner un joueur. Il perd sa capacité spéciale jusqu'à la fin de la partie.",
        listeners: emptyListener // TODO exorcisme
    },
    teleportation: {
        name: "Téléportation",
        description: "Pour vous déplacer, vous pouvez lancer normalement les dés, ou vous déplacer sur la carte Lieu adjacente.",
        listeners: emptyListener // TODO teleportation
    },
    soinsParticuliers: {
        name: "Soins particuliers",
        description: "Au début de votre tour, placez le marquer de Blessures d'un joueur sur 7.",
        listeners: emptyListener // TODO soinsParticuliers
    },
    demolition: {
        name: "Démolition",
        description: "Au début de votre tour, choisissez un joueur et infligez-lui autant de Blessures que le résultat d'un dé à 4 faces.",
        listeners: emptyListener // TODO demolition
    },
    bouclierFantome: {
        name: "Bouclier fantôme",
        description: "Ce pouvoir peut s'activer à la fin de votre tour. Vous ne subissez aucune Blessure jusqu'au début de votre prochain tour.",
        listeners: emptyListener // TODO bouclierFantome
    },
    necromancie: {
        name: "Nécromancie",
        description: "Vous pouvez rejouer autant de fois qu'il y a de personnages morts.",
        listeners: emptyListener // TODO necromancie
    },
    contreattaque: {
        name: "Contre-attaque",
        description: "Après avoir subi l'attaque d'un joueur, vous pouvez contre-attaquer immédiatement.",
        listeners: emptyListener // TODO contreattaque
    },
    rayonDOutremonde: {
        name: "Rayon d'Outremonde",
        description: "Au début de votre tour, vous pouvez infliger 3 Blessures à un joueur présent dans le Lieu Porte de l'Outremonde.",
        listeners: emptyListener // TODO rayonDOutremonde
    },
    imitation: {
        name: "Imitation",
        description: "Vous pouvez mentir (sans avoir à révéler votre identité) lorsqu'on vous donne une carte Vision.",
        listeners: emptyListener // TODO imitation
    },
    chantDeGuerre: {
        name: "Chant de guerre",
        description: "Quand vous attaquez, lancez seulement le dé à 4 faces pour déterminer les dégats.",
        listeners: emptyListener // TODO chantDeGuerre
    },
    morsure: {
        name: "Morsure",
        description: "Si vous attaquez un joueur et lui infligez des Blessures, soignez immédiatement 2 de vos Bléssures.",
        listeners: emptyListener // TODO morsure
    },
};
