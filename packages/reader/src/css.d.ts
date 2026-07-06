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
