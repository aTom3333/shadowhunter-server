import {Player} from "../Player";
import {Room} from "../Room";
import {TurnStep} from "../../common/Game/Board";
import {Power} from "../../common/Game/Character";

export interface ServerPower extends Power {
    description: string;
    execute(room: Room, self: Player): Promise<void>;
}

export const powers: {
    thunder: ServerPower;
} = {
    thunder: {
        description: "Au début de votre tour, choisissez un joueur et infligez-lui autant de Blessures que le résultat d'un dé à 6 faces.",
        async execute(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;

            if(board.currentTurn.character.id !== state.id || board.currentTurn.step !== TurnStep.Start || self.character.powerUsed)
                return; // Power not usable

            if(await self.askYesNo('Utiliser votre pouvoir ?')) {
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
    }
};
