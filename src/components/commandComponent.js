import { appState } from '../appState';

export class CommandComponent {
  static HISTORY_LIMIT = 100;

  constructor(selector) {
    this.input = document.querySelector(selector);

    this.input.addEventListener('input', (e) => this._handleInput(e));

    this.input.addEventListener('keydown', (e) => this._handleKeyDown(e));
    
    this.callbacks = [];
  }

  onSubmit(callback) {
    this.callbacks.push(callback);
  }

  _handleInput() {
    appState.commandIndex = appState.commands.length;
  }

  _handleKeyDown(e) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this._submitCommand();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this._navigateHistory(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this._navigateHistory(1);
        break;

      case 'Tab':
        e.preventDefault();
        break;
    }
  }
  
  _navigateHistory(direction) {
    appState.commandIndex = Math.min(Math.max(appState.commandIndex + direction, -1), appState.commands.length);

    const isValidIndex = appState.commandIndex >= 0 && appState.commandIndex < appState.commands.length;

    this.input.value = isValidIndex ? appState.commands[appState.commandIndex] : '';

    this.input.select();
  }

  _submitCommand() {
    const command = this.input.value;

    if (appState.commands[appState.commands.length - 1] !== command) {
      appState.commands.push(command);

      if (appState.commands.length > CommandComponent.HISTORY_LIMIT) {
        appState.commands.shift();
      }

      appState.commandIndex = appState.commands.length - 1;
    }
  
    this.input.select();

    this.callbacks.forEach(callback => callback(command));
  }
 }