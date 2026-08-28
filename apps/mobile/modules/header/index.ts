// Re-export the native module. On web, it will be resolved to HeaderModule.web.ts
// and on native platforms to HeaderModule.ts
export { default } from "./src/HeaderModule";
export { default as HeaderView } from "./src/HeaderView";
export * from "./src/Header.types";
