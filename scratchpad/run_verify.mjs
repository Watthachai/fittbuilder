// scratchpad/run_verify.mjs
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
function envValue(key){for(const f of[".env.local",".env"]){if(!existsSync(f))continue;const m=readFileSync(f,"utf8").match(new RegExp(`^${key}=(.*)$`,"m"));if(m)return m[1].trim().replace(/^["']|["']$/g,"");}return"";}
const url=envValue("DIRECT_URL")||envValue("DATABASE_URL");
execSync(`psql "$MIGRATE_DB_URL" -v ON_ERROR_STOP=1 -f "${process.argv[2]}"`,{stdio:"inherit",env:{...process.env,MIGRATE_DB_URL:url}});
