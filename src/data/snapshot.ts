import raw from "./snapshot.json";

export interface LabeledCount {
  key: string;
  label: string;
  count: number;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface HeavyTurnYear {
  year: number;
  avgMass: number;
  avgEngineSize: number;
  count: number;
  /** Cars with a recorded cilinderinhoud; only engineSizeByYear rows carry it. */
  withEngine?: number;
}

/** Most common handelsbenaming among the Ferrari tractors, null if none. */
export interface FerrariTopModel {
  name: string;
  count: number;
}

/** Model and first admission year of a single record. */
export interface FerrariModelYear {
  model: string;
  year: number;
}

/** Figures of the closing Ferrari card, from the RDW Ferrari brand extract. */
export interface Ferrari {
  total: number;
  red: number;
  model458: number;
  california: number;
  tractors: number;
  tractorsTopModel: FerrariTopModel | null;
  tractorsWithColor: number;
  motorcycle: number;
  /** Handelsbenaming of the motorcycle record, null unless exactly one exists. */
  motorcycleModel: string | null;
  /** First admission year of the motorcycle record, null when not recorded. */
  motorcycleYear: number | null;
  /** Model and year of the record with the earliest first admission date. */
  oldest: FerrariModelYear | null;
}

export interface Snapshot {
  retrievedAt: string;
  source: {
    name: string;
    url: string;
    license: string;
    datasets: { base: string; fuel: string; ferrari: string };
  };
  totals: {
    vehicles: number;
    vehiclesWithFuelData: number;
    fuelRegistrations: number;
  };
  fuelRegistrations: LabeledCount[];
  electricSplit: LabeledCount[];
  fuelCellByFuel: LabeledCount[];
  vehicleTypes: LabeledCount[];
  registrationYears: YearCount[];
  registrationYearsUnknown: number;
  massByYear: HeavyTurnYear[];
  engineSizeByYear: HeavyTurnYear[];
  ferrari: Ferrari;
}

export const snapshot = raw as Snapshot;

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export const electricVehicles =
  snapshot.electricSplit.reduce((sum, entry) => sum + entry.count, 0);

export const batteryElectric =
  snapshot.electricSplit.find((entry) => entry.key === "bev")?.count ?? 0;

export const plugInHybrids =
  snapshot.electricSplit.find((entry) => entry.key === "ovc-hev")?.count ?? 0;

export const fullHybrids =
  snapshot.electricSplit.find((entry) => entry.key === "novc-hev")?.count ?? 0;

export const electricShareOfFuelVehicles =
  electricVehicles / snapshot.totals.vehiclesWithFuelData;

export const batteryElectricShareOfFuelVehicles =
  batteryElectric / snapshot.totals.vehiclesWithFuelData;

export const passengerCars =
  snapshot.vehicleTypes.find((entry) => entry.label === "Passenger car")
    ?.count ?? 0;

export const fuelRegistrationsTotal =
  snapshot.fuelRegistrations.reduce((sum, entry) => sum + entry.count, 0);
