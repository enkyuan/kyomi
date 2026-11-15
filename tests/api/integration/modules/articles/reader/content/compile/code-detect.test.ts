import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

/**
 * Regression tests for unhinted code-block classification. Colouring is asserted by comparing
 * the stored tokens with the tokens the same text gets under an explicit hint for the expected
 * language, so a wrong colour or label fails.
 */
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pre = (value: string, attributes = "") =>
  `<pre${attributes}><code>${escape(value)}</code></pre>`;

async function codeBlocks(html: string) {
  const draft = await runThrough(html, "code");
  return draft.blocks.filter((block) => block.type === "code");
}

async function first(value: string, before = "") {
  const blocks = await codeBlocks(`${before}${pre(value)}`);
  const block = blocks.at(-1);
  if (!block) {
    throw new Error("expected a code block");
  }
  return block;
}

async function expectColour(value: string, language: string, before = "") {
  const detected = await first(value, before);
  const hinted = await first(value, "").then(() =>
    codeBlocks(pre(value, ` data-lang="${language}"`)),
  );
  // Colour and label are one decision: the block names the language it is coloured as.
  expect(detected.language).toBe(hinted[0]?.language ?? undefined);
  expect(detected.label).toBe(hinted[0]?.label ?? undefined);
  expect(detected.languageSource).toBe("classifier");
  expect(detected.highlight).toBeDefined();
  expect(detected.highlight).toEqual(hinted[0]?.highlight);
}

async function expectPlain(value: string, before = "") {
  const block = await first(value, before);
  expect(block.highlight).toBeUndefined();
  expect(block.language).toBeNull();
}

describe("code detection: shell", () => {
  test.each([
    ["package manager with many names", "brew cask install firefox blender handbrake vlc"],
    ["npx scaffolding", "npx shadcn@latest add button card input badge avatar"],
    ["sudo with a tool that is not on the list", "sudo usermod -aG docker $USER"],
    ["an unknown tool with a long flag", "prometheus --enable-feature=native-histograms"],
    ["continuation lines", `kubectl apply \\\n  --server-side \\\n  -f deployment.yaml`],
    ["heredoc body", `cat <<EOF | tee main.tf\nresource "x" "y" {\n}\nEOF`],
    ["string left open over several lines", `mkdir app\ncd app\necho "\nimport os\nprint(1)`],
    ["pipe into an ambiguous command", "diff <(ls dir1) <(ls dir2)"],
  ])("colours %s as shell", async (_name, value) => {
    await expectColour(value, "shellscript");
  });

  test("a transcript with output is a shell session, prompts of several shapes", async () => {
    await expectColour(
      `$ docker run --name my-app app:2.1\nError: DATABASE_URL is not set.\n`,
      "shellsession",
    );
    await expectColour(
      `[hadoop@cluster01 ~]$ hdfs dfs -test -d /user/hive\n[hadoop@cluster01 ~]$ echo $?\n0`,
      "shellsession",
    );
    await expectColour(
      `user@host:~$ ls -la\ntotal 8\ndrwxr-xr-x 2 user user 4096 .`,
      "shellsession",
    );
  });

  test.each([
    ["a module export", `export const customResource = backend.createStack("Stack");`],
    ["a lone assignment", `IsClusteringEnabled="True"`],
    ["a sentence that starts with a command word", `find the best way to do it in your own time`],
    ["an ambiguous command without arguments", `open the file`],
  ])("does not treat %s as shell", async (_name, value) => {
    await expectPlain(value);
  });
});

describe("code detection: data and markup shapes", () => {
  test("json, jsonc, and elided json", async () => {
    await expectColour(`{\n  "name": "gawain",\n  "version": "0.1.0"\n}`, "json");
    await expectColour(`{\n  // the port\n  "port": 8080,\n  "host": "x",\n}`, "jsonc");
    await expectColour(
      `{\n  "message": "ok",\n  "download_url": "https://<bucket>.s3.amazonaws.com/x",\n  "id": 1\n`,
      "json",
    );
  });

  test("yaml with comments and block scalars, but not prose with colons or python", async () => {
    await expectColour(
      `name: ci\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read  # least privilege by default\n  packages: write  # push the image to the registry we use\n`,
      "yaml",
    );
    await expectColour(
      `steps:\n- bash: |\n    echo "hello"\n    echo "again"\n- script: make\n`,
      "yaml",
    );
    await expectPlain(
      `Criterion: 1. dotnet build exits with code 0\nStatus: PASS\nOwner: Platform\n`,
    );
    await expectPlain(`if ready:\n    go()\nelse:\n    wait()\n`);
  });

  test("html is lowercase tags, xml (and xaml) is everything else, embedded script is html", async () => {
    await expectColour(`<div class="a">\n  <p>Hello</p>\n</div>`, "html");
    await expectColour(`<Grid>\n  <Label Text="Hi" />\n  <Button Content="Go" />\n</Grid>`, "xml");
    await expectColour(`<?xml version="1.0"?>\n<root>\n  <item id="1"/>\n</root>`, "xml");
    await expectColour(`<script type="text/javascript">\n  var a = {{ b }};\n</script>`, "html");
  });

  test("jsx is not markup", async () => {
    const block = await first(`const App = () => {\n  return <div className="a">{x}</div>;\n};\n`);
    // either plain or labelled and coloured as script, never as html
    expect(block.language).not.toBe("html");
    const html = await codeBlocks(
      pre(`const App = () => {\n  return <div className="a">{x}</div>;\n};\n`, ` data-lang="html"`),
    );
    expect(block.highlight).not.toEqual(html[0]?.highlight);
  });

  test("css and scss rules", async () => {
    await expectColour(`thead {\n  position: relative;\n}\nthead tr th {\n  left: 0;\n}`, "css");
    await expectColour(
      `$gap: 4px;\n.a {\n  margin: $gap;\n  &:hover {\n    color: red;\n  }\n}`,
      "scss",
    );
  });

  test("sql statements, lowercase and after a comment", async () => {
    await expectColour(
      `create table test (id int primary key, name text);\ninsert into test values (1, 'a');`,
      "sql",
    );
    await expectColour(
      `-- Session 1:\nupdate test set in_stock = in_stock - 25 where id = 1;\n`,
      "sql",
    );
    await expectColour(`SELECT id, name\nFROM users\nWHERE id = 1;`, "sql");
    await expectPlain(`Select the file you want to open from the list on the left, then continue.`);
  });

  test("diff, dockerfile, http and toml", async () => {
    await expectColour(
      `diff --git a/a.json b/a.json\n--- a/a.json\n+++ b/a.json\n@@ -1 +1 @@\n-1\n+2`,
      "diff",
    );
    await expectColour(
      `FROM node:22\nWORKDIR /app\nCOPY . .\nRUN npm ci \\\n  && npm run build\nCMD ["node", "x.js"]`,
      "docker",
    );
    await expectColour(`HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"a": 1}`, "http");
    await expectColour(
      `GET /api/v2/posts?sort=top HTTP/1.1\nHost: api.service.com\nAccept: */*`,
      "http",
    );
    await expectColour(`[tool.gawain]\nmode = "strict"`, "toml");
  });

  test("a command that mentions a toml file stays a command", async () => {
    await expectColour(
      `docker cp mongooseim:/usr/lib/mongooseim/etc/mongooseim.toml .`,
      "shellscript",
    );
  });

  test("visual basic", async () => {
    await expectColour(`Sub Hello()\n    Dim a As Integer\n    a = 1\nEnd Sub`, "vb");
  });
});

describe("code detection: text that is not code", () => {
  test.each([
    [
      "pytest output",
      `============================= test session starts ==============================\ncollected 214 items\ntests/test_orders.py ....F..    [100%]\n`,
    ],
    [
      "a git transcript",
      `remote: Enumerating objects: 89, done.\nremote: Counting objects: 100% (68/68), done.\n`,
    ],
    [
      "a stack trace",
      `Traceback (most recent call last):\n  File "a.py", line 3, in <module>\n    boom()\nValueError: nope\n`,
    ],
    [
      "timestamped logs",
      `2024-05-01 12:00:01 INFO starting\n2024-05-01 12:00:02 WARN slow\n2024-05-01 12:00:03 ERROR boom\n`,
    ],
    ["a box-drawing tree", `Session: my-project\n  ├── Window 0\n  ├── Window 1\n  └── Window 2\n`],
    ["a markdown table", `| a | b |\n|---|---|\n| 1 | 2 |\n`],
    ["a fenced markdown block", "```bash\npython -m tool cleanup\n```\n"],
    [
      "a table of contents",
      `1  Introduction. . . . . . . 1\n2  Getting Started . . . . . 2\n3  Viewing Photos . . . . . 5\n`,
    ],
    [
      "prose",
      `Shared hosting is one of the two basic types of hosting around. It is the most cost effective option for small sites that do not need much.\nThe dedicated option costs more but gives full control of the machine.\n`,
    ],
  ])("leaves %s plain", async (_name, value) => {
    await expectPlain(value);
  });
});

describe("code detection: the model proposes and the syntax disposes", () => {
  test("python the model ranks as javascript is still python", async () => {
    await expectColour(
      `from flashrank import Ranker, RerankRequest\nimport pandas as pd\n\n\ndef get_ranked_chunks(query: str, top: int = 5):\n    conditions = {}\n    return conditions\n`,
      "python",
    );
  });

  test("c# with typed members is not typescript", async () => {
    await expectColour(
      `public async Task<List<Flag>> GetFlagsAsync(string key)\n{\n    var cache = new Cache();\n    var flags = await cache.GetAsync(key);\n    return flags;\n}\n`,
      "csharp",
    );
  });

  test("elixir is not ruby", async () => {
    await expectColour(
      `defmodule Web.Router do\n  scope "/auth" do\n    pipe_through :ceremony\n  end\nend\n`,
      "elixir",
    );
  });

  test("a guess whose language the text cannot be is dropped", async () => {
    await expectPlain(
      `Step type: Custom JAR\nName: Move\nMain class :None\nAction on failure:Continue\n`,
    );
  });
});

describe("code detection: article context", () => {
  const csharpArticle = pre(
    `public class Foo\n{\n    public int A { get; set; }\n}`,
    ` data-lang="csharp"`,
  );

  test("the article's declared language colours a snippet the model cannot place", async () => {
    const snippet = `var game = new BoardGame();\ngame.Name = "x";\nConsole.WriteLine(game.Name);`;
    await expectColour(snippet, "csharp", csharpArticle);
  });

  test("a prior never colours a block that does not fit its language", async () => {
    await expectColour(`$ dotnet new console\n$ dotnet run`, "shellscript", csharpArticle);
    await expectColour(`{\n  "a": 1,\n  "b": 2\n}`, "json", csharpArticle);
    await expectPlain(
      `2024-05-01 12:00:01 INFO starting\n2024-05-01 12:00:02 WARN slow\n`,
      csharpArticle,
    );
  });

  test("a paragraph that names one language tips an ambiguous block", async () => {
    const value = `def main():\n    run()\n`;
    const named = await codeBlocks(`<p>Here is the Python entry point:</p>${pre(value)}`);
    const hinted = await codeBlocks(pre(value, ` data-lang="python"`));
    expect(named[0]?.highlight).toEqual(hinted[0]?.highlight);
    expect(named[0]).toMatchObject({ language: "python", label: "Python", languageSource: "classifier" });
  });

  test("a paragraph that names two languages is no cue", async () => {
    const blocks = await codeBlocks(
      `<p>Unlike Ruby, the Python version is short:</p>${pre(`x = 1\ny = 2`)}`,
    );
    expect(blocks[0]?.highlight).toBeUndefined();
  });
});

describe("code labels from a named file", () => {
  const labelOf = async (intro: string, value: string) => {
    const [block] = await codeBlocks(`<p>${intro}</p>${pre(value)}`);
    return block;
  };

  test("a command that merely mentions the file is not the file", async () => {
    const block = await labelOf(`Apply <code>app.yaml</code>:`, `kubectl apply -f app.yaml`);
    expect(block).toMatchObject({ language: "shellscript", languageSource: "classifier" });
  });

  test("a script that imports the file is not the file", async () => {
    const block = await labelOf(
      `The config lives in <code>outputs.json</code>.`,
      `import outputs from "./outputs.json";\nAmplify.configure(outputs);\nconst a = 1;\n`,
    );
    expect(block?.language).not.toBe("json");
  });

  test("the file's own content takes its label, and html is not xml", async () => {
    const yaml = await labelOf(`Edit <code>ci.yml</code>:`, `name: ci\non:\n  push:\n`);
    expect(yaml).toMatchObject({ language: "yaml", languageSource: "filename" });
    const xml = await labelOf(`Edit <code>web.xml</code>:`, `<web-app>\n  <servlet/>\n</web-app>`);
    expect(xml).toMatchObject({ language: "xml", languageSource: "filename" });
    const wrong = await labelOf(`Edit <code>index.xml</code>:`, `<div>\n  <p>hi</p>\n</div>`);
    expect(wrong?.language).not.toBe("xml");
  });

  test("output named with a file is never labelled", async () => {
    const block = await labelOf(
      `Running <code>app.log</code> prints:`,
      `2024-05-01 12:00:01 INFO starting\n2024-05-01 12:00:02 WARN slow\n`,
    );
    expect(block).toMatchObject({ language: null });
    expect(block?.highlight).toBeUndefined();
  });
});

describe("code detection is deterministic and never labels", () => {
  test("a detected block is labelled with the language it is coloured as", async () => {
    const block = await first(
      `import os\nfrom pathlib import Path\n\ndef main():\n    print(Path.cwd())\n`,
    );
    expect(block).toMatchObject({ language: "python", languageSource: "classifier", label: "Python" });
    expect(block.highlight).toBeDefined();
  });

  test("the same block detects the same way regardless of what ran before", async () => {
    const value = `defmodule A do\n  def a, do: 1\nend\n`;
    const one = await first(value);
    await first(`SELECT 1;`);
    const two = await first(value);
    expect(two.highlight).toEqual(one.highlight);
  });
});
