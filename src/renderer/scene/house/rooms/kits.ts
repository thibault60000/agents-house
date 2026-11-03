import type { RoomType } from '@shared/types';
import * as P from '../props';
import type { PropBuild } from '../props';

export type Placement = 'wall' | 'center' | 'corner' | 'floor' | 'ceiling';

export interface PropSpec {
  w: number;
  d: number;
  place: Placement;
  build: PropBuild;
  chance?: number;
  poi?: boolean;
}

const spec = (w: number, d: number, place: Placement, build: PropBuild, extra: Partial<PropSpec> = {}): PropSpec => ({ w, d, place, build, ...extra });

const plant = (chance = 0.8) => spec(1.15, 1.15, 'corner', P.plant, { chance });
const tallPlant = (chance = 0.7) => spec(1.4, 1.4, 'corner', P.tallPlant, { chance });

export const KITS: Record<RoomType, PropSpec[]> = {
  bureau: [
    spec(3.2, 2.4, 'floor', P.rug),
    spec(1.85, 0.55, 'wall', P.sideboard, { poi: true }),
    plant(),
    spec(1.12, 1, 'center', P.armchair, { chance: 0.8, poi: true }),
    spec(0.72, 0.72, 'corner', P.floorLamp, { chance: 0.8 }),
    spec(1.35, 0.9, 'corner', P.crates, { chance: 0.5 }),
  ],
  salon: [
    spec(4, 3, 'floor', P.rug),
    spec(2.55, 1.05, 'wall', P.sofa, { poi: true }),
    spec(1.3, 0.8, 'center', P.coffeeTable, { poi: true }),
    spec(1.95, 0.55, 'wall', P.tvStand),
    spec(0.72, 0.72, 'corner', P.floorLamp),
    tallPlant(),
    plant(0.7),
    spec(1.12, 1, 'center', P.armchair, { chance: 0.7 }),
    spec(0.56, 0.45, 'wall', P.wallClock, { chance: 0.5 }),
  ],
  cuisine: [
    spec(0.9, 0.8, 'wall', P.fridge, { poi: true }),
    spec(1.85, 0.7, 'wall', P.counterSink),
    spec(1.3, 0.7, 'wall', P.counterStove, { poi: true }),
    spec(1.85, 0.7, 'wall', P.counterPlain),
    spec(1.35, 0.3, 'wall', P.spiceShelf, { chance: 0.8 }),
    spec(0.45, 0.45, 'center', P.stool),
    spec(0.45, 0.45, 'center', P.stool, { chance: 0.8 }),
    plant(0.5),
    spec(0.8, 0.6, 'corner', P.vegCrate, { chance: 0.5 }),
  ],
  'salle-a-manger': [
    spec(4, 3, 'floor', P.rug, { chance: 0.7 }),
    spec(3.3, 2.4, 'center', P.diningTable, { poi: true }),
    spec(1.85, 0.55, 'wall', P.sideboard),
    spec(0.1, 0.1, 'ceiling', P.chandelier),
    tallPlant(0.6),
    plant(0.5),
  ],
  chambre: [
    spec(1.9, 2.36, 'wall', P.bed, { poi: true }),
    spec(0.55, 0.5, 'wall', P.nightstand),
    spec(0.55, 0.5, 'wall', P.nightstand, { chance: 0.7 }),
    spec(1.4, 0.55, 'wall', P.dresser, { poi: true }),
    spec(3, 2.4, 'floor', P.roundRug),
    plant(0.7),
    spec(1.12, 1, 'center', P.armchair, { chance: 0.4 }),
  ],
  atelier: [
    spec(2.3, 0.92, 'wall', P.workbench, { poi: true }),
    spec(1.65, 0.2, 'wall', P.pegboard),
    spec(1.35, 0.9, 'corner', P.crates),
    spec(1.35, 0.9, 'corner', P.crates, { chance: 0.7 }),
    spec(0.78, 0.78, 'corner', P.barrel, { chance: 0.6 }),
    spec(0.45, 0.45, 'center', P.stool),
    spec(1.0, 1.1, 'center', P.easel, { chance: 0.4, poi: true }),
  ],
  bibliotheque: [
    spec(2, 0.42, 'wall', P.bookshelf, { poi: true }),
    spec(2, 0.42, 'wall', P.bookshelf),
    spec(2, 0.42, 'wall', P.bookshelf, { chance: 0.85 }),
    spec(3, 2.4, 'floor', P.roundRug),
    spec(1.12, 1, 'center', P.armchair, { poi: true }),
    spec(0.66, 0.66, 'corner', P.globe),
    spec(0.72, 0.72, 'corner', P.floorLamp),
  ],
  cellier: [
    spec(1.75, 0.5, 'wall', P.jarShelf, { poi: true }),
    spec(1.75, 0.5, 'wall', P.jarShelf),
    spec(0.78, 0.78, 'corner', P.barrel),
    spec(0.78, 0.78, 'corner', P.barrel, { chance: 0.8 }),
    spec(0.8, 0.6, 'wall', P.vegCrate),
    spec(0.8, 0.6, 'wall', P.vegCrate, { chance: 0.7 }),
    spec(1.35, 0.9, 'corner', P.crates, { chance: 0.6 }),
  ],
  garage: [
    spec(4.2, 2.0, 'center', P.car, { poi: true }),
    spec(1.8, 0.5, 'wall', P.metalShelves),
    spec(1.8, 0.5, 'wall', P.metalShelves, { chance: 0.7 }),
    spec(1.65, 0.2, 'wall', P.pegboard),
    spec(0.82, 0.3, 'corner', P.jerrycans),
    spec(1.35, 0.9, 'corner', P.crates, { chance: 0.6 }),
  ],
  veranda: [
    spec(1.7, 0.5, 'wall', P.planter),
    spec(1.7, 0.5, 'wall', P.planter, { chance: 0.8 }),
    spec(1.14, 1.14, 'center', P.wickerChair, { poi: true }),
    spec(1.14, 1.14, 'center', P.wickerChair, { chance: 0.8 }),
    spec(0.7, 0.7, 'center', P.sideTable),
    tallPlant(0.9),
    tallPlant(0.7),
    plant(0.8),
    plant(0.7),
  ],
  grenier: [
    spec(1.15, 0.65, 'wall', P.trunk, { poi: true }),
    spec(0.82, 0.7, 'corner', P.oldBoxes),
    spec(0.82, 0.7, 'corner', P.oldBoxes),
    spec(0.82, 0.7, 'corner', P.oldBoxes, { chance: 0.7 }),
    spec(1.0, 1.1, 'center', P.easel, { chance: 0.6 }),
    spec(1.12, 1, 'center', P.armchair, { chance: 0.6 }),
    spec(0.66, 0.66, 'corner', P.globe, { chance: 0.5 }),
  ],
  'salle-de-jeux': [
    spec(4, 3, 'floor', P.rug),
    spec(2.5, 1.5, 'center', P.pingpong, { poi: true }),
    spec(0.85, 1.15, 'wall', P.arcade, { poi: true }),
    spec(0.85, 1.15, 'wall', P.arcade),
    spec(1.04, 1.12, 'corner', P.beanbag),
    spec(1.04, 1.12, 'corner', P.beanbag, { chance: 0.8 }),
    spec(1.95, 0.55, 'wall', P.tvStand, { chance: 0.6 }),
    plant(0.5),
  ],
  couloir: [],
  logistique: [
    spec(4, 3, 'floor', P.rug),
    spec(2, 0.42, 'wall', P.bookshelf, { poi: true }),
    spec(1.12, 1, 'center', P.armchair),
    spec(1.3, 0.8, 'center', P.coffeeTable),
    spec(0.56, 0.45, 'wall', P.wallClock),
    spec(0.72, 0.72, 'corner', P.floorLamp),
    plant(1),
  ],
  entree: [
    spec(3, 2.4, 'floor', P.rug),
    spec(0.8, 0.8, 'corner', P.coatRack),
    spec(1.25, 0.42, 'wall', P.shoeBench),
    spec(1.25, 0.4, 'wall', P.consoleTable, { chance: 0.8 }),
    tallPlant(0.9),
    spec(0.56, 0.45, 'wall', P.wallClock, { chance: 0.8 }),
  ],
  'salle-de-bain': [
    spec(2, 0.96, 'wall', P.bathtub, { poi: true }),
    spec(0.96, 0.56, 'wall', P.vanity),
    plant(0.5),
    spec(0.6, 0.6, 'corner', P.laundryBasket, { chance: 0.7 }),
  ],
  wc: [
    spec(1.0, 0.8, 'wall', P.toilet),
    spec(0.5, 0.45, 'wall', P.smallSink),
    plant(0.4),
  ],
  buanderie: [
    spec(0.75, 0.72, 'wall', P.washer, { poi: true }),
    spec(0.75, 0.72, 'wall', P.washer),
    spec(1.15, 0.55, 'wall', P.dryingRack),
    spec(0.6, 0.6, 'corner', P.laundryBasket),
  ],
};

export const CORRIDOR_PROPS: PropSpec[] = [
  spec(1.25, 0.4, 'wall', P.consoleTable),
  spec(1.1, 0.15, 'wall', P.pictureFrame),
  spec(1.1, 0.15, 'wall', P.pictureFrame),
  spec(0.5, 0.5, 'wall', P.slimPlant),
];
