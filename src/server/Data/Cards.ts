import {Card, CardColor, Equipment} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room, shuffleArray} from "../Room";
import {BeforeAttackData, emptyListener, Listeners} from "../TurnManager";
import {Faction} from "../../common/Game/Character";
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
    discard: Array<ServerCard>;

    get numberLeft() {
        return this.cards.length;
    }

    drawCard(room: Room, player: Player): ServerCard {
        if(this.numberLeft === 0)
            this.refill(room);
        const card = this.cards[0];
        this.cards.splice(0, 1);
        // TODO Send event to room
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

    private constructor(content: Array<ServerCard>) {
        this.cards = content;
        this.discard = [];
    }

    static makeDeck(color: CardColor) {
        // TODO Take amountInDeck into account
        return new ServerDeck(cards.filter(c => c.color === color));
    }
}


function makeClassicWeapon(name: string, amount: number): ServerEquipment {
    return {
        name: name,
        color: CardColor.Black,
        description: "Si votre attaque inflige des Blessures, la victime subit 1 Blessure en plus.",
        amountInDeck: amount,
        async apply(player: Player, room: Room) { player.equips(this); },
        listeners: {
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder && data.type === 'attack')
                        data.modifier += 1; // Boost les attaques normales du porteur
                    return data;
                }
            }],
            ...emptyListener
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
        async apply(player: Player, room: Room) { player.equips(this); },
        listeners: {
            beforeAttack: [{
                async call(data: BeforeAttackData, room: Room, currentPlayer: Player, holder: Player) {
                    if(currentPlayer === holder && data.type === 'attack' && currentPlayer.character.revealed && currentPlayer.character.identity.faction === Faction.Hunter)
                        data.modifier += 2;
                    return data;
                }
            }],
            ...emptyListener
        }
    }
];

const otherCards: Array<ServerCard> = [

];

export const cards: Array<ServerCard> = otherCards.concat(equipments);
