import { mapEnvTypes } from './mapEnvTypes.js';
import { normalize, fnv1a64 } from './util.js';

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
    
    this.mapData = null;

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
        if (this.mapData && this.lastRenderArgs) {
          this.render(...this.lastRenderArgs);
        }
      }, 50);
    });
  }

  /**
   * Fetches and prepares the map data, including label images.
   */
  async init(apiUrl = 'map.json') {
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Data Transformation (Logic from mapApi.ts)
    data.areasById = {};
    data.roomsById = {};
    const imagePromises = [];

    data.areas.forEach(area => {
      data.areasById[area.id] = area;
      area.rooms = area.rooms ?? [];
      area.labels = area.labels ?? [];
      area.levelsById = {};

      area.rooms.forEach(room => {
        data.roomsById[room.id] = room;
        room.areaId = area.id;
        // Invert Y coordinate for canvas
        room.coordinates[1] *= -1;

        const levelId = room.coordinates[2];
        if (!area.levelsById[levelId]) {
          area.levelsById[levelId] = { id: levelId, rooms: [] };
        }
        area.levelsById[levelId].rooms.push(room);
      });

      // Handle base64 labels
      area.labels.forEach(label => {
        label.areaId = area.id;
        label.coordinates[1] *= -1;
        const imageStr = label.image.join('');
        if (imageStr) {
          label.htmlImage = new Image();
          const p = new Promise(resolve => {
            label.htmlImage.onload = resolve;
            label.htmlImage.src = 'data:image/png;base64,' + imageStr;
          });
          imagePromises.push(p);
        }
      });
    });

    await Promise.all(imagePromises);
    this.mapData = data;

    this.roomMap = new Map();
    for (let room of this.mapData.areas.flatMap(x => x.rooms)) {
      const name = normalize(room.name);
      const desc = normalize(room.userData?.description);
      if (!name || !desc) continue;

      const key = fnv1a64(`${normalize(room.name)}|${normalize(room.userData?.description)}`);
      let entries = this.roomMap.get(key);
      if (!entries) {
        entries = [];
        this.roomMap.set(key, entries);
      }

      entries.push(room);
    }
  }

  /**
   * Core rendering method (Logic from mapRenderer.ts).
   */
  render(areaId, levelId, selectedRoomId, scale = 10) {
    if (!this.mapData) return;

    this.lastRenderArgs = [areaId, levelId, selectedRoomId, scale];

    const area = this.mapData.areasById[areaId];
    const level = area.levelsById[levelId];
    if (!level) return;

    const rooms = level.rooms;
    const paths = {};

    // Determine viewport translation based on selected room or level center
    const centerRoom = this.mapData.roomsById[selectedRoomId] || rooms[0];
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
        const exitRoom = this.mapData.roomsById[exit.exitId];
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