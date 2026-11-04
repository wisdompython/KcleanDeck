const {chromium} = require('../../e2e/node_modules/@playwright/test');
(async()=>{
 const browser=await chromium.launch(); const page=await browser.newPage();
 page.on('console',x=>console.log('console',x.type(),x.text().slice(0,300)));
 page.on('pageerror',x=>console.log('pageerror',x.message));
 page.on('requestfailed',x=>console.log('requestfailed',x.url(),x.failure()));
 await page.goto((process.env.AUDIT_URL||'http://localhost:8089')+'/admin/login');
 await page.waitForLoadState('networkidle');
 await page.waitForFunction(()=>Object.keys(document.querySelector('form')).some(k=>k.startsWith('__react')),null,{timeout:15000}).catch(()=>{});
 console.log('ready',await page.evaluate(()=>({state:document.readyState,scripts:[...document.scripts].map(s=>s.src||s.textContent.slice(0,80)),react: Object.keys(document.querySelector('form')).filter(k=>k.startsWith('__react')).length})));
 await page.getByLabel('Email',{exact:true}).fill('owner@e2e.kleandeck.test');
 await page.getByLabel('Password',{exact:true}).fill('E2e-owner-pass-1');
 await page.getByRole('button',{name:'Sign in'}).click();
 await page.waitForLoadState('networkidle');
 console.log('result',page.url(),(await page.locator('body').innerText()).slice(0,1500));
 await page.context().storageState({path:__dirname+'/owner.json'});
 await browser.close();
})();
