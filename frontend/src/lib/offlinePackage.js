const VERSION='0.27.7';
const CACHE='battlecode-python-'+VERSION;
const FILES=['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'];
export async function runtimeAssets(){
  const cache=await caches.open(CACHE),assets={};
  for(const file of FILES){const response=await cache.match('/offline-runtime/'+file);if(!response)throw new Error('Chưa có đủ gói Python ngoại tuyến. Hãy tải gói khi còn mạng.');assets[file]=await response.arrayBuffer();}
  return assets;
}
export async function downloadOfflinePackage(progress){
  if(!('serviceWorker' in navigator)||!('caches' in globalThis))throw new Error('Cần HTTPS hoặc localhost để lưu gói ngoại tuyến.');
  const registration=await navigator.serviceWorker.ready;
  const ready=registration.waiting||registration.active;
  if(!ready)throw new Error('Trang chưa sẵn sàng ngoại tuyến. Hãy tải lại trang khi có mạng.');
  await new Promise((resolve,reject)=>{
    const channel=new MessageChannel();const timer=setTimeout(()=>reject(new Error('Tải giao diện quá lâu. Hãy thử lại.')),60000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.ok?resolve():reject(new Error(event.data.error));};
    ready.postMessage({type:'CACHE_APP'},[channel.port2]);
  });
  const cache=await caches.open(CACHE);let bytes=0;
  for(let i=0;i<FILES.length;i++){
    const file=FILES[i];let response=await cache.match('/offline-runtime/'+file);
    if(!response){response=await fetch(`https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/${file}`,{credentials:'omit'});if(!response.ok)throw new Error('Không tải được '+file);await cache.put('/offline-runtime/'+file,response.clone());}
    bytes+=(await response.arrayBuffer()).byteLength;progress?.(`Đã tải ${i+1}/${FILES.length} tệp Python · ${(bytes/1048576).toFixed(1)} MB`);
  }
  await runtimeAssets();
  await navigator.storage?.persist?.();
  return bytes;
}
// Opaque-origin iframe: uploaded Python has no access to site cookies, tokens,
// IndexedDB or network. Its worker receives only code, game input and runtime bytes.
const pythonProgram=`import sys, io, json
class LimitedOutput(io.StringIO):
 def write(self,s):
  if self.tell()+len(s)>131072: raise RuntimeError('STDOUT quá lớn')
  return super().write(s)
_output=LimitedOutput()
_saved=(sys.stdin,sys.stdout,sys.stderr)
sys.stdin=io.StringIO(_input)
sys.stdout=_output
sys.stderr=LimitedOutput()
try:
 exec(compile(_source.lstrip('\\ufeff'), 'bot.py', 'exec'), {'__name__':'__main__'})
finally:
 sys.stdin,sys.stdout,sys.stderr=_saved
_output.getvalue()`;
const pythonWorker=`
let runtime;
onmessage=async event=>{
 try {
  if(event.data.type==='init'){
   const assets=event.data.assets;
   self.fetch=async url=>{const name=String(url).split('/').pop();if(!assets[name])throw Error('Network disabled: '+name);return new Response(assets[name],{headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'}});};
   runtime=await loadPyodide({indexURL:'https://offline.invalid/',stdout:()=>{},stderr:()=>{}});
   self.fetch=()=>Promise.reject(Error('Network disabled'));self.importScripts=()=>{throw Error('Imports disabled');};
   postMessage({type:'ready'});return;
  }
  runtime.globals.set('_source',event.data.source);runtime.globals.set('_input',JSON.stringify(event.data.input));
  const output=runtime.runPython(${JSON.stringify(pythonProgram)});
  const lines=output.trim().split('\\n');postMessage({type:'move',move:JSON.parse(lines[lines.length-1])});
 }catch(error){postMessage({type:'error',message:String(error.message).slice(0,2000)});}
};`;
export const sandboxDocument=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'">
<script>
let worker;
const workerBody=${JSON.stringify(pythonWorker)};
onmessage=event=>{
 if(event.source!==parent)return;
 if(event.data.type==='init'){
  worker?.terminate();
  const assets=event.data.assets,decode=new TextDecoder();
  const blob=new Blob([decode.decode(assets['pyodide.js']),'\\n',decode.decode(assets['pyodide.asm.js']),'\\n',workerBody],{type:'text/javascript'});
  const url=URL.createObjectURL(blob);worker=new Worker(url);URL.revokeObjectURL(url);
  worker.onmessage=e=>parent.postMessage(e.data,'*');worker.onerror=e=>parent.postMessage({type:'error',message:'Không khởi động được Python ngoại tuyến: '+e.message},'*');
 }
 if(event.data.type==='stop'){worker?.terminate();return;}
 worker?.postMessage(event.data);
};
parent.postMessage({type:'sandbox-ready'},'*');
</script>`;
