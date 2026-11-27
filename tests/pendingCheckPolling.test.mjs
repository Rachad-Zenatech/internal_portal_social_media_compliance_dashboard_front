import test from "node:test";
import assert from "node:assert/strict";
import { pollPendingCheck } from "../src/services/pendingCheckPolling.ts";
const flush = async () => { for(let i=0;i<6;i++) await Promise.resolve(); };

test("polling stops when the completed result arrives", async () => {
 let calls=0, results=[];
 const poll=pollPendingCheck({load:async()=>{calls++;return {pending:false}},onResult:r=>{results.push(r);return r.pending},onError:()=>assert.fail("unexpected error")});
 await flush(); poll.retry(); await flush(); poll.stop();
 assert.equal(calls,1); assert.deepEqual(results,[{pending:false}]);
});
test("slow polls never overlap and manual refresh can finish the check", async () => {
 let resolve, calls=0;
 const poll=pollPendingCheck({load:()=>{calls++;return new Promise(r=>resolve=r)},onResult:r=>r.pending,onError:()=>{}});
 poll.retry(); poll.retry(); assert.equal(calls,1);
 resolve({pending:true}); await flush(); poll.retry(); assert.equal(calls,2);
 resolve({pending:false}); await flush(); poll.stop();
});
test("a failed refresh is reported and retry accepts the completed result", async () => {
 let calls=0, failures=0, complete=false;
 const poll=pollPendingCheck({load:async()=>{if(++calls===1) throw Error("offline");return {pending:false}},onResult:r=>{complete=true;return r.pending},onError:()=>failures++});
 await flush(); assert.equal(failures,1); assert.equal(complete,false);
 poll.retry(); await flush(); poll.stop(); assert.equal(complete,true);
});
test("unmount or a new check ignores the old in-flight response", async () => {
 let resolve, updates=0;
 const poll=pollPendingCheck({load:()=>new Promise(r=>resolve=r),onResult:()=>{updates++;return true},onError:()=>{}});
 poll.stop(); resolve({pending:true}); await flush(); assert.equal(updates,0);
});
test("a request timeout is reported and can be retried", async t => {
 t.mock.timers.enable({apis:["setTimeout"]});
 let failures=0;
 const poll=pollPendingCheck({timeoutMs:50,load:signal=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(Error("timeout")))),onResult:()=>true,onError:()=>failures++});
 t.mock.timers.tick(50); await flush(); poll.stop(); assert.equal(failures,1);
});
