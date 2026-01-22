import { Terminal } from './terminal.js';
import { MudSocket } from './services/mudSocket.js';
import { MapRenderer } from './map.js';
import { normalize } from './util.js';
import { MapService } from './services/MapService.js';
import { Spinner } from './spinner.js';
import { Command } from './command.js';

export class App {
    constructor() {

        let wsUrl;
        if (window.location.host.startsWith('localhost')) {
            wsUrl = 'ws://localhost:8080'
        } else {
            wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
        }

        // 1. Initialize Components
        this.terminal = new Terminal('#terminal', 1000);
        this.comms = new Terminal('#comms', 1000);
        this.socket = new MudSocket(wsUrl);
        this.map = new MapRenderer('#map');
        this.spinner = new Spinner('#spinner');
        this.command = new Command('#cmd-input');
        this.connectButton = document.getElementById('connect-button');
        
        // 2. Internal State
        this.trailing = false;

        // 4. Bind and Setup
        this.socket.onMessage((msg) => this._onSocketMessage(msg));
        this.command.onSubmit((command) => this._onSubmitCommand(command));
        this.connectButton.onclick = () => this.socket.connect();

        window.mapService = new MapService();
        this.spinner.show();
        window.mapService.load().then(() => this.spinner.hide());
    }

    /**
     * Handle incoming messages from the socket
     * @param {Object} msg - The message object
     */
    _onSocketMessage(msg) {
      const type = msg.type || 'raw';

        this._handleTriggers(msg.data);

        const words = msg.data.match(/\b\w{2,}\b/g);
        if (words) {
            this.words ??= new Set();

            for (const word of words) {
                // move word to most-recent position
                this.words.delete(word);
                this.words.add(word);

                // trim to last 100 distinct words
                if (this.words.size > 100) {
                    const oldest = this.words.values().next().value;
                    this.words.delete(oldest);
                }
            }
            console.log('words', this.words);
        }


        // Reset trailing if we get a new non-timer message
        if (this.trailing && !msg.timer) {
            this.terminal.writeln();
            this.trailing = false;
        }

        if (type === 'system') {
            this.terminal.writeln(msg.data);
        } else if (type === 'raw') {
            if (msg.timer) {
                this.terminal.write(msg.data);
                this.trailing = true;
            } else {
                this.terminal.writeln(msg.data);
            }
        }
    }

    _onSubmitCommand(cmd) {

        // Visual cleanup for trailing text
        if (this.trailing) {
            this.terminal.writeln();
            this.trailing = false;
        }

        this.terminal.writeln(`\x1B\[90m${cmd}\x1B\[0m`);

        // Process command (splitting by semicolon)
        const subcmds = cmd.split(';');
        subcmds.forEach(sub => this.socket.send(sub.trim()));
    }


    _handleTriggers(text) {
        if (text.includes(' says ') ||
            text.includes(' tells you ') ||
            text.includes('You tell ') ||
            text.includes('You say ') ||
            text.includes('whispers') ||
            text.includes('shouts') || 
            text.includes('yells') ||
            text.includes(' chats ') ||          
            text.includes(' narrates ')) {
            this.comms.writeln(text);
        }

        const match = text.match(/^\x1B\[36m(.+)\x1B\[0m$/);
        if (match) {
            this.isRoom = true;
            this.roomName = match[1];
            this.roomDesc = '';
        } else if (this.isRoom && text.includes('obvious exits:')) {
            this.isRoom = false;

            this.roomExits = text.match(/\[ obvious exits: (.*) \]$/)?.[1] || '';

            console.log('name', [this.roomName, normalize(this.roomName)]);
            console.log('roomDesc', [this.roomDesc, normalize(this.roomDesc)]);
            console.log('exits', [this.roomExits, normalize(this.roomExits)]);


            //search by room name
            let entries = window.mapService.roomMap[normalize(this.roomName)];
            if (entries?.length > 1) {
                //then search by room description
                entries = window.mapService.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}`];
                if (entries?.length > 1) {
                    //finally search by room exits
                    entries = window.mapService.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}|${normalize(this.roomExits)}`];
                    if (!entries?.length) {
                        //fallback behavior
                        entries = window.mapService.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}`];
                    }
                }
            }

            if (entries?.length) {
                const entry = entries[0];
                console.log('Room detected:', entry);
                this.map.render(entry.areaId, entry.coordinates[2], entry.id);
            }
        }
        else if (this.isRoom) {
            this.roomDesc += text + '\n';
        }
    }
}