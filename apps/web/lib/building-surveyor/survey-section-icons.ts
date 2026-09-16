import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  AppWindow,
  Bath,
  BookOpen,
  ClipboardList,
  Columns2,
  DoorOpen,
  Droplet,
  Droplets,
  Flame,
  Fuel,
  Grid3x3,
  Hammer,
  Home,
  Layers,
  Leaf,
  ListChecks,
  MessageSquareQuote,
  PanelTop,
  Scale,
  Stamp,
  Tent,
  Thermometer,
  Trees,
  Warehouse,
  Zap,
} from 'lucide-react';

/**
 * Lucide icons for RICS Home Survey section keys.
 * Used on grouped-observation headers so ALL CAPS titles stay scannable.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  about_inspection: ClipboardList,
  overall_opinion: MessageSquareQuote,
  about_property: Home,
  chimney_stacks: Flame,
  roof_coverings: Home,
  rainwater: Droplets,
  main_walls: Columns2,
  windows: AppWindow,
  outside_doors: DoorOpen,
  conservatory_porches: Tent,
  other_joinery: Hammer,
  roof_structure: Layers,
  ceilings: PanelTop,
  walls_partitions: Columns2,
  floors: Grid3x3,
  fireplaces: Flame,
  built_in_fittings: Warehouse,
  woodwork: Hammer,
  bathroom_fittings: Bath,
  electricity: Zap,
  gas_oil: Fuel,
  water: Droplet,
  heating: Thermometer,
  water_heating: Thermometer,
  drainage: Droplets,
  grounds: Trees,
  garage_outbuildings: Warehouse,
  legal_advisers: Scale,
  risks: AlertTriangle,
  energy: Leaf,
  declaration: Stamp,
  what_to_do_now: ListChecks,
  rics_description: BookOpen,
};

export function surveySectionIcon(sectionKey: string): LucideIcon {
  return SECTION_ICONS[sectionKey] ?? ClipboardList;
}
