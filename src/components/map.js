import { mapEnvTypes } from '../mapEnvTypes.js';
import { normalize, fnv1a64 } from '../util.js';

/**
 * Encapsulates the rendering logic for the WoTMud map.
 * Derived from mapRenderer.ts and mapApi.ts.
 */
export class MapRenderer {
  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);
    if (!this.canvas) {
      throw new Error(`Canvas element with selector "${canvasSelector}" not found.`);
    }
    this.ctx = this.canvas.getContext('2d');
    
    // Constants matching the original implementation
    this.baseScale = 10;
    this.tileSize = 1;
    this.scaledTileSize = this.tileSize * this.baseScale;
    
    setTimeout(() => {
      this.canvas.width = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;
    }, 0)

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        if (window.mapService.mapData && this.lastRenderArgs) {
          this.render(...this.lastRenderArgs);
        }
      }, 50);
    });
  }

  /**
   * Core rendering method (Logic from mapRenderer.ts).
   */
  render(areaId, levelId, selectedRoomId, scale = 10) {
    const mapData = window.mapService.mapData;
    if (!mapData) return;

    this.lastRenderArgs = [areaId, levelId, selectedRoomId, scale];

    const area = mapData.areasById[areaId];
    const level = area.levelsById[levelId];
    if (!level) return;

    const rooms = level.rooms;
    const paths = {};

    // Determine viewport translation based on selected room or level center
    const centerRoom = mapData.roomsById[selectedRoomId] || rooms[0];
    const translateX = centerRoom.coordinates[0];
    const translateY = centerRoom.coordinates[1];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    // Set up viewport
    this.ctx.translate(
      this.canvas.width / 2 - translateX * scale, 
      this.canvas.height / 2 - translateY * scale
    );
    this.ctx.scale(scale / this.baseScale, scale / this.baseScale);

    // 1. Draw Paths
    rooms.forEach(room => {
      const x1 = room.coordinates[0] * this.baseScale;
      const y1 = room.coordinates[1] * this.baseScale;

      room.exits.forEach(exit => {
        const exitRoom = mapData.roomsById[exit.exitId];
        if (!exitRoom || exit.name === 'up' || exit.name === 'down') return;

        if (exitRoom.areaId === areaId) {
          const pathKey = room.id < exitRoom.id ? `${room.id}|${exitRoom.id}` : `${exitRoom.id}|${room.id}`;
          if (!paths[pathKey]) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#cccccc";
            // Check for one-way exits
            if (!exitRoom.exits.some(e => e.exitId === room.id)) {
              this.ctx.setLineDash([2, 3]);
            }
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(exitRoom.coordinates[0] * this.baseScale, exitRoom.coordinates[1] * this.baseScale);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            paths[pathKey] = true;
          }
        } else {
          // Cross-area "stub" indicators
          this._drawAreaStub(x1, y1, exit.name);
        }
      });
    });

    // 2. Draw Rooms
    rooms.forEach(room => {
      const x = room.coordinates[0] * this.baseScale;
      const y = room.coordinates[1] * this.baseScale;
      const env = mapEnvTypes[room.environment] || { color: '#cc0000' };

      this.ctx.beginPath();
      this.ctx.rect(x - this.scaledTileSize / 2, y - this.scaledTileSize / 2, this.scaledTileSize, this.scaledTileSize);
      this.ctx.strokeStyle = "#cccccc";
      this.ctx.fillStyle = env.color;
      this.ctx.fill();
      this.ctx.stroke();

      if (room.id === selectedRoomId) {
        this._drawSelectionHighlight(x, y);
      }
    });

    // 3. Draw Labels
    area.labels.filter(l => l.coordinates[2] === levelId).forEach(label => {
      const lx = label.coordinates[0] * this.baseScale;
      const ly = label.coordinates[1] * this.baseScale;
      const lw = label.size[0] * this.baseScale * 0.9;
      const lh = label.size[1] * this.baseScale * 0.9;
      if (label.htmlImage) this.ctx.drawImage(label.htmlImage, lx, ly, lw, lh);
    });

    this.ctx.restore();
  }

  _drawAreaStub(x, y, direction) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = "#ff0000";
    const offset = this.baseScale * 1.5;
    this.ctx.moveTo(x, y);
    if (direction === 'west') this.ctx.lineTo(x - offset, y);
    if (direction === 'east') this.ctx.lineTo(x + offset, y);
    if (direction === 'north') this.ctx.lineTo(x, y - offset);
    if (direction === 'south') this.ctx.lineTo(x, y + offset);
    this.ctx.stroke();
  }

  _drawSelectionHighlight(x, y) {
    // Red pulsing effect style
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.scaledTileSize, 0, Math.PI * 2);
    this.ctx.strokeStyle = "#ff0000";
    this.ctx.fillStyle = "#cc000077";
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(x, y, this.scaledTileSize * 1.25, 0, Math.PI * 2);
    this.ctx.strokeStyle = "#ff0000";
    this.ctx.stroke();
  }
}