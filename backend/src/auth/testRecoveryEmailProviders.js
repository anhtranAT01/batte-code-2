const assert=require('node:assert/strict');
const {recoveryEmailEnabled,sendRecoveryEmail,publicProviderError}=require('./recoveryEmail');

async function main(){
  const keys=['GOOGLE_APPS_SCRIPT_URL','GOOGLE_APPS_SCRIPT_SECRET','RESEND_API_KEY','SMTP_HOST','EMAIL_FROM','PASSWORD_RESET_URL','NODE_ENV'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  try{
    for(const key of keys)delete process.env[key];
    process.env.NODE_ENV='production';
    process.env.EMAIL_FROM='BattleCode <bot@example.test>';
    process.env.PASSWORD_RESET_URL='https://batte-code-2.pages.dev/';
    process.env.GOOGLE_APPS_SCRIPT_URL='https://script.google.com/macros/s/deployment-id/exec';
    process.env.GOOGLE_APPS_SCRIPT_SECRET='test-shared-secret';
    assert.equal(recoveryEmailEnabled(),true);
    delete process.env.GOOGLE_APPS_SCRIPT_SECRET;
    assert.equal(recoveryEmailEnabled(),false,'partial Apps Script configuration must not fall through to SMTP');
    process.env.GOOGLE_APPS_SCRIPT_SECRET='test-shared-secret';

    let postedUrl,postedBody;
    global.fetch=async(url,options)=>{
      postedUrl=String(url);postedBody=JSON.parse(options.body);
      return {ok:true,status:200,json:async()=>({ok:true})};
    };
    const result=await sendRecoveryEmail({to:'student@example.test',url:'https://batte-code-2.pages.dev/#reset_token=test-token'});
    assert.equal(result.ok,true);
    assert.equal(postedUrl,process.env.GOOGLE_APPS_SCRIPT_URL);
    assert.equal(postedBody.secret,'test-shared-secret');
    assert.equal(postedBody.to,'student@example.test');
    assert.match(postedBody.html,/Đặt lại mật khẩu/);
    assert.equal(publicProviderError(Object.assign(new Error('script failed'),{code:'E_FAIL'})).provider,'apps-script');

    global.fetch=async()=>({ok:true,status:200,json:async()=>({ok:false,error:'send_failed'})});
    await assert.rejects(sendRecoveryEmail({to:'student@example.test',url:'https://batte-code-2.pages.dev/#reset_token=test-token'}),/send_failed/);

    process.env.GOOGLE_APPS_SCRIPT_URL='http://script.google.com/macros/s/id/exec';
    await assert.rejects(sendRecoveryEmail({to:'student@example.test',url:'https://batte-code-2.pages.dev/#reset_token=test-token'}),/HTTPS web app/);
    console.log('PASS: Apps Script HTTPS recovery mail, provider error, and endpoint validation');
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
