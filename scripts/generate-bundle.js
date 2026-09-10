import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apphostingDir = path.join(rootDir, ".apphosting");

if (!fs.existsSync(apphostingDir)) {
  fs.mkdirSync(apphostingDir, { recursive: true });
}

const content = `version: v1
runConfig:
  runCommand: node dist/index.js
`;

fs.writeFileSync(path.join(apphostingDir, "bundle.yaml"), content, "utf-8");
console.log("Generated .apphosting/bundle.yaml successfully");
