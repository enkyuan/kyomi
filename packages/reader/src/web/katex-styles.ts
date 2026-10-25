/// <reference path="../css.d.ts" />
// The only module that imports the KaTeX stylesheet. Every lazy math path (HTML, Markdown and
// document bodies) loads this one chunk, so bundlers never split the stylesheet into a shared
// chunk between async imports, which Expo's DOM component export cannot resolve.
import "katex/dist/katex.min.css";
