import {Socket} from "socket.io";
import {CharacterState} from "../common/Game/CharacterState";
import {ServerVictoryCondition} from "./Data/VictoryConditions";
import {Room} from "./Room";


export class Player {
    sockets: Array<Socket>;
    name: string;
    character: CharacterState;

    constructor(name: string) {
        this.name = name;
        this.sockets = [];
    }

    addSocket(socket: Socket) {
        this.sockets.push(socket);
        if(this.character) {
            socket.emit('update:ownidentity', this.character);
        }
    }

    hasWon(room: Room) {
        return (<ServerVictoryCondition>this.character.identity.victoryCondition).isFulfilled(room, this);
    }

    /**
     * Ask the player to make a choice from a collection of possibilities
     * @param title The prompt given to the user
     * @param choices The possibilities given to the user
     * @param type The type as string, defaults to "generic"
     * @param tries Number of try to connect to the player, each try will be separated by 1sec, default 120 (2 minutes), set to -1 for infinite tries
     */
    // TODO Differentiate needed and not needed questions
    async choose<T>(title: string, choices: Array<T>, type: string = 'generic', tries: number = 120): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let answerReceived = false;
            const socketTried: Array<Socket> = [];
            const connectionFunction = () => {
                this.sockets.forEach(s => {
                    if (!socketTried.find(s2 => s2.id === s.id)) {
                        s.once('response:choice', data => {
                            if(answerReceived)
                                return;
                            socketTried.forEach((s: Socket) => s.removeAllListeners('response:choice'));
                            answerReceived = true;
                            if(!choices.includes(data)) {
                                reject(new Error("Player responded with data not in dataset"));
                            } else {
                                resolve(data);
                            }
                        });
                        s.emit('request:choice', {
                            title,
                            type,
                            choices
                        });
                        socketTried.push(s);
                    }
                });
            };
            const timeoutFunction = (amount: number, f: Function) => {
                if(answerReceived)
                    return;
                if(amount === 0) {
                    socketTried.forEach((s: Socket) => s.removeAllListeners('response:choice'));
                    reject(new Error("Timeout while trying to communicate with player "+this));
                } else {
                    connectionFunction();
                    setTimeout(f, 1000, amount-1, f);
                }
            };

            connectionFunction();
            setTimeout(timeoutFunction, 1000, tries, timeoutFunction);
        });
    }


    async askYesNo(question: string, tries: number = 120): Promise<boolean> {
        const response = await this.choose(question, ['Oui', 'Non'], 'generic', tries);
        return response === 'Oui';
    }


    async choosePlayer(title: string, players: Array<Player>, tries: number = 120): Promise<Player> {
        const playerName = await this.choose(title, players.map(p => p.name), 'player', tries);
        return players.find(p => p.name === playerName);
    }

    emit(event: string, data: any) {
        this.sockets.forEach(s => s.emit(event, data));
    }
}
