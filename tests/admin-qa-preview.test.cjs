const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const builder=fs.readFileSync('scripts/build_web_admin_test.py','utf8');
const qa=fs.readFileSync('scripts/admin-test-controls.js','utf8');
const deployment=fs.readFileSync('.github/workflows/deploy-ipad-web.yml','utf8');

test('admin QA is a separate public test path and never claims production privileges',()=>{
  assert.match(builder,/ROOT \/ "admin-test"/);
  assert.match(builder,/JEPPIRAN_TEST_ADMIN = true/);
  assert.match(qa,/LOCAL QA · NOT REAL ADMIN ACCESS/);
  assert.match(qa,/No actual PDF encryption|NOT real admin|not actual PDF encryption|public test tools|no privileged server API/i);
  assert.match(qa,/window.JEPPIRAN_TEST_ADMIN!==true/);
  assert.match(qa,/location.pathname.includes\("\/admin-test\/"\)/);
});
test('admin QA controls cover subscription management in browser only',()=>{
  for(const id of ['qaRole','qaAdd','qaRenew','qaSave','qaDelete','qaPlan','qaEnabled','qaExpiry']){
    assert.ok(qa.includes(id),id);
  }
  assert.match(qa,/localStorage\.setItem\(STORE/);
  assert.match(qa,/sessionStorage\.setItem\(ROLE/);
  assert.match(qa,/DEMO TEST/);
  assert.match(qa,/Monthly · 30 days/);
  assert.match(qa,/Quarterly · 90 days/);
  assert.match(qa,/Annual · 365 days/);
});
test('preview is online only, production PWA remains untouched',()=>{
  assert.match(builder,/offline-manager\\?\\.js|offline-manager\\\.js|offline-manager/);
  assert.match(builder,/if\(false&&"serviceWorker" in navigator\)/);
  assert.doesNotMatch(qa,/Sync offline|Starting verified offline synchronization/);
  assert.match(deployment,/Build isolated Admin QA test website/);
  assert.match(deployment,/python3 scripts\/build_web_admin_test\.py/);
});
