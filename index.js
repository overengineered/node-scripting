const fs = require("fs-extra");
const fetch = require("node-fetch");
const util = require("util");
const xp = require("./xp");
const { exec } = require("child_process");
const execAsync = util.promisify(exec);

const context = { wd: "*", home: "*" };

function main(origin, script) {
  if (require.main === origin) {
    context.wd = process.cwd();
    context.home = process.env.HOME;
    const run = async () => await script();
    run().catch((e) => {
      if (e.silenced !== true) {
        process.stderr.write(util.inspect(e) + "\n");
      }
      process.exit(1);
    });
  }
  return script;
}

async function loadJson(file, fallback) {
  if (arguments.length > 1 && !fs.existsSync(file)) {
    return fallback;
  }
  return JSON.parse(await fs.readFile(file, { encoding: "utf-8" }));
}

async function saveJson(file, data, indentation = 2) {
  return fs.writeFile(file, JSON.stringify(data, undefined, indentation));
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
  items.forEach((e) =>
    process.stdout.write(typeof e === "string" ? e : util.inspect(e))
  );
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
  const output = sharp(stdout);
  const errors = sharp(stderr);
  if (output && errors) {
    throw Object.assign(new Error("Command failed"), { output });
  } else {
    return output || errors;
  }
}

function collectOutput(commands, { printCommand = false, ...rest } = {}) {
  return each(commands, async (raw) => {
    const command = cmd(raw);
    if (printCommand) {
      console.log(command);
    }
    return readOutput(execAsync(cmd(command), { encoding: "utf-8", ...rest }));
  });
}

function printOutput(commands, { printCommand = true, ...rest } = {}) {
  return each(commands, (raw) => {
    const command = cmd(raw);
    if (printCommand) {
      console.log(command);
    }
    return new Promise((resolve, reject) => {
      exec(command, { encoding: "utf-8", ...rest }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          console.log(stdout);
          if (stderr) {
            reject(new Error("\n" + stderr));
          } else {
            resolve(true);
          }
        }
      });
    });
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
  const fn = opt || target;
  return async (...args) => {
    const start = process.hrtime();
    const result = await fn(...args);
    const end = process.hrtime(start);
    const label =
      typeof target === "string"
        ? target
        : target === main
        ? contextual(process.argv[1])
        : opt.name;
    console.log(`${label} execution time ${formatDuration(end)}`);
    return result;
  };
}

function cmd(text) {
  return text.replace(/\n\s*/g, " ");
}

function coerce(value, optional = value) {
  return optional;
}

function sharp(text) {
  return text[text.length - 1] === "\n"
    ? text.substring(0, text.length - 1)
    : text;
}

const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(resolve, ms, value));

function timeout(ms, promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(reject, ms)),
  ]);
}

function failWith(message) {
  if (message) {
    throw message instanceof Error ? message : new Error(message);
  }
}

module.exports = {
  main: Object.assign(main, {
    timed: (origin, script) => main(origin, timed(main, script)),
  }),
  print: Object.assign((...args) => printPretty(args), {
    bare: (...args) => printBare(args),
    one: (v) => printPretty([v]),
  }),
  exec: Object.assign(collectOutput, {
    io: printOutput,
    log: (cmd, options) =>
      collectOutput(cmd, { ...options, printCommand: true }),
  }),
  fetch,
  formatDuration,
  contextual,
  fs,
  env: {
    text: (key, defaultValue = "") =>
      String(coerce(defaultValue, process.env[key])),
    bool: (key) => !!process.env[key],
    int: (key) => parseInt(process.env[key]),
  },
  timed,
  delay,
  timeout,
  failWith,
  loadJson,
  saveJson,
  xp,
};
