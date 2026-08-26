declare module "*.css";

declare module "katex/dist/contrib/auto-render.mjs" {
  type KatexDelimiter = {
    left: string;
    right: string;
    display: boolean;
  };

  type RenderMathOptions = {
    delimiters?: KatexDelimiter[];
    errorColor?: string;
    ignoredClasses?: string[];
    ignoredTags?: string[];
    throwOnError?: boolean;
  };

  const renderMathInElement: (element: HTMLElement, options?: RenderMathOptions) => void;
  export default renderMathInElement;
}

declare module "marked-katex-extension" {
  import type { MarkedExtension } from "marked";
  import type { KatexOptions } from "katex";

  export type MarkedKatexOptions = KatexOptions & {
    nonStandard?: boolean;
  };

  export default function markedKatex(options?: MarkedKatexOptions): MarkedExtension;
}
