'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const net = require('node:net');

async function freePort() {
  const s = net.createServer();
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}

async function waitFor(url) {
  for (let i=0; i<40; i++) {
    try { const r=await fetch(url); if(r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r, 100));
  }
  throw new Error('Gateway not ready');
}

test('routes, body transparency, security, config, status, credits', async () => {
  const upstreamRequests=[];
  const upstream=http.createServer(async (req,res) => {
    const chunks=[];
    for await(const c of req) chunks.push(c);
    const payload=Buffer.concat(chunks).toString();
    upstreamRequests.push({method:req.method,url:req.url,payload,auth:req.headers.authorization,cookie:req.headers.cookie});
    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({got:req.url,method:req.method,payload}));
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const upstreamPort=upstream.address().port;
  const port=await freePort();
  const gateway=spawn(process.execPath, ['server.js'],{
    cwd: require('node:path').resolve(__dirname,'..'),
    env:{...process.env,PORT:String(port),API_KEY:'secret-key',UPSTREAM_BASE_URL:`http://127.0.0.1:${upstreamPort}`,IMGUPSCALER_COOKIE:'my=test',IMGUPSCALER_AUTHORIZATION:'Bearer owned-token'}
  });
  try {
    const url=`http://127.0.0.1:${port}`;
    await waitFor(url+'/api/health');
    let html=await fetch(url+'/');
    assert.equal(html.status,200);
    assert.match(html.headers.get('content-type'),/text\/html/);
    assert.match(await html.text(),/SK Vision AI/);
    let uploadDenied=await fetch(url+'/api/upload/object',{method:'POST',headers:{'X-API-Key':'secret-key','X-Signed-Url':'https://127.0.0.1/upload'},body:'test'});
    assert.equal(uploadDenied.status,400);
    let uploadUnauthorized=await fetch(url+'/api/upload/object',{method:'POST',headers:{'X-Signed-Url':'https://foo.aliyuncs.com/upload'},body:'test'});
    assert.equal(uploadUnauthorized.status,401);
    let resp=await fetch(url+'/api/jobs/create',{method:'POST',headers:{'Content-Type':'application/json'}});
    assert.equal(resp.status,401);
    resp=await fetch(url+'/api/upload/sign',{method:'POST',headers:{'X-API-Key':'secret-key','Content-Type':'application/json'},body:JSON.stringify({f:'abc.png'})});
    assert.equal(resp.status,200);
    assert.equal((await resp.json()).got,'/api/common/upload/sign-object');
    resp=await fetch(url+'/api/jobs/create',{method:'POST',headers:{'X-API-Key':'secret-key','Content-Type':'application/json'},body:JSON.stringify({task:'real-shape-not-assumed'})});
    assert.equal((await resp.json()).got,'/api/runtime/jobs/create-job');
    resp=await fetch(url+'/api/jobs/j-123',{headers:{'X-API-Key':'secret-key'}});
    assert.equal((await resp.json()).got,'/api/runtime/jobs/j-123');
    resp=await fetch(url+'/api/credits',{headers:{'X-API-Key':'secret-key'}});
    assert.equal((await resp.json()).got,'/api/business/config/free-credits-config');
    for(const [short,full] of [['enhance','router_free.image_enhance_v1'],['remove-object','router_free.me_remove_object_v1'],['remove-background','router_free.me_remove_background_v1']]) {
      resp=await fetch(url+'/api/task-config?task='+short,{headers:{'X-API-Key':'secret-key'}});
      assert.equal((await resp.json()).got,'/api/runtime/system-parameters?full_key='+full);
    }
    assert.equal(upstreamRequests[0].payload,'{"f":"abc.png"}');
    assert.equal(upstreamRequests[0].cookie,'my=test');
    assert.equal(upstreamRequests[0].auth,'Bearer owned-token');
    resp=await fetch(url+'/api/task-config?task=invalid',{headers:{'X-API-Key':'secret-key'}});
    assert.equal(resp.status,404);
  } finally {
    gateway.kill();
    await new Promise(resolve=>upstream.close(resolve));
  }
});
