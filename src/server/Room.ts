import {Board} from "../common/Game/Board";
import {Player} from "./Player";
import {Namespace, Server, Socket} from "socket.io";
import {Character, Faction} from "../common/Game/Character";
import {characters} from "./Data/Characters";
import {CharacterState} from "../common/Game/CharacterState";


function randomInt(low: number, high: number): number {
    return Math.floor(Math.random() * (high - low) + low)
}

function shuffleArray<T>(array: Array<T>): Array<T> {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export class Room {
    name: string;
    board: Board;
    players: Array<Player>;
    lastAction: Date;
    io: Server;

    constructor(name: string, io: Server) {
        this.name = name;
        this.players = [];
        this.io = io;
    }

    private updateTS() {
        this.lastAction = new Date(Date.now());
    }

    serialize() {   // TODO Return a common protocol Room when defined
        return {name: this.name};
    }

    serializeState() {
        return {
            board: this.board,
            players: this.players.map(p => { return { id: p.character?p.character.id:undefined, name: p.name }; })
        }; // TODO Return a common protocol that describe the whole game
    }

    addPlayer(newPlayer: Player) {
        this.players.push(newPlayer);
        this.updateTS();
    }

    getRoomNamespace(): Namespace {
        return this.io.in(this.name);
    }

    enters(name: string, socket: Socket) {
        const player_id = this.players.findIndex(p => p.name === name);
        this.players[player_id].addSocket(socket);
        socket.join(this.name);
        this.getRoomNamespace().emit('update:playerjoined', { name });
        this.updateTS();
    }

    d6(): number {
        // TODO Random
        const value = 1;
        this.getRoomNamespace().emit('dice:d6', { value });
        this.updateTS();
        return 1;
    }

    applyDamage(target: Player, damage: number) {
        const actualDamage = target.character.dealDamage(damage);
        // TODO Communication
        this.updateTS();
    }

    // TODO Externalize
    private generateComposition(extension: boolean): Array<Character> {
        const hunters = characters.filter(c => c.faction === Faction.Hunter);
        const shadows = characters.filter(c => c.faction === Faction.Shadow);
        const neutrals = characters.filter(c => c.faction === Faction.Neutral);

        let amountShadowHunter = 0;
        let amountNeutral = 0;
        switch (this.players.length) {
            case 2:
                amountNeutral = 0;
                amountShadowHunter = 1;
                break;
            case 3:
                amountNeutral = 1;
                amountShadowHunter = 1;
                break;
            case 4:
                amountNeutral = 0;
                amountShadowHunter = 2;
                break;
            case 5:
                amountNeutral = 1;
                amountShadowHunter = 2;
                break;
            case 6:
                amountNeutral = 2;
                amountShadowHunter = 2;
                break;
            default:
                throw new Error('Not implemented'); // TODO Better error handling
        }

        const charas = [];
        for(let i = 0; i < amountShadowHunter; i++) {
            const shadowIdx = randomInt(0, shadows.length);
            charas.push(shadows[shadowIdx]);
            // TODO Remove inserted character
            //shadows.splice(shadowIdx, 1);
            const hunterIdx = randomInt(0, hunters.length);
            charas.push(hunters[hunterIdx]);
            // TODO Remove inserted character
            //hunters.splice(hunterIdx, 1);
        }
        for(let i = 0; i < amountNeutral; i++) {
            const neutralIdx = randomInt(0, neutrals.length);
            charas.push(neutrals[neutralIdx]);
            // TODO Remove inserted character
            //neutrals.splice(neutralIdx, 1);
        }

        return charas;
    }

    startGame() {
        if(this.board === null) {
            const charas = shuffleArray(this.generateComposition(false)); // TODO Leave control to the players
            console.log(charas);
            this.players.forEach((p, i) => p.character = new CharacterState(i, charas[i]));
            this.board = new Board(this.players.map(p => p.character));

            this.getRoomNamespace().emit('update:gamestarted', this.serializeState());

            this.players.forEach(p => p.emit('update:ownidentity', p.character));
        }
        this.updateTS();
    }
}
