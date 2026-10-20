import type { RackEntity, StructuralElement, WarehouseZone } from '@/types/layout';

export function nextRackName(existingRacks: Array<Pick<RackEntity, 'name'>>): string {
  const usedNumbers = new Set<number>();

  for (const rack of existingRacks) {
    const match = /^A(\d+)$/.exec(rack.name);
    if (match) {
      usedNumbers.add(Number.parseInt(match[1], 10));
    }
  }

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return `A${String(candidate).padStart(2, '0')}`;
}

export function nextRackId(): string {
  return `rack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextStructureId(): string {
  return `struct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextStructureName(type: string, existing: StructuralElement[]): string {
  const prefix =
    type === 'charging_dock'
      ? 'Charging Dock'
      : type === 'dock_door'
      ? 'Dock Door'
      : type.charAt(0).toUpperCase() + type.slice(1);
  const count = existing.filter((e) => e.type === type).length + 1;
  return `${prefix} ${String(count).padStart(2, '0')}`;
}

export function nextZoneId(): string {
  return `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextZoneName(type: string, existing: WarehouseZone[]): string {
  const prefix = type.charAt(0).toUpperCase() + type.slice(1);
  const count = existing.filter((z) => z.type === type).length + 1;
  return `${prefix} Zone ${String(count).padStart(2, '0')}`;
}

export function nextVerticalConnectorId(): string {
  return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextVerticalConnectorName(
  type: string,
  existing: Array<{ type: string }>
): string {
  const names: Record<string, string> = {
    cargo_lift: 'Cargo Lift',
    lift: 'Cargo Lift',
    ramp: 'Access Ramp',
    stairs: 'Industrial Stairs',
  };
  const prefix = names[type] || 'Connector';
  const count = existing.filter((c) => c.type === type).length + 1;
  return `${prefix} ${String(count).padStart(2, '0')}`;
}

export function nextLevelId(): string {
  return `level-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function nextLevelName(existingLevels: Array<{ name: string }>): string {
  const count = existingLevels.length + 1;
  return `Lantai ${count} / Level ${count}`;
}


