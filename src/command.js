import { normalize } from './util.js';
import { MapService } from './services/MapService.js';

export class Command {
    constructor(selector) {
        this.history = [];
        this.historyIndex = -1;

        // 3. Cache DOM Elements
        this.inputEl = document.querySelector(selector);

        this.inputEl.onkeydown = (e) => this._handleInput(e);

        this.callbacks = [];
    }

    _handleInput(e) {
        if (e.key === 'Enter') {
            this._submitCommand();
        } else if (e.key === 'ArrowUp') {
            this._navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
            this._navigateHistory(+1);
        } else if (e.key === 'Tab') {
            e.preventDefault();
        }
    }

    /**
     * Subscribe to incoming messages
     * @param {function} callback - Called with {type, data} objects
     */
    onSubmit(callback) {
        this.callbacks.push(callback);
    }

    /**
     * Internal: emit message to all subscribers
     * @param {string} msg 
     */
    _emit(msg) {
        this.callbacks.forEach(cb => cb(msg));
    }

    _submitCommand() {
        const cmd = this.inputEl.value.trim();
 
        // Manage History
        if (this.history[this.history.length - 1] !== cmd) {
            this.history.push(cmd);
        }

        if (this.history.length > 50) this.history.shift();
        
        this.historyIndex = this.history.length - 1;
        this.inputEl.select();

        this._emit(cmd);
    }

    _navigateHistory(direction) {
        if (direction === 0) return;
        this.historyIndex = Math.max(-1, Math.min(this.historyIndex + direction, this.history.length));
        this.inputEl.value = this.history[this.historyIndex] || '';
        setTimeout(() => this.inputEl.select(), 0);
    }
 }