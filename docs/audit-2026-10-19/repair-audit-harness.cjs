const fs=require('node:fs');
for(const file of ['browser-audit.cjs','browser-recheck.cjs']){
 let source=fs.readFileSync(__dirname+'/'+file,'utf8');
 source=source.replaceAll("page.getByRole('alert')","page.locator('main').getByRole('alert')");
 source=source.replaceAll("name:'Active',exact:true","name:/^Active/");
 fs.writeFileSync(__dirname+'/'+file,source);
}
