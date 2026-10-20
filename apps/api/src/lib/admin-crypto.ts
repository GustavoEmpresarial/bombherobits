import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scrypt=promisify(scryptCallback);
export const tokenHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function equalHash(value:string,hash:string){const actual=Buffer.from(tokenHash(value),"hex");const expected=Buffer.from(hash,"hex");return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export async function hashPassword(password:string){const salt=randomBytes(16).toString("hex");const key=await scrypt(password,salt,64) as Buffer;return "scrypt:"+salt+":"+key.toString("hex");}
export async function verifyPassword(password:string,encoded:string){const [method,salt,hash]=encoded.split(":");if(method!=="scrypt"||!salt||!hash)return false;const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hash,"hex");return key.length===expected.length&&timingSafeEqual(key,expected);}
