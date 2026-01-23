// src/mudSocket.js

export class MudSocket {
    /**
     * @param {string} url - WebSocket server URL
     */
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.buffer = '';
        this.timeout = null;
        this.callbacks = [];
        this.regex = /\r\n|\n\r|\r\x00|\r|\n|\x00/g;
    }

    /**
     * Connect to the MUD server
     */
    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            this._emit({ type: 'system', data: 'Connected successfully.' });
        };

        this.socket.onclose = () => {
            this._emit({ type: 'system', data: 'Disconnected.' });
        };

        this.socket.onerror = (err) => {
            this._emit({ type: 'system', data: 'Socket Error.' });
        };

        this.socket.onmessage = (event) => this._handleMessage(event);
    }

    /**
     * Send a command to the server
     * @param {string} cmd 
     */
    send(cmd) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'cmd', data: cmd }));
        }
    }

    /**
     * Subscribe to incoming messages
     * @param {function} callback - Called with {type, data} objects
     */
    onMessage(callback) {
        this.callbacks.push(callback);
    }

    /**
     * Internal: emit message to all subscribers
     * @param {object} msg 
     */
    _emit(msg) {
        this.callbacks.forEach(cb => cb(msg));
    }

    /**
     * Internal: handle incoming data
     * @param {MessageEvent} event 
     */
    _handleMessage(event) {
        // Clear existing timeout
        clearTimeout(this.timeout);
        this.timeout = null;

        // Append incoming data to buffer
        const data = JSON.parse(event.data);
        this.buffer += data.data;
        console.log(data);
        
        //break into parts
        let i = 0;
        const matches = [...this.buffer.matchAll(this.regex)];
        const results = matches.map(match => {
            const text = this.buffer.substring(i, match.index);
            const delimiter = match[0];
            const item = {  text, delimiter };
            i = match.index + delimiter.length;
            return item;
        }).filter(x => x.text.trim() || x.delimiter.includes('\n'));
        this.buffer = this.buffer.substring(i);

        // preemptive flush (optimization)
        if (this.buffer === 'By what name do you wish to be known? ' ||
            this.buffer === 'Passphrase: ' ||
            this.buffer.endsWith('> ') ||
            [' ', '-', '=', '+', '*'].includes(this.buffer)) {
            const buffer = this.buffer;
            this.buffer = '';
            results.push({ text: buffer, delimiter: '' });
        }

        // emit results
        for (let result of results) {
            this._emit({
                data: result.text, 
                delimiter: result.delimiter,
                prompt: result.text.endsWith('> '),
                timer: [' ', '-', '=', '+', '*'].includes(result.text)
            });
        }

        // flush remainder after short delay
        if (!this.timeout && this.buffer.length) {
            this.timeout = setTimeout(() => {
                console.log('Flushing after delay', this.buffer);
                this.timeout = null;
                const buffer = this.buffer;
                this.buffer = '';
                this._emit({
                    data: buffer,
                    delimiter: '',
                    prompt: false,
                    timer: false
                });
            }, 250);
        }
    }
}