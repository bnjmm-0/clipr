// PM2 : garde le site et le worker allumés, et les relance après un plantage ou un redémarrage.
const path = require("node:path");
const cwd = path.resolve(__dirname, "..");
const env = { NODE_ENV: "production", PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` };
module.exports = {
  apps: [
    { name: "clipr-web", cwd, script: "node_modules/next/dist/bin/next", args: "start -p 3000 -H 127.0.0.1", env },
    { name: "clipr-worker", cwd, script: "node_modules/tsx/dist/cli.mjs", args: "worker/index.ts", env, kill_timeout: 30000 },
  ],
};
