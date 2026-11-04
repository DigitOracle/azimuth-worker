// Najma Financial Intelligence Engine: public entry point. Pure, deterministic functions; no UI, no network, no AI.
export * from "./provenance.js";
export * from "./units.js";
export * from "./area.js";
export * from "./returns.js";
export * from "./costplan.js";
export * from "./development.js";
export * from "./cashflow.js";
export * from "./income.js";
export * from "./analysis.js";
export * from "./modes.js";
// Excel export lives in ./excel.js (Node only, pulls in exceljs); import it directly so the worker bundle stays small.
