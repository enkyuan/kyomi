import { mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockReactNative } from "../../lib/module-mocks";

mock.module("react-native-svg", () => ({
  Path: ({ d }: { d: string }) => createElement("path", { d }),
  Svg: ({ children }: { children?: ReactNode }) => createElement("svg", null, children),
  SvgXml: ({ xml }: { xml: string }) => createElement("svg", { "data-xml": xml }),
}));

mockReactNative();

export function html(node: ReactNode): string {
  return renderToStaticMarkup(node as never);
}
