import {Card, CardColor, Equipment} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room, shuffleArray} from "../Room";
import {BeforeAttackData, emptyListener, Listeners} from "../TurnManager";
import {Character, Faction} from "../../common/Game/Character";
import {Deck} from "../../common/Game/Board";


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
        async apply(player: Player, room: Room) { player.equips(this, room); },
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
            // TODO Show card
            const targets = room.players.filter(p => p.character && !p.character.dead && p.name !== player.name);
            const target = await player.choosePlayer("À qui donner la carte vision ?", targets);
            room.sendMessage("{0:player} donne une carte vision à {1:player}", player.serialize(), target.serialize());
            // TODO Show card to target
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
            room.discardCard(this);
        }
    }
}

const equipments: Array<ServerEquipment> = [
    makeClassicWeapon("Hache tueuse", 1),
    makeClassicWeapon("Hachoir maudit", 1),
    makeClassicWeapon("Hache tueuse", 1),

    {
        name: "Lance de Longinus",
        color: CardColor.White,
        description: "Si vous êtes un hunter et que votre identité est révélée, chaque fois qu'une de vos attaques inflige des Blessures, vous infligez 2 Blessures supplémentaires.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) { player.equips(this, room); },
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
        name: "Premiers Secours",
        color: CardColor.White,
        description: "Placez le marqueur de Blessures du joueur de votre choix (y compris vous) sur le 7.",
        amountInDeck: 1,
        async apply(player: Player, room: Room) {
            const target = await player.choosePlayer("Sur qui utiliser le Premiers Secours ?", room.players.filter(p => p.character && !p.character.dead));
            room.sendMessage("{0:player} utilise les {1:card} sur {2:player}", player.serialize(), this, target.serialize());
            await room.setPlayerHP(target, 7);
            room.discardCard(this);
        }
    },
    makeVision("Vision clairvoyante", "Je pense que tu es un personnage de 11 points de vie ou moins. Si c'est le cas, subis 1 Blessure.", 1, (c: Character) => c.hp <= 11, VisionAction.Hit),
    makeVision("Vision cupide", "Je pense que tu es Neutre ou Shadow. Si c'est le cas tu dois : soit me donner un équipement soit subir 1 Blessure.", 1, (c: Character) => c.faction === Faction.Neutral || c.faction === Faction.Shadow, VisionAction.Steal)
];

export const cards: Array<ServerCard> = otherCards.concat(equipments);
