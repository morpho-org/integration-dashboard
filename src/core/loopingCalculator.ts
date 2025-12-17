import {
  LoopingCalculatorInputs,
  LoopingCalculatorResults,
  ExposureBreakdown,
  NetReturnBreakdown,
  UnwindScenarioResults,
  RiskMetrics,
  ROEChartDataPoint,
} from "../types/loopingCalculator";

/**
 * Calculate insurance cost using the present-value adjusted formula
 * Formula: (amount / (1 + rate_per_term)) * rate_per_term
 */
function calculateInsuranceCost(
  amount: number,
  annualizedRate: number,
  termsPerYear: number
): number {
  if (annualizedRate === 0 || termsPerYear === 0) return 0;
  const ratePerTerm = annualizedRate / termsPerYear;
  return (amount / (1 + ratePerTerm)) * ratePerTerm;
}

/**
 * Calculate exposure breakdown at target leverage (user-specified turns)
 */
function calculateTargetLeverageExposure(
  inputs: LoopingCalculatorInputs,
  termsPerYear: number
): ExposureBreakdown {
  const { capitalDeposited, insuranceUpfrontCost, turnsOfLeverage, borrowRate } =
    inputs;

  // Row 3-4: Initial capital flow
  const initialPrincipal = capitalDeposited; // H4 = C14
  const insuranceCost = calculateInsuranceCost(
    capitalDeposited,
    insuranceUpfrontCost,
    termsPerYear
  ); // I4
  const rwaPurchase = capitalDeposited - insuranceCost; // J4 = C14 - I4
  const totalDebt = rwaPurchase * (turnsOfLeverage - 1); // K4 = J4 * (C13 - 1)

  // Row 5-6: Additional loop from debt
  const additionalInsuranceCost = calculateInsuranceCost(
    totalDebt,
    insuranceUpfrontCost,
    termsPerYear
  ); // I6
  const additionalRwaPurchase = totalDebt - additionalInsuranceCost; // J6 = K4 - I6
  const totalExposure = additionalRwaPurchase + rwaPurchase; // K6 = J6 + J4

  // Debt cost per term
  const debtCost = totalDebt * (borrowRate / termsPerYear); // L4 = H6 * (C8 / F6)

  // LTV = Total Debt / Total Exposure
  const ltv = totalExposure > 0 ? totalDebt / totalExposure : 0; // L6 = H6 / K6

  return {
    initialPrincipal,
    insuranceCost,
    rwaPurchase,
    totalDebt,
    debtCost,
    additionalInsuranceCost,
    additionalRwaPurchase,
    totalExposure,
    ltv,
  };
}

/**
 * Calculate exposure breakdown at maximum leverage (LTV cap)
 */
function calculateMaxLeverageExposure(
  inputs: LoopingCalculatorInputs,
  termsPerYear: number
): ExposureBreakdown {
  const { capitalDeposited, insuranceUpfrontCost, ltvCap, borrowRate } = inputs;

  // Row 13-14: Initial capital at LTV cap
  const initialPrincipal = capitalDeposited; // H14 = C14
  const insuranceCost = calculateInsuranceCost(
    capitalDeposited,
    insuranceUpfrontCost,
    termsPerYear
  ); // I14
  // Note: J14 = C14 - I4 in Excel (same formula as I14 when insurance is consistent)
  const rwaPurchase = capitalDeposited - insuranceCost; // J14

  // Total debt at LTV cap: RWA * ((1/(1-LTV_cap)) - 1)
  // At 90% LTV cap: multiplier = (1/0.1) - 1 = 9
  const totalDebt = rwaPurchase * (1 / (1 - ltvCap) - 1); // K14

  // Row 15-16: Additional loop
  const additionalInsuranceCost = calculateInsuranceCost(
    totalDebt,
    insuranceUpfrontCost,
    termsPerYear
  ); // I16
  const additionalRwaPurchase = totalDebt - additionalInsuranceCost; // J16 = H16 - I16
  const totalExposure = additionalRwaPurchase + rwaPurchase; // K16 = J16 + J14

  // Debt cost per term
  const debtCost = totalDebt * (borrowRate / termsPerYear); // L14 = K14 * (C8 / F6)

  // LTV = LTV cap (by definition)
  const ltv = ltvCap; // L16 = C9

  return {
    initialPrincipal,
    insuranceCost,
    rwaPurchase,
    totalDebt,
    debtCost,
    additionalInsuranceCost,
    additionalRwaPurchase,
    totalExposure,
    ltv,
  };
}

/**
 * Calculate net return breakdown
 */
function calculateNetReturn(
  inputs: LoopingCalculatorInputs,
  targetExposure: ExposureBreakdown,
  termsPerYear: number
): NetReturnBreakdown {
  const { capitalDeposited, assetYield, insuranceUpfrontCost } = inputs;

  // Earnings = Total Exposure * (Asset Yield / Terms per year)
  const earnings = targetExposure.totalExposure * (assetYield / termsPerYear); // H10

  // Total insurance cost
  const totalInsuranceCost =
    targetExposure.insuranceCost + targetExposure.additionalInsuranceCost; // I10 = I6 + I4

  // Debt cost (from target exposure)
  const debtCost = targetExposure.debtCost; // L4

  // Net earnings = Earnings - Insurance - Debt cost
  const netEarnings = earnings - totalInsuranceCost - debtCost; // J10 = H10 - I10 - L4

  // Dollars of coverage (null if insurance rate is 0 to avoid division by zero)
  const insuranceRatePerTerm = insuranceUpfrontCost / termsPerYear;
  const dollarsOfCoverage =
    insuranceRatePerTerm > 0 ? totalInsuranceCost / insuranceRatePerTerm : null; // K10

  // Net yield (annualized) = (Net Earnings / Capital) * Terms per year
  const netYield = (netEarnings / capitalDeposited) * termsPerYear; // L10

  return {
    earnings,
    totalInsuranceCost,
    debtCost,
    netEarnings,
    dollarsOfCoverage,
    netYield,
  };
}

/**
 * Calculate risk metrics (NAV drop thresholds)
 */
function calculateRiskMetrics(
  inputs: LoopingCalculatorInputs,
  targetExposure: ExposureBreakdown,
  maxExposure: ExposureBreakdown
): RiskMetrics {
  const { liquidationLTV, additionalInsuranceCost: swapHaircut } = inputs;

  // Get all the values needed for the formulas
  const H6 = targetExposure.totalDebt;
  const I6 = targetExposure.additionalInsuranceCost;
  const I4 = targetExposure.insuranceCost;
  const F7 = targetExposure.debtCost; // L4 = accrued interest
  const K6 = targetExposure.totalExposure;
  const F8 = swapHaircut;
  const C10 = liquidationLTV;

  const H16 = maxExposure.totalDebt;
  const I16 = maxExposure.additionalInsuranceCost;
  const I14 = maxExposure.insuranceCost;
  const L14 = maxExposure.debtCost;
  const K16 = maxExposure.totalExposure;

  // NAV drop to trigger LLTV at target leverage
  // F9 = 1 - ((H6 + I6 + I4 + F7) / (C10 * K6 * (1 - F8)))
  const denominator_F9 = C10 * K6 * (1 - F8);
  const navDropToLLTV_Target =
    denominator_F9 > 0 ? 1 - (H6 + I6 + I4 + F7) / denominator_F9 : 0;

  // NAV drop to trigger bad debt at target leverage
  // F10 = 1 - ((H6 + I6 + I4 + F7) / (K6 * (1 - F8)))
  const denominator_F10 = K6 * (1 - F8);
  const navDropToBadDebt_Target =
    denominator_F10 > 0 ? 1 - (H6 + I6 + I4 + F7) / denominator_F10 : 0;

  // NAV drop to trigger LLTV at LTV cap
  // F11 = 1 - ((H16 + I16 + I14 + L14) / (C10 * K16 * (1 - F8)))
  const denominator_F11 = C10 * K16 * (1 - F8);
  const navDropToLLTV_Cap =
    denominator_F11 > 0 ? 1 - (H16 + I16 + I14 + L14) / denominator_F11 : 0;

  // NAV drop to trigger bad debt at LTV cap
  // F12 = 1 - ((H16 + I16 + I14 + L14) / (K16 * (1 - F8)))
  const denominator_F12 = K16 * (1 - F8);
  const navDropToBadDebt_Cap =
    denominator_F12 > 0 ? 1 - (H16 + I16 + I14 + L14) / denominator_F12 : 0;

  return {
    navDropToLLTV_Target,
    navDropToBadDebt_Target,
    navDropToLLTV_Cap,
    navDropToBadDebt_Cap,
  };
}

/**
 * Calculate unwind scenario results
 */
function calculateUnwindScenario(
  inputs: LoopingCalculatorInputs,
  targetExposure: ExposureBreakdown,
  termsPerYear: number
): UnwindScenarioResults {
  const {
    navDrop,
    capitalDeposited,
    additionalInsuranceCost: swapHaircut,
    borrowRate,
    liquidationLTV,
  } = inputs;

  const K6 = targetExposure.totalExposure;
  const H6 = targetExposure.totalDebt;

  // Current notional exposure after NAV drop
  const currentNotionalExposure = K6 * (1 - navDrop); // D22 = K6 * (1 - D19)

  // Current LTV = Debt / Reduced Exposure
  const currentLTV =
    currentNotionalExposure > 0 ? H6 / currentNotionalExposure : Infinity; // D23 = H6 / D22

  // Cost to exit (swap haircut / exercise fee)
  const costToExit = currentNotionalExposure * swapHaircut; // D24 = D22 * F8

  // Available to repay debt
  const availableToRepay = currentNotionalExposure - costToExit; // D25 = D22 - D24

  // Principal owed
  const principalOwed = H6; // D26 = H6

  // Interest owed
  const interestOwed = H6 * (borrowRate / termsPerYear); // D27 = H6 * (C8 / F6)

  // Total owed
  const totalOwed = principalOwed + interestOwed; // D28 = D26 + D27

  // No bad debt? (boolean)
  const noBadDebt = totalOwed < availableToRepay; // D29 = (D28) < (D25)

  // Remaining capital
  const remainingCapital = availableToRepay - totalOwed; // D31 = D25 - D28

  // PnL
  const pnl = remainingCapital - capitalDeposited; // D32 = D31 - C14

  // Annualized return
  const annualizedReturn = (pnl / capitalDeposited) * termsPerYear; // D33 = (D32 / C14) * F6

  return {
    navDrop,
    currentNotionalExposure,
    currentLTV,
    costToExit,
    availableToRepay,
    principalOwed,
    interestOwed,
    totalOwed,
    noBadDebt,
    lltv: liquidationLTV,
    remainingCapital,
    pnl,
    annualizedReturn,
  };
}

/**
 * Main calculation function - computes all results from inputs
 */
export function calculateLoopingStrategy(
  inputs: LoopingCalculatorInputs
): LoopingCalculatorResults {
  // Terms per year = 365 / Coverage Duration
  const termsPerYear = 365 / inputs.coverageDurationDays; // F6 = 365 / C5

  // Calculate exposure at target leverage
  const targetLeverage = calculateTargetLeverageExposure(inputs, termsPerYear);

  // Calculate exposure at max leverage (LTV cap)
  const maxLeverage = calculateMaxLeverageExposure(inputs, termsPerYear);

  // Calculate net return
  const netReturn = calculateNetReturn(inputs, targetLeverage, termsPerYear);

  // Calculate risk metrics
  const riskMetrics = calculateRiskMetrics(
    inputs,
    targetLeverage,
    maxLeverage
  );

  // Calculate unwind scenario
  const unwind = calculateUnwindScenario(inputs, targetLeverage, termsPerYear);

  return {
    // Summary metrics
    initialVaultPrincipal: inputs.capitalDeposited, // F3 = C14
    notionalExposure:
      targetLeverage.rwaPurchase + targetLeverage.additionalRwaPurchase, // F4 = J4 + J6
    targetLTV: targetLeverage.ltv, // F5 = L6
    termsPerYear, // F6
    accruedInterest: targetLeverage.debtCost, // F7 = L4
    swapHaircut: inputs.additionalInsuranceCost, // F8 = C6
    loopROE: netReturn.netYield, // F13 = L10

    // Detailed results
    riskMetrics,
    targetLeverage,
    maxLeverage,
    netReturn,
    unwind,
  };
}

/**
 * Generate ROE vs Leverage chart data
 * Calculates ROE for leverage levels from 1x to max possible
 */
export function generateROEChartData(
  inputs: LoopingCalculatorInputs,
  steps: number = 20
): ROEChartDataPoint[] {
  const { ltvCap } = inputs;

  // Max leverage at LTV cap = 1 / (1 - LTV_cap)
  // At 90% LTV: max = 10x
  const maxLeverage = 1 / (1 - ltvCap);

  const data: ROEChartDataPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    // Leverage from 1x to maxLeverage
    const leverage = 1 + (i / steps) * (maxLeverage - 1);

    // Create modified inputs with this leverage
    const modifiedInputs = {
      ...inputs,
      turnsOfLeverage: leverage,
    };

    // Calculate results
    const results = calculateLoopingStrategy(modifiedInputs);

    data.push({
      leverage: Math.round(leverage * 100) / 100,
      roe: Math.round(results.loopROE * 10000) / 100, // Convert to percentage with 2 decimals
      ltv: Math.round(results.targetLTV * 10000) / 100,
    });
  }

  return data;
}

/**
 * Validate inputs and return error messages if any
 */
export function validateInputs(
  inputs: LoopingCalculatorInputs
): string | null {
  const { ltvCap, liquidationLTV, turnsOfLeverage, capitalDeposited } = inputs;

  if (capitalDeposited <= 0) {
    return "Capital deposited must be greater than 0";
  }

  if (turnsOfLeverage < 1) {
    return "Turns of leverage must be at least 1";
  }

  if (ltvCap >= liquidationLTV) {
    return "LTV Cap must be less than Liquidation LTV (LLTV)";
  }

  if (ltvCap >= 1 || ltvCap <= 0) {
    return "LTV Cap must be between 0% and 100%";
  }

  if (liquidationLTV >= 1 || liquidationLTV <= 0) {
    return "Liquidation LTV must be between 0% and 100%";
  }

  // Check if target leverage exceeds LTV cap
  // At target leverage, LTV = (leverage - 1) / leverage
  // This must be <= ltvCap
  const impliedLTV = (turnsOfLeverage - 1) / turnsOfLeverage;
  if (impliedLTV > ltvCap) {
    const maxLeverage = 1 / (1 - ltvCap);
    return `Leverage ${turnsOfLeverage}x implies LTV of ${(impliedLTV * 100).toFixed(1)}%, which exceeds the LTV Cap of ${(ltvCap * 100).toFixed(1)}%. Maximum leverage is ${maxLeverage.toFixed(1)}x`;
  }

  return null;
}
