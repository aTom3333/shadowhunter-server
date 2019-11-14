import {CardColor, Equipment, Location} from "../../common/Game/CharacterState";
import {Room} from "../Room";
import {Player} from "../Player";
import {AddDices} from "../../common/Event/DiceResult";


export interface ServerLocation extends Location {
    apply(room: Room, player: Player): void;
}

export function diceForMove(room: Room, player: Player): AddDices {
    let result = room.addDices(player);
    if(player.character.location)
        while(player.character.location.numbers.includes(result.finalValue()))
            result = room.addDices(player);
    return result;
}

export const locations: Array<ServerLocation> = [
    {
        name: "Monastère",
        description: "Vous Pouvez piocher une carte Lumière.",
        numbers: [6],
        async apply(room: Room, player: Player) {
            if(await player.askYesNo("Prendre une carte Lumière ?")) {
                try {
                    await room.drawCard(CardColor.White, player);
                } catch (e) {
                    if(e instanceof Error)
                        e = {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        };
                    room.getRoomNamespace().emit('error', e);
                }
            }
        }
    },
    {
        name: "Porte de l'outremonde",
        description: "Vous pouvez piocher une carte de la pile de votre choix.",
        numbers: [4, 5],
        async apply(room: Room, player: Player) {
            const answer = await player.choose("Prendre une carte de quelle pile ?",
                                                ['Lumière', 'Ténèbres', 'Vision', 'Aucune'], 'generic');

            try {
                switch (answer) {
                    case 'Lumière':
                        await room.drawCard(CardColor.White, player);
                        break;
                    case 'Ténèbres':
                        await room.drawCard(CardColor.Black, player);
                        break;
                    case 'Vision':
                        await room.drawCard(CardColor.Green, player);
                        break;
                    case 'Aucune':
                        break;
                }
            } catch (e) {
                if(e instanceof Error)
                    e = {
                        name: e.name,
                        message: e.message,
                        stack: e.stack
                    };
                room.getRoomNamespace().emit('error', e);
            }
        }
    },
    {
        name: "Antre de l'ermite",
        description: "Vous pouvez piocher une carte vision.",
        numbers: [2, 3],
        async apply(room: Room, player: Player) {
            if(await player.askYesNo("Prendre une carte Vision ?")) {
                try {
                    await room.drawCard(CardColor.Green, player);
                } catch (e) {
                    if(e instanceof Error)
                        e = {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        };
                    room.getRoomNamespace().emit('error', e);
                }
            }
        }
    },
    {
        name: "Cimetière",
        description: "Vous pouvez piocher une carte Ténèbres.",
        numbers: [8],
        async apply(room: Room, player: Player) {
            if(await player.askYesNo("Prendre une carte Ténèbres ?")) {
                try {
                    await room.drawCard(CardColor.Black, player);
                } catch (e) {
                    if(e instanceof Error)
                        e = {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        };
                    room.getRoomNamespace().emit('error', e);
                }
            }
        }
    },
    {
        name: "Forêt hantée",
        description: "Le joueur de votre choix peut subir 2 Blessures OU soigner 1 Blessure.",
        numbers: [9],
        async apply(room: Room, player: Player) {
            const action = await player.choose("Infliger 2 Blessures ou soigner 1 Blessure ?", ['Infliger 2 Blessures', 'Soigner 1 Blessure']);
            const question = (action === 'Infliger 2 Blessures' ? 'Qui blesser ?' : 'Qui soigner ?');
            const target = await player.choosePlayer(question, room.players.filter(p => p.character && !p.character.dead));
            if(action === 'Infliger 2 Blessures') {

                await room.attackPlayer(player, target, 2, 'hauntedforest');
            } else {
                await room.healPlayer(target, 1);
            }
        }
    },
    {
        name: "Sanctuaire ancien",
        description: "Vous pouvez voler une carte équipement à un autre joueur.",
        numbers: [10],
        async apply(room: Room, player: Player) {
            let possibilites: Array<{target: Player; equipment: Equipment}> = [];
            room.players.filter(p => p.character).filter(p => p !== player).forEach(p => {
                p.character.equipment.forEach(e => possibilites.push({
                    target: p,
                    equipment: e
                }));
            });
            possibilites.push(null);
            if(possibilites.length > 1) {
                // const target = await player.choose("Quel équipement voler ?", possibilites, 'playerequipment');
                // if(target !== null) {
                //     // TODO Implement
                //     //await room.stealEquipment(target.target, player, target.equipment);
                // }
            }
        }
    }
];
