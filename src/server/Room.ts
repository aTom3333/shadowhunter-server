import {Board} from "../common/Game/Board";
import {Player} from "./Player";
import {Namespace, Server, Socket} from "socket.io";
import {Character, Faction} from "../common/Game/Character";
import {characters} from "./Data/Characters";
import {CardColor, CharacterState, PawnColor} from "../common/Game/CharacterState";
import {AfterAttackData, BeforeAttackData, Listeners, TurnManager} from "./TurnManager";
import {ServerPower} from "./Data/Powers";
import {ServerDeck, ServerEquipment} from "./Data/Cards";
import {AddDices, Dice4, Dice6, SubtractDices} from "../common/Event/DiceResult";
import {locations} from "./Data/Locations";
import {FullRoom, RoomState, RoomSummary} from "../common/Protocol/RoomInterface";
import {Dice, Response, Update} from "../common/Protocol/SocketIOEvents";


export function randomInt(low: number, high: number): number {
    return Math.floor(Math.random() * (high - low) + low)
}

export function shuffleArray<T>(array: Array<T>): Array<T> {
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
        this.board = null;
        this.io = io;
    }

    private updateTS() {
        this.lastAction = new Date(Date.now());
    }

    serialize(): RoomSummary {
        return {
            name: this.name,
            state: this.board ? this.isGameOver() ? RoomState.Over : RoomState.Playing : RoomState.Setup,
            noplayers: this.players.length
        };
    }

    serializeState(): FullRoom {
        return {
            board: this.board,
            players: this.players.map(p => { return { id: p.character?p.character.id:undefined, name: p.name }; })
        };
    }

    addPlayer(newPlayer: Player) {
        this.players.push(newPlayer);
        this.updateTS();
    }

    getRoomNamespace(): Namespace {
        return this.io.in(this.name);
    }

    gameStarted(): boolean {
        return this.board !== null;
    }

    enters(name: string, socket: Socket) {
        const player_id = this.players.findIndex(p => p.name === name);
        if(player_id === -1) {
            socket.emit('error', new Error('Can\'t bind socket with player: no player named "'+name+'"'));
            return;
        }
        const player = this.players[player_id];

        player.addSocket(socket);
        socket.join(this.name);

        this.getRoomNamespace().emit(Update.PlayerJoined.stub, Update.PlayerJoined({ name, character: this.players[player_id].character }));
        if(!this.gameStarted())
            socket.on('request:startgame', data => {
                this.startGame();
            });

        socket.emit(Response.RoomJoined.stub, Response.RoomJoined({ name, room: this.serialize() }));

        socket.on('disconnect', () => {
            player.removeSocket(socket, this);
        });

        this.updateTS();
    }

    leaves(player: Player) {
        const player_idx = this.players.indexOf(player);
        if(player_idx === -1)
            return;
        this.players.splice(player_idx, 1);
        this.getRoomNamespace().emit(Update.PlayerLeft.stub, Update.PlayerLeft({ name: player.name, character: player.character }));
        this.updateTS();
    }

    private throwDice6(player: Player): Dice6 {
        const value = randomInt(1, 7);
        return {
            value, finalValue() {
                return this.value;
            }, player: player.serialize()
        };
    }

    private throwDice4(player: Player): Dice4 {
        const value = randomInt(1, 5);
        return {
            value, finalValue() {
                return this.value;
            }, player: player.serialize()
        };
    }

    d6(player: Player): Dice6 {
        const result = this.throwDice6(player);
        this.getRoomNamespace().emit(Dice.D6.stub, Dice.D6(result));
        this.updateTS();
        return result;
    }

    d4(player: Player): Dice4 {
        const result = this.throwDice4(player);
        this.getRoomNamespace().emit(Dice.D4.stub, Dice.D4(result));
        this.updateTS();
        return result;
    }

    addDices(player: Player): AddDices {
        const result = {
            d4: this.throwDice4(player),
            d6: this.throwDice6(player),
            player: player.serialize(),
            finalValue() { return this.d4.value + this.d6.value; }
        };
        this.getRoomNamespace().emit(Dice.Add.stub, Dice.Add(result));
        this.updateTS();
        return result;
    }

    subDices(player: Player): SubtractDices {
        const result = {
            d4: this.throwDice4(player),
            d6: this.throwDice6(player),
            player: player.serialize(),
            finalValue() { return Math.abs(this.d4.value - this.d6.value); }
        };
        this.getRoomNamespace().emit(Dice.Sub.stub, Dice.Sub(result));
        this.updateTS();
        return result;
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
        this.players.forEach(p => {
            p.sockets.forEach(s => {
                s.removeAllListeners('request:startgame');
            })
        });

        if(!this.gameStarted()) {
            const charas = shuffleArray(this.generateComposition(false)); // TODO Leave control to the players
            this.players.forEach((p, i) => p.character = new CharacterState(i, charas[i], i));

            this.board = new Board(this.players.map(p => p.character), shuffleArray(locations),
                                    ServerDeck.makeDeck(CardColor.White), ServerDeck.makeDeck(CardColor.Black), ServerDeck.makeDeck(CardColor.Green));

            this.getRoomNamespace().emit(Update.GameStarted.stub, Update.GameStarted(this.serializeState()));

            this.players.forEach(p => p.emit(Update.OwnIdentity.stub, Update.OwnIdentity(p.character)));

            setTimeout(() => { this.play(); }, 5000);
        }
        this.updateTS();
    }

    async playTurn(player: Player) {
        const turnManager = new TurnManager(this, player);
        await turnManager.executeTurn();
    }

    isGameOver(): boolean {
        return this.players.filter(p => p.character).map(p => p.hasWon(this)).reduce((a, b) => a || b, false);
    }

    async invokeListener<T>(data: T, currentPlayer: Player, listenerGetter: Function): Promise<T> {
        for(const p of this.players.filter(p => p.character)) {
            // Invoke power callbacks
            for(const l of listenerGetter((<ServerPower>p.character.identity.power).listeners)) {
                data = await l.call(data, this, currentPlayer, p);
            }

            // Invoke equipment callbacks
            for(const e of p.character.equipment) {
                for(const l of listenerGetter((<ServerEquipment>e).listeners)) {
                    data = await l.call(data, this, currentPlayer, p);
                }
            }
        }

        return data;
    }

    areNextTo(player1: Player, player2: Player): boolean {
        const index1 = this.board.locations.findIndex(l => l === player1.character.location);
        const index2 = this.board.locations.findIndex(l => l === player2.character.location);
        return Math.floor(index1/2) === Math.floor(index2/2);
    }

    async play() {
        try {
            while (!this.isGameOver()) {
                const currentPlayer = this.players.find(p => p.character.id === this.board.currentTurn.character.id);
                await this.playTurn(currentPlayer);
                this.board.nextTurn();
            }
            this.showEnd();
        }
        catch (e) {
            if(e instanceof Error)
                e = {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                };
            this.getRoomNamespace().emit('error', e);
        }
    }

    async attackPlayer(attacker: Player, target: Player, damage: number, type: string) {
        let data: any = new BeforeAttackData(target, type, damage, 0);

        data = await this.invokeListener(data, attacker, (l: Listeners) => l.beforeAttack);
        let finalDamage = (<BeforeAttackData>data).damage !== 0 ? (<BeforeAttackData>data).damage + (<BeforeAttackData>data).modifier : 0;
        if(finalDamage < 0)
            finalDamage = 0;
        this.applyDamage(target, finalDamage);

        data = new AfterAttackData(target, type, damage);

        data = await this.invokeListener(data, attacker, (l: Listeners) => l.afterAttack);
    }

    async drawCard(color: CardColor, player: Player) {
        let deck: ServerDeck;
        switch (color) {
            case CardColor.White:
                deck = <ServerDeck>this.board.whiteDeck;
                break;
            case CardColor.Black:
                deck = <ServerDeck>this.board.blackDeck;
                break;
            case CardColor.Green:
                deck = <ServerDeck>this.board.greenDeck;
                break;
        }
        const card = deck.drawCard(this, player);
        await card.apply(player, this);
    }

    private showEnd() {
        // TODO Implement
    }
}
