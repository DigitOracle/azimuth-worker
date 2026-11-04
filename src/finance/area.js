// Area basis. GFA (gross floor area), BUA (built-up area), NSA (net saleable area). Permitted area is NOT saleable area.
import { result, val } from "./provenance.js";

export function gfaFromFar({ plotArea, far }) {
  return result("AREA.GFA_FAR", val(plotArea) * val(far), { plotArea, far }, { formula: "GFA = plot area x FAR", unit: "m2" });
}
export function farOf({ permittedFloorArea, plotArea }) {
  return result("AREA.FAR", val(permittedFloorArea) / val(plotArea), { permittedFloorArea, plotArea }, { formula: "FAR = permitted floor area / plot area" });
}
export function nsaFromEfficiency({ gfa, efficiency }) {
  return result("AREA.NSA", val(gfa) * val(efficiency), { gfa, efficiency }, { formula: "NSA = gross area x saleable efficiency", unit: "m2" });
}
export function efficiencyOf({ nsa, gfa }) {
  return result("AREA.EFFICIENCY", val(nsa) / val(gfa), { nsa, gfa }, { formula: "efficiency = NSA / gross area" });
}
export function plotCoverage({ footprint, plotArea }) {
  return result("AREA.PLOT_COVERAGE", val(footprint) / val(plotArea), { footprint, plotArea }, { formula: "plot coverage = building footprint / plot area" });
}
export function unitYield({ nsa, averageUnitSize }) {
  return result("AREA.UNIT_YIELD", Math.floor(val(nsa) / val(averageUnitSize)), { nsa, averageUnitSize }, { formula: "units = floor(NSA / average unit size)", unit: "units" });
}
export function landCostPerBuildable({ landCost, gfa }) {
  return result("AREA.LAND_PER_BUILDABLE", val(landCost) / val(gfa), { landCost, gfa }, { formula: "land cost per buildable m2 = land cost / GFA", unit: "per m2 GFA" });
}
