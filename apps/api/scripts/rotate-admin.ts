import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword, tokenHash } from '../src/lib/admin-crypto.js';
try {
 const username=process.argv.slice(2).find(arg=>arg!=='--');
 const admins=await prisma.adminUser.findMany({where:username?{username}:{disabled:false}});
 if(admins.length!==1)throw new Error('Informe o usuário administrativo: pnpm --filter @herobits/api admin:rotate -- usuario');
 const admin=admins[0];
 const env=await readFile('.env','utf8');
 const path='/_ops-'+randomBytes(18).toString('hex');
 const token=randomBytes(32).toString('base64url');
 const password=randomBytes(24).toString('base64url');
 const passwordHash=await hashPassword(password);
 const clean=env.split(/\r?\n/).filter(line=>!/^ADMIN_(PATH|ACCESS_TOKEN_HASH)=/.test(line)).join('\n').trimEnd();
 const credentials='HeroBits — acesso administrativo local\n\nURL: http://127.0.0.1:3001'+path+'#access='+token+'\nUsuário: '+admin.username+'\nSenha: '+password+'\nToken de acesso: '+token+'\n\nArquivo privado de acesso. Não publique nem adicione ao Git.\n';
 await prisma.$transaction(async tx=>{
  await tx.adminUser.update({where:{id:admin.id},data:{passwordHash,disabled:false}});
  await tx.adminSession.deleteMany({});
  await writeFile('.env',clean+'\n\nADMIN_PATH='+path+'\nADMIN_ACCESS_TOKEN_HASH='+tokenHash(token)+'\n');
  await writeFile('../../.admin-access.txt',credentials,{mode:0o600});
 });
 console.log('Senha, token e rota renovados; sessões revogadas. Consulte .admin-access.txt e reinicie a API.');
}finally{await prisma.$disconnect();}
