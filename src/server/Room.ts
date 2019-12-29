import {Board} from "../common/Game/Board";
import {Player} from "./Player";
import {Namespace, Server, Socket} from "socket.io";
import {Character, Faction} from "../common/Game/Character";
import {characters} from "./Data/Characters";
import {CardColor, CharacterState} from "../common/Game/CharacterState";
import {AfterAttackData, BeforeAttackData, Listeners, TurnListener, TurnManager} from "./TurnManager";
import {ServerPower} from "./Data/Powers";
import {ServerDeck, ServerEquipment} from "./Data/Cards";
import {AddDices, Dice4, Dice6, SubtractDices} from "../common/Event/DiceResult";
import {locations} from "./Data/Locations";
import {FullRoom, RoomState, RoomSummary} from "../common/Protocol/RoomInterface";
import {Debug, Dice, Request, Response, Update} from "../common/Protocol/SocketIOEvents";
import {Duplex} from "stream";
import {PlayerInterface} from "../common/Protocol/PlayerInterface";


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
        const board = this.board ? this.board.serialize(this.isGameOver()) : null;
        return {
            board: board,
            players: this.players.map(p => { return { id: p.character?p.character.id:undefined, name: p.name }; }),
            winners: this.isGameOver() ? this.players.filter(p => p.character).filter(p => p.hasWon(this)).map(p => p.character.id) : null
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

        // TODO Remove this
        console.log(`${name} entre dans la room ${this.name} avec l'adresse ${socket.handshake.headers['x-real-ip']||socket.handshake.headers['x-forwarded-for']}`);

        this.getRoomNamespace().emit(Update.PlayerJoined.stub, Update.PlayerJoined({ name, character: this.players[player_id].character }));
        if(!this.gameStarted())
            socket.on('request:startgame', data => {
                this.startGame();
            });

        socket.on(Request.Reveal.stub, (p: PlayerInterface) => {
            if(player.name === p.name && p.character && player.character && p.character.id === player.character.id) {
                this.revealPlayer(player);
            }
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
        this.getRoomNamespace().emit(Update.ChangeHP.stub, Update.ChangeHP({
            player: target.serialize(),
            type: '-',
            amount: damage
        }));
        this.updateTS();
    }

    // TODO Externalize
    private generateComposition(extension: boolean): Array<Character> {
        const hunters = characters.filter(c => c.faction === Faction.Hunter);
        const shadows = characters.filter(c => c.faction === Faction.Shadow);
        const neutrals = characters.filter(c => c.faction === Faction.Neutral).filter(c => c.name === 'Allie');

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
            case 1:
                throw new Error('Il faut plus d\'un joueur pour commencer une partie')
            default:
                throw new Error('Not implemented'); // TODO Better error handling
        }

        const charas = [];
        for(let i = 0; i < amountShadowHunter; i++) {
            const shadowIdx = randomInt(0, shadows.length);
            charas.push(shadows[shadowIdx]);
            shadows.splice(shadowIdx, 1);
            const hunterIdx = randomInt(0, hunters.length);
            charas.push(hunters[hunterIdx]);
            hunters.splice(hunterIdx, 1);
        }
        for(let i = 0; i < amountNeutral; i++) {
            const neutralIdx = randomInt(0, neutrals.length);
            charas.push(neutrals[neutralIdx]);
            neutrals.splice(neutralIdx, 1);
        }

        return charas;
    }

    startGame() {
        try {
            if (!this.gameStarted()) {
                const charas = shuffleArray(this.generateComposition(false)); // TODO Leave control to the players
                this.players.forEach((p, i) => p.character = new CharacterState(i, charas[i], i));

                this.board = new Board(this.players.map(p => p.character), shuffleArray(locations),
                    ServerDeck.makeDeck(CardColor.White), ServerDeck.makeDeck(CardColor.Black), ServerDeck.makeDeck(CardColor.Green));

                this.getRoomNamespace().emit(Update.GameStarted.stub, Update.GameStarted(this.serializeState()));

                this.players.forEach(p => p.emit(Update.OwnIdentity.stub, Update.OwnIdentity(p.character)));

                setTimeout(() => {
                    this.play();
                }, 500);
            }
        } catch(e) {
            if(e instanceof Error)
                e = {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                };
            this.getRoomNamespace().emit('error', e);
            return;
        }

        this.players.forEach(p => {
            p.sockets.forEach(s => {
                s.removeAllListeners('request:startgame');
            })
        });
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
        const listeners: Array<{p: Player, l: TurnListener<T>}> = [];

        for(const p of this.players.filter(p => p.character)) {
            // Invoke power callbacks
            for(const l of listenerGetter((<ServerPower>p.character.identity.power).listeners)) {
                listeners.push({p, l});
            }

            // Invoke equipment callbacks
            for(const e of p.character.equipment) {
                for(const l of listenerGetter((<ServerEquipment>e).listeners)) {
                    listeners.push({p, l});
                }
            }
        }

        listeners.sort((a, b) => a.l.priority - b.l.priority);

        for(const {p, l} of listeners) {
            data = await l.call(data, this, currentPlayer, p);
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
                const currentPlayer = this.players.find(p => p.character.id === this.board.currentCharacterId);
                await this.playTurn(currentPlayer);
                this.board.nextTurn();
            }
            this.showEnd();
        }
        catch (e) {
            console.error(e);
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
        this.getRoomNamespace().emit(Update.Attack.stub, Update.Attack({
            attacker: attacker.serialize(),
            target: target.serialize(),
            type
        }));

        let data: any = new BeforeAttackData(target, type, damage, 0);

        data = await this.invokeListener(data, attacker, (l: Listeners) => l.beforeAttack);
        let finalDamage = (<BeforeAttackData>data).damage !== 0 ? (<BeforeAttackData>data).damage + (<BeforeAttackData>data).modifier : 0;
        if(finalDamage < 0)
            finalDamage = 0;
        this.applyDamage(target, finalDamage);

        data = new AfterAttackData(target, type, damage);

        data = await this.invokeListener(data, attacker, (l: Listeners) => l.afterAttack);

        if(target.character.lostHp >= target.character.identity.hp) {
            // Dead
            target.character.dead = true;
            target.character.killerId = attacker.character.id;
            this.board.deaths.push({
                deadId: target.character.id,
                killerId: attacker.character.id,
                reason: type
            });
            this.getRoomNamespace().emit(Update.Dead.stub, Update.Dead({
                target: target.serialize(),
                killer: attacker.serialize()
            }));
        }
    }

    async healPlayer(target: Player, amount: number) {
        const old = target.character.lostHp;
        target.character.lostHp = Math.max(old - amount, 0);
        this.getRoomNamespace().emit(Update.ChangeHP.stub, Update.ChangeHP({
            player: target.serialize(),
            type: '+',
            amount: old - target.character.lostHp
        }));
        this.updateTS();
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
        this.getRoomNamespace().emit(Update.DrawCard.stub, Update.DrawCard({
            player: player.serialize(),
            card: card.color === CardColor.Green ? { name: null, description: null, color: CardColor.Green } : card
        }));
        await card.apply(player, this);
    }

    private showEnd() {
        this.getRoomNamespace().emit(Update.GameOver.stub, Update.GameOver(this.serializeState()));
    }

    revealPlayer(player: Player) {
        player.character.revealed = true;
        this.getRoomNamespace().emit(Update.Reveal.stub, Update.Reveal(player.serialize()));
    }

    usePower(player: Player) {
        this.getRoomNamespace().emit(Update.UsePower.stub, Update.UsePower(player.serialize()));
    }

    checkStates() {
        this.players.forEach(p => {
            const boardState = this.serializeState();
            if(p.character)
                boardState.board.states.find(c => c.id === p.character.id).identity = p.character.identity;
            p.emit(Debug.CheckState.stub, Debug.CheckState(boardState));
        });
    }

    sendMessage(msg: string, ...data: Array<any>) {
        this.getRoomNamespace().emit(Update.Message.stub, Update.Message({
            msg,
            params: data
        }));
    }
}
