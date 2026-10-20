import 'dotenv/config';
import {prisma} from '../src/lib/prisma.js';
import {getSettings,saveSection} from '../src/services/config.js';
import {spawnTargets} from '../src/services/dungeon.js';
try {
 const settings=await getSettings();
 const admin=await prisma.adminUser.findFirstOrThrow({where:{disabled:false},orderBy:{createdAt:'asc'}});
 if(settings.config.game.TARGET_COUNT!==60)await saveSection(admin.id,'game',{...settings.config.game,TARGET_COUNT:60},settings.revision);
 const runs=await prisma.dungeonRun.findMany({where:{status:'ACTIVE',waveTotal:{lt:60}}});
 let added=0;
 for(const run of runs){
  const count=await spawnTargets(run.id,60-run.waveTotal);
  await prisma.dungeonRun.update({where:{id:run.id},data:{waveTotal:{increment:count}}});
  added+=count;
 }
 console.log(JSON.stringify({targetCount:60,expandedRuns:runs.length,addedChests:added}));
}finally{await prisma.$disconnect();}
