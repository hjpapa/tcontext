import { randomBytes, scrypt } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 3;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

function upsertEnv(content, name, value, newline) {
  const entry = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, entry);
  const suffix =
    content.length === 0 || content.endsWith(newline) ? "" : newline;
  return `${content}${suffix}${entry}${newline}`;
}

const workspace = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
if (packageJson.name !== "tcontext") {
  throw new Error("TContext 저장소 루트에서 실행해 주세요.");
}

const target = path.join(workspace, ".env.local");
try {
  const stats = await lstat(target);
  if (stats.isSymbolicLink())
    throw new Error(".env.local 심볼릭 링크는 지원하지 않습니다.");
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  ) {
    // The file is created below.
  } else {
    throw error;
  }
}

let content = "";
try {
  content = await readFile(target, "utf8");
} catch (error) {
  if (!(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  )) {
    throw error;
  }
}

const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16);
const digest = await derive(password, salt);
const passwordHash = [
  "scrypt",
  "v1",
  COST,
  BLOCK_SIZE,
  PARALLELIZATION,
  salt.toString("base64url"),
  digest.toString("base64url"),
].join("$");
const sessionSecret = randomBytes(32).toString("base64url");
const newline = content.includes("\r\n") ? "\r\n" : "\n";

content = upsertEnv(content, "ADMIN_PASSWORD_HASH", passwordHash, newline);
content = upsertEnv(content, "ADMIN_SESSION_SECRET", sessionSecret, newline);
content = upsertEnv(content, "ADMIN_SESSION_TTL_HOURS", "8", newline);
await writeFile(target, content, { encoding: "utf8", mode: 0o600 });

console.log("관리자 자격증명을 .env.local에 저장했습니다.");
console.log(`관리자 비밀번호(지금 한 번만 표시됨): ${password}`);
console.log("이 비밀번호를 안전한 비밀번호 관리자에 보관하세요.");
