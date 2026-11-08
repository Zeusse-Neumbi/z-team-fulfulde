import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
    return null;
  }
}

function requireFile(file) {
  if (!existsSync(path.join(root, file))) {
    fail(`missing required file: ${file}`);
  }
}

function frontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return {};
  const end = markdown.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = markdown.slice(4, end);
  const values = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function globMatches(pattern) {
  if (!pattern.includes("*")) {
    return existsSync(path.join(root, pattern));
  }
  const directory = path.dirname(pattern);
  const base = path.basename(pattern);
  const escaped = base
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const matcher = new RegExp(`^${escaped}$`);
  const fullDirectory = path.join(root, directory);
  if (!existsSync(fullDirectory)) return false;
  return readdirSync(fullDirectory).some((entry) => matcher.test(entry));
}

requireFile("AGENTS.md");
requireFile("CONTRIBUTING.md");
requireFile("LICENSE");
requireFile("LICENSING.md");
requireFile("docs/AI_WORKFLOW.md");
requireFile("docs/PROJECT_BOARD.md");
requireFile("docs/decisions/0005-noncommercial-license.md");
requireFile("docs/decisions/0006-upstream-skills-and-mcp.md");
requireFile(".env.example");
requireFile(".ai/rules/index.md");
requireFile(".github/copilot-instructions.md");
requireFile("CLAUDE.md");
requireFile(".cursor/rules/project.mdc");
requireFile(".opencode/skills/SOURCES.md");

const opencode = readJson("opencode.json");
if (opencode) {
  if (opencode.$schema !== "https://opencode.ai/config.json") {
    fail("opencode.json: $schema must be https://opencode.ai/config.json");
  }

  const instructions = Array.isArray(opencode.instructions) ? opencode.instructions : [];
  for (const required of [
    "AGENTS.md",
    ".ai/rules/index.md",
    "docs/PROJECT_BOARD.md",
    "docs/AI_WORKFLOW.md",
  ]) {
    if (!instructions.includes(required)) {
      fail(`opencode.json: instructions must include ${required}`);
    }
  }
  for (const instruction of instructions) {
    if (!globMatches(instruction)) {
      fail(`opencode.json: instruction path does not resolve: ${instruction}`);
    }
  }

  const servers = opencode.mcp?.servers;
  if (!servers || typeof servers !== "object") {
    fail("opencode.json: mcp.servers must be an object");
  } else {
    for (const required of ["context7", "playwright", "chrome-devtools", "huggingface"]) {
      if (!servers[required]) {
        fail(`opencode.json: mcp.servers must include ${required}`);
      }
    }
    for (const [name, server] of Object.entries(servers)) {
      if (!server || typeof server !== "object") {
        fail(`opencode.json: mcp.servers.${name} must be an object`);
        continue;
      }
      if (server.type === "local") {
        if (!Array.isArray(server.command) || server.command.length === 0) {
          fail(`opencode.json: mcp.servers.${name}.command must be a non-empty array`);
        }
      } else if (server.type === "remote") {
        if (typeof server.url !== "string" || !server.url.startsWith("http")) {
          fail(`opencode.json: mcp.servers.${name}.url must be an HTTP(S) URL`);
        }
      } else {
        fail(`opencode.json: mcp.servers.${name}.type must be local or remote`);
      }
    }
  }

  const commands = opencode.commands;
  if (!commands || typeof commands !== "object") {
    fail("opencode.json: commands must be an object");
  } else {
    for (const name of ["verify", "protected-audit", "project-sync", "release-check"]) {
      const command = commands[name];
      if (!command || typeof command.description !== "string" || typeof command.template !== "string") {
        fail(`opencode.json: command ${name} needs description and template`);
      }
    }
  }
}

const mcp = readJson(".mcp.json");
if (mcp) {
  const servers = mcp.mcpServers;
  if (!servers || typeof servers !== "object") {
    fail(".mcp.json: mcpServers must be an object");
  } else {
    for (const [name, server] of Object.entries(servers)) {
      if (!server || typeof server !== "object") {
        fail(`.mcp.json: mcpServers.${name} must be an object`);
        continue;
      }
      if (server.url) {
        if (typeof server.url !== "string" || !server.url.startsWith("http")) {
          fail(`.mcp.json: mcpServers.${name}.url must be an HTTP(S) URL`);
        }
      } else if (typeof server.command === "string") {
        if (server.args !== undefined && !Array.isArray(server.args)) {
          fail(`.mcp.json: mcpServers.${name}.args must be an array`);
        }
      } else {
        fail(`.mcp.json: mcpServers.${name} needs a command or url`);
      }
    }
  }
}

const rulesDirectory = path.join(root, ".ai/rules");
const ruleIndex = read(".ai/rules/index.md");
for (const entry of readdirSync(rulesDirectory)) {
  if (!entry.endsWith(".md") || entry === "index.md") continue;
  if (!ruleIndex.includes(entry)) {
    fail(`.ai/rules/index.md does not reference ${entry}`);
  }
}

const skillsDirectory = path.join(root, ".opencode/skills");
const skillIds = [];
for (const entry of readdirSync(skillsDirectory)) {
  const fullPath = path.join(skillsDirectory, entry);
  if (!statSync(fullPath).isDirectory()) continue;
  const skillPath = path.join(fullPath, "SKILL.md");
  if (!existsSync(skillPath)) {
    fail(`.opencode/skills/${entry}: missing SKILL.md`);
    continue;
  }
  if (!existsSync(path.join(fullPath, "SOURCE.md"))) {
    fail(`.opencode/skills/${entry}: missing SOURCE.md attribution`);
  }
  if (!existsSync(path.join(fullPath, "LICENSE.txt")) && !existsSync(path.join(fullPath, "LICENSE"))) {
    fail(`.opencode/skills/${entry}: missing LICENSE.txt`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry)) {
    fail(`.opencode/skills/${entry}: id must be lowercase kebab-case`);
  }
  const meta = frontmatter(readFileSync(skillPath, "utf8"));
  if (!meta.name) fail(`.opencode/skills/${entry}/SKILL.md: missing name`);
  if (!meta.description) fail(`.opencode/skills/${entry}/SKILL.md: missing description`);
  skillIds.push(entry);
}

const skillSources = read(".opencode/skills/SOURCES.md");
for (const skillId of skillIds) {
  if (!skillSources.includes(skillId)) {
    fail(`.opencode/skills/SOURCES.md does not list ${skillId}`);
  }
}

const aiWorkflow = read("docs/AI_WORKFLOW.md");
for (const skillId of skillIds) {
  if (!aiWorkflow.includes(skillId)) {
    fail(`docs/AI_WORKFLOW.md does not reference skill ${skillId}`);
  }
}

const license = read("LICENSE");
if (!license.includes("PolyForm Noncommercial License 1.0.0")) {
  fail("LICENSE must contain the PolyForm Noncommercial License 1.0.0 text");
}

const packageJson = readJson("package.json");
if (packageJson && packageJson.license !== "SEE LICENSE IN LICENSE") {
  fail("package.json: license must be SEE LICENSE IN LICENSE");
}

const envExample = read(".env.example");
for (const key of [
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GH_TOKEN",
  "HF_TOKEN",
  "CONTEXT7_API_KEY",
  "GITHUB_REPOSITORY",
  "PROJECT_NUMBER",
]) {
  if (!new RegExp(`^${key}=`, "m").test(envExample)) {
    fail(`.env.example: missing ${key}`);
  }
}
if (!/^\.env$/m.test(read(".gitignore")) && !/^\.env\.\*$/m.test(read(".gitignore"))) {
  fail(".gitignore: must exclude .env");
}

const secretPatterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/,
];

function scanForSecrets(file) {
  const content = read(file);
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      fail(`${file}: looks like it contains a secret (${pattern})`);
    }
  }
}

scanForSecrets("opencode.json");
scanForSecrets(".mcp.json");
scanForSecrets(".env.example");
scanForSecrets(".github/copilot-instructions.md");
scanForSecrets("CLAUDE.md");
scanForSecrets(".cursor/rules/project.mdc");
for (const entry of readdirSync(rulesDirectory)) {
  if (entry.endsWith(".md")) scanForSecrets(`.ai/rules/${entry}`);
}
for (const skillId of skillIds) {
  scanForSecrets(`.opencode/skills/${skillId}/SKILL.md`);
}

if (errors.length > 0) {
  console.error("AI configuration checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("AI configuration checks passed.");
console.log(`- ${skillIds.length} skills, ${readdirSync(rulesDirectory).filter((entry) => entry.endsWith(".md")).length - 1} path-scoped rules`);
console.log("- opencode.json, .mcp.json, instructions, licence and secret patterns are valid");
