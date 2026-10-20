import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword, tokenHash } from '../src/lib/admin-crypto.js';
import { getSettings } from '../src/services/config.js';
try {
 if(process.env.ADMIN_PATH||await prisma.adminUser.count())throw new Error('Administração já configurada. Use o procedimento de rotação documentado.');
 const path='/_ops-'+randomBytes(18).toString('hex');const token=randomBytes(32).toString('base64url');const password=randomBytes(24).toString('base64url');const username='owner-'+randomBytes(4).toString('hex');
 await prisma.adminUser.create({data:{username,passwordHash:await hashPassword(password)}});
 const env=await readFile('.env','utf8');await writeFile('.env',env+'\nADMIN_PATH='+path+'\nADMIN_ACCESS_TOKEN_HASH='+tokenHash(token)+'\n');
 await getSettings();
 const content='HeroBits — acesso administrativo local\n\nURL: http://127.0.0.1:3001'+path+'#access='+token+'\nUsuário: '+username+'\nSenha: '+password+'\nToken de acesso: '+token+'\n\nArquivo privado de acesso. Não publique nem adicione ao Git.\n';
 await writeFile('../../.admin-access.txt',content,{flag:'wx',mode:0o600});
 console.log('Administração configurada. Credenciais salvas em .admin-access.txt na raiz do projeto.');
}finally{await prisma.$disconnect();}
