export class ConsoleComponent {
    // Static configuration for ANSI codes
    static FG_COLORS = {
        '30': '#000', '31': '#ff5555', '32': '#50fa7b', '33': '#f1fa8c',
        '34': '#bd93f9', '35': '#ff79c6', '36': '#8be9fd', '37': '#f8f8f2',
        '90': '#6272a4', '91': '#ff6e6e', '92': '#69ff94', '93': '#ffffa5',
        '94': '#d6acff', '95': '#ff92df', '96': '#a4ffff', '97': '#ffffff'
    };

    static BG_COLORS = {
        '40': '#000', '41': '#ff5555', '42': '#50fa7b', '43': '#f1fa8c',
        '44': '#bd93f9', '45': '#ff79c6', '46': '#8be9fd', '47': '#f8f8f2',
        '100': '#6272a4', '101': '#ff6e6e', '102': '#69ff94', '103': '#ffffa5',
        '104': '#d6acff', '105': '#ff92df', '106': '#a4ffff', '107': '#ffffff'
    };

    constructor(selector, maxLines = 1000) {
        this.container = document.querySelector(selector);
        this.maxLines = maxLines;
        
        // Persistent console state
        this.state = {
            fg: null,
            bg: null,
            bold: false,
            underline: false
        };

        this.container.classList.add('console');
    }

    _parseAnsi(str) {
        const regex = /\x1b\[([0-9;]+)m/g;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        for (const match of str.matchAll(regex)) {
            // Text before the escape code
            if (match.index > lastIndex) {
                fragment.appendChild(this._createSpan(str.slice(lastIndex, match.index)));
            }

            // Update state based on ANSI codes
            const codes = match[1].split(';');
            codes.forEach(code => {
                if (code === '0') {
                    this.state = { fg: null, bg: null, bold: false, underline: false };
                } else if (code === '1') {
                    this.state.bold = true;
                } else if (code === '4') {
                    this.state.underline = true;
                } else if (ConsoleComponent.FG_COLORS[code]) {
                    this.state.fg = ConsoleComponent.FG_COLORS[code];
                } else if (ConsoleComponent.BG_COLORS[code]) {
                    this.state.bg = ConsoleComponent.BG_COLORS[code];
                } else if (code === '39') {
                    this.state.fg = null;
                } else if (code === '49') {
                    this.state.bg = null;
                }
            });

            lastIndex = match.index + match[0].length;
        }

        // Remaining trailing text
        if (lastIndex < str.length) {
            fragment.appendChild(this._createSpan(str.slice(lastIndex)));
        }

        return fragment;
    }

    _createSpan(text) {
        const span = document.createElement('span');
        span.textContent = text;
        
        if (this.state.fg) {
            span.style.color = this.state.fg;
        }

        if (this.state.bg) {
            span.style.backgroundColor = this.state.bg;
        }
        
        if (this.state.bold) {
            span.style.fontWeight = 'bold';
        }

        if (this.state.underline) {
            span.style.textDecoration = 'underline';
        }

        return span;
    }

    write(content = '') {
        const lines = content.toString().split('\n');
        
        lines.forEach((line, i) => {
            let lastLine = this.container.lastElementChild;
            
            if (!lastLine || i > 0) {
                lastLine = document.createElement('div');
                this.container.appendChild(lastLine);
            }

            if (line.length > 0) {
                lastLine.appendChild(this._parseAnsi(line));
            }
        });

        while (this.container.children.length > this.maxLines) {
            this.container.removeChild(this.container.firstChild);
        }

        this.scrollToBottom();
    }

    writeln(content = '') {
        this.write(content + '\n');
    }

    clear() {
        this.container.innerHTML = '';
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }
}