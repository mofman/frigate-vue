/** Icons and color tones for object, audio and motion labels. */
import {
  Bike,
  Bird,
  Bus,
  Car,
  Cat,
  Circle,
  Dog,
  Package,
  Scan,
  ScanEye,
  Truck,
  User,
  Volume2,
  Zap,
  type LucideIcon,
} from "@lucide/vue";

export type LabelTone = "person" | "vehicle" | "motion" | "animal" | "other";

const ICONS: Record<string, LucideIcon> = {
  person: User,
  face: ScanEye,
  car: Car,
  truck: Truck,
  bus: Bus,
  motorcycle: Bike,
  bicycle: Bike,
  dog: Dog,
  cat: Cat,
  bird: Bird,
  package: Package,
  license_plate: Scan,
  motion: Zap,
  audio: Volume2,
};

const VEHICLES = new Set([
  "car",
  "truck",
  "bus",
  "motorcycle",
  "bicycle",
  "boat",
  "license_plate",
]);
const ANIMALS = new Set([
  "dog",
  "cat",
  "bird",
  "horse",
  "deer",
  "bear",
  "cow",
  "sheep",
  "fox",
  "raccoon",
]);

function baseLabel(label: string) {
  return label.replace(/-verified$/, "");
}

export function labelIcon(label: string): LucideIcon {
  return ICONS[baseLabel(label)] ?? Circle;
}

export function labelTone(label: string): LabelTone {
  const base = baseLabel(label);
  if (base === "person" || base === "face") return "person";
  if (base === "motion") return "motion";
  if (VEHICLES.has(base)) return "vehicle";
  if (ANIMALS.has(base)) return "animal";
  return "other";
}
