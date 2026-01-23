export class SpinnerComponent {
    constructor(selector) {
        this.container = document.querySelector(selector);
    }

    show() {
      this.container.style.display = 'block';
    }

    hide() {
      this.container.style.display = 'none';
    }

  }