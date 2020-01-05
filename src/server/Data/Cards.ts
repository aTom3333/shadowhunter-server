import {Card, CardColor, Equipment, Location} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room, shuffleArray} from "../Room";
import {
    BeforeAttackData,
    BeforeAttackDiceData,
    BeforeAttackTargetSelectionData,
    BeforeMoveData,
    DiceThrower4,
    emptyListener,
    Listeners,
    Target
} from "../TurnManager";
import {Character, Faction} from "../../common/Game/Character";
import {Deck} from "../../common/Game/Board";
import {Update} from "../../common/Protocol/SocketIOEvents";
import {PlayerInterface} from "../../common/Protocol/PlayerInterface";
import {diceForMove, locations} from "./Locations";


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
    },
    {
        name: "Amulette",
        color: CardColor.White,
        description: "Vous ne subissez aucune Blessure causée par les cartes Ténèbres : Araignée sanguinaire, Dynamite ou Chauve-souris vampire.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Amulette", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(data.target === holder && (data.type === 'araigneesanguinaire' || data.type === 'chauvesourisvampire' || data.type === 'dynamite')) {
                        data.damage = 0;
                    }
                    return data;
                },
                priority: 1
            }]
        }
    },
    {
        name: "Boussole mystique",
        color: CardColor.White,
        description: "Quand vous vous déplacez, vous pouvez lancer 2 fois les dés et choisir quel résultat utiliser.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Boussole mystique", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeMove: [{
                async call(data: BeforeMoveData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder) {
                        const result = diceForMove(room, holder);
                        let locs: Array<Location>;
                        if (result.finalValue() === 7)
                            locs = locations.filter(l => l !== holder.character.location);
                        else
                            locs = locations.filter(l => l.numbers.includes(result.finalValue()));
                        locs.forEach(l => {
                            if(data.locations.findIndex(loc => loc.name === l.name) === -1)
                                data.locations.push(l);
                        });
                    }
                    return data;
                },
                priority: 1
            }]
        }
    },
    {
        name: "Broche de chance",
        color: CardColor.White,
        description: "Un joueur dans la Forêt hantée ne peut pas utiliser le pouvoir du Lieu pour vous infliger des Blessures (mais peut toujours vous guérir).",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Broche de chance", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(data.target === holder && (data.type === 'hauntedforest')) {
                        data.damage = 0;
                    }
                    return data;
                },
                priority: 1
            }]
        }
    },
    {
        name: "Crucifix en argent",
        color: CardColor.White,
        description: "Si vous attaquez et tuez un autre personnage, vous récupérez toutes ses cartes équipement.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Crucifix en argent", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener // TODO Implement
        }
    },
    {
        name: "Toge sainte",
        color: CardColor.White,
        description: "Vos attaques infligent 1 Blessure de moins et les Blessures que vous subissez sont réduites de 1.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Vous avez Toge sainte", ["S'équiper"]);
            room.hideCard();
            player.equips(this, room);
        },
        listeners: {
            ...emptyListener,
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(data.target === holder  || (currentPlayer === holder && data.type === 'attack')) {
                        data.modifier -= 1;
                    }
                    return data;
                },
                priority: 0
            }]
        }
    },
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
    {
        name: "Dynamite",
        color: CardColor.Black,
        description: "Lancez les 2 dés et infligez 3 Blessures à tous les joueurs (vous compris) se trouvant dans le secteur désigné par le total des 2 dés. Il ne se passe rien si ce total est 7.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            await player.choose("Quel secteur faire exploser ?", ["Lancer les dés"]);
            room.hideCard();
            const res = room.addDices(player);
            if(res.finalValue() === 7) {
                room.sendMessage("La dynamite n'explose pas");
            } else {
                const targetedLocation = room.board.locations.find(loc => loc.numbers.includes(res.finalValue()));
                const locIdx = room.board.locations.findIndex(loc => loc.name === targetedLocation.name);
                const otherIdx = Math.floor(locIdx / 2) * 2 + 1 - locIdx % 2;
                const otherLocation = room.board.locations[otherIdx];
                await Promise.all([room.players.map(async p => {
                    if (p.character && !p.character.dead && (p.character.location.name === targetedLocation.name || p.character.location.name === otherLocation.name)) {
                        await room.attackPlayer(player, p, 3, 'dynamite');
                    }
                })]);
            }
            room.discardCard(this);
        }
    },
    {
        name: "Peau de banane",
        color: CardColor.Black,
        description: "Donnez une de vos cartes équipement à un autre personnage. Si vous n'en possédez aucune, vous encaissez 1 Blessure.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            if(player.character.equipment.length > 0) {
                const equip = await player.choose("Quel équipement donner ?", player.character.equipment.map(e => { return { target: player.serialize(), equipment: e}; }));
                const targets = room.players.filter(p => p.character && !p.character.dead && p.name !== player.name);
                const target = await player.choosePlayer("À qui donner l'équipement ?", targets);
                room.stealEquipment(player, target, player.character.equipment.find(e => e.name === equip.equipment.name) as ServerEquipment);
            } else {
                await player.choose('Pas d\'équipement à donner', ['Subir 1 Blessure']);
                await room.attackPlayer(player, player, 1, 'peaudebanane');
            }
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Poupée démoniaque",
        color: CardColor.Black,
        description: "Désignez un joueur et lancez le dé à 6 faces. 1 à 4 : infligez-lui 3 Blessures. 5 ou 6 : subissez 3 Blessures.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const targets = room.players.filter(p => p.character && !p.character.dead && p.name !== player.name);
            const target = await player.choosePlayer("Sur qui utiliser la poupée démoniaque ?", targets);
            room.sendMessage('{0:player} va utiliser la poupée démoniaque sur {1:player}', player.serialize(), target.serialize());
            const result = room.d6(player);
            if(result.finalValue() <= 4) {
                await room.attackPlayer(player, target, 3, 'poupeedemoniaque');
            } else {
                await room.attackPlayer(player, player, 3, 'poupeedemoniaque');
            }
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Rituel diabolique",
        color: CardColor.Black,
        description: "Si vous êtes un shadow et si vous décidez de révéler (ou avez déjà révélé) votre identité, soignez toutes vos Blessures.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            if(player.character.identity.faction === Faction.Shadow) {
                const choice = await player.choose("Faire le rituel diabolique pour soigner toutes vos blessures ?", [player.character.revealed ? "Oui" : "Oui (révélation)", "Non"]);
                if(choice.substr(0, 3) === "Oui") {
                    room.revealPlayer(player);
                    room.sendMessage("{0:player} effectue un rituel diabolique", player.serialize());
                    await room.setPlayerHP(player, 0);
                }
            } else {
                await player.choose("Faire le rituel diabolique pour soigner toutes vos blessures ?", ['Non']);
            }
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Succube tentatrice",
        color: CardColor.Black,
        description: "Volez une carte équipement au joueur de votre choix.",
        amountInDeck: 2,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            let possibilites: Array<{target: PlayerInterface; equipment: Equipment}> = [];
            room.players.filter(p => p.character).filter(p => p !== player).forEach(p => {
                p.character.equipment.forEach(e => possibilites.push({
                    target: p.serialize(),
                    equipment: e
                }));
            });
            possibilites.push(null);
            const target = await player.choose("Quel équipement voler ?", possibilites, 'playerequipment');
            const targetedPlayer = room.players.find(p => p.name === target.target.name);
            if(target !== null) {
                await room.stealEquipment(targetedPlayer, player, target.equipment);
            }
            room.hideCard();
            room.discardCard(this);
        }
    },


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
    // TODO Ange gardien
    {
        name: "Avènement suprême",
        color: CardColor.White,
        description: "Si vous êts un Hunter, vous pouvez révéler votre identité. Si vous le faites, ou si vous avez déjà révélé votre identité, vous soignez toutes vos Blessures.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            if(player.character.identity.faction === Faction.Hunter) {
                const choice = await player.choose("Procéder à l'avènement suprême pour soigner toutes vos blessures ?", [player.character.revealed ? "Oui" : "Oui (révélation)", "Non"]);
                if(choice.substr(0, 3) === "Oui") {
                    room.revealPlayer(player);
                    room.sendMessage("{0:player} procède à l'avènement suprême", player.serialize());
                    await room.setPlayerHP(player, 0);
                }
            } else {
                await player.choose("Procéder à l'avènement suprême pour soigner toutes vos blessures ?", ['Non']);
            }
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Barre de chocolat",
        color: CardColor.White,
        description: "Si vous êts un Hunter, vous pouvez révéler votre identité. Si vous le faites, ou si vous avez déjà révélé votre identité, vous soignez toutes vos Blessures.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const initial = player.character.identity.name[0];
            if(['A', 'E', 'M'].includes(initial)) {
                const choice = await player.choose("Manger la barre de chocolat pour soigner toutes vos blessures ?", [player.character.revealed ? "Oui" : "Oui (révélation)", "Non"]);
                if(choice.substr(0, 3) === "Oui") {
                    room.revealPlayer(player);
                    room.sendMessage("{0:player} mange la barre de chocolat", player.serialize());
                    await room.setPlayerHP(player, 0);
                }
            } else {
                await player.choose("Manger la barre de chocolat pour soigner toutes vos blessures ?", ['Non']);
            }
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Bénédiction",
        color: CardColor.White,
        description: "Choisissez un joueur autre que vous et lancez le dé à 6 faces. Ce joueur guérit d'autant de Blessures que le résultat du dé.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const targets = room.players.filter(p => p.character && !p.character.dead && p.name !== player.name);
            const target = await player.choose("Qui bénir ?", targets);
            room.sendMessage("{0:player} offre sa bénédiction à {1:player}", player.serialize(), target.serialize());
            const result = room.d6(player);
            await room.healPlayer(target, result.finalValue());
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Eau bénite",
        color: CardColor.White,
        description: "Vous êtes soigné de 2 Blessures.",
        amountInDeck: 2,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const target = await player.choose("Vous avez de l'eau bénite", ['Boire l\'eau bénite']);
            await room.healPlayer(player, 2);
            room.hideCard();
            room.discardCard(this);
        }
    },
    {
        name: "Miroir divin",
        color: CardColor.White,
        description: "Si vous êtes un shadow autre que Métamorphe, vous devez révéler votre identité.",
        amountInDeck: 2,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const choice = await player.choose("Que faire ?", [player.character.identity.faction === Faction.Shadow && player.character.identity.name !== "Métamorphe" && !player.character.revealed ? 'Se révéler' : 'Ne rien faire']);
            if(choice === 'Se révéler')
                room.revealPlayer(player);
            room.hideCard();
            room.discardCard(this);
        }
    },
    // TODO Savoir ancestral
    {
        name: "Éclair purificateur",
        color: CardColor.White,
        description: "Chaque personnage, à l'exception de vous-même, subit 2 Blessures.",
        amountInDeck: 2,
        async apply(player: Player, room: Room) {
            room.showCard(this);
            const choice = await player.choose("Que faire ?", ['Faire s\'abattre l\'éclair purificateur']);
            await Promise.all([room.players.filter(p => p.character && !p.character.dead && p.name !== player.name).map(async p => {
                await room.attackPlayer(player, p, 2, 'eclairpurificateur');
            })]);
            room.hideCard();
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
