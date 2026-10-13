/* Browser-level QA for isolated /admin-test/ home dashboard.
 * Uses the existing Chrome + Playwright installed by Pages CI.
 */
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const root=path.resolve(__dirname,"../web");
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".mjs":"text/javascript",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".pdf":"application/pdf",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    let filepath=path.resolve(root,"."+decodeURIComponent(url.pathname));
    if(!filepath.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
    if(fs.existsSync(filepath)&&fs.statSync(filepath).isDirectory())filepath=path.join(filepath,"index.html");
    fs.readFile(filepath,(err,data)=>{
      if(err){res.writeHead(404);res.end();return}
      res.writeHead(200,{"Content-Type":MIME[path.extname(filepath)]||"application/octet-stream","Cache-Control":"no-store"});
      res.end(data);
    });
  }catch(e){res.writeHead(400);res.end()}
});
async function run(){
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.JEPPIRAN_CHROME_BIN||undefined,args:["--no-sandbox"]});
  try {
    const context=await browser.newContext({viewport:{width:1180,height:850},serviceWorkers:"block"});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:"+port+"/admin-test/",{waitUntil:"domcontentloaded",timeout:60000});
    await page.locator("#qaAccountButton").waitFor({timeout:45000});
    assert.equal(await page.locator("#adminQaHomeBtn").isVisible(),false,"Guest must NOT see Admin Home card");
    await page.locator("#qaAccountButton").click();
    await page.locator('[data-qa-signin="admin"]').click();
    await page.locator("#adminQaView.active").waitFor({timeout:12000});
    assert.equal(await page.locator("#adminQaHomeBtn").isVisible(),false,"Admin Home tile is behind the dashboard");
    assert.equal(await page.locator("#qaTotal").textContent(),"4");
    await page.locator("#qaNew").fill("qa-browser-test");
    await page.locator("#qaAdd").click();
    assert.equal(await page.locator("#qaTotal").textContent(),"5");
    await page.locator("#qaPlan").selectOption("annual");
    await page.locator("#qaRenew").click();
    assert.equal(await page.locator("#qaActive").textContent(),"3");
    await page.locator("#qaDashboardHome").click();
    await page.locator("#homeView.active").waitFor();
    assert.equal(await page.locator("#adminQaHomeBtn").isVisible(),true,"Admin tile visible only in Admin Home");
    await page.locator("#adminQaHomeBtn").click();
    await page.locator("#adminQaView.active").waitFor();
    await page.locator("#qaDashboardSignOut").click();
    await page.locator("#homeView.active").waitFor();
    assert.equal(await page.locator("#adminQaHomeBtn").isVisible(),false,"Sign-out must remove Admin tile");
    await page.locator("#qaAccountButton").click();
    await page.locator('[data-qa-signin="premium"]').click();
    assert.equal(await page.locator("#adminQaHomeBtn").isVisible(),false,"Premium cannot see Admin tile");
    await page.setViewportSize({width:390,height:844});
    await page.locator("#qaAccountButton").click();
    await page.locator('[data-qa-signin="admin"]').click();
    await page.locator("#adminQaView.active").waitFor();
    const dims=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    assert.ok(dims.scrollWidth<=dims.clientWidth+2,"Dashboard horizontal overflow on phone: "+JSON.stringify(dims));
    console.log("JEPPIRAN Admin QA browser test passed: sign-in, Admin Home, user management, sign-out and phone layout.");
    await context.close();
  }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());