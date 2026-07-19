import Phaser from 'phaser';
import { installPixelAtlases } from '../assets/pixel/PixelAtlasFactory';
import { REQUIRED_CHARACTER_ANIMATIONS, WORLD_ASSETS, characterFrame, effectFrame } from '../assets/pixel/manifest';
import { gameEvents } from '../core/events';
import type { GridPoint, PixelAnimationName, StationRuntime, TableRuntime, WorldAssetId } from '../core/types';
import { gridToWorld, isoDepth } from '../game/grid/IsoGrid';
import { DECORATIONS, ENTRANCE, MAP_SIZE, RESTAURANT_SIZE } from '../game/map/initialMap';
import type { CustomerRuntime, RestaurantSimulation, WorkerActor } from '../game/simulation/RestaurantSimulation';

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
}

const ZOOM_LEVELS = [0.5, 1, 2] as const;
const SEATED_STATES = ['waiting_order', 'waiting_food', 'eating', 'waiting_payment'];

export class RestaurantScene extends Phaser.Scene {
  private actorVisuals = new Map<string, ActorVisual>();
  private customerVisuals = new Map<string, CustomerVisual>();
  private stationVisuals = new Map<string, StationVisual>();
  private tableVisuals = new Map<string, TableVisual>();
  private technicalOverlay?: Phaser.GameObjects.Graphics;
  private technicalMode = false;
  private dragging = false;
  private zoomIndex = 1;
  private dragOrigin = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

  constructor(private readonly simulation: RestaurantSimulation) { super('restaurant'); }

  create(): void {
    installPixelAtlases(this, this.simulation.state.profile?.appearance);
    this.cameras.main.setBackgroundColor('#294b3a');
    this.cameras.main.setBounds(-920, -250, 1840, 1250);
    this.cameras.main.centerOn(0, 320).setZoom(ZOOM_LEVELS[this.zoomIndex]);
    this.drawEnvironment();
    this.simulation.tables.forEach((table) => this.drawTable(table));
    this.simulation.stations.forEach((station) => this.drawStation(station));
    this.simulation.actors.forEach((actor) => this.createActor(actor));
    this.technicalOverlay = this.add.graphics().setDepth(50_000).setVisible(false);
    this.bindCameraControls();
    this.input.keyboard?.on('keydown-D', () => this.toggleTechnicalMode());
    this.input.keyboard?.on('keydown-PLUS', () => this.setZoomIndex(this.zoomIndex + 1));
    this.input.keyboard?.on('keydown-MINUS', () => this.setZoomIndex(this.zoomIndex - 1));
    gameEvents.on('technical:toggle', () => this.toggleTechnicalMode());
    gameEvents.emit('camera:zoom', this.cameras.main.zoom);
  }

  update(_time: number, deltaMs: number): void {
    this.simulation.update(deltaMs / 1000);
    this.simulation.actors.forEach((actor) => this.syncActor(actor));
    this.simulation.customers.forEach((customer) => this.syncCustomer(customer));
    const activeCustomerIds = new Set(this.simulation.customers.map((customer) => customer.id));
    for (const [customerId, visual] of this.customerVisuals) {
      if (activeCustomerIds.has(customerId)) continue;
      visual.sprite.destroy(); visual.bubble.destroy(); visual.patience.destroy();
      this.customerVisuals.delete(customerId);
    }
    this.simulation.stations.forEach((station) => this.syncStation(station));
    this.simulation.tables.forEach((table) => this.syncTable(table));
    if (this.technicalMode) this.drawTechnicalOverlay();
  }

  private bindCameraControls(): void {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.setZoomIndex(this.zoomIndex + (dy > 0 ? -1 : 1)));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragOrigin = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const camera = this.cameras.main;
      camera.scrollX = Math.round(this.dragOrigin.scrollX - (pointer.x - this.dragOrigin.x) / camera.zoom);
      camera.scrollY = Math.round(this.dragOrigin.scrollY - (pointer.y - this.dragOrigin.y) / camera.zoom);
    });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.on('pointerupoutside', () => { this.dragging = false; });
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

  private addWorldAsset(asset: WorldAssetId, position: GridPoint, layer: number): Phaser.GameObjects.Image {
    const definition = WORLD_ASSETS[asset];
    const point = gridToWorld(position);
    return this.add.image(Math.round(point.x), Math.round(point.y), 'world-atlas', definition.frame)
      .setOrigin(definition.anchor.x, definition.anchor.y).setDepth(isoDepth(position, layer));
  }

  private drawTable(table: TableRuntime): void {
    const tableImage = this.addWorldAsset('table', table.position, 30).setInteractive({ useHandCursor: true });
    tableImage.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('table', table.id);
      gameEvents.emit('toast', { message: ok ? 'Tarefa da mesa priorizada.' : 'Não há tarefa compatível nessa mesa.', tone: ok ? 'success' : 'info' });
    });
    const pieces = [tableImage, ...table.chairs.map((chair) => this.addWorldAsset(`chair_${chair.orientation}`, chair.position, 31))];
    const point = gridToWorld(table.position);
    const stateIcon = this.add.text(Math.round(point.x), Math.round(point.y - 56), '', this.pixelTextStyle('#fff8e9', '#294b3ae6'))
      .setOrigin(.5).setDepth(isoDepth(table.position, 90)).setVisible(false);
    this.tableVisuals.set(table.id, { pieces, stateIcon });
  }

  private drawStation(station: StationRuntime): void {
    const center = { x: station.position.x + (station.size.x - 1) / 2, y: station.position.y + (station.size.y - 1) / 2 };
    const base = { x: station.position.x + station.size.x - 1, y: station.position.y + station.size.y - 1 };
    const point = gridToWorld(center);
    const definition = WORLD_ASSETS[station.asset];
    const stationDepth = station.id === 'pickup' ? isoDepth(station.position, 18) : isoDepth(base, 30);
    const sprite = this.add.image(Math.round(point.x), Math.round(point.y), 'world-atlas', definition.frame)
      .setOrigin(definition.anchor.x, definition.anchor.y).setDepth(stationDepth).setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('station', station.id);
      gameEvents.emit('toast', { message: ok ? `${station.name}: tarefa priorizada.` : `${station.name}: nenhuma tarefa disponível.`, tone: ok ? 'success' : 'info' });
    });
    const effect = this.add.sprite(Math.round(point.x), Math.round(point.y), 'world-atlas', effectFrame('steam', 0))
      .setOrigin(.5, 1).setDepth(station.id === 'pickup' ? stationDepth + 4 : isoDepth(base, 34)).setVisible(false);
    const progress = this.add.graphics().setDepth(isoDepth(base, 95));
    const label = this.add.text(Math.round(point.x), Math.round(point.y - station.visualHeight - 16), station.name, this.pixelTextStyle('#fff8e9', '#294b3ae6'))
      .setOrigin(.5).setDepth(isoDepth(base, 96)).setVisible(false);
    const plates = station.id === 'pickup' ? [-28, 0, 28].map((offset) => this.add.image(Math.round(point.x + offset), Math.round(point.y - 37), 'world-atlas', WORLD_ASSETS.dish.frame)
      .setOrigin(.5, 1).setDepth(stationDepth + 6).setScale(.58).setVisible(false)) : [];
    this.stationVisuals.set(station.id, { sprite, effect, progress, label, plates });
  }

  private createActor(actor: WorkerActor): void {
    const variant = actor.kind === 'player' ? 'player' : actor.kind;
    const point = gridToWorld(actor.position);
    const sprite = this.add.sprite(Math.round(point.x), Math.round(point.y), 'character-atlas', characterFrame(variant, 'idle', actor.direction, 0))
      .setOrigin(.5, 88 / 96).setDepth(isoDepth(actor.position, 50)).setInteractive({ useHandCursor: actor.kind === 'player' });
    if (actor.kind === 'player') sprite.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); gameEvents.emit('ui:open-player', undefined); });
    const bubble = this.add.text(Math.round(point.x), Math.round(point.y - 77), '', this.pixelTextStyle('#294b3a', '#fff8e9ee'))
      .setOrigin(.5).setDepth(isoDepth(actor.position, 98));
    this.actorVisuals.set(actor.id, { sprite, bubble });
  }

  private syncActor(actor: WorkerActor): void {
    const visual = this.actorVisuals.get(actor.id)!;
    const variant = actor.kind === 'player' ? 'player' : actor.kind;
    const task = actor.taskId ? this.simulation.tasks.get(actor.taskId) : undefined;
    let animation: PixelAnimationName = 'idle';
    if (actor.path.length) animation = actor.carrying === 'dish' ? 'carry-dish' : actor.carrying === 'ingredients' ? 'carry-ingredients' : 'walk';
    else if (task?.status === 'active') animation = 'work';
    else if (actor.carrying === 'dish') animation = 'carry-dish';
    else if (actor.carrying === 'ingredients') animation = 'carry-ingredients';
    const frame = this.animationFrame(animation);
    visual.sprite.setFrame(characterFrame(variant, animation, actor.direction, frame));
    const point = gridToWorld(actor.visual);
    visual.sprite.setPosition(Math.round(point.x), Math.round(point.y)).setDepth(isoDepth(actor.visual, 50));
    visual.bubble.setPosition(Math.round(point.x), Math.round(point.y - 77)).setDepth(isoDepth(actor.visual, 98))
      .setText(actor.activity === 'Sem tarefa' ? actor.name : `${actor.name} · ${actor.activity}`)
      .setVisible(actor.kind === 'player' || actor.activity !== 'Sem tarefa');
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
      if (chair) { position = chair.sitPoint; customer.direction = chair.orientation; }
    }
    let animation: PixelAnimationName = customer.path.length ? 'walk' : 'idle';
    if (seated) animation = customer.state === 'eating' ? 'eat' : this.time.now - visual.transitionStartedAt < 350 ? 'sit' : 'seated';
    const point = gridToWorld(position);
    visual.sprite.setPosition(Math.round(point.x), Math.round(point.y)).setDepth(isoDepth(position, seated ? 32 : 50))
      .setFrame(characterFrame(`customer-${customer.variant}`, animation, customer.direction, this.animationFrame(animation)));
    visual.bubble.setPosition(Math.round(point.x), Math.round(point.y - 73)).setDepth(isoDepth(position, 99));
    const recipe = customer.orderId ? this.simulation.orders.find((order) => order.id === customer.orderId)?.recipeId : undefined;
    const label = customer.partySize > 1 ? `${this.simulation.customerLabel(customer)} · grupo ${customer.partySize}` : this.simulation.customerLabel(customer);
    visual.bubble.setText(recipe ? `${RECIPE_LABEL[recipe] ?? ''} ${label}` : label).setVisible(customer.state !== 'eating');
    visual.patience.clear().setDepth(isoDepth(position, 100));
    if (['queueing', 'waiting_order', 'waiting_food', 'waiting_payment'].includes(customer.state)) {
      const ratio = Phaser.Math.Clamp(customer.patience / customer.maxPatience, 0, 1);
      visual.patience.fillStyle(0x241a18, .65).fillRect(Math.round(point.x - 20), Math.round(point.y - 62), 40, 5);
      visual.patience.fillStyle(ratio > .45 ? 0x7d9b68 : ratio > .2 ? 0xf1c45b : 0xc94b3c, 1).fillRect(Math.round(point.x - 19), Math.round(point.y - 61), Math.round(38 * ratio), 3);
    }
  }

  private createCustomer(customer: CustomerRuntime): void {
    const point = gridToWorld(customer.position);
    const sprite = this.add.sprite(Math.round(point.x), Math.round(point.y), 'character-atlas', characterFrame(`customer-${customer.variant}`, 'idle', customer.direction, 0))
      .setOrigin(.5, 88 / 96).setDepth(isoDepth(customer.position, 50));
    const bubble = this.add.text(Math.round(point.x), Math.round(point.y - 73), '', this.pixelTextStyle('#294b3a', '#fff8e9ee')).setOrigin(.5);
    const patience = this.add.graphics();
    this.customerVisuals.set(customer.id, { sprite, bubble, patience, previousState: customer.state, transitionStartedAt: 0 });
  }

  private syncStation(station: StationRuntime): void {
    const visual = this.stationVisuals.get(station.id)!;
    visual.progress.clear();
    visual.label.setText(station.state === 'no_ingredients' ? `${station.name} · sem ingredientes` : station.currentStep ?? station.name)
      .setVisible(station.state !== 'free' || Boolean(station.currentStep));
    const active = station.state === 'in_use';
    const effect = station.id === 'stove' || station.id === 'grill' ? 'flame' : station.id === 'oven' ? 'oven-glow' : station.id === 'cauldron' ? 'bubble' : 'steam';
    visual.effect.setVisible(active).setFrame(effectFrame(effect, Math.floor(this.time.now / 140) % 4));
    if (active && station.remaining > 0) {
      const point = gridToWorld(station.interaction);
      visual.progress.fillStyle(0x241a18, .6).fillRect(Math.round(point.x - 19), Math.round(point.y - 41), 38, 5);
      visual.progress.fillStyle(0xf1c45b, 1).fillRect(Math.round(point.x - 18), Math.round(point.y - 40), Math.round(36 * (.25 + .75 / (1 + station.remaining))), 3);
    }
    if (station.state === 'no_ingredients') visual.sprite.setTint(0xcf9d94); else visual.sprite.clearTint();
    if (station.id === 'pickup') {
      const readyCount = this.simulation.orders.filter((order) => order.state === 'ready').length;
      visual.plates.forEach((plate, index) => plate.setVisible(index < readyCount));
      visual.effect.setVisible(readyCount > 0).setFrame(effectFrame('ready', Math.floor(this.time.now / 180) % 4));
    }
  }

  private syncTable(table: TableRuntime): void {
    const visual = this.tableVisuals.get(table.id)!;
    visual.pieces.forEach((piece) => piece.setAlpha(table.state === 'unavailable' ? .5 : 1));
    const label = table.state === 'waiting_cleaning' ? 'LIMPAR' : table.state === 'waiting_order' ? 'PEDIDO' : table.state === 'waiting_food' ? 'AGUARDANDO' : '';
    visual.stateIcon.setText(label).setVisible(Boolean(label));
  }

  private animationFrame(animation: PixelAnimationName): number {
    const definition = REQUIRED_CHARACTER_ANIMATIONS[animation];
    return Math.floor(this.time.now / (1000 / definition.fps)) % definition.frames;
  }

  private drawTechnicalOverlay(): void {
    const graphics = this.technicalOverlay!;
    graphics.clear();
    for (let y = 0; y < this.simulation.grid.height; y += 1) {
      for (let x = 0; x < this.simulation.grid.width; x += 1) {
        const cell = this.simulation.grid.get({ x, y })!;
        const point = gridToWorld({ x, y });
        const color = cell.reservedBy ? 0xf1c45b : cell.reservedFor ? 0xe98255 : cell.occupiedBy || cell.furniturePart || cell.stationPart ? 0x4f8293 : cell.walkable ? 0x63b66f : 0xc94b3c;
        graphics.fillStyle(color, cell.walkable && !cell.reservedBy && !cell.reservedFor ? .08 : .23);
        graphics.lineStyle(1, color, .9);
        this.drawDebugDiamond(graphics, point);
      }
    }
    for (const mover of [...this.simulation.actors, ...this.simulation.customers]) {
      let from = gridToWorld(mover.visual);
      graphics.lineStyle(2, 0x70d7e0, .9);
      for (const step of mover.path) {
        const to = gridToWorld(step);
        graphics.lineBetween(Math.round(from.x), Math.round(from.y), Math.round(to.x), Math.round(to.y));
        from = to;
      }
      graphics.fillStyle(0xfff1ce, 1).fillRect(Math.round(gridToWorld(mover.visual).x - 2), Math.round(gridToWorld(mover.visual).y - 2), 4, 4);
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
