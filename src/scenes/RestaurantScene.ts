import Phaser from 'phaser';
import { CHARACTER_OPTIONS } from '../content/characters/options';
import { gameEvents } from '../core/events';
import type { GridPoint, StationRuntime, TableRuntime } from '../core/types';
import type { CustomerRuntime, RestaurantSimulation, WorkerActor } from '../game/simulation/RestaurantSimulation';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

const iso = (point: GridPoint) => ({ x: (point.x - point.y) * TILE_WIDTH / 2, y: (point.x + point.y) * TILE_HEIGHT / 2 });
const colorNumber = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface ActorVisual { root: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Text; body: Phaser.GameObjects.Graphics }
interface CustomerVisual { root: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Text; patience: Phaser.GameObjects.Graphics }
interface StationVisual { root: Phaser.GameObjects.Container; progress: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }

export class RestaurantScene extends Phaser.Scene {
  private actorVisuals = new Map<string, ActorVisual>();
  private customerVisuals = new Map<string, CustomerVisual>();
  private stationVisuals = new Map<string, StationVisual>();
  private tableVisuals = new Map<string, Phaser.GameObjects.Container>();
  private dragging = false;
  private dragOrigin = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

  constructor(private readonly simulation: RestaurantSimulation) { super('restaurant'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#173a36');
    this.cameras.main.setBounds(-900, -140, 1800, 1100);
    this.cameras.main.centerOn(0, 320);
    this.drawEnvironment();
    this.simulation.tables.forEach((table) => this.drawTable(table));
    this.simulation.stations.forEach((station) => this.drawStation(station));
    this.simulation.actors.forEach((actor) => this.createActor(actor));

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      const camera = this.cameras.main;
      camera.setZoom(Phaser.Math.Clamp(camera.zoom - dy * 0.001, 0.62, 1.42));
      gameEvents.emit('camera:zoom', camera.zoom);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragOrigin = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const camera = this.cameras.main;
      camera.scrollX = this.dragOrigin.scrollX - (pointer.x - this.dragOrigin.x) / camera.zoom;
      camera.scrollY = this.dragOrigin.scrollY - (pointer.y - this.dragOrigin.y) / camera.zoom;
    });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.on('pointerupoutside', () => { this.dragging = false; });
    gameEvents.emit('camera:zoom', this.cameras.main.zoom);
  }

  update(_time: number, deltaMs: number): void {
    this.simulation.update(deltaMs / 1000);
    for (const actor of this.simulation.actors) this.syncActor(actor);
    for (const customer of this.simulation.customers) this.syncCustomer(customer);
    for (const station of this.simulation.stations) this.syncStation(station);
    for (const table of this.simulation.tables) this.syncTable(table);
  }

  private drawEnvironment(): void {
    const floor = this.add.graphics();
    for (let y = -2; y < 20; y += 1) {
      for (let x = -2; x < 20; x += 1) {
        const point = iso({ x, y });
        const inside = x >= 0 && y >= 0 && x < 18 && y < 18;
        const kitchen = inside && y <= 7;
        const outside = !inside || y >= 17;
        const shade = outside ? ((x + y) % 2 ? 0x315d4b : 0x356653) : kitchen ? ((x + y) % 2 ? 0xd9cdb9 : 0xe2d6c3) : ((x + y) % 2 ? 0xc5dfd1 : 0xd2e8da);
        floor.fillStyle(shade, 1);
        floor.lineStyle(1, outside ? 0x3b715b : kitchen ? 0xc9bca8 : 0xb1d2c2, 0.85);
        floor.beginPath();
        floor.moveTo(point.x, point.y);
        floor.lineTo(point.x + TILE_WIDTH / 2, point.y + TILE_HEIGHT / 2);
        floor.lineTo(point.x, point.y + TILE_HEIGHT);
        floor.lineTo(point.x - TILE_WIDTH / 2, point.y + TILE_HEIGHT / 2);
        floor.closePath(); floor.fillPath(); floor.strokePath();
      }
    }

    const decor = this.add.graphics();
    for (let i = 0; i < 12; i += 1) {
      const p = iso({ x: -1 + (i % 6) * 4, y: 18 + Math.floor(i / 6) * 2 });
      decor.fillStyle(i % 2 ? 0xf2c14e : 0xf28f6b, 0.9).fillCircle(p.x, p.y + 8, 3);
      decor.fillStyle(0x2e7d59, 1).fillTriangle(p.x, p.y + 12, p.x - 5, p.y + 24, p.x + 5, p.y + 24);
    }

    this.drawWalls();
    const kitchenSign = this.add.text(0, 89, 'COZINHA  ·  BISTRÔ BLOOM', { fontFamily: 'Trebuchet MS', fontSize: '15px', fontStyle: 'bold', color: '#315b52', backgroundColor: '#f8e8c7', padding: { x: 12, y: 5 } }).setOrigin(0.5).setDepth(16);
    kitchenSign.setShadow(0, 3, '#173a3630', 2);
  }

  private drawWalls(): void {
    const walls = this.add.graphics().setDepth(500);
    for (let x = 0; x < 18; x += 1) {
      const top = iso({ x, y: 0 });
      walls.fillStyle(0xf7e7c8, 1).fillPoints([
        new Phaser.Geom.Point(top.x, top.y), new Phaser.Geom.Point(top.x + 32, top.y + 16),
        new Phaser.Geom.Point(top.x + 32, top.y - 22), new Phaser.Geom.Point(top.x, top.y - 38),
      ], true);
      walls.lineStyle(1, 0xd8b98c, 1).strokePoints([
        new Phaser.Geom.Point(top.x, top.y), new Phaser.Geom.Point(top.x + 32, top.y + 16),
        new Phaser.Geom.Point(top.x + 32, top.y - 22), new Phaser.Geom.Point(top.x, top.y - 38),
      ], true);
    }
    for (let y = 0; y < 18; y += 1) {
      const left = iso({ x: 0, y });
      walls.fillStyle(0xe8cfaa, 1).fillPoints([
        new Phaser.Geom.Point(left.x, left.y), new Phaser.Geom.Point(left.x - 32, left.y + 16),
        new Phaser.Geom.Point(left.x - 32, left.y - 22), new Phaser.Geom.Point(left.x, left.y - 38),
      ], true);
    }
  }

  private drawTable(table: TableRuntime): void {
    const p = iso({ x: table.position.x + 0.5, y: table.position.y + 0.5 });
    const root = this.add.container(p.x, p.y).setDepth((table.position.x + table.position.y) * 20 + 200);
    const art = this.add.graphics();
    art.fillStyle(0x173a36, 0.2).fillEllipse(0, 31, 91, 28);
    table.chairs.forEach((chair) => {
      const cp = iso(chair.position);
      const relative = { x: cp.x - p.x, y: cp.y - p.y };
      art.fillStyle(0xc76b4d, 1).fillRoundedRect(relative.x - 14, relative.y + 5, 28, 13, 5);
      art.fillStyle(0x8e4936, 1).fillRect(relative.x - 11, relative.y + 17, 4, 10).fillRect(relative.x + 7, relative.y + 17, 4, 10);
    });
    art.fillStyle(0x8a5638, 1).fillRect(-5, 16, 10, 28);
    art.fillStyle(0xe4a960, 1).fillEllipse(0, 12, table.maxCustomers === 4 ? 93 : 73, 47);
    art.lineStyle(4, 0xb97343, 1).strokeEllipse(0, 12, table.maxCustomers === 4 ? 93 : 73, 47);
    art.fillStyle(0xfff1bd, 1).fillCircle(0, 8, 8);
    const flower = this.add.text(0, 2, '✿', { fontFamily: 'serif', fontSize: '17px', color: '#c95056' }).setOrigin(0.5);
    const label = this.add.text(0, -26, `${table.maxCustomers} lugares`, { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#315b52', backgroundColor: '#fff8e9dd', padding: { x: 5, y: 2 } }).setOrigin(0.5);
    root.add([art, flower, label]);
    root.setSize(105, 70).setInteractive({ useHandCursor: true });
    root.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('table', table.id);
      gameEvents.emit('toast', { message: ok ? 'Tarefa da mesa priorizada.' : 'Não há tarefa compatível nessa mesa.', tone: ok ? 'success' : 'info' });
    });
    this.tableVisuals.set(table.id, root);
  }

  private drawStation(station: StationRuntime): void {
    const p = iso({ x: station.position.x + (station.size.x - 1) / 2, y: station.position.y + (station.size.y - 1) / 2 });
    const root = this.add.container(p.x, p.y).setDepth((station.position.x + station.position.y) * 20 + 180);
    const art = this.add.graphics();
    const width = 48 + (station.size.x - 1) * 34;
    art.fillStyle(0x163f3a, 0.22).fillEllipse(0, 28, width + 14, 22);
    art.fillStyle(0x536861, 1).fillRoundedRect(-width / 2, -2, width, 35, 5);
    art.fillStyle(station.color, 1).fillRoundedRect(-width / 2 + 3, -13, width - 6, 24, 5);
    art.lineStyle(2, 0xfff2d5, 0.5).strokeRoundedRect(-width / 2 + 6, -9, width - 12, 14, 3);
    art.fillStyle(0x263d39, 1).fillRect(-width / 2 + 5, 32, 5, 11).fillRect(width / 2 - 10, 32, 5, 11);
    const icon = this.add.text(0, -2, station.icon, { fontFamily: 'Segoe UI Emoji', fontSize: '22px' }).setOrigin(0.5);
    const label = this.add.text(0, -30, station.name, { fontFamily: 'Trebuchet MS', fontSize: '10px', fontStyle: 'bold', color: '#f8eed8', backgroundColor: '#173a36dd', padding: { x: 6, y: 3 } }).setOrigin(0.5);
    const progress = this.add.graphics();
    root.add([art, icon, label, progress]);
    root.setSize(width + 20, 65).setInteractive({ useHandCursor: true });
    root.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const ok = this.simulation.prioritizeWorldTarget('station', station.id);
      gameEvents.emit('toast', { message: ok ? `${station.name}: tarefa priorizada.` : `${station.name}: nenhuma tarefa disponível.`, tone: ok ? 'success' : 'info' });
    });
    this.stationVisuals.set(station.id, { root, progress, label });
  }

  private createActor(actor: WorkerActor): void {
    const root = this.add.container();
    const body = this.add.graphics();
    const bubble = this.add.text(0, -62, '', { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#173a36', backgroundColor: '#fff9e8ee', padding: { x: 6, y: 3 }, align: 'center' }).setOrigin(0.5);
    root.add([body, bubble]);
    root.setSize(42, 72).setInteractive({ useHandCursor: actor.kind === 'player' });
    if (actor.kind === 'player') root.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); gameEvents.emit('ui:open-player', undefined); });
    this.actorVisuals.set(actor.id, { root, bubble, body });
    this.paintActor(actor, body);
  }

  private paintActor(actor: WorkerActor, art: Phaser.GameObjects.Graphics): void {
    art.clear();
    const appearance = this.simulation.state.profile?.appearance;
    const isPlayer = actor.kind === 'player';
    const bodyColor = isPlayer ? colorNumber(CHARACTER_OPTIONS.outfitColor.find((item) => item.id === appearance?.outfitColor)?.color ?? '', 0x1d766d) : actor.kind === 'cook' ? 0xf4eee2 : 0xd25f4e;
    const skinColor = isPlayer ? colorNumber(CHARACTER_OPTIONS.skin.find((item) => item.id === appearance?.skin)?.color ?? '', 0xd99a68) : actor.kind === 'cook' ? 0x8b5a3c : 0xf0c7a6;
    const hairColor = isPlayer ? colorNumber(CHARACTER_OPTIONS.hairColor.find((item) => item.id === appearance?.hairColor)?.color ?? '', 0x3a241d) : 0x3a241d;
    art.fillStyle(0x102e2a, 0.25).fillEllipse(0, 25, 35, 12);
    if (isPlayer) art.lineStyle(3, 0xf2c14e, 0.95).strokeEllipse(0, 24, 43, 17);
    art.fillStyle(0x33423f, 1).fillRoundedRect(-13, 15, 9, 19, 4).fillRoundedRect(4, 15, 9, 19, 4);
    art.fillStyle(bodyColor, 1).fillRoundedRect(-17, -11, 34, 34, 10);
    art.fillStyle(0xfff0d1, actor.kind === 'cook' ? 0.9 : 0.25).fillTriangle(-12, -8, 12, -8, 0, 14);
    art.fillStyle(skinColor, 1).fillCircle(0, -24, 14);
    art.fillStyle(hairColor, 1).fillEllipse(0, -31, 27, 14);
    art.fillStyle(0x273b37, 1).fillCircle(-5, -24, 1.4).fillCircle(5, -24, 1.4);
    if (actor.kind === 'cook') {
      art.fillStyle(0xffffff, 1).fillCircle(-8, -42, 8).fillCircle(0, -45, 9).fillCircle(8, -42, 8).fillRoundedRect(-13, -42, 26, 9, 3);
    } else if (actor.kind === 'waiter') {
      art.fillStyle(0xd7b36a, 1).fillEllipse(21, 2, 24, 7); art.lineStyle(2, 0x5e4030).lineBetween(10, 0, 32, 0);
    } else {
      art.fillStyle(0xf2c14e, 1).fillCircle(16, -8, 5);
    }
  }

  private syncActor(actor: WorkerActor): void {
    const visual = this.actorVisuals.get(actor.id)!;
    const p = iso(actor.visual);
    const bob = actor.path.length ? Math.sin(this.time.now * 0.018) * 2 : 0;
    visual.root.setPosition(p.x, p.y + 11 + bob).setDepth((actor.visual.x + actor.visual.y) * 20 + 300);
    visual.bubble.setText(actor.activity === 'Sem tarefa' ? '…' : actor.activity).setVisible(actor.kind === 'player' || actor.activity !== 'Sem tarefa');
  }

  private syncCustomer(customer: CustomerRuntime): void {
    if (!this.customerVisuals.has(customer.id)) this.createCustomer(customer);
    const visual = this.customerVisuals.get(customer.id)!;
    visual.root.setVisible(customer.state !== 'gone');
    if (customer.state === 'gone') return;
    let point = customer.visual;
    if (customer.tableId && ['waiting_order', 'waiting_food', 'eating', 'waiting_payment'].includes(customer.state)) {
      const table = this.simulation.tables.find((item) => item.id === customer.tableId);
      const chair = table?.chairs.find((item) => customer.chairIds.includes(item.id));
      if (chair) point = chair.position;
    }
    const p = iso(point);
    const moving = customer.path.length > 0;
    visual.root.setPosition(p.x, p.y + 10 + (moving ? Math.sin(this.time.now * 0.02) * 2 : 0)).setDepth((point.x + point.y) * 20 + 305);
    const recipe = customer.orderId ? this.simulation.orders.find((order) => order.id === customer.orderId)?.recipeId : undefined;
    const icon = recipe ? RECIPE_ICON[recipe] : customer.state === 'eating' ? '♥' : '';
    visual.bubble.setText(`${icon ? `${icon} ` : ''}${this.simulation.customerLabel(customer)}${customer.partySize > 1 ? ` · ${customer.partySize}` : ''}`);
    visual.patience.clear();
    if (['queueing', 'waiting_order', 'waiting_food', 'waiting_payment'].includes(customer.state)) {
      const ratio = Phaser.Math.Clamp(customer.patience / customer.maxPatience, 0, 1);
      visual.patience.fillStyle(0x173a36, 0.25).fillRoundedRect(-20, -61, 40, 5, 2);
      visual.patience.fillStyle(ratio > 0.45 ? 0x67b879 : ratio > 0.2 ? 0xf2b84b : 0xdb5c4f, 1).fillRoundedRect(-20, -61, 40 * ratio, 5, 2);
    }
  }

  private createCustomer(customer: CustomerRuntime): void {
    const palette = [0x6c82c5, 0xd78563, 0x7aaf75, 0xb175a8];
    const root = this.add.container();
    const art = this.add.graphics();
    art.fillStyle(0x102e2a, 0.22).fillEllipse(0, 22, 31, 10);
    art.fillStyle(0x4b443e, 1).fillRoundedRect(-11, 13, 8, 17, 4).fillRoundedRect(3, 13, 8, 17, 4);
    art.fillStyle(palette[customer.variant], 1).fillRoundedRect(-16, -9, 32, 32, 11);
    const skin = [0xf1c8a8, 0xd99968, 0x8f5e41, 0x573923][customer.variant];
    art.fillStyle(skin, 1).fillCircle(0, -22, 13);
    art.fillStyle([0x3a241d, 0x9b573e, 0x242635, 0x5c392a][customer.variant], 1).fillEllipse(0, -29, 25, 13);
    art.fillStyle(0x263d39, 1).fillCircle(-4, -22, 1.3).fillCircle(4, -22, 1.3);
    const bubble = this.add.text(0, -49, '', { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#173a36', backgroundColor: '#fff9e8ee', padding: { x: 5, y: 3 } }).setOrigin(0.5);
    const patience = this.add.graphics();
    root.add([art, bubble, patience]);
    this.customerVisuals.set(customer.id, { root, bubble, patience });
  }

  private syncStation(station: StationRuntime): void {
    const visual = this.stationVisuals.get(station.id)!;
    visual.progress.clear();
    visual.label.setText(station.state === 'no_ingredients' ? `${station.name} · sem ingredientes` : station.currentStep ?? station.name);
    if (station.state === 'in_use' && station.remaining > 0) {
      const pulse = 0.35 + Math.sin(this.time.now * 0.008) * 0.08;
      visual.progress.fillStyle(0xf2c14e, 1).fillRoundedRect(-24, 39, 48 * pulse, 5, 2);
      visual.progress.fillStyle(0xffffff, 0.25).fillRoundedRect(-24, 39, 48, 5, 2);
    } else if (station.state === 'no_ingredients') {
      visual.progress.fillStyle(0xdb5c4f, 1).fillCircle(0, 41, 4);
    }
  }

  private syncTable(table: TableRuntime): void {
    const root = this.tableVisuals.get(table.id)!;
    root.setAlpha(table.state === 'unavailable' ? 0.45 : 1);
    const existing = root.getByName('state-icon') as Phaser.GameObjects.Text | null;
    const iconText = table.state === 'waiting_cleaning' ? '✨ limpar' : table.state === 'waiting_order' ? '✎ pedido' : table.state === 'waiting_food' ? '⌛ prato' : '';
    if (iconText && !existing) {
      const icon = this.add.text(0, -43, iconText, { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#fff', backgroundColor: table.state === 'waiting_cleaning' ? '#b65f4add' : '#315b52dd', padding: { x: 5, y: 2 } }).setOrigin(0.5).setName('state-icon');
      root.add(icon);
    } else if (existing) {
      existing.setText(iconText).setVisible(Boolean(iconText));
    }
  }
}

const RECIPE_ICON: Record<string, string> = { coffee: '☕', omelette: '🍳', burger: '🍔', soup: '🥣' };
