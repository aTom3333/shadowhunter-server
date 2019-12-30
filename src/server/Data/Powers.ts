import {Player} from "../Player";
import {Room} from "../Room";
import {TurnStep} from "../../common/Game/Board";
import {Character, Power} from "../../common/Game/Character";
import {
    AfterAttackData,
    AfterAttackDiceData,
    AfterAttackTargetSelectionData,
    BeforeAttackData, BeforeAttackDiceData, BeforeMoveData, DiceThrowerSub,
    emptyListener,
    Listeners,
    Target
} from "../TurnManager";
import {Update} from "../../common/Protocol/SocketIOEvents";

export interface ServerPower extends Power {
    listeners: Listeners;
}


function areAllProcessed(target: Target, players: Array<Player>) {
    if(target instanceof Player)
        return players.includes(target);
    else
        return target.map(t => players.includes(t)).reduce((a,b) => a&&b);
}


function makeUseless(power: ServerPower): ServerPower {
    return {
        name: power.name,
        description: power.description,
        listeners: emptyListener
    };
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
            ...emptyListener,
            start: [{
                async call(data: void, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return; // Only act on own turn

                    if(self.character.dead || self.character.powerUsed)
                        return;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);

                        // Player alive and not self
                        const targetPlayers = room.players.filter(p => p.character).filter(p => !p.character.dead && p.character.id !== self.character.id);
                        const targetedPlayer = await self.choosePlayer('Sur qui la foudre va-t-elle se déchainer ?', targetPlayers);
                        const damage = room.d6(self);

                        await room.attackPlayer(self, targetedPlayer, damage.finalValue(), 'thunder');
                    }
                },
                priority: 0
            }]
        }
    },
    caprice: {
        name: "Caprice",
        description: "Au début de votre tour, changez votre condition de victoire par «Le joueur à votre gauche gagne.»",
        listeners: {
            ...emptyListener,
            start: [{
                async call(data: void, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return; // Only act on own turn

                    if(self.character.dead || self.character.powerUsed)
                        return;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);
                        // Nothing to do, the logic for changing direction is in the VictoryCondition
                    }
                },
                priority: 0
            }]
        }
    },
    amourMaternel: {
        name: "Amour maternel",
        description: "Soignez toutes vos blessures.",
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, current: Player, self: Player) {
                    if(data.target !== self)
                        return data; // Only act when targeted

                    if(self.character.dead || self.character.powerUsed)
                        return data;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);

                        room.getRoomNamespace().emit(Update.ChangeHP.stub, Update.ChangeHP({
                            player: self,
                            type: '=',
                            amount: 0
                        }));
                    }
                    return data;
                },
                priority: 0
            }]
        }
    },
    braquage: {
        name: "Braquage",
        description: "Si vous infligez au moins 2 Blessures à un personnage lors d'une attaque, vous pouvez lui voler une carte équipement au lieu de lui infliger des Blessures.",
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return data;
                    if(data.damage !== 0 && data.damage + data.modifier >= 2 && data.target.character.equipment.length >= 1) {
                        if(await self.askYesNo("Utiliser votre pouvoir ?")) {

                        }
                    }
                },
                priority: 10 // After modifier are applied
                // TODO braquage
            }]
        }
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
        listeners: {
            ...emptyListener,
            start: [{
                async call(data: void, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return; // Only act on own turn

                    if(self.character.dead)
                        return;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);

                        await room.healPlayer(self, 1);
                    }
                },
                priority: 0
            }]
        }
    },
    festinSanglant: {
        name: "Festin sanglant",
        description: "Après votre attaque, vous pouvez vous infliger 2 Blessures afin d'attaquer de nouveau le même joueur.",
        listeners: {
            ...emptyListener,
            afterAttackTargetSelection: [{
                async call(data: AfterAttackTargetSelectionData, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return data;
                    if(self.character.dead)
                        return data;

                    (self as any).goingCrazyData = {
                        target: data.target,
                        processed: []
                    }
                },
                priority: 0
            }],
            afterAttack: [{
                async call(data: AfterAttackData, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return data;

                    if(self.character.dead)
                        return data;

                    if(data.type !== 'attack')
                        return data;

                    const specificData = (self as any).goingCrazyData;
                    specificData.processed.push(data.target);
                    if(!areAllProcessed(specificData.target, specificData.processed))
                        return data;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);

                        // Reset processed players
                        specificData.processed = [];

                        // Take 2 hp
                        await room.attackPlayer(self, self, 2, 'festinsanglant');

                        // Attack every target (copy paste of TurnManager)
                        {
                            let newAttackData: any = new BeforeAttackDiceData(specificData.target, new DiceThrowerSub(room, self));

                            newAttackData = await room.invokeListener(newAttackData, self, (l: Listeners) => l.beforeAttackDice);
                            if (room.isGameOver())
                                return data;

                            const result = (<BeforeAttackDiceData>newAttackData).dice.throwDice();

                            newAttackData = new AfterAttackDiceData(specificData.target, result);
                            newAttackData = await room.invokeListener(newAttackData, self, (l: Listeners) => l.afterAttackDice);
                            if (room.isGameOver())
                                return data;

                            const doAttack = async (targetPlayer: Player) => {
                                await room.attackPlayer(self, targetPlayer, result.finalValue(), 'attack');
                            };

                            // TODO Early exit if game is over
                            if (specificData.target instanceof Player)
                                await doAttack(specificData.target);
                            else
                                await Promise.all(specificData.target.map((p:Player) => doAttack(p))); // TODO See if problem arrive because of that
                        }
                    }

                    return data;
                },
                priority: 0
            }],
        }
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
        listeners: {
            ...emptyListener,
            start: [{
                async call(data: void, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return; // Only act on own turn

                    if(self.character.dead || self.character.powerUsed)
                        return;

                    if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                        if(!self.character.revealed)
                            room.revealPlayer(self);

                        self.character.powerUsed = true;
                        room.usePower(self);

                        const targets = room.players.filter(p => p.character).filter(p => !p.character.dead);
                        const target = await self.choosePlayer('Qui va être exorcisé ?', targets);

                        target.character.identity = new Character(
                            target.character.identity.name,
                            target.character.identity.faction,
                            target.character.identity.hp,
                            makeUseless(target.character.identity.power as ServerPower),
                            target.character.identity.victoryCondition,
                            target.character.identity.isExtension
                        );
                        room.sendMessage('{0:player} a été exorcisé et ne peut plus utiliser son pouvoir');
                    }
                },
                priority: 0
            }]
        }
    },
    teleportation: {
        name: "Téléportation",
        description: "Pour vous déplacer, vous pouvez lancer normalement les dés, ou vous déplacer sur la carte Lieu adjacente.",
        listeners: {
            ...emptyListener,
            beforeMove: [{
                async call(data: BeforeMoveData, room: Room, current: Player, self: Player) {
                    if(current !== self)
                        return data; // Only act on own turn

                    if(self.character.dead)
                        return data;

                    if(!self.character.revealed && self.character.location) {
                        if(await self.askYesNo('Utiliser votre pouvoir ?')) {
                            room.revealPlayer(self);

                            self.character.powerUsed = true;
                            room.usePower(self);
                        }
                    }

                    if(self.character.revealed && self.character.location) {
                        const locIdx = room.board.locations.findIndex(l => l === self.character.location);
                        const nextLoc = room.board.locations.find((l,idx) => idx !== locIdx && Math.floor(idx/2) === Math.floor(locIdx/2));
                        if(nextLoc && !data.locations.includes(nextLoc))
                            data.locations.push(nextLoc);
                    }

                    return data;
                },
                priority: 0
            }]
        }
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
