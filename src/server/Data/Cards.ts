import {Card, CardColor, Equipment} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room} from "../Room";
import {BeforeAttackData, emptyListener, Listeners} from "../TurnManager";
import {Faction} from "../../common/Game/Character";


export interface ServerCard extends Card {
    apply(player: Player, room: Room): void;
    amountInDeck: number;
}

export interface ServerEquipment extends ServerCard, Equipment {
    listeners: Listeners;
}



function makeClassicWeapon(name: string, amount: number): ServerEquipment {
    return {
        name: name,
        color: CardColor.Black,
        description: "Si votre attaque inflige des Blessures, la victime subit 1 Blessure en plus.",
        amountInDeck: amount,
        apply(player: Player, room: Room) { player.equips(this); },
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
        apply(player: Player, room: Room) { player.equips(this); },
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
