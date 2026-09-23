// ...existing code...
// Índice: re-exporta los generadores de páginas y helpers para mantener compatibilidad
export { generateListPageDart } from './listPageGenerator';
export { generateFormPageDart } from './formPageGenerator';
export { makeLower, toPascal, valueFromController } from './pageHelpers';