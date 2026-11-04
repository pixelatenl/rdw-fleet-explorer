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

/**
 * AI insight narrations, generated at snapshot time by Mistral from the
 * same aggregates that power the charts. All fields optional: a run
 * without the API key or a failed narration simply stores less.
 */
export interface Narration {
  /** SHA-256 of each visual's narration context: the exact aggregates
   *  the stored text was generated from and validated against. A
   *  visual is re-narrated only when its context hash changes. */
  signatures?: {
    treemap?: string;
    fleetByFuel?: string;
    vehicleTypes?: string;
    heavyTurn?: string;
    entryYears?: string;
  };
  visuals: {
    treemap?: string;
    fleetByFuel?: string;
    vehicleTypes?: string;
    heavyTurn?: string;
    entryYears?: string;
  };
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
  /**
   * The fleet by fuel: every vehicle with fuel data in exactly one
   * mutually exclusive category, ordered by count descending.
   */
  fleetByFuel: LabeledCount[];
  electricSplit: LabeledCount[];
  fuelCellByFuel: LabeledCount[];
  vehicleTypes: LabeledCount[];
  registrationYears: YearCount[];
  registrationYearsUnknown: number;
  massByYear: HeavyTurnYear[];
  engineSizeByYear: HeavyTurnYear[];
  ferrari: Ferrari;
  /** Absent when no narration could be generated for this snapshot. */
  narration?: Narration;
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

/**
 * Vehicles with a fuel cell class, on the distinct-kenteken basis. The
 * fuel cell coverage entries (fuelCellByFuel) are per-fuel record
 * counts — a fuel cell vehicle books several fuel records — so they
 * cannot be summed into a vehicle count. Every classed vehicle books
 * exactly one Elektriciteit record (verified against the register; see
 * docs/data-notes.md), so the coverage's Elektriciteit entry equals the
 * distinct kenteken count of the class.
 */
export const fuelCellVehicles =
  snapshot.fuelCellByFuel.find((entry) => entry.key === "elektriciteit")
    ?.count ?? 0;

export const electricShareOfFuelVehicles =
  electricVehicles / snapshot.totals.vehiclesWithFuelData;

export const batteryElectricShareOfFuelVehicles =
  batteryElectric / snapshot.totals.vehiclesWithFuelData;

export const passengerCars =
  snapshot.vehicleTypes.find((entry) => entry.label === "Passenger car")
    ?.count ?? 0;
