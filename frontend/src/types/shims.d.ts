// Basic shims to allow importing plain JS modules and CSS in TS strict mode
declare module '*.js';
declare module '*.css';

// Allow any non-typed imports (quick shim); consider replacing with specific types later
declare module '*';
