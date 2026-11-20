import { Glob } from "bun";
import { relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dir, "..");
const styleProps = new Set(["className", "style"]);
const variantProps = new Set([
  "align",
  "appearance",
  "axis",
  "checked",
  "disabled",
  "indicator",
  "loading",
  "mode",
  "orientation",
  "placement",
  "position",
  "selected",
  "shape",
  "side",
  "size",
  "static",
  "tone",
  "type",
  "unstyled",
  "variant",
]);

function inline(source: string) {
  const text = source.replace(/\s+/g, " ").trim();
  const fence = "`".repeat(
    1 + Math.max(0, ...Array.from(text.matchAll(/`+/g), ([run]) => run.length)),
  );
  return `${fence} ${text} ${fence}`;
}

function context(node: ts.Node): string {
  const parents: string[] = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && parent.openingElement !== node) {
      parents.unshift(parent.openingElement.tagName.getText());
    }
    if (ts.isFunctionDeclaration(parent) && parent.name) {
      return [parent.name.text, ...parents].join(" → ");
    }
    if (ts.isVariableDeclaration(parent)) {
      return [parent.name.getText(), ...parents].join(" → ");
    }
  }
  return parents.join(" → ") || "module";
}

function note(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, file: ts.SourceFile) {
  const tag = node.tagName.getText(file);
  if (!/^[A-Z]|\./.test(tag)) return;

  const props = node.attributes.properties;
  const attrs = (keys: Set<string>) =>
    props.filter((prop) => ts.isJsxAttribute(prop) && keys.has(prop.name.getText(file)));
  const variants = attrs(variantProps);
  const styling = attrs(styleProps);
  const tokens = [
    ...new Set(
      styling.flatMap((prop) => prop.getText(file).match(/(?<![\w-])--[a-z][\w-]*/g) ?? []),
    ),
  ];
  const line = 1 + file.getLineAndCharacterOfPosition(node.getStart(file)).line;
  const path = relative(root, file.fileName);
  const show = (attributes: readonly ts.Node[], fallback: string) =>
    attributes.length ? attributes.map((prop) => inline(prop.getText(file))).join(", ") : fallback;

  const notes = [
    `Variants ${show(variants, "inherit defaults")}`,
    `styling ${show(styling, "from component")}`,
    `CSS variables ${tokens.length ? tokens.map(inline).join(", ") : "from component or utility scale"}`,
  ];
  if (props.some(ts.isJsxSpreadAttribute)) notes.push("forwards spread props");

  return `- [${line}](${path}#L${line}) ${inline(tag)} in ${inline(context(node))}. ${notes.join(" · ")}.`;
}

const files = [...new Glob("src/**/*.tsx").scanSync({ cwd: root })].sort();
const sources = await Promise.all(
  files.map(async (path) => {
    const absolute = resolve(root, path);
    return { path, absolute, text: await Bun.file(absolute).text() };
  }),
);
const sections: string[] = [];
let count = 0;
for (const { path, absolute, text } of sources) {
  const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
  const notes: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const entry = note(node, source);
      if (entry) notes.push(entry);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (notes.length) {
    count += notes.length;
    sections.push(`## [${path}](${path})\n\n${notes.join("\n")}`);
  }
}

const intro = `# Component usage in @kyomi/ui

This inventory covers ${count} JSX component instances across ${sections.length} source files.
Each entry gives the containing function and JSX ancestry, variant and state props at the call
site, local styling, and explicit CSS variables. Tailwind utility names indicate their underlying
scale or semantic role. Expressions and spread props can also resolve styles at runtime.

Use the [primitive catalog](primitives.md) for defaults, semantic tokens, and intended use.
Intrinsic HTML/SVG elements and direct \`useRender\` calls are covered by the family entry and the
linked implementation. To regenerate this inventory, run \`bun run --cwd packages/ui audit:primitives\`.

`;
await Bun.write(resolve(root, "primitive-usage.md"), `${intro}${sections.join("\n\n")}\n`);
