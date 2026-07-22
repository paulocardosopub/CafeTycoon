import Phaser from 'phaser';
import { installPixelAtlases } from '../assets/pixel/PixelAtlasFactory';
import { REQUIRED_CHARACTER_ANIMATIONS, WORLD_ASSETS, characterFrame, effectFrame } from '../assets/pixel/manifest';
import { BLENDER_RENDERED_ASSETS } from '../assets/pixel/blenderManifest';
import { C3_BR_CHARACTER_ASSETS, C3_BR_LEGACY_ALIASES } from '../assets/pixel/c3brManifest';
import { footprintDepthPoint, VISUAL_METRICS } from '../assets/pixel/VisualMetrics';
import { gameEvents } from '../core/events';
import type { ConstructionSaveState, Direction, FurnitureEditSession, GridPoint, PixelAnimationName, StationRuntime, TableRuntime, WorldAssetId } from '../core/types';
import { gridToWorld, isoDepth, worldToGrid } from '../game/grid/IsoGrid';
import { DECORATIONS, ENTRANCE, MAP_SIZE, RESTAURANT_SIZE } from '../game/map/initialMap';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { STAFF_BY_ID } from '../game/data/staff';
import { orientedFootprint } from '../game/systems/furniture/FurniturePlacement';
import type { CustomerRuntime, RestaurantSimulation, WorkerActor } from '../game/simulation/RestaurantSimulation';
import { characterMotionState, oneShotAnimationDurationMs, oneShotAnimationFrame } from '../game/systems/animation/CharacterAnimationState';
import { directionBetween } from '../game/navigation/TileMovement';
import { getFootprintFloorAnchorWorld } from '../game/grid/SpatialLayoutService';
import { renderedDirectionRow } from '../assets/pixel/RenderedDirection';
import { RECIPE_BY_ID } from '../content/recipes/recipes';

interface ActorVisual {
  sprite: Phaser.GameObjects.Sprite;
  bubble: Phaser.GameObjects.Text;
}

interface CustomerVisual {
  sprite: Phaser.GameObjects.Sprite;
  bubble: Phaser.GameObjects.Text;
  patience: Phaser.GameObjects.Graphics;
  previousState: string;
  transitionStartedAt: number;
}

interface StationVisual {
  sprite: Phaser.GameObjects.Image;
  effect: Phaser.GameObjects.Sprite;
  progress: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  plates: Phaser.GameObjects.Image[];
}

interface TableVisual {
  pieces: Phaser.GameObjects.Image[];
  stateIcon: Phaser.GameObjects.Text;
  seatPlates: Map<string, Phaser.GameObjects.Image>;
  seatDirt: Map<string, Phaser.GameObjects.Text>;
}

const ZOOM_LEVELS = VISUAL_METRICS.zoomLevels;
const SEATED_STATES = ['sitting', 'waiting_order', 'waiting_food', 'eating', 'paying'];
const RENDERED_ASSETS = [...BLENDER_RENDERED_ASSETS.filter((asset) => asset.kind !== 'character'), ...C3_BR_CHARACTER_ASSETS];

export class RestaurantScene extends Phaser.Scene {
  private actorVisuals = new Map<string, ActorVisual>();
  private customerVisuals = new Map<string, CustomerVisual>();
  private stationVisuals = new Map<string, StationVisual>();
  private tableVisuals = new Map<string, TableVisual>();
  private placedDecorationVisuals: Phaser.GameObjects.Image[] = [];
  private technicalOverlay?: Phaser.GameObjects.Graphics;
  private technicalMode = false;
  private technicalFilters = new Set(['customers', 'kitchen', 'service', 'stock', 'production', 'pathfinding', 'reservations']);
  private dragging = false;
  private zoomIndex: number = VISUAL_METRICS.defaultZoomIndex;
  private visualSkinSet: 'bloom' | 'sage' = activeVisualSkinSet();
  private constructionPreviewActive = false;
  private constructionPreviewObjects: Phaser.GameObjects.GameObject[] = [];
  private dragOrigin = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
  private draggedFurnitureId?: string;
  private lastFurnitureDragCell?: string;

  constructor(private readonly simulation: RestaurantSimulation) { super('restaurant'); }

  preload(): void {
    for (const asset of RENDERED_ASSETS) {
      const source = `${asset.spriteSheet}?v=${encodeURIComponent(asset.renderVersion)}`;
      this.load.spritesheet(`blender:${asset.assetId}`, source, { frameWidth: asset.frameSize[0], frameHeight: asset.frameSize[1] });
    }
  }

  create(): void {
    installPixelAtlases(this, this.simulation.state.profile?.appearance);
    for (const asset of RENDERED_ASSETS) this.textures.get(`blender:${asset.assetId}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor('#294b3a');
    this.cameras.main.setBounds(-920, -250, 1840, 1250);
    this.cameras.main.centerOn(0, 320).setZoom(ZOOM_LEVELS[this.zoomIndex]);
    this.drawEnvironment();
    this.drawPlacedDecorations();
    this.simulation.tables.forEach((table) => this.drawTable(table));
    this.simulation.stations.forEach((station) => this.drawStation(station));
    this.simulation.actors.forEach((actor) => this.createActor(actor));
    this.technicalOverlay = this.add.graphics().setDepth(50_000).setVisible(false);
    this.bindCameraControls();
    if (isDevelopmentHost()) this.input.keyboard?.on('keydown-D', () => this.toggleTechnicalMode());
    this.input.keyboard?.on('keydown-PLUS', () => this.setZoomIndex(this.zoomIndex + 1));
    this.input.keyboard?.on('keydown-MINUS', () => this.setZoomIndex(this.zoomIndex - 1));
    gameEvents.on('technical:toggle', () => { if (isDevelopmentHost()) this.toggleTechnicalMode(); });
    gameEvents.on<string[]>('technical:filters', (filters) => { this.technicalFilters = new Set(filters); });
    gameEvents.on<number>('camera:zoom-step', (step) => this.setZoomIndex(this.zoomIndex + Math.sign(step)));
    gameEvents.on<string>('camera:focus-actor', (actorId) => {
      const actor = this.simulation.actors.find((item) => item.id === actorId);
      if (!actor) return;
      const point = gridToWorld(actor.visual); this.cameras.main.pan(point.x, point.y, 420, 'Sine.easeInOut');
    });
    gameEvents.on<{ construction: ConstructionSaveState; selectedItemId?: string; selectedStaffId?: string; interactionMode?: 'select' | 'place' | 'move' | 'staff'; editSession?: FurnitureEditSession }>('construction:preview', (payload) => this.renderConstructionPreview(payload));
    gameEvents.on('construction:preview-end', () => this.endConstructionPreview());
    gameEvents.emit('camera:zoom', this.cameras.main.zoom);
  }

  update(_time: number, deltaMs: number): void {
    this.simulation.update(deltaMs / 1000);
    this.simulation.actors.forEach((actor) => { if (!this.actorVisuals.has(actor.id)) this.createActor(actor); this.syncActor(actor); });
    const activeActorIds = new Set(this.simulation.actors.map((actor) => actor.id));
    for (const [actorId, visual] of this.actorVisuals) {
      if (activeActorIds.has(actorId)) continue;
      visual.sprite.destroy(); visual.bubble.destroy(); this.actorVisuals.delete(actorId);
    }
    this.simulation.customers.forEach((customer) => this.syncCustomer(customer));
    const activeCustomerIds = new Set(this.simulation.customers.map((customer) => customer.id));
    for (const [customerId, visual] of this.customerVisuals) {
      if (activeCustomerIds.has(customerId)) continue;
      visual.sprite.destroy(); visual.bubble.destroy(); visual.patience.destroy();
      this.customerVisuals.delete(customerId);
    }
    if (!this.constructionPreviewActive) {
      this.simulation.stations.forEach((station) => this.syncStation(station));
      this.simulation.tables.forEach((table) => this.syncTable(table));
    }
    if (this.technicalMode) this.drawTechnicalOverlay();
  }

  private bindCameraControls(): void {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.setZoomIndex(this.zoomIndex + (dy > 0 ? -1 : 1)));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Furniture and floor hit areas stop propagation themselves. Empty
      // restaurant space remains available for camera panning in edit mode.
      if (this.draggedFurnitureId) return;
      this.dragging = true;
      this.dragOrigin = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.draggedFurnitureId && pointer.isDown) {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const cell = worldToGrid(world); const key = `${cell.x},${cell.y}`;
        if (key !== this.lastFurnitureDragCell) {
          this.lastFurnitureDragCell = key;
          gameEvents.emit('construction:world-drag', { itemId: this.draggedFurnitureId, x: cell.x, y: cell.y });
        }
        return;
      }
      if (!this.dragging || !pointer.isDown) return;
      const camera = this.cameras.main;
      camera.scrollX = Math.round(this.dragOrigin.scrollX - (pointer.x - this.dragOrigin.x) / camera.zoom);
      camera.scrollY = Math.round(this.dragOrigin.scrollY - (pointer.y - this.dragOrigin.y) / camera.zoom);
    });
    this.input.on('pointerup', () => { this.dragging = false; this.draggedFurnitureId = undefined; this.lastFurnitureDragCell = undefined; });
    this.input.on('pointerupoutside', () => { this.dragging = false; this.draggedFurnitureId = undefined; this.lastFurnitureDragCell = undefined; });
  }

  private setZoomIndex(index: number): void {
    const next = Phaser.Math.Clamp(index, 0, ZOOM_LEVELS.length - 1);
    if (next === this.zoomIndex) return;
    const center = { x: this.cameras.main.midPoint.x, y: this.cameras.main.midPoint.y };
    this.zoomIndex = next;
    this.cameras.main.setZoom(ZOOM_LEVELS[this.zoomIndex]).centerOn(center.x, center.y);
    gameEvents.emit('camera:zoom', this.cameras.main.zoom);
  }

  private toggleTechnicalMode(): void {
    this.technicalMode = !this.technicalMode;
    this.technicalOverlay?.setVisible(this.technicalMode);
    gameEvents.emit('technical:changed', this.technicalMode);
    gameEvents.emit('toast', { message: this.technicalMode ? 'Modo técnico ativado.' : 'Modo técnico desativado.', tone: 'info' });
  }

  private renderConstructionPreview(payload: { construction: ConstructionSaveState; selectedItemId?: string; selectedStaffId?: string; interactionMode?: 'select' | 'place' | 'move' | 'staff'; editSession?: FurnitureEditSession }): void {
    this.constructionPreviewActive = true;
    this.setOperationVisualsVisible(false);
    this.constructionPreviewObjects.splice(0).forEach((object) => object.destroy());

    const grid = this.add.graphics().setDepth(-9_000);
    const cells = new Map<string, GridPoint>();
    for (const area of payload.construction.builtAreas) for (let y = area.y; y < area.y + area.depth; y += 1) for (let x = area.x; x < area.x + area.width; x += 1) {
      cells.set(`${x},${y}`, { x, y });
    }
    for (const cell of cells.values()) {
      const point = gridToWorld(cell);
      const protectedCell = (cell.x === 9 || cell.x === 10) && cell.y === 17;
      grid.fillStyle(protectedCell ? 0xf1c45b : 0x77d3b4, protectedCell ? .24 : .08);
      grid.lineStyle(protectedCell ? 2 : 1, protectedCell ? 0xf1c45b : 0x8ce1c4, protectedCell ? .9 : .36);
      this.drawDebugDiamond(grid, point);
      const zone = this.add.zone(Math.round(point.x), Math.round(point.y), 64, 32).setOrigin(.5).setDepth(-8_900)
        .setInteractive(new Phaser.Geom.Polygon([{ x: 32, y: 0 }, { x: 64, y: 16 }, { x: 32, y: 32 }, { x: 0, y: 16 }]), Phaser.Geom.Polygon.Contains);
      zone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        gameEvents.emit('construction:world-cell', { x: cell.x, y: cell.y });
      });
      this.constructionPreviewObjects.push(zone);
    }
    this.constructionPreviewObjects.push(grid);

    for (const item of payload.construction.placedFurniture) {
      const definition = FURNITURE_BY_ID[item.definitionId];
      if (!definition) continue;
      const footprint = orientedFootprint(definition, item.orientation);
      const base = footprintDepthPoint({ x: item.gridX, y: item.gridY }, footprint);
      const point = getFootprintFloorAnchorWorld({ x: item.gridX, y: item.gridY }, footprint);
      const counterVariant = payload.construction.serviceCounters.find((module) => module.id === item.id)?.connectionVariant;
      const renderDefinition = definition.functionId === 'pickup' && counterVariant
        ? FURNITURE_BY_ID[{ isolated: 'service.c1.isolated', left: 'service.c2.left', middle: 'service.c3.middle', right: 'service.c4.right', corner: 'service.c1.isolated' }[counterVariant]]
        : definition;
      const assetId = renderDefinition.spriteSet[item.orientation];
      const rendered = blenderAsset(assetId);
      if (!rendered || !this.textures.exists(`blender:${assetId}`)) continue;
      const origin = definition.baseAnchor;
      const sprite = this.add.image(Math.round(point.x), Math.round(point.y), `blender:${assetId}`, worldRenderedFrame(item.orientation, 0, assetId))
        .setOrigin(origin.x, origin.y).setScale((rendered.nativeScale ?? 1) * definition.visualScale)
        .setDepth(isoDepth(base, VISUAL_METRICS.depth.furnitureBase));
      const furnitureSelectionEnabled = !['place', 'staff'].includes(payload.interactionMode ?? 'select');
      if (furnitureSelectionEnabled) {
        // Os renders têm frames transparentes maiores que o móvel. Sem teste
        // por alpha, esse retângulo invisível interceptava o toque destinado
        // aos quadrados do piso e fazia parecer que o item tinha sumido.
        sprite.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });
      }
      if (item.id === payload.selectedItemId) sprite.setTint(0xffd66b);
      const chooseFurniture = (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.draggedFurnitureId = item.id; this.lastFurnitureDragCell = `${item.gridX},${item.gridY}`;
        gameEvents.emit('construction:world-item', { itemId: item.id });
      };
      if (furnitureSelectionEnabled) sprite.on('pointerdown', chooseFurniture);
      this.constructionPreviewObjects.push(sprite);
      if (furnitureSelectionEnabled) for (let cellY = 0; cellY < footprint.depth; cellY += 1) for (let cellX = 0; cellX < footprint.width; cellX += 1) {
        const footprintPoint = gridToWorld({ x: item.gridX + cellX, y: item.gridY + cellY });
        const footprintZone = this.add.zone(Math.round(footprintPoint.x), Math.round(footprintPoint.y), 64, 32)
          .setOrigin(.5).setDepth(sprite.depth + 1)
          .setInteractive(new Phaser.Geom.Polygon([{ x: 32, y: 0 }, { x: 64, y: 16 }, { x: 32, y: 32 }, { x: 0, y: 16 }]), Phaser.Geom.Polygon.Contains);
        footprintZone.on('pointerdown', chooseFurniture);
        this.constructionPreviewObjects.push(footprintZone);
      }
      if (item.id === payload.selectedItemId) {
        const valid = payload.editSession?.validationState !== 'invalid';
        const highlight = this.add.graphics().setDepth(sprite.depth - 1);
        for (let fy = 0; fy < footprint.depth; fy += 1) for (let fx = 0; fx < footprint.width; fx += 1) {
          const footprintPoint = gridToWorld({ x: item.gridX + fx, y: item.gridY + fy });
          highlight.fillStyle(valid ? 0x55d98a : 0xe75b4f, .32).lineStyle(2, valid ? 0x88f0ad : 0xff8a7f, 1);
          this.drawDebugDiamond(highlight, footprintPoint);
        }
        highlight.fillStyle(0xfff1ce, 1).fillCircle(Math.round(point.x), Math.round(point.y), 3);
        const controlY = Math.round(point.y - rendered.frameSize[1] * definition.visualScale * .74);
        const confirm = this.add.text(Math.round(point.x - 18), controlY, '✓', this.pixelTextStyle('#173a36', valid ? '#8ce1a8ee' : '#777777dd'))
          .setOrigin(.5).setDepth(isoDepth(base, VISUAL_METRICS.depth.status) + 2);
        if (valid) confirm.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); gameEvents.emit('construction:edit-confirm', undefined); });
        const cancel = this.add.text(Math.round(point.x + 18), controlY, '×', this.pixelTextStyle('#fff8e9', '#c94b3cee'))
          .setOrigin(.5).setDepth(isoDepth(base, VISUAL_METRICS.depth.status) + 2).setInteractive({ useHandCursor: true });
        cancel.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); gameEvents.emit('construction:edit-cancel', undefined); });
        const label = this.add.text(Math.round(point.x), controlY - 24, `${definition.code} · ${valid ? 'posição válida' : payload.editSession?.validationErrors[0] ?? 'posição inválida'}`, this.pixelTextStyle('#173a36', valid ? '#dff8e4ee' : '#ffd4cfee'))
          .setOrigin(.5).setDepth(isoDepth(base, VISUAL_METRICS.depth.status));
        this.constructionPreviewObjects.push(highlight, confirm, cancel, label);
      }
    }

    for (const staff of payload.construction.staffStartPositions) {
      const assetId = staff.staffId === 'player'
        ? this.simulation.actors.find((actor) => actor.kind === 'player')?.assetId ?? 'player-style-0'
        : STAFF_BY_ID[staff.staffId]?.assetId;
      const rendered = assetId ? blenderAsset(assetId) : undefined;
      if (!assetId || !rendered || !this.textures.exists(`blender:${assetId}`)) continue;
      const point = gridToWorld({ x: staff.gridX, y: staff.gridY });
      const selected = staff.staffId === payload.selectedStaffId;
      const sprite = this.add.sprite(Math.round(point.x), Math.round(point.y), `blender:${assetId}`, renderedCharacterFrame(assetId, 'idle', staff.facing, 0, true))
        .setOrigin(characterOrigin(assetId).x, characterOrigin(assetId).y)
        .setScale(rendered.nativeScale ?? 1)
        .setDepth(isoDepth({ x: staff.gridX, y: staff.gridY }, VISUAL_METRICS.depth.standingCharacter));
      const staffSelectionEnabled = !['place', 'staff'].includes(payload.interactionMode ?? 'select');
      if (staffSelectionEnabled) sprite.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });
      if (selected) sprite.setTint(0xffd66b);
      const chooseStaff = (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        gameEvents.emit('construction:world-staff', { staffId: staff.staffId });
      };
      this.constructionPreviewObjects.push(sprite);
      if (staffSelectionEnabled) {
        sprite.on('pointerdown', chooseStaff);
        const staffZone = this.add.zone(Math.round(point.x), Math.round(point.y), 64, 32).setOrigin(.5).setDepth(sprite.depth + 1)
          .setInteractive(new Phaser.Geom.Polygon([{ x: 32, y: 0 }, { x: 64, y: 16 }, { x: 32, y: 32 }, { x: 0, y: 16 }]), Phaser.Geom.Polygon.Contains);
        staffZone.on('pointerdown', chooseStaff);
        this.constructionPreviewObjects.push(staffZone);
      }
      if (selected) {
        const label = this.add.text(Math.round(point.x), Math.round(point.y - characterUiOffset(assetId)), 'EQUIPE · toque no destino', this.pixelTextStyle('#173a36', '#ffd66bee'))
          .setOrigin(.5).setDepth(isoDepth({ x: staff.gridX, y: staff.gridY }, VISUAL_METRICS.depth.status));
        this.constructionPreviewObjects.push(label);
      }
    }
  }

  private endConstructionPreview(): void {
    if (!this.constructionPreviewActive) return;
    this.constructionPreviewActive = false;
    this.draggedFurnitureId = undefined; this.lastFurnitureDragCell = undefined;
    this.constructionPreviewObjects.splice(0).forEach((object) => object.destroy());
    this.setOperationVisualsVisible(true);
  }

  private setOperationVisualsVisible(visible: boolean): void {
    for (const visual of this.stationVisuals.values()) {
      visual.sprite.setVisible(visible);
      visual.effect.setVisible(false);
      visual.progress.setVisible(visible);
      visual.label.setVisible(false);
      visual.plates.forEach((plate) => plate.setVisible(false));
    }
    for (const visual of this.tableVisuals.values()) {
      visual.pieces.forEach((piece) => piece.setVisible(visible));
      visual.stateIcon.setVisible(false);
      visual.seatPlates.forEach((plate) => plate.setVisible(false));
      visual.seatDirt.forEach((dirt) => dirt.setVisible(false));
    }
    this.placedDecorationVisuals.forEach((decoration) => decoration.setVisible(visible));
    for (const visual of this.actorVisuals.values()) { visual.sprite.setVisible(visible); visual.bubble.setVisible(false); }
    for (const visual of this.customerVisuals.values()) { visual.sprite.setVisible(visible); visual.bubble.setVisible(false); visual.patience.setVisible(visible); }
  }

  private drawEnvironment(): void {
    for (let y = -2; y < MAP_SIZE.height + 2; y += 1) {
      for (let x = -2; x < MAP_SIZE.width + 2; x += 1) {
        const inside = x >= 0 && y >= 0 && x < RESTAURANT_SIZE.width && y < RESTAURANT_SIZE.height - 1;
        const entrancePath = Math.abs(x - ENTRANCE.x) <= 1 && y >= RESTAURANT_SIZE.height - 1;
        const farOutside = x <= -2 || y <= -2 || x >= RESTAURANT_SIZE.width + 1 || y >= RESTAURANT_SIZE.height + 1;
        const asset: WorldAssetId = inside
          ? y <= 7 ? 'floor_kitchen' : 'floor_dining'
          : entrancePath || farOutside ? 'floor_road' : (x + y) % 2 ? 'floor_grass_alt' : 'floor_outside';
        const point = gridToWorld({ x, y });
        this.add.image(Math.round(point.x), Math.round(point.y), 'world-atlas', WORLD_ASSETS[asset].frame)
          .setOrigin(.5).setDepth(-10_000 + x + y);
      }
    }
    for (let x = 0; x < RESTAURANT_SIZE.width; x += 1) this.addWorldAsset('wall_nw', { x, y: 0 }, 8);
    for (let y = 1; y < RESTAURANT_SIZE.height; y += 1) this.addWorldAsset('wall_ne', { x: 0, y }, 8);
    DECORATIONS.forEach((item) => this.addWorldAsset(item.asset, item.position, item.asset === 'door' ? 9 : 18));
  }

  private drawPlacedDecorations(): void {
    for (const item of this.simulation.state.construction.placedFurniture) {
      const definition = FURNITURE_BY_ID[item.definitionId];
      if (definition?.functionId !== 'decoration') continue;
      const asset: WorldAssetId = definition.id === 'decor.plant.basic' ? 'plant' : 'bin';
      this.placedDecorationVisuals.push(this.addWorldAsset(
        asset, { x: item.gridX, y: item.gridY }, VISUAL_METRICS.depth.furnitureBase, item.orientation,
        definition.spriteSet[item.orientation], definition.visualScale, orientedFootprint(definition, item.orientation),
      ));
    }
  }

  private addWorldAsset(asset: WorldAssetId, position: GridPoint, layer: number, orientation: Direction = 'sw', renderedAssetId?: string, visualScale = 1, floorFootprint?: { width: number; depth: number }): Phaser.GameObjects.Image {
    const definition = WORLD_ASSETS[asset];
    const point = floorFootprint ? getFootprintFloorAnchorWorld(position, floorFootprint) : gridToWorld(position);
    const blenderId = renderedAssetId ?? WORLD_BLENDER_ASSET[asset];
    const rendered = blenderId ? blenderAsset(blenderId) : undefined;
    const useBlender = Boolean(rendered && this.textures.exists(`blender:${blenderId}`));
    const image = this.add.image(
      Math.round(point.x),
      Math.round(point.y),
      useBlender ? `blender:${blenderId}` : 'world-atlas',
      useBlender ? worldRenderedFrame(orientation, 0, blenderId!) : definition.frame,
    );
    const origin = useBlender && rendered && rendered.anchor.length === 2
      ? { x: rendered.anchor[0], y: rendered.anchor[1] }
      : definition.anchor;
    return image.setOrigin(origin.x, origin.y).setScale((rendered?.nativeScale ?? 1) * visualScale).setDepth(isoDepth(position, layer));
  }

  private drawTable(table: TableRuntime): void {
    const tableAssetId = `${table.maxCustomers === 2 ? 'table_two' : 'table_four'}${this.visualSkinSet === 'sage' ? '_green' : ''}`;
    const tableImage = this.addWorldAsset('table', table.position, 30, table.orientation, tableAssetId, FURNITURE_BY_ID['dining.table.basic'].visualScale, { width: 1, depth: 1 }).setInteractive({ useHandCursor: true });
    tableImage.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('table', table.id);
      gameEvents.emit('toast', { message: ok ? 'Tarefa da mesa priorizada.' : 'Não há tarefa compatível nessa mesa.', tone: ok ? 'success' : 'info' });
    });
    const chairBacks = table.chairs.map((chair) => this.addWorldAsset(
      `chair_${chair.orientation}`, chair.visualPosition, VISUAL_METRICS.depth.chairBack + chair.depthOffset, chair.orientation,
      this.visualSkinSet === 'sage' ? 'chair_upholstered_back' : chair.layerAssetIds.back,
      FURNITURE_BY_ID['dining.chair.basic'].visualScale,
      { width: 1, depth: 1 },
    ));
    const chairFronts = table.chairs.map((chair) => this.addWorldAsset(
      `chair_${chair.orientation}`, chair.visualPosition, VISUAL_METRICS.depth.chairFront + chair.depthOffset, chair.orientation,
      this.visualSkinSet === 'sage' ? 'chair_upholstered_front' : chair.layerAssetIds.front,
      FURNITURE_BY_ID['dining.chair.basic'].visualScale,
      { width: 1, depth: 1 },
    ));
    const pieces = [tableImage, ...chairBacks, ...chairFronts];
    const point = getFootprintFloorAnchorWorld(table.position, { width: 1, depth: 1 });
    const stateIcon = this.add.text(Math.round(point.x), Math.round(point.y - 56), '', this.pixelTextStyle('#fff8e9', '#294b3ae6'))
      .setOrigin(.5).setDepth(isoDepth(table.position, 90)).setVisible(false);
    const seatPlates = new Map<string, Phaser.GameObjects.Image>();
    const seatDirt = new Map<string, Phaser.GameObjects.Text>();
    for (const seat of table.chairs) {
      const seatPoint = getFootprintFloorAnchorWorld(seat.platePosition, { width: 1, depth: 1 });
      seatPlates.set(seat.seatId, this.add.image(Math.round(seatPoint.x), Math.round(seatPoint.y - 28), 'world-atlas', WORLD_ASSETS.dish.frame)
        .setOrigin(.5, 1).setScale(.4).setDepth(isoDepth(seat.platePosition, 42)).setVisible(false));
      seatDirt.set(seat.seatId, this.add.text(Math.round(seatPoint.x), Math.round(seatPoint.y - 23), '×', this.pixelTextStyle('#8e3f2f', '#fff1cecc'))
        .setOrigin(.5).setDepth(isoDepth(seat.dirtPosition, 43)).setVisible(false));
    }
    this.tableVisuals.set(table.id, { pieces, stateIcon, seatPlates, seatDirt });
  }

  private drawStation(station: StationRuntime): void {
    const base = footprintDepthPoint(station.position, { width: station.size.x, depth: station.size.y });
    const point = getFootprintFloorAnchorWorld(station.position, { width: station.size.x, depth: station.size.y });
    const definition = WORLD_ASSETS[station.asset];
    const stationDepth = isoDepth(base, VISUAL_METRICS.depth.furnitureBase);
    // Balcões C1-C4 são sempre módulos 1x1. A antiga substituição visual por
    // pickup_counter_green reintroduzia um único sprite legado de 6x1.
    const blenderId = station.renderedAssetId ?? WORLD_BLENDER_ASSET[station.asset];
    const useBlender = Boolean(blenderId && this.textures.exists(`blender:${blenderId}`));
    const rendered = blenderId ? blenderAsset(blenderId) : undefined;
    const origin = station.anchor;
    const sprite = this.add.image(Math.round(point.x), Math.round(point.y), useBlender ? `blender:${blenderId}` : 'world-atlas', useBlender ? worldRenderedFrame(station.orientation, 0, blenderId!) : definition.frame)
      .setOrigin(origin.x, origin.y).setScale(useBlender ? (rendered?.nativeScale ?? 1) * (station.visualScale ?? 1) : 1).setDepth(stationDepth + station.depthOffset).setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('station', station.id);
      gameEvents.emit('toast', { message: ok ? `${station.name}: tarefa priorizada.` : `${station.name}: nenhuma tarefa disponível.`, tone: ok ? 'success' : 'info' });
    });
    const effect = this.add.sprite(Math.round(point.x), Math.round(point.y), 'world-atlas', effectFrame('steam', 0))
      .setOrigin(.5, 1).setDepth(station.id === 'pickup' ? stationDepth + 4 : isoDepth(base, 34)).setVisible(false);
    const progress = this.add.graphics().setDepth(isoDepth(base, 95));
    const labelOffset = useBlender && rendered ? Math.round(rendered.frameSize[1] * .72 * (station.visualScale ?? 1)) : station.visualHeight + 16;
    const label = this.add.text(Math.round(point.x), Math.round(point.y - labelOffset), station.name, this.pixelTextStyle('#fff8e9', '#294b3ae6'))
      .setOrigin(.5).setDepth(isoDepth(base, 96)).setVisible(false);
    const plates = (station.id === 'pickup' || station.id.startsWith('pickup:')) ? [-28, 0, 28].map((offset) => this.add.image(Math.round(point.x + offset), Math.round(point.y - 37), 'world-atlas', WORLD_ASSETS.dish.frame)
      .setOrigin(.5, 1).setDepth(stationDepth + 6).setScale(.58).setVisible(false)) : [];
    this.stationVisuals.set(station.id, { sprite, effect, progress, label, plates });
  }

  private createActor(actor: WorkerActor): void {
    const variant = canonicalCharacterAsset(actor.assetId);
    const point = gridToWorld(actor.position);
    const useBlender = this.textures.exists(`blender:${variant}`);
    const rendered = blenderAsset(variant);
    const origin = characterOrigin(variant);
    const sprite = this.add.sprite(Math.round(point.x), Math.round(point.y), useBlender ? `blender:${variant}` : 'character-atlas', useBlender ? renderedCharacterFrame(variant, 'idle', actor.direction, 0, true) : characterFrame(variant, 'idle', actor.direction, 0))
      .setOrigin(origin.x, origin.y).setScale(useBlender ? rendered?.nativeScale ?? 1 : 1).setDepth(isoDepth(actor.position, 50)).setInteractive({ useHandCursor: actor.kind === 'player' });
    sprite.on('pointerover', () => sprite.setData('status-detail', true));
    sprite.on('pointerout', () => sprite.setData('status-detail', false));
    if (actor.kind === 'player') sprite.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); gameEvents.emit('ui:open-player', undefined); });
    const bubble = this.add.text(Math.round(point.x), Math.round(point.y - characterUiOffset(variant)), '', this.pixelTextStyle('#294b3a', '#fff8e9ee'))
      .setOrigin(.5).setDepth(isoDepth(actor.position, 98));
    this.actorVisuals.set(actor.id, { sprite, bubble });
  }

  private syncActor(actor: WorkerActor): void {
    const visual = this.actorVisuals.get(actor.id)!;
    const variant = canonicalCharacterAsset(actor.assetId);
    const task = actor.taskId ? this.simulation.tasks.get(actor.taskId) : undefined;
    let animation: PixelAnimationName = 'idle';
    if (characterMotionState(actor) === 'walk') animation = actor.carrying === 'dish' ? 'carry-plate' : actor.carrying === 'ingredients' ? 'carry-ingredients' : 'walk';
    else if (task?.status === 'executing') animation = task.kind === 'cook_step' ? 'cook' : task.kind === 'clean' ? 'clean' : task.kind === 'deliver' ? 'serve' : task.kind === 'payment' ? 'receive-payment' : 'use-appliance';
    else if (actor.carrying === 'dish') animation = 'carry-plate';
    else if (actor.carrying === 'ingredients') animation = 'carry-ingredients';
    const frame = this.animationFrame(animation);
    if (this.textures.exists(`blender:${variant}`)) visual.sprite.setTexture(`blender:${variant}`, renderedCharacterFrame(variant, c3Animation(animation, characterMotionState(actor) === 'walk'), actor.direction, frame, true));
    else visual.sprite.setTexture('character-atlas', characterFrame(variant, animation, actor.direction, frame));
    const point = gridToWorld(actor.visual);
    visual.sprite.setPosition(Math.round(point.x), Math.round(point.y)).setDepth(isoDepth(actor.visual, VISUAL_METRICS.depth.standingCharacter));
    const detail = this.technicalMode || Boolean(visual.sprite.getData('status-detail'));
    const active = actor.activity !== 'Sem tarefa';
    const staff = this.simulation.state.staff.instances.find((item) => item.id === actor.id);
    const reservations = task?.reservations.map((item) => `${item.type}:${item.id}`).join(' · ') ?? 'sem reservas';
    const expectedFacing = actor.path[0] ? directionBetween(actor.visual, actor.path[0], actor.direction) : actor.direction;
    const nextVector = actor.path[0] ? { x: actor.path[0].x - actor.visual.x, y: actor.path[0].y - actor.visual.y } : { x: 0, y: 0 };
    const diagnostic = this.technicalMode
      ? `${actor.name} · ${actor.kind}${staff ? ` · ${staff.currentState}` : ''}\ngrid ${actor.position.x},${actor.position.y} · visual ${actor.visual.x.toFixed(2)},${actor.visual.y.toFixed(2)}\nface ${actor.direction} · esperado ${expectedFacing} · vetor ${nextVector.x.toFixed(1)},${nextVector.y.toFixed(1)}\n${task ? `${task.kind} P${task.priority} · ${task.status}` : actor.activity}\n${reservations}\nrota ${actor.pathStatus} · sem progresso ${actor.blockedSeconds.toFixed(1)}s · tentativas ${actor.retryCount}`
      : (active ? `${actor.name} · ${actor.activity}` : actor.name);
    visual.bubble.setPosition(Math.round(point.x), Math.round(point.y - characterUiOffset(variant))).setDepth(isoDepth(actor.visual, VISUAL_METRICS.depth.status))
      .setText(detail ? diagnostic : active ? '●' : '')
      .setVisible(detail || active);
  }

  private syncCustomer(customer: CustomerRuntime): void {
    if (!this.customerVisuals.has(customer.id)) this.createCustomer(customer);
    const visual = this.customerVisuals.get(customer.id)!;
    if (visual.previousState !== customer.state) {
      if (customer.state === 'waiting_order') visual.transitionStartedAt = this.time.now;
      visual.previousState = customer.state;
    }
    let position = customer.visual;
    const seated = customer.tableId && SEATED_STATES.includes(customer.state);
    if (seated) {
      const table = this.simulation.tables.find((item) => item.id === customer.tableId);
      const chair = table?.chairs.find((item) => customer.chairIds.includes(item.id));
      if (chair) { position = chair.seatAnchor; customer.direction = chair.orientation; }
    }
    const sitDefinition = REQUIRED_CHARACTER_ANIMATIONS['sit-down'];
    const sitElapsedMs = Math.max(0, this.time.now - visual.transitionStartedAt);
    const sittingDown = Boolean(seated) && sitElapsedMs < oneShotAnimationDurationMs(sitDefinition.frames, sitDefinition.fps);
    let animation: PixelAnimationName = characterMotionState(customer);
    if (seated) animation = customer.state === 'eating' ? 'seated-eating'
      : sittingDown ? 'sit-down'
        : customer.state === 'waiting_order' || customer.state === 'waiting_food' ? 'seated-waiting' : 'seated-idle';
    const point = seated
      ? getFootprintFloorAnchorWorld(position, { width: 1, depth: 1 })
      : gridToWorld(position);
    visual.sprite.setPosition(Math.round(point.x), Math.round(point.y)).setDepth(isoDepth(position, seated ? VISUAL_METRICS.depth.seatedCharacter : VISUAL_METRICS.depth.standingCharacter));
    const assetId = canonicalCharacterAsset(`customer-${customer.variant}`);
    const animationIndex = animation === 'sit-down'
      ? oneShotAnimationFrame(sitElapsedMs, sitDefinition.frames, sitDefinition.fps)
      : this.animationFrame(animation);
    if (this.textures.exists(`blender:${assetId}`)) visual.sprite.setTexture(`blender:${assetId}`, renderedCharacterFrame(assetId, c3Animation(animation), customer.direction, animationIndex, true));
    else visual.sprite.setTexture('character-atlas', characterFrame(assetId, animation, customer.direction, animationIndex));
    const uiOffset = characterUiOffset(assetId);
    visual.bubble.setPosition(Math.round(point.x), Math.round(point.y - uiOffset)).setDepth(isoDepth(position, 99));
    const recipe = customer.orderId ? this.simulation.orders.find((order) => order.id === customer.orderId)?.recipeId : undefined;
    const expectedFacing = customer.path[0] ? directionBetween(customer.visual, customer.path[0], customer.direction) : customer.direction;
    const baseLabel = customer.partySize > 1 ? `${this.simulation.customerLabel(customer)} · grupo ${customer.partySize}` : this.simulation.customerLabel(customer);
    const label = this.technicalMode ? `${baseLabel}\ngrid ${customer.position.x},${customer.position.y} · visual ${position.x.toFixed(2)},${position.y.toFixed(2)}\nface ${customer.direction} · esperado ${expectedFacing}\nmesa ${customer.tableId ?? '—'} · cadeira ${customer.seatId ?? '—'} · ${customer.state}` : baseLabel;
    const showStatus = ['queueing', 'waiting_order', 'waiting_food', 'paying', 'gave_up'].includes(customer.state)
      && (customer.state !== 'queueing' || customer.partyIndex === 0);
    const detail = this.technicalMode || Boolean(visual.sprite.getData('status-detail'));
    visual.bubble.setText(detail ? (recipe ? `${RECIPE_LABEL[recipe] ?? ''} ${label}` : label) : customerStatusIcon(customer.state)).setVisible(showStatus || detail);
    visual.patience.clear().setDepth(isoDepth(position, 100));
    if (['queueing', 'waiting_order', 'waiting_food', 'waiting_payment'].includes(customer.state)
      && (customer.state !== 'queueing' || customer.partyIndex === 0)) {
      const ratio = Phaser.Math.Clamp(customer.patience / customer.maxPatience, 0, 1);
      visual.patience.fillStyle(0x241a18, .65).fillRect(Math.round(point.x - 20), Math.round(point.y - uiOffset + 12), 40, 5);
      visual.patience.fillStyle(ratio > .45 ? 0x7d9b68 : ratio > .2 ? 0xf1c45b : 0xc94b3c, 1).fillRect(Math.round(point.x - 19), Math.round(point.y - uiOffset + 13), Math.round(38 * ratio), 3);
    }
  }

  private createCustomer(customer: CustomerRuntime): void {
    const point = gridToWorld(customer.position);
    const assetId = canonicalCharacterAsset(`customer-${customer.variant}`); const useBlender = this.textures.exists(`blender:${assetId}`);
    const rendered = blenderAsset(assetId); const origin = characterOrigin(assetId);
    const sprite = this.add.sprite(Math.round(point.x), Math.round(point.y), useBlender ? `blender:${assetId}` : 'character-atlas', useBlender ? renderedCharacterFrame(assetId, 'idle', customer.direction, 0, true) : characterFrame(assetId, 'idle', customer.direction, 0))
      .setOrigin(origin.x, origin.y).setScale(useBlender ? rendered?.nativeScale ?? 1 : 1).setDepth(isoDepth(customer.position, 50)).setInteractive({ useHandCursor: true });
    sprite.on('pointerover', () => sprite.setData('status-detail', true));
    sprite.on('pointerout', () => sprite.setData('status-detail', false));
    sprite.on('pointerdown', () => sprite.setData('status-detail', !sprite.getData('status-detail')));
    const bubble = this.add.text(Math.round(point.x), Math.round(point.y - characterUiOffset(assetId)), '', this.pixelTextStyle('#294b3a', '#fff8e9ee')).setOrigin(.5);
    const patience = this.add.graphics();
    this.customerVisuals.set(customer.id, { sprite, bubble, patience, previousState: customer.state, transitionStartedAt: 0 });
  }

  private syncStation(station: StationRuntime): void {
    const visual = this.stationVisuals.get(station.id)!;
    visual.progress.clear();
    const isServiceCounter = station.id === 'pickup' || station.id.startsWith('pickup:');
    const counter = isServiceCounter
      ? this.simulation.counterModules.find((module) => module.gridX === station.position.x && module.gridY === station.position.y)
      : undefined;
    const counterRecipe = counter?.assignedRecipeId ? RECIPE_BY_ID[counter.assignedRecipeId] : undefined;
    const readyDishLabel = counter && counterRecipe && counter.currentQuantity > 0 ? `${counter.currentQuantity}× ${counterRecipe.name}` : undefined;
    visual.label.setText(readyDishLabel ?? (this.technicalMode ? (station.state === 'no_ingredients' ? `${station.name} · sem ingredientes` : station.currentStep ?? station.name) : '!'))
      .setVisible(Boolean(readyDishLabel) || station.state === 'no_ingredients' || (this.technicalMode && (station.state !== 'free' || Boolean(station.currentStep))));
    const active = station.state === 'in_use';
    const effect = station.id === 'stove' || station.id === 'grill' ? 'flame' : station.id === 'oven' ? 'oven-glow' : station.id === 'cauldron' ? 'bubble' : 'steam';
    visual.effect.setVisible(active).setFrame(effectFrame(effect, Math.floor(this.time.now / 140) % 4));
    if (active && station.remaining > 0) {
      const point = gridToWorld(station.interaction);
      visual.progress.fillStyle(0x241a18, .6).fillRect(Math.round(point.x - 19), Math.round(point.y - 41), 38, 5);
      visual.progress.fillStyle(0xf1c45b, 1).fillRect(Math.round(point.x - 18), Math.round(point.y - 40), Math.round(36 * (.25 + .75 / (1 + station.remaining))), 3);
    }
    if (station.state === 'no_ingredients') visual.sprite.setTint(0xcf9d94); else visual.sprite.clearTint();
    const blenderId = station.renderedAssetId ?? WORLD_BLENDER_ASSET[station.asset];
    if (blenderId && this.textures.exists(`blender:${blenderId}`)) {
      const stateFrame = station.state === 'complete' ? 3 : active ? 1 + Math.floor(this.simulation.animationClockMs() / 240) % 2 : 0;
      visual.sprite.setFrame(worldRenderedFrame(station.orientation, stateFrame, blenderId));
    }
    if (isServiceCounter) {
      const readyCount = counter?.currentQuantity ?? 0;
      visual.plates.forEach((plate, index) => plate.setVisible(index < readyCount));
      visual.effect.setVisible(readyCount > 0).setFrame(effectFrame('ready', Math.floor(this.time.now / 180) % 4));
    }
  }

  private syncTable(table: TableRuntime): void {
    const visual = this.tableVisuals.get(table.id)!;
    visual.pieces.forEach((piece) => piece.setAlpha(table.state === 'unavailable' ? .5 : 1));
    for (const seat of table.chairs) {
      const order = seat.orderId ? this.simulation.orders.find((item) => item.id === seat.orderId) : undefined;
      visual.seatPlates.get(seat.seatId)?.setVisible(Boolean(order && ['delivered', 'consumed'].includes(order.state) && seat.state !== 'dirty'));
      visual.seatDirt.get(seat.seatId)?.setVisible(seat.state === 'dirty' || seat.state === 'cleaning');
    }
    const label = this.technicalMode
      ? table.state === 'dirty' || table.state === 'cleaning' ? 'LIMPAR' : table.state === 'waiting_order' ? 'PEDIDO' : table.state === 'waiting_food' ? 'AGUARDA' : ''
      : table.state === 'dirty' || table.state === 'cleaning' ? '!' : table.state === 'waiting_order' ? '●' : table.state === 'waiting_food' ? '…' : '';
    visual.stateIcon.setText(label).setVisible(Boolean(label));
  }

  private animationFrame(animation: PixelAnimationName): number {
    const definition = REQUIRED_CHARACTER_ANIMATIONS[animation];
    return Math.floor(this.simulation.animationClockMs() / (1000 / definition.fps)) % definition.frames;
  }

  private drawTechnicalOverlay(): void {
    const graphics = this.technicalOverlay!;
    graphics.clear();
    for (let y = 0; y < this.simulation.grid.height; y += 1) {
      for (let x = 0; x < this.simulation.grid.width; x += 1) {
        if (!this.technicalFilters.has('reservations') && !this.technicalFilters.has('pathfinding')) continue;
        const cell = this.simulation.grid.get({ x, y })!;
        const point = gridToWorld({ x, y });
        const color = cell.reservedBy ? 0xf1c45b : cell.reservedFor ? 0xe98255 : cell.occupiedBy || cell.furniturePart || cell.stationPart ? 0x4f8293 : cell.walkable ? 0x63b66f : 0xc94b3c;
        graphics.fillStyle(color, cell.walkable && !cell.reservedBy && !cell.reservedFor ? .08 : .23);
        graphics.lineStyle(1, color, .9);
        this.drawDebugDiamond(graphics, point);
      }
    }
    for (const item of this.simulation.state.construction.placedFurniture) {
      const definition = FURNITURE_BY_ID[item.definitionId]; if (!definition) continue;
      const footprint = orientedFootprint(definition, item.orientation);
      const base = footprintDepthPoint({ x: item.gridX, y: item.gridY }, footprint);
      const anchor = gridToWorld(base);
      graphics.fillStyle(0xfff1ce, 1).fillCircle(Math.round(anchor.x), Math.round(anchor.y), 3);
      graphics.lineStyle(2, 0xffd66b, .9);
      for (let fy = 0; fy < footprint.depth; fy += 1) for (let fx = 0; fx < footprint.width; fx += 1) this.drawDebugDiamond(graphics, gridToWorld({ x: item.gridX + fx, y: item.gridY + fy }));
    }
    const visibleActors = this.simulation.actors.filter((actor) => {
      const task = actor.taskId ? this.simulation.tasks.get(actor.taskId) : undefined;
      if (task?.kind === 'production_batch') return this.technicalFilters.has('production');
      if (actor.kind === 'cook') return this.technicalFilters.has('kitchen');
      if (actor.kind === 'waiter' || actor.kind === 'cleaner') return this.technicalFilters.has('service');
      if (actor.kind === 'stocker') return this.technicalFilters.has('stock');
      return true;
    });
    const movers = [...visibleActors, ...(this.technicalFilters.has('customers') ? this.simulation.customers : [])];
    for (const mover of movers) {
      let from = gridToWorld(mover.visual);
      graphics.lineStyle(2, 0x70d7e0, .9);
      for (const step of this.technicalFilters.has('pathfinding') ? mover.path : []) {
        const to = gridToWorld(step);
        graphics.lineBetween(Math.round(from.x), Math.round(from.y), Math.round(to.x), Math.round(to.y));
        from = to;
      }
      graphics.fillStyle(0xfff1ce, 1).fillRect(Math.round(gridToWorld(mover.visual).x - 2), Math.round(gridToWorld(mover.visual).y - 2), 4, 4);
      if (mover.path[0]) {
        const start = gridToWorld(mover.visual); const end = gridToWorld(mover.path[0]);
        graphics.lineStyle(3, 0xffd66b, 1).lineBetween(Math.round(start.x), Math.round(start.y), Math.round(start.x + (end.x - start.x) * .45), Math.round(start.y + (end.y - start.y) * .45));
      }
    }
  }

  private drawDebugDiamond(graphics: Phaser.GameObjects.Graphics, point: GridPoint): void {
    graphics.beginPath();
    graphics.moveTo(Math.round(point.x), Math.round(point.y - 16));
    graphics.lineTo(Math.round(point.x + 32), Math.round(point.y));
    graphics.lineTo(Math.round(point.x), Math.round(point.y + 16));
    graphics.lineTo(Math.round(point.x - 32), Math.round(point.y));
    graphics.closePath(); graphics.fillPath(); graphics.strokePath();
  }

  private pixelTextStyle(color: string, backgroundColor: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: '"Courier New", monospace', fontSize: '10px', fontStyle: 'bold', color, backgroundColor, padding: { x: 5, y: 3 }, resolution: 1 };
  }
}

const RECIPE_LABEL: Record<string, string> = { coffee: 'CAFÉ', omelette: 'OMELETE', burger: 'BRASA', soup: 'SOPA' };

const WORLD_BLENDER_ASSET: Partial<Record<WorldAssetId, string>> = {
  table: 'table_four',
  chair_ne: 'chair_wood_front', chair_nw: 'chair_wood_front', chair_se: 'chair_wood_front', chair_sw: 'chair_wood_front',
  prep: 'preparation_level_1',
  stove: 'stove_level_1',
  grill: 'grill_level_1',
  cauldron: 'cauldron_level_1',
  coffee_machine: 'coffee_machine_level_1',
  assembly: 'assembly_level_1',
  pickup: 'pickup_counter',
  fridge: 'refrigerator_level_1',
  oven: 'oven_level_1',
  sink: 'sink_level_1',
  storage: 'storage_cabinet',
  plant: 'plant',
  shelf: 'shelf',
  bin: 'bin',
};

function blenderAsset(assetId: string) {
  return RENDERED_ASSETS.find((asset) => asset.assetId === assetId);
}

function canonicalCharacterAsset(assetId: string): string {
  if (C3_BR_CHARACTER_ASSETS.some((asset) => asset.assetId === assetId)) return assetId;
  if (C3_BR_LEGACY_ALIASES[assetId]) return C3_BR_LEGACY_ALIASES[assetId];
  if (assetId.startsWith('customer-')) {
    const variant = Number(assetId.slice('customer-'.length));
    if (Number.isInteger(variant) && variant >= 0 && variant <= 7) return C3_BR_LEGACY_ALIASES[`customer-${variant}`];
    return `char_customer_${String((Number.isInteger(variant) ? Math.max(0, variant) : 0) % 6 + 1).padStart(2, '0')}`;
  }
  return HIGH_DETAIL_CHARACTER_ASSETS.has(assetId) ? C3_BR_LEGACY_ALIASES[assetId] : 'char_cook_female_01';
}

const HIGH_DETAIL_CHARACTER_ASSETS = new Set([
  'player-style-0', 'player-style-1',
  'cook-0', 'cook-1', 'waiter-0', 'waiter-1', 'cleaner-0', 'stocker-0',
]);

function renderedCharacterFrame(assetId: string, animation: string, direction: Direction, frame: number, correctCharacterRows = false): number {
  const asset = blenderAsset(assetId);
  if (!asset) return 0;
  const animationName = asset.animations[animation] ? animation : ('fallback' in asset ? asset.fallback : 'idle');
  let animationOffset = 0;
  for (const [name, frames] of Object.entries(asset.animations)) {
    if (name === animationName) break;
    animationOffset += frames;
  }
  const frameCount = asset.animations[animationName] ?? asset.animations.idle ?? 1;
  const directionIndex = renderedDirectionRow(direction, asset, correctCharacterRows);
  return directionIndex * asset.frameCount + animationOffset + (frame % frameCount);
}

function c3Animation(animation: PixelAnimationName, walking = false): string {
  const mapped: Partial<Record<PixelAnimationName, string>> = {
    'sit-down': 'sit_down', 'seated-idle': 'seated_idle', 'seated-waiting': 'wait_food', 'seated-eating': 'eat',
    'stand-up': 'stand_up', 'carry-plate': walking ? 'carry_plate_walk' : 'carry_plate_idle',
    'carry-ingredients': walking ? 'carry_ingredient_walk' : 'carry_ingredient_idle', cook: 'cook_stove',
    'use-appliance': 'prep_counter', serve: 'serve_table', clean: 'clean_table', 'receive-payment': 'talk',
  };
  return mapped[animation] ?? animation;
}

function characterOrigin(assetId: string): { x: number; y: number } {
  const asset = blenderAsset(assetId);
  if (!asset || asset.kind !== 'character') return { x: .5, y: 88 / 96 };
  return { x: asset.anchor[0] / asset.frameSize[0], y: asset.anchor[1] / asset.frameSize[1] };
}

function characterUiOffset(assetId: string): number {
  const asset = blenderAsset(assetId);
  return asset?.kind === 'character' ? Math.round(asset.anchor[1] - 4) : VISUAL_METRICS.character.uiOffset;
}

function customerStatusIcon(state: string): string {
  if (state === 'queueing') return '⌛';
  if (state === 'waiting_order') return '✎';
  if (state === 'waiting_food') return '◷';
  if (state === 'paying') return '¤';
  if (state === 'gave_up') return '!';
  return '';
}

function worldRenderedFrame(direction: Direction, stateFrame: number, assetId: string): number {
  const asset = blenderAsset(assetId);
  if (!asset) return 0;
  const directionIndex = renderedDirectionRow(direction, asset);
  return directionIndex * asset.frameCount + Phaser.Math.Clamp(stateFrame, 0, Math.max(0, asset.frameCount - 1));
}

function isDevelopmentHost(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function activeVisualSkinSet(): 'bloom' | 'sage' {
  if (!isDevelopmentHost()) return 'bloom';
  return window.sessionStorage.getItem('bb:visual-skin-set') === 'sage' ? 'sage' : 'bloom';
}
