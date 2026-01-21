import { normalize } from '../util.js';

export class MapService {

  async load(apiUrl = 'map.json') {
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

      const tier1RoomsMap = this.mapData.areas.flatMap(x => x.rooms).reduce((map, room) => {
        const name = room.name;
        const key = normalize(name);
        (map[key] ??= []).push(room);
        return map;
      }, {});

      const tier2RoomsMap = Object.values(tier1RoomsMap).filter(x => x.length > 1).flat().reduce((map, room) => {
        const name = room.name;
        const description = room.userData.description;
        const key = `${normalize(name)}|${normalize(description)}`;
        (map[key] ??= []).push(room);
        return map;
      }, {});

      const directionOrder = ['N', 'E', 'S', 'W', 'U', 'D'];
      const tier3RoomsMap = Object.values(tier2RoomsMap).filter(x => x.length > 1).flat().reduce((map, room) => {
        const name = room.name;
        const description = room.userData.description;
        const exits = room.exits.map(x => x.name[0].toUpperCase()).sort((a, b) => directionOrder.indexOf(a) - directionOrder.indexOf(b)).join(' ');
        const key = `${normalize(name)}|${normalize(description)}|${normalize(exits)}`;
        (map[key] ??= []).push(room);
        return map;
      }, {});

      this.roomMap = { ...tier1RoomsMap, ...tier2RoomsMap, ...tier3RoomsMap };
    }
}