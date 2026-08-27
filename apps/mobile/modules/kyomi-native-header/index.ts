// Re-export the native module. On web, it will be resolved to KyomiNativeHeaderModule.web.ts
// and on native platforms to KyomiNativeHeaderModule.ts
export { default } from "./src/KyomiNativeHeaderModule";
export { default as KyomiNativeHeaderView } from "./src/KyomiNativeHeaderView";
export * from "./src/KyomiNativeHeader.types";
