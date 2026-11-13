import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const root = resolve(process.cwd(), option("--root", process.env.EVAL_ROOT ?? "eval/pages"));
const host = option("--host", process.env.HOST ?? "127.0.0.1");
const port = Number.parseInt(option("--port", process.env.PORT ?? "4173"), 10);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".opus": "audio/ogg",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  const file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`[eval] serving ${root} at http://${host}:${port}/`);
});
