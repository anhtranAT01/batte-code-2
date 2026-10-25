import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
function offlineBuild(){return {name:'offline-package',apply:'build',async generateBundle(options,bundle){
  const engine=await build({entryPoints:[path.resolve('src/offline/engine.cjs')],bundle:true,write:false,platform:'browser',format:'iife',minify:true});
  this.emitFile({type:'asset',fileName:'offline-engine.js',source:engine.outputFiles[0].text});
  const assets=[...new Set([...Object.keys(bundle).filter(name=>!name.endsWith('.map')).map(name=>'/'+name),'/offline-engine.js','/index.html'])];
  const template=fs.readFileSync(path.resolve('src/offline/service-worker.js'),'utf8');
  this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__BUILD_ID__',Date.now().toString(36)).replace('__ASSETS__',JSON.stringify(assets))});
}};}

export default defineConfig({
  plugins: [react(),offlineBuild()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
