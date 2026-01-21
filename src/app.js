import { Terminal } from './terminal.js';
import { MudSocket } from './mudSocket.js';
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
        
        // 2. Internal State
        this.trailing = false;

        this.connectButton = document.getElementById('connect-button');

        // 4. Bind and Setup
        this.socket.onMessage((msg) => this.onSocketMessage(msg));
        this.command.onSubmit((command) => this._submitCommand(command));
        this.connectButton.onclick = () => this.socket.connect();

        window.mapService = new MapService();
        this.spinner.show();
        window.mapService.load().then(() => this.spinner.hide());
    }

    /**
     * Handle incoming messages from the socket
     * @param {Object} msg - The message object
     */
    onSocketMessage(msg) {
      const type = msg.type || 'raw';

          this._handleTriggers(msg.data);

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

    _submitCommand(cmd) {

        // Visual cleanup for trailing text
        if (this.trailing) {
            this.terminal.writeln();
            this.trailing = false;
        }

        // Echo command to local terminal
        //\x1B\[36m(.+)\x1B\[0m
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