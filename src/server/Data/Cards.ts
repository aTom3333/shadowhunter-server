import {Card, CardColor, Equipment} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room, shuffleArray} from "../Room";
import {
    BeforeAttackData,
    BeforeAttackDiceData,
    BeforeAttackTargetSelectionData, DiceThrower4,
    emptyListener,
    Listeners,
    Target
} from "../TurnManager";
import {Character, Faction} from "../../common/Game/Character";
import {Deck} from "../../common/Game/Board";
import {Update} from "../../common/Protocol/SocketIOEvents";


function flatMap<T, E>(array: Array<T>, fun: {(a:T):Array<E>}):Array<E> {
    return array.reduce((a: any, b: any) => {
        return a.concat(fun.call(this, b))
    }, []);
}

// Object.defineProperty(Array.prototype, 'flatMap', {
//     value: function(f: Function) {
//         return this.reduce((ys: any, x: any) => {
//             return ys.concat(f.call(this, x))
//         }, [])
//     },
//     enumerable: false,
// });


export interface ServerCard extends Card {
    apply(player: Player, room: Room): Promise<void>;
    amountInDeck: number;
}

export interface ServerEquipment extends ServerCard, Equipment {
    listeners: Listeners;
}

export class ServerDeck implements Deck {
    private cards: Array<ServerCard>;
    private publicDiscard: boolean;
    discard: Array<ServerCard>;

    get numberLeft() {
        return this.cards.length;
    }

    drawCard(room: Room, player: Player): ServerCard {
        if(this.numberLeft === 0)
            this.refill(room);
        const card = this.cards[0];
        this.cards.splice(0, 1);
        return card;
    }

    private refill(room: Room) {
        if(this.discard.length === 0)
            throw new Error("Can't refill the deck, no cards in discard");
        this.cards = shuffleArray(this.discard);
        this.discard = [];
        // TODO Send event to room
    }

    discardCard(card: ServerCard) {
        this.discard.push(card);
    }

    private constructor(content: Array<ServerCard>, publicDiscard: boolean = true) {
        this.cards = shuffleArray(content);
        this.discard = [];
        this.publicDiscard = publicDiscard;
    }

    static makeDeck(color: CardColor) {
        // TODO Take amountInDeck into account
        return new ServerDeck(cards.filter(c => c.color === color), color !== CardColor.Green);
    }

    serialize() {
        return {
            discard: this.publicDiscard ? this.discard : this.discard.map(c => { return { color: c.color, name: null, description: null }; }),
            numberLeft: this.numberLeft,
            serialize() {
                return this;
            }
        }
    }
}


function makeClassicWeapon(name: string, amount: number): ServerEquipment {
    return {
        name: name,
        color: CardColor.Black,
        description: "Si votre attaque inflige des Blessures, la victime subit 1 Blessure en plus.",
        amountInDeck: amount,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez "+name, ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder && data.type === 'attack')
                        data.modifier += 1; // Boost les attaques normales du porteur
                    return data;
                },
                priority: 0
            }]
        }
    }
}


enum VisionAction {
    Hit, Heal, Steal, HitStrong
}

function makeVision(name: string, description: string, amount: number, predicate: {(c: Character): boolean}, action: VisionAction) {
    const actionPossible = (p: Player) => {
        return predicate(p.character.identity) || p.character.identity.power.name === "Imitation";
    };
    const noActionPossible = (p: Player) => {
        return !predicate(p.character.identity) || p.character.identity.power.name === "Imitation";
    };
    return {
        name: name,
        color: CardColor.Green,
        description: description,
        amountInDeck: amount,
        async apply(player: Player, room: Room) {
            room.getRoomNamespace().emit(Update.ShowCard.stub, Update.ShowCard({
                color: CardColor.Green,
                name: null,
                description: null
            }));
            player.emit(Update.ShowCard.stub, Update.ShowCard(this));
            const targets = room.players.filter(p => p.character && !p.character.dead && p.name !== player.name);
            const target = await player.choosePlayer("À qui donner la carte vision ?", targets);
            player.emit(Update.ShowCard.stub, Update.ShowCard({
                color: CardColor.Green,
                name: null,
                description: null
            }));
            room.sendMessage("{0:player} donne une carte vision à {1:player}", player.serialize(), target.serialize());
            target.emit(Update.ShowCard.stub, Update.ShowCard(this));
            let possibilities: Array<string> = [];
            switch (action) {
                case VisionAction.Hit:
                    if(actionPossible(target))
                        possibilities.push("Prendre 1 Blessure");
                    break;
                case VisionAction.Heal:
                    if(actionPossible(target))
                        possibilities.push(target.character.lostHp === 0 ? "Prendre 1 Blessure" : "Soigner 1 Blessure");
                    break;
                case VisionAction.Steal:
                    if(actionPossible(target)) {
                        if(target.character.equipment.length > 0)
                            possibilities.push("Donner un équipment");
                        possibilities.push("Prendre 1 Blessure");
                    }
                    break;
                case VisionAction.HitStrong:
                    if(actionPossible(target))
                        possibilities.push("Prendre 2 Blessures");
                    break;
            }
            if(noActionPossible(target))
                possibilities.push("Ne rien faire");

            const choice = await target.choose("Que faire ?", possibilities);
            switch (choice) {
                case "Ne rien faire":
                    room.sendMessage("La carte vision n'a aucun effet sur {0:player}", target.serialize());
                    break;
                case "Prendre 1 Blessure":
                    await room.attackPlayer(player, target, 1, "vision");
                    break;
                case "Prendre 2 Blessures":
                    await room.attackPlayer(player, target, 2, "vision");
                    break;
                case "Donner un équipement":
                    const equips = target.character.equipment.map(e => { return {equipment: e, target: target.serialize()}; });
                    const equip = await target.choose("Quel équipement donner ?", equips, 'playerequipment');
                    room.stealEquipment(target, player, target.character.equipment.find(e => e.name === equip.equipment.name));
                    break;
                case "Soigner 1 Blessure":
                    await room.healPlayer(target, 1);
                    break;
            }
            room.getRoomNamespace().emit(Update.HideCard.stub);
            room.discardCard(this);
        }
    }
}

const equipments: Array<ServerEquipment> = [
    makeClassicWeapon("Hache tueuse", 1),
    makeClassicWeapon("Hachoir maudit", 1),
    makeClassicWeapon("Tronçonneuse du mal", 1),
    {
        name: "Mitrailleuse funeste",
        color: CardColor.Black,
        description: "Votre attaque affecte tous les personnages qui sont à votre portée. Effectuez un seul jet de Blessures pour tous les joueurs concernés.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Mitrailleuse funeste", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttackTargetSelection: [{
                async call(data: BeforeAttackTargetSelectionData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder) {
                        const newTarget = flatMap(data.targets.filter(t => t !== null), (t: Target) => {
                            return t instanceof Player ? [t] : t;
                        });
                        const targets = [];
                        if(newTarget.length > 0)
                            targets.push(newTarget);
                        if(data.targets.indexOf(null) !== -1)
                            targets.push(null);
                        data.targets = targets;
                        return data;
                    }
                    return data;
                },
                priority: 1
            }]
        }
    },
    {
        name: "Revolver des ténèbres",
        color: CardColor.Black,
        description: "Vous pouvez attaquer un joueur présent sur l'un des 4 lieux hors de votre secteur, mais vous ne pouvez plus attaquer un joueur situé dans le même secteur que vous.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Revolver des ténèbres", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttackTargetSelection: [{
                async call(data: BeforeAttackTargetSelectionData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder) {
                        const targets = room.players.filter(p => p.character)
                            .filter(p => p !== currentPlayer)
                            .filter(p => !p.character.dead)
                            .filter(p => !room.areNextTo(currentPlayer, p));
                        if(data.targets.indexOf(null) !== -1)
                            targets.push(null);
                        data.targets = targets;
                        return data;
                    }
                    return data;
                },
                priority: 0
            }]
        }
    },
    {
        name: "Sabre hanté Masamune",
        color: CardColor.Black,
        description: "Vous êtes obligé d'attaquer durant votre tour. Lancez uniquement le dé à 4 faces, le résultat indique les Blessures que vous infligez.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Sabre hanté Masamune", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttackTargetSelection: [{
                async call(data: BeforeAttackTargetSelectionData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder) {
                        const nullIdx = data.targets.indexOf(null);
                        if(nullIdx !== -1 && data.targets.length > 1)
                            data.targets.splice(nullIdx, 1);
                    }
                    return data;
                },
                priority: 0
            }],
            beforeAttackDice: [{
                async call(data: BeforeAttackDiceData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder) {
                        data.dice = new DiceThrower4(room, holder);
                    }
                    return data;
                },
                priority: 0
            }]
        }
    },

    {
        name: "Lance de Longinus",
        color: CardColor.White,
        description: "Si vous êtes un hunter et que votre identité est révélée, chaque fois qu'une de vos attaques inflige des Blessures, vous infligez 2 Blessures supplémentaires.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Lance de Longinus", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder && data.type === 'attack' && currentPlayer.character.revealed && currentPlayer.character.identity.faction === Faction.Hunter)
                        data.modifier += 2;
                    return data;
                },
                priority: 0
            }]
        }
    }
];

const otherCards: Array<ServerCard> = [
    {
        name: "Araignée sanguinaire",
        color: CardColor.Black,
        description: "Vous infligez 2 Blessures au personnage de votre choix, puis vous subissez vous-même 2 Blessures.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const targets = room.players.filter(p => p.character && !p.character.dead);
            const target = await player.choosePlayer("Qui sera attaqué par l'araignée sanguinaire ?", targets);
            room.hideCard();
            await room.attackPlayer(player, target, 2, 'araigneesanguinaire');
            await room.attackPlayer(player, player, 2, 'araigneesanguinaire');
            room.discardCard(this);
        }
    },
    {
        name: "Chauve-souris vampire",
        color: CardColor.Black,
        description: "Infligez 2 Blessures au joueur de votre choix puis soignez une de vos Blessures.",
        amountInDeck: 3,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const targets = room.players.filter(p => p.character && !p.character.dead);
            const target = await player.choosePlayer("Qui sera attaqué par la chauve-souris vampire ?", targets);
            room.hideCard();
            await room.attackPlayer(player, target, 2, 'chauvesourisvampire');
            await room.healPlayer(player, 1);
            room.discardCard(this);
        }
    },
    // {
    //     name: "Dynamite",
    //     color: CardColor.Black,
    //     description: "Lancez les 2 dés et infligez 3 Blessures à tous les joueurs (vous compris) se trouvant dans le secteur désigné par le total des 2 dés. Il ne se passe rien si ce total est 7.",
    //     amountInDeck: 1,
    //     async apply(player: Player, room: Room) {
    //         room.showCard(this);
    //         await player.choose("Quel secteur faire exploser ?", ["Lancer les dés"]);
    //         room.hideCard();
    //         const res = room.addDices(player);
    //         const targetedLocation = room.board.locations.find(loc => loc.numbers.includes(res.finalValue()));
    //         const locIdx = room.board.locations.findIndex(loc => loc.name === targetedLocation.name);
    //         const otherIdx = Math.floor(locIdx / 2) * 2 + 1 - locIdx % 2;
    //         const otherLocation = room.board.locations[otherIdx];
    //         room.discardCard(this);
    //     }
    // }

    {
        name: "Premiers Secours",
        color: CardColor.White,
        description: "Placez le marqueur de Blessures du joueur de votre choix (y compris vous) sur le 7.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const target = await player.choosePlayer("Sur qui utiliser le Premiers Secours ?", room.players.filter(p => p.character && !p.character.dead));
            room.hideCard();
            room.sendMessage("{0:player} utilise les {1:card} sur {2:player}", player.serialize(), this, target.serialize());
            await room.setPlayerHP(target, 7);
            room.discardCard(this);
        }
    },


    makeVision("Vision clairvoyante", "Je pense que tu es un personnage de 11 Points de Vie ou moins. Si c'est le cas, subis 1 Blessure !", 1, (c: Character) => c.hp <= 11, VisionAction.Hit),
    makeVision("Vision cupide", "Je pense que tu es Neutre ou Shadow. Si c'est le cas tu dois : soit me donner un équipement soit subir 1 Blessure !", 1, (c: Character) => c.faction === Faction.Neutral || c.faction === Faction.Shadow, VisionAction.Steal),
    makeVision("Vision mortifère", "Je pense que tu es Hunter. Si c'est le cas, subis 1 Blessure !", 1, (c: Character) => c.faction === Faction.Hunter, VisionAction.Hit),
    makeVision("Vision réconfortante", "Je pense que tu es Neutre. Si c'est le cas, soigne 1 Blessure. (Toutefois, si tu n'avais aucune blessure, subis 1 Blessure !)", 1, (c: Character) => c.faction === Faction.Neutral, VisionAction.Heal),
    makeVision("Vision furtive", "Je pense que tu es Hunter ou Shadow. Si c'est le cas, tu dois : soit me donner une carte équipement, soit subir 1 Blessure.", 2, (c: Character) => c.faction === Faction.Hunter || c.faction === Faction.Shadow, VisionAction.Steal),
    makeVision("Vision destructrice", "Je pense que tu es un personnage de 12 Points de Vie ou plus. Si c'est le cas, subis 2 Blessures !", 1, (c: Character) => c.hp >= 12, VisionAction.HitStrong),
    makeVision("Vision enivrante", "Je pense que tu es Neutre ou Hunter. Si c'est le cas, tu dois : soit me donner une carte équipement, soit subir 1 Blessure.", 2, (c: Character) => c.faction === Faction.Neutral || c.faction === Faction.Hunter, VisionAction.Steal),
    makeVision("Vision lugubre", "Je pense que tu es Shadow. Si c'est le cas, soigne 1 Blessure. (Toutefois, si tu n'avais aucune blessure, subis 1 Blessure !)", 1, (c: Character) => c.faction === Faction.Shadow, VisionAction.Heal),
    makeVision("Vision divine", "Je pense que tu es Hunter. Si c'est le cas, soigne 1 Blessure. (Toutefois si tu n'avais aucune blessure, subis 1 Blessure !)", 1, (c: Character) => c.faction === Faction.Hunter, VisionAction.Heal),
    makeVision("Vision purificatrice", "Je pense que tu es Shadow. Si c'est le cas, subis 2 Blessures", 1, (c: Character) => c.faction === Faction.Shadow, VisionAction.HitStrong),
    makeVision("Vision foudroyante", "Je pense que tu es Shadow. Si c'est le cas, subis 1 BLessure !", 1, (c: Character) => c.faction === Faction.Shadow, VisionAction.Hit),
    // TODO Vision suprême
];

export const cards: Array<ServerCard> = otherCards.concat(equipments);
