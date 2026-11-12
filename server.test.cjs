const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {financialSummary,numeric,xmlRows,api,createServer}=require('./server.cjs');
const row=(id,value,previous,section='IS',currency='KRW')=>({account_id:id,thstrm_amount:value,frmtrm_amount:previous,sj_div:section,currency});
test('DART ratios preserve zero and reject missing, nonpositive denominators and currency mismatches',()=>{
 let result=financialSummary([row('ifrs-full_Revenue','1,000','800'),row('dart_OperatingIncomeLoss','0','10'),row('ifrs-full_Liabilities','500','400','BS'),row('ifrs-full_Equity','250','200','BS')]);
 assert.equal(result.ratios.revenueGrowth,25);assert.equal(result.ratios.operatingMargin,0);assert.equal(result.ratios.debtRatio,200);
 result=financialSummary([row('ifrs-full_Revenue','0','-10'),row('dart_OperatingIncomeLoss','10','5'),row('ifrs-full_Liabilities','500','400','BS'),row('ifrs-full_Equity','-250','200','BS')]);
 assert.deepEqual(result.ratios,{revenueGrowth:null,operatingMargin:null,debtRatio:null});
 assert.equal(financialSummary([row('ifrs-full_Revenue','100','80'),row('dart_OperatingIncomeLoss','10','5','IS','USD')]).ratios.operatingMargin,null);
 assert.equal(numeric('-'),null);assert.equal(numeric('0'),0);assert.equal(numeric(''),null);
});
test('XML parsing handles CDATA, entity text and multiple job records',()=>{
 const records=xmlRows('<wantedRoot><wanted><title><![CDATA[A < B]]></title><company>A&amp;B</company></wanted><wanted><title>개발</title></wanted></wantedRoot>','wanted');assert.equal(records.length,2);assert.equal(records[0].title,'A < B');assert.equal(records[0].company,'A&B');
});
test('Provider endpoints use server keys, exact business identity and preserve observed salary history',async()=>{
 const originalFetch=global.fetch;const vars=['KAKAO_REST_API_KEY','WORK24_API_KEY','DART_API_KEY'];const saved=vars.map(k=>process.env[k]);const file=path.join(__dirname,'data/jobs-0000000000.json');const old=fs.existsSync(file)?fs.readFileSync(file):null;
 try{for(const k of vars)delete process.env[k];await assert.rejects(()=>api('places',new URLSearchParams({q:'회사'})),e=>e.status===503);
 for(const k of vars)process.env[k]='test-only';
 global.fetch=async(url,options)=>{const u=new URL(url);if(u.hostname==='dapi.kakao.com'){assert.equal(options.headers.Authorization,'KakaoAK test-only');return new Response(JSON.stringify({documents:[{id:'1',place_name:'실제 지점',road_address_name:'서울 강남구 길 1'}],meta:{is_end:true}}))}if(u.hostname==='www.work24.go.kr'){assert.equal(u.searchParams.get('busino'),'0000000000');return new Response('<wantedRoot><total>1</total><wanted><wantedAuthNo>test1</wantedAuthNo><company>테스트</company><title>개발직</title><salTpNm>월급</salTpNm><sal>300만원</sal></wanted></wantedRoot>')}if(u.pathname.endsWith('/company.json'))return new Response(JSON.stringify({status:'000',corp_name:'공시법인',bizr_no:'0000000000'}));if(u.pathname.endsWith('/fnlttSinglAcntAll.json'))return new Response(JSON.stringify({status:'000',list:[row('ifrs-full_Revenue','1000','800')]}));throw Error('Unexpected upstream')};
 const places=await api('places',new URLSearchParams({q:'회사'}));assert.equal(places.items[0].address,'서울 강남구 길 1');
 await assert.rejects(()=>api('jobs',new URLSearchParams({business:'bad'})),e=>e.status===400);
 const jobs=await api('jobs',new URLSearchParams({business:'0000000000'}));assert.equal(jobs.items[0].pay,'300만원');assert.equal(jobs.history.length,1);assert.equal(jobs.history[0].versions.length,1);
 const repeated=await api('jobs',new URLSearchParams({business:'0000000000'}));assert.equal(repeated.history.length,1);assert.equal(repeated.history[0].versions.length,1);
 const finance=await api('finance',new URLSearchParams({code:'00126380',year:'2025'}));assert.equal(finance.metrics.revenue.value,1000);assert.equal(finance.ratios.revenueGrowth,25);
 }finally{global.fetch=originalFetch;vars.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);if(old)fs.writeFileSync(file,old);else if(fs.existsSync(file))fs.unlinkSync(file)}
});
test('HTTP server blocks access to environment configuration',async()=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const url='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(url+'/.env')).status,404);assert.equal((await fetch(url+'/api/status')).status,200);assert.equal((await fetch(url+'/api/finance?code=bad&year=2025')).status,400)}finally{await new Promise(resolve=>server.close(resolve))}});
test('Local key setup rejects cross-origin requests and missing CSRF token',async()=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const url='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(url+'/setup')).status,200);assert.equal((await fetch(url+'/setup',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);assert.equal((await fetch(url+'/setup',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:'{}'})).status,403);assert.equal((await fetch(url+'/api/evidence',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403)}finally{await new Promise(resolve=>server.close(resolve))}});
