// Fulfills Phase 36 Picking Path & Routing Optimization Contracts
// Pure TypeScript types for 3D navigation, TSP order sequencing, vehicle agents, and simulation playback.

export type VehicleType = 'FORKLIFT' | 'AGV' | 'CART';

export type PickBadgeDisplayMode = 'SMART' | 'FULL' | 'COMPACT';

export interface VehicleConfig {
  type: VehicleType;
  label: string;
  speedMps: number; // meters per second
  pickDwellSeconds: number; // stop dwell time to load/scan item
  color: string;
  description: string;
}

export const VEHICLE_CONFIGS: Record<VehicleType, VehicleConfig> = {
  FORKLIFT: {
    type: 'FORKLIFT',
    label: 'Forklift Industri (Reach Truck)',
    speedMps: 4.0,
    pickDwellSeconds: 4.0,
    color: '#f59e0b', // Safety Amber
    description: 'Kendaraan palet muatan berat berkecepatan 4.0 m/s',
  },
  AGV: {
    type: 'AGV',
    label: 'AGV Robot (Autonomous Mobile Robot)',
    speedMps: 2.5,
    pickDwellSeconds: 3.0,
    color: '#06b6d4', // Cyan Neon
    description: 'Robot pintar otonom berkecepatan 2.5 m/s dengan sensor lidar',
  },
  CART: {
    type: 'CART',
    label: 'Manual Picking Trolley',
    speedMps: 1.2,
    pickDwellSeconds: 6.0,
    color: '#10b981', // Emerald Green
    description: 'Keranjang dorong manual untuk pengambilan eceran 1.2 m/s',
  },
};

export interface PickItem {
  binId: string;
  rackId: string;
  rackName: string;
  bayIndex: number;
  levelIndex: number;
  position3D: { x: number; y: number; z: number };
  accessPoint3D: { x: number; y: number; z: number };
  sku: string;
  productName: string;
  quantity: number;
  weightKg: number;
  isPicked: boolean;
  levelId?: string;
}

export interface CustomWaypoint {
  id: string;
  x: number;
  z: number;
  name?: string;
  insertAfterStopIndex: number; // 0 for after depot, 1 for after stop 1, etc.
}

export interface RouteWaypoint {
  id?: string;
  x: number;
  y?: number;
  z: number;
  type: 'DEPOT_START' | 'TRANSIT' | 'PICK_STOP' | 'DEPOT_END';
  binId?: string;
  stopNumber?: number;
  customWaypointId?: string;
}

export interface RoutingComparisonMetrics {
  totalDistanceMeters: number;
  unoptimizedDistanceMeters: number;
  distanceSavedPercent: number;
  estimatedDurationSeconds: number;
  unoptimizedDurationSeconds: number;
  timeSavedPercent: number;
  totalWeightKg: number;
  itemCount: number;
}

export interface PickingRouteResult {
  orderedPicks: PickItem[];
  waypoints: RouteWaypoint[];
  polylinePoints: Array<{
    x: number;
    y?: number;
    z: number;
    insertAfterStopIndex?: number;
    prevWaypointId?: string;
    nextWaypointId?: string;
  }>;
  metrics: RoutingComparisonMetrics;
  isManualSequence?: boolean;
}


export interface PlaybackState {
  isPlaying: boolean;
  progress: number; // 0 to 1
  playbackSpeed: number; // 1, 2, 5
  currentStopIndex: number;
  elapsedSeconds: number;
}

export interface PickingRouteConfig {
  pickList: PickItem[];
  customWaypoints: CustomWaypoint[];
  depotPosition: { x: number; z: number };
  selectedVehicleType?: VehicleType;
  isManualSequence?: boolean;
  fleet?: FleetAgent[];
}

// Phase 41 Multi-Agent Fleet Simulation & Traffic Control Contracts
export type FleetAgentStatus =
  | 'IDLE'
  | 'MOVING'
  | 'PICKING'
  | 'YIELDING'
  | 'RETURNING_TO_DOCK'
  | 'CHARGING';

export interface FleetAgent {
  id: string;
  name: string; // e.g. "AGV-01", "Forklift-01"
  vehicleType: VehicleType;
  color: string; // Distinct accent color for vehicle & polyline
  batteryLevel: number; // 0 - 100%
  status: FleetAgentStatus;
  currentSpeedMps: number;
  assignedPickList: PickItem[];
  routeResult?: PickingRouteResult | null;
  progress: number; // 0 to 1 along its route
  currentStopIndex: number;
  position3D: { x: number; y: number; z: number };
  headingRad: number;
  homeDockId?: string;
  isYielding?: boolean;
  yieldReason?: string;
  levelId: string; // Target floor/building level ID (e.g. "level-1")
  levelName?: string; // Human-friendly floor label (e.g. "Lantai 1", "Mezzanine")
}

export interface TrafficAlert {
  id: string;
  type: 'PROXIMITY_WARNING' | 'INTERSECTION_YIELD' | 'LOW_BATTERY' | 'BLOCKED_CORRIDOR';
  vehicleIdA: string;
  vehicleIdB?: string;
  position: { x: number; y: number; z: number };
  timestamp: number;
  message: string;
}

export interface FleetSimulationMetrics {
  totalAgents: number;
  activeAgents: number;
  yieldingAgents: number;
  chargingAgents: number;
  averageBatteryPct: number;
  totalOrdersCompleted: number;
  totalOrdersAssigned: number;
  totalDistanceTraveledMeters: number;
}

