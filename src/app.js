import './style.css';
import { Terminal } from './terminal.js';
import { MudSocket } from './mudSocket.js';
import { MapRenderer } from './map.js';
import { normalize, fnv1a64 } from './util.js';
//import map from './map.json' with { type: 'json' };

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
        this.map.init();

        // 2. Internal State
        this.trailing = false;
        this.history = [];
        this.historyIndex = -1;

        // 3. Cache DOM Elements
        this.inputEl = document.getElementById('cmd-input');
        this.connectButton = document.getElementById('connect-button');

        // 4. Bind and Setup
        this.socket.onMessage((msg) => this.onSocketMessage(msg));
        this.connectButton.onclick = () => this.socket.connect();
        this.inputEl.onkeydown = (e) => this._handleInput(e);
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

    _handleInput(e) {
        if (e.key === 'Enter') {
            this._submitCommand();
        } else if (e.key === 'ArrowUp') {
            this._navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
            this._navigateHistory(+1);
        }
    }

    _submitCommand() {
        const cmd = this.inputEl.value.trim();
        //if (!cmd) return;

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

        // Manage History
        if (this.history[this.history.length - 1] !== cmd) {
            this.history.push(cmd);
        }

        if (this.history.length > 50) this.history.shift();
        
        this.historyIndex = this.history.length - 1;
        this.inputEl.select();
    }

    _navigateHistory(direction) {
        if (direction === 0) return;
        this.historyIndex = Math.max(-1, Math.min(this.historyIndex + direction, this.history.length));
        this.inputEl.value = this.history[this.historyIndex] || '';
        setTimeout(() => this.inputEl.select(), 0);
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
            let entries = this.map.roomMap[normalize(this.roomName)];
            if (entries?.length > 1) {
                //then search by room description
                entries = this.map.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}`];
                if (entries?.length > 1) {
                    //finally search by room exits
                    entries = this.map.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}|${normalize(this.roomExits)}`];
                    if (!entries?.length) {
                        //fallback behavior
                        entries = this.map.roomMap[`${normalize(this.roomName)}|${normalize(this.roomDesc)}`];
                    }
                }
            }

            if (entries?.length) {
                const entry = entries[0];
                console.log('Room detected:', entry);
                this.map.render(entry.areaId, entry.coordinates[2], entry.id);
            }


            /*const key = fnv1a64(`${normalize(this.roomName)}|${normalize(this.roomDesc)}`);
            const entries = this.map.roomMap.get(key);
            if (entries) {
                const entry = entries[0];
                console.log('Room detected:', entry);
                this.map.render(entry.areaId, entry.coordinates[2], entry.id);
            }*/

    
            
            /*let found = false;
            for (let area of this.map.mapData.areas) {
                for (let room of area.rooms) {
                    if (room.name === this.roomName && room.userData.description.trim() === this.roomDesc.trim()) {
                        console.log('Room detected:', area, room);
                        
                        this.map.render(area.id, room.coordinates[2], room.id);
                        found = true;

                        break;
                    }

                    if (found) {
                        break;
                    }
                }
            }*/


            //const roomData = map.areas.flatMap(x => x.rooms).find(r => r.name === this.roomName && r.userData.description.trim() === this.roomDesc.trim());

        }
        else if (this.isRoom) {
            this.roomDesc += text + '\n';
        }
    }
}