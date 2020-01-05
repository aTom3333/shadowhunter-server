import {Faction, VictoryCondition} from "../../common/Game/Character";
import {CharacterState} from "../../common/Game/CharacterState";
import {Player} from "../Player";
import {Room} from "../Room";


export interface ServerVictoryCondition extends VictoryCondition {
    description: string;

    isFulfilled(room: Room, self: Player): boolean;
}

// TODO Gérer les boucles infinies:
// Au moins Agnès et Allie ont une condition de victoire dépendant des conditions de victoire d'autres joueurs
// Il faut faire attention à ne pas boucler indéfiniment
export const victoryConditions: {
    agnes: ServerVictoryCondition;
    allie: ServerVictoryCondition;
    bob: ServerVictoryCondition;
    bryan: ServerVictoryCondition;
    catherine: ServerVictoryCondition;
    charles: ServerVictoryCondition;
    daniel: ServerVictoryCondition;
    david: ServerVictoryCondition;

    hunter: ServerVictoryCondition;
    shadow: ServerVictoryCondition;
} = {
    agnes: {
        description: "Le joueur à votre droite gagne.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            const self_idx = board.states.findIndex(c => c.id === state.id);
            let target: CharacterState;
            if (state.powerUsed) {
                // Le joueur à gauche gagne
                target = board.states[board.nextOf(self_idx)];
            } else {
                // Le joueur à droite gagne
                target = board.states[board.previousOf(self_idx)];
            }

            const targetPlayer = room.players.filter(p => p.character).find(p => p.character.id === target.id);

            return targetPlayer.hasWon(room);
        }
    },
    allie: {
        description: "Être encore en vie lorsque la partie se termine.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            if (state.dead)
                return false;
            // Si Allie est vivante, elle gagne si la partie est finie, càd au moins un personnage a gagné
            let gameOver = false;
            room.players.filter(p => p.character).every(p => {
                if (p.character.id !== state.id) {
                    if (p.hasWon(room)) {
                        gameOver = true;
                        return false;
                    }
                }
            });

            return gameOver;
        }
    },
    bob: {
        description: "Posséder 5 cartes équipement ou plus.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            return state.equipment.length >= 5;
        }
    },
    bryan: {
        description: "Tuer un personnage de 13 Points de Vie ou plus OU être dans le sanctuaire ancien à la fin du jeu.",
        isFulfilled(room: Room, self: Player): boolean {
            const board = room.board;
            const state = self.character;

            let gameOver = false;
            room.players.filter(p => p.character).every(p => {
                if (p.character.id !== state.id) {
                    if (p.hasWon(room)) {
                        gameOver = true;
                        return false;
                    }
                }
            });
            if(gameOver && state.location.name === "Sanctuaire ancien")
                return true;

            let hasKilledStrong = false;
            board.deaths.every(dr => {
                if(dr.killerId === state.id) {
                    const deadChara = board.states.find(c => c.id === dr.deadId);
                    if(deadChara.identity.hp >= 13) {
                        hasKilledStrong = true;
                        return false;
                    }
                }
            });
            if(hasKilledStrong)
                return true;
            return false;
        }
    },
    catherine: {
        description: "Être la première à mourir OU être l'un des deux seuls personnages en vie.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            // Première à mourir (morte et seul mort de la partie => 1 mort)
            if (state.dead && board.states.filter(c => c.dead).length === 1)
                return true;
            // Vivante avec maximum une autre personne
            if (!state.dead && board.states.filter(c => !c.dead).length <= 2)
                return true;
            return false;
        }
    },
    charles: {
        description: "Tuer un autre personnage par une attaque alors qu'il y a déjà eu 3 morts ou plus.",
        isFulfilled(room: Room, self: Player): boolean {
            const board = room.board;
            const state = self.character;
            for(let i = 3; i < board.deaths.length; i++) {
                const dr = board.deaths[i];
                if(dr.killerId === state.id && dr.reason === 'attack')
                    return true;
            }
            return false;
        }
    },
    daniel: {
        description: "Être le premier à mourir OU être en vie quand tous les personnages Shadow sont morts.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            // Premier à mourir
            if (state.dead && board.states.filter(c => c.dead).length === 1)
                return true;
            // Vivant et tous les shadow morts
            if (!state.dead && board.states.filter(c => !c.dead && c.identity.faction === Faction.Shadow).length === 0)
                return true;
            return false;
        }
    },
    david: {
        description: "Avoir au minimum 3 de ces cartes : Crucifix en Argent, Amulette, Lance de Longinus, Toge Sainte.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            let ownedWanted = 0;
            if (state.equipment.find(e => e.name === "Crucifix en Argent" || e.name === "Amulette" || e.name === "Lance de Longinus" || e.name === "Toge Sainte"))
                ownedWanted += 1;
            return ownedWanted >= 3;
        }
    },


    hunter: {
        description: "Tous les personnages Shadow sont morts.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            return board.states.filter(c => !c.dead && c.identity.faction === Faction.Shadow).length === 0;
        }
    },
    shadow: {
        description: "Tous les personnages Hunter sont morts OU au moins 3 personnages Neutres sont morts.",
        isFulfilled(room: Room, self: Player) {
            const board = room.board;
            const state = self.character;
            return (board.states.filter(c => c.dead && c.identity.faction === Faction.Neutral).length >= 3)
                || board.states.filter(c => !c.dead && c.identity.faction === Faction.Hunter).length === 0;
        }
    }
};
