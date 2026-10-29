// Load the real shared presentation components in the existing CommonJS test harness.
const {buildSync}=require('esbuild');
const path=require('node:path');
const moduleResult={exports:{}};
const output=buildSync({entryPoints:[path.resolve(__dirname,'../src/components/ArenaPresentation.jsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react']}).outputFiles[0].text;
new Function('require','module','exports',output)(require,moduleResult,moduleResult.exports);
module.exports=moduleResult.exports;
