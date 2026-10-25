const {parentPort,workerData}=require('worker_threads');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {execFileSync}=require('child_process');
const {getPythonCommand}=require('../game/pythonRunner');
const {validateBotExecution}=require('../bot/botValidation');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rps-validation-'));
  try {
    const file=path.join(dir,'bot.py');fs.writeFileSync(file,workerData.source.replace(/^\uFEFF/,''),'utf8');
    try {execFileSync(getPythonCommand(),['-m','py_compile',file],{timeout:3000,stdio:'pipe'});}
    catch(error) {throw Object.assign(new Error(error.stderr?.toString()||error.message),{statusCode:error.code==='ENOENT'?503:422});}
    await validateBotExecution(file);
    parentPort.postMessage({ok:true});
  } catch(error) {
    parentPort.postMessage({ok:false,statusCode:/PROCESS_SPAWN_ERROR/.test(error.message)?503:error.statusCode||503,message:error.message.slice(0,2000)});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
})();
