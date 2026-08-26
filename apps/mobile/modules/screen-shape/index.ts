// Re-export the native module. On web, it will be resolved to ScreenShapeModule.web.ts
// and on native platforms to ScreenShapeModule.ts
export { default } from "./src/ScreenShapeModule";
export * from "./src/ScreenShape.types";
