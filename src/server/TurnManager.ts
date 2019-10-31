import {AddDices, DiceResult} from "../common/Event/DiceResult";
import {Debugger} from "inspector";
import {Room} from "./Room";
import {Player} from "./Player";
import {diceForMove, locations, ServerLocation} from "./Data/Locations";
import {Location} from "../common/Game/CharacterState";
import {Update} from "../common/Protocol/SocketIOEvents";


export enum TurnState {
    Start, BeforeMoveDice, AfterMoveDice, BeforeMove, AfterMove, BeforeAction, AfterAction,
    BeforeAttackTargetSelection, AfterAttackTargetSelection, BeforeAttackDice, AfterAttackDice,
    BeforeAttack, AfterAttack, End
}

export class BeforeMoveDiceData {

}

export class AfterMoveDiceData {
    result: AddDices;

    constructor(result: AddDices) {
        this.result = result;
    }
}

export class BeforeMoveData {
    locations: Array<Location>;

    constructor(locations: Array<Location>) {
        this.locations = locations;
    }
}

export class AfterMoveData {
    location: Location;

    constructor(location: Location) {
        this.location = location;
    }
}

export class ActionData {
    action: any;
}

export type Target = Player | Array<Player>;

export class BeforeAttackTargetSelectionData {
    targets: Array<Target>;

    constructor(targets: Array<Target>) {
        this.targets = targets;
    }
}

export class AfterAttackTargetSelectionData {
    target: Target;

    constructor(target: Target) {
        this.target = target;
    }
}

export class BeforeAttackDiceData {
    target: Target;
    dice: DiceThrower;

    constructor(target: Target, dice: DiceThrower) {
        this.target = target;
        this.dice = dice;
    }
}

export class AfterAttackDiceData {
    target: Target;
    result: DiceResult;

    constructor(target: Target, result: DiceResult) {
        this.target = target;
        this.result = result;
    }
}

export class BeforeAttackData {
    target: Player;
    type: string;
    damage: number;
    modifier: number;

    constructor(target: Player, type: string, damage: number, modifier: number) {
        this.target = target;
        this.type = type;
        this.damage = damage;
        this.modifier = modifier;
    }
}

export class AfterAttackData {
    target: Player;
    type: string;
    finalDamage: number;

    constructor(target: Player, type: string, finalDamage: number) {
        this.target = target;
        this.type = type;
        this.finalDamage = finalDamage;
    }
}

export function isTargeted(player: Player, target: Target) {
    if(target instanceof Player)
        return player === target;
    return target.includes(player);
}

export interface TurnListener<T> {
    /**
     * Callback function called at the appropriate moment
     * @param data The data associated with the event
     * @param room The room
     * @param current The user whose turn is happening
     * @param self The owner of the thing that have this listener
     */
    call(data: T, room: Room, current: Player, self: Player): Promise<T>;
}

export interface Listeners {
    start: Array<TurnListener<void>>;
    beforeMoveDice: Array<TurnListener<BeforeMoveDiceData>>;
    afterMoveDice: Array<TurnListener<AfterMoveDiceData>>;
    beforeMove: Array<TurnListener<BeforeMoveData>>;
    afterMove: Array<TurnListener<AfterMoveData>>;
    beforeAction: Array<TurnListener<ActionData>>;
    afterAction: Array<TurnListener<ActionData>>;
    beforeAttackTargetSelection: Array<TurnListener<BeforeAttackTargetSelectionData>>;
    afterAttackTargetSelection: Array<TurnListener<AfterAttackTargetSelectionData>>;
    beforeAttackDice: Array<TurnListener<BeforeAttackDiceData>>;
    afterAttackDice: Array<TurnListener<AfterAttackDiceData>>;
    beforeAttack: Array<TurnListener<BeforeAttackData>>;
    afterAttack: Array<TurnListener<AfterAttackData>>;
    end: Array<TurnListener<void>>;
}

export const emptyListener: Listeners = {
    start: [],
    beforeMoveDice: [],
    afterMoveDice: [],
    beforeMove: [],
    afterMove: [],
    beforeAction: [],
    afterAction: [],
    beforeAttackTargetSelection: [],
    afterAttackTargetSelection: [],
    beforeAttackDice: [],
    afterAttackDice: [],
    beforeAttack: [],
    afterAttack: [],
    end: [],
};


export interface DiceThrower {
    throwDice(): DiceResult;
}

export class DiceThrower4 implements DiceThrower {
    room: Room;
    player: Player;

    constructor(room: Room, player: Player) {
        this.room = room;
        this.player = player;
    }

    throwDice() {
        return this.room.d4(this.player);
    }
}

export class DiceThrower6 implements DiceThrower {
    room: Room;
    player: Player;

    constructor(room: Room, player: Player) {
        this.room = room;
        this.player = player;
    }

    throwDice() {
        return this.room.d6(this.player);
    }
}

export class DiceThrowerAdd implements DiceThrower {
    room: Room;
    player: Player;

    constructor(room: Room, player: Player) {
        this.room = room;
        this.player = player;
    }

    throwDice() {
        return this.room.addDices(this.player);
    }
}

export class DiceThrowerSub implements DiceThrower {
    room: Room;
    player: Player;

    constructor(room: Room, player: Player) {
        this.room = room;
        this.player = player;
    }

    throwDice() {
        return this.room.subDices(this.player);
    }
}


export class TurnManager {
    room: Room;
    currentPlayer: Player;

    constructor(room: Room, currentPlayer: Player) {
        this.room = room;
        this.currentPlayer = currentPlayer;
    }

    async executeTurn() {
        await this.room.invokeListener(null, this.currentPlayer, (l: Listeners) => l.start);
        if(this.room.isGameOver())
            return;

        /***** MOVE *****/
        let data: any = new BeforeMoveDiceData();

        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.beforeMoveDice);
        if(this.room.isGameOver())
            return;

        data = new AfterMoveDiceData(diceForMove(this.room, this.currentPlayer));
        if(this.room.isGameOver())
            return;

        let locs: Array<Location>;
        if(data.result.finalValue() === 7)
            locs = locations.filter(l => l !== this.currentPlayer.character.location);
        else
            locs = locations.filter(l => l.numbers.includes(data.result.finalValue()));

        data = new BeforeMoveData(locs);

        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.beforeMove);
        if(this.room.isGameOver())
            return;

        let destination: Location;
        switch ((<BeforeMoveData>data).locations.length) {
            case 0:
                destination = this.currentPlayer.character.location; // Don't move, shouldn't happen
                break;
            case 1: // No choice
                destination = (<BeforeMoveData>data).locations[0];
                break;
            default: // Let the user choose
                destination = await this.currentPlayer.choose("Vers où se déplacer ?", (<BeforeMoveData>data).locations, 'location');
                break;
        }
        this.currentPlayer.character.location = destination; // Move

        this.room.getRoomNamespace().emit(Update.Movement.stub, Update.Movement(this.currentPlayer.serialize()));

        await (<ServerLocation>destination).apply(this.room, this.currentPlayer); // And apply effect
        if(this.room.isGameOver())
            return;

        data = new AfterMoveData(destination);
        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.afterMove);
        if(this.room.isGameOver())
            return;


        /***** ATTACK *****/
        data = new BeforeAttackTargetSelectionData(this.room.players.filter(p => p.character)
                                                                    .filter(p => p !== this.currentPlayer)
                                                                    .filter(p => !p.character.dead)
                                                                    .filter(p => this.room.areNextTo(this.currentPlayer, p)));
        data.targets.push(null); // Option of not attacking

        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.beforeAttackTargetSelection);
        if(this.room.isGameOver())
            return;

        const target = await this.currentPlayer.choose("Qui attaquer ?", (<BeforeAttackTargetSelectionData>data).targets, 'target');
        if(this.room.isGameOver())
            return;

        data = new AfterAttackTargetSelectionData(target);

        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.afterAttackTargetSelection);
        if(this.room.isGameOver())
            return;

        data = new BeforeAttackDiceData(target, new DiceThrowerSub(this.room, this.currentPlayer));

        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.beforeAttackDice);
        if(this.room.isGameOver())
            return;

        const result = (<BeforeAttackDiceData>data).dice.throwDice();

        data = new AfterAttackDiceData(target, result);
        data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.afterAttackDice);
        if(this.room.isGameOver())
            return;

        const doAttack = async (targetPlayer: Player) => {
            data = new BeforeAttackData(targetPlayer, 'attack', result.finalValue(), 0);

            data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.beforeAttack);
            let damage = (<BeforeAttackData>data).damage !== 0 ? (<BeforeAttackData>data).damage + (<BeforeAttackData>data).modifier : 0;
            if(damage < 0)
                damage = 0;
            this.room.applyDamage(targetPlayer, damage);

            data = new AfterAttackData(targetPlayer, 'attack', damage);

            data = await this.room.invokeListener(data, this.currentPlayer, (l: Listeners) => l.afterAttack);
        };


        // TODO Early exit if game is over
        if(target instanceof Player)
            await doAttack(target);
        else
            await Promise.all(target.map(p => doAttack(p))); // TODO See if problem arrive because of that

        if(this.room.isGameOver())
            return;

        await this.room.invokeListener(null, this.currentPlayer, (l: Listeners) => l.end);
    }
}
