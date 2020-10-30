const fs = require("fs");
const fetch = require("node-fetch");
const util = require("util");
const xp = require("./xp");
const { exec, execSync } = require("child_process");
const execAsync = util.promisify(exec);

const context = { wd: "*", home: "*" };

async function main(origin, script) {
  if (require.main === origin) {
    context.wd = process.cwd();
    context.home = process.env.HOME;
    return await script();
  }
}

function prepare(items, depth) {
  return items.map((data) => {
    const text = util.inspect(data, false, depth);
    return depth !== undefined && util.inspect(data) === text ? data : text;
  });
}

function printPretty(items) {
  const { log } = console;
  log.apply(console, items.length === 1 ? prepare(items, 99) : items);
  return items[0];
}

function printBare(items) {
  items.forEach((e) => process.stdout.write(util.inspect(e)));
  return items[0];
}

function mapSequentially(items, fn) {
  return items.reduce(
    (prev, item) => prev.then(async (result) => [...result, await fn(item)]),
    Promise.resolve([])
  );
}

async function each(stringOrArray, fn) {
  if (Array.isArray(stringOrArray)) {
    return await mapSequentially(stringOrArray, fn);
  } else {
    return fn(stringOrArray);
  }
}

async function readOutput(execution) {
  const { stdout, stderr } = await execution;
  return stderr ? stderr + "\n\n" + stdout.trim() : stdout.trim();
}

function collectOutput(commands) {
  return each(commands, async (command) =>
    readOutput(execAsync(cmd(command), { encoding: "utf-8" }))
  );
}

function printOutput(commands, { printCommand = true } = {}) {
  each(commands, (raw) => {
    const command = cmd(raw);
    if (printCommand) {
      printPretty([command]);
    }
    execSync(command, { stdio: "inherit" });
  });
}

function formatDuration(time, digits = 2) {
  if (Array.isArray(time)) {
    return `${time[0]}${(time[1] / 1000000000).toFixed(digits).substring(1)}s`;
  } else if (Number.isInteger(time)) {
    return (time / 1000).toFixed(2) + "s";
  }
}

function contextual(path) {
  return path.replace(context.wd, ".").replace(context.home, "~");
}

function timed(target, opt) {
  const label =
    typeof target === "string"
      ? target
      : target === main
      ? contextual(process.argv[1])
      : opt.name;
  const fn = opt || target;
  return async (...args) => {
    const start = process.hrtime();
    const result = await fn(...args);
    const end = process.hrtime(start);
    print(`${label} execution time ${formatDuration(end)}`);
    return result;
  };
}

function cmd(text) {
  return text.replace(/\n\s*/g, " ");
}

function coerce(value, optional = value) {
  return optional;
}

module.exports = {
  main: Object.assign(main, { timed: timed(main) }),
  print: Object.assign((...args) => printPretty(args), {
    bare: (...args) => printBare(args),
    one: (v) => printPretty([v]),
  }),
  exec: Object.assign(collectOutput, { io: printOutput }),
  fetch,
  formatDuration,
  contextual,
  fs: {
    ...fs.promises,
    exists: fs.existsSync,
    createReadStream: fs.createReadStream,
    createWriteStream: fs.createWriteStream,
    $: fs,
  },
  env: {
    text: (key, defaultValue = "") =>
      String(coerce(defaultValue, process.env[key])),
    bool: (key) => !!process.env[key],
    int: (key) => parseInt(process.env[key]),
  },
  timed,
  xp,
};
