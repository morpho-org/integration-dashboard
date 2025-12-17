// Input parameters that the user can modify
export interface LoopingCalculatorInputs {
  // Insurance section (greyed out by default)
  insuranceUpfrontCost: number; // C4: Annualized (0-1, e.g., 0.02 = 2%)
  coverageDurationDays: number; // C5: Days (default 365)
  additionalInsuranceCost: number; // C6: APY (0-1) - also used as swap haircut

  // Lending Market section
  borrowRate: number; // C8: APY (0-1, e.g., 0.05 = 5%)
  ltvCap: number; // C9: LTV cap (0-1, e.g., 0.9 = 90%)
  liquidationLTV: number; // C10: LLTV (0-1, e.g., 0.95 = 95%)

  // Looping Math section
  assetYield: number; // C12: APY (0-1, e.g., 0.08 = 8%)
  turnsOfLeverage: number; // C13: Integer (e.g., 8)
  capitalDeposited: number; // C14: Amount in USD

  // Unwind scenario
  navDrop: number; // D19: (0-1, e.g., 0.12 = 12%)
}

// Breakdown of exposure calculation at a given leverage level
export interface ExposureBreakdown {
  initialPrincipal: number; // H4/H14
  insuranceCost: number; // I4/I14
  rwaPurchase: number; // J4/J14
  totalDebt: number; // K4/K14
  debtCost: number; // L4/L14
  additionalInsuranceCost: number; // I6/I16
  additionalRwaPurchase: number; // J6/J16
  totalExposure: number; // K6/K16
  ltv: number; // L6/L16
}

// Net return breakdown
export interface NetReturnBreakdown {
  earnings: number; // H10: Total yield earned
  totalInsuranceCost: number; // I10: Sum of insurance costs
  debtCost: number; // L4: Interest cost
  netEarnings: number; // J10: Earnings - costs
  dollarsOfCoverage: number | null; // K10: Notional coverage (null if insurance = 0)
  netYield: number; // L10: Annualized ROE
}

// Unwind scenario results
export interface UnwindScenarioResults {
  navDrop: number; // Input: % drop
  currentNotionalExposure: number; // D22: Exposure after drop
  currentLTV: number; // D23: New LTV
  costToExit: number; // D24: Exit fees
  availableToRepay: number; // D25: Net available
  principalOwed: number; // D26: Debt principal
  interestOwed: number; // D27: Accrued interest
  totalOwed: number; // D28: Total debt
  noBadDebt: boolean; // D29: True if collateral > debt
  lltv: number; // D30: Reference to LLTV
  remainingCapital: number; // D31: What's left after repaying
  pnl: number; // D32: Profit/Loss
  annualizedReturn: number; // D33: Annualized return in this scenario
}

// Risk metrics (NAV drop thresholds)
export interface RiskMetrics {
  navDropToLLTV_Target: number; // F9: % drop to trigger LLTV at target leverage
  navDropToBadDebt_Target: number; // F10: % drop to trigger bad debt at target
  navDropToLLTV_Cap: number; // F11: % drop to trigger LLTV at LTV cap
  navDropToBadDebt_Cap: number; // F12: % drop to trigger bad debt at LTV cap
}

// Complete calculation results
export interface LoopingCalculatorResults {
  // Summary metrics
  initialVaultPrincipal: number; // F3
  notionalExposure: number; // F4
  targetLTV: number; // F5
  termsPerYear: number; // F6
  accruedInterest: number; // F7
  swapHaircut: number; // F8
  loopROE: number; // F13 / L10 - Main output!

  // Risk metrics
  riskMetrics: RiskMetrics;

  // Detailed breakdowns
  targetLeverage: ExposureBreakdown;
  maxLeverage: ExposureBreakdown;
  netReturn: NetReturnBreakdown;

  // Unwind scenario
  unwind: UnwindScenarioResults;
}

// Chart data point for ROE vs Leverage visualization
export interface ROEChartDataPoint {
  leverage: number;
  roe: number;
  ltv: number;
}

// Default input values matching the Excel
export const DEFAULT_INPUTS: LoopingCalculatorInputs = {
  insuranceUpfrontCost: 0, // 0%
  coverageDurationDays: 365, // 1 year
  additionalInsuranceCost: 0, // 0%
  borrowRate: 0.05, // 5%
  ltvCap: 0.9, // 90%
  liquidationLTV: 0.95, // 95%
  assetYield: 0.08, // 8%
  turnsOfLeverage: 8, // 8x
  capitalDeposited: 1000000, // $1M
  navDrop: 0.12, // 12%
};
