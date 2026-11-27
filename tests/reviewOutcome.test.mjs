import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { approvedForFinalEdits, reviewOutcomeStatus } from "../src/lib/reviewOutcome.ts";
const url = code => "data:text/javascript," + encodeURIComponent(code);
const helper = url(transpileModule(readFileSync(new URL("../src/lib/reviewOutcome.ts", import.meta.url), "utf8"), {compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText);
const queueCode = transpileModule(readFileSync(new URL("../src/lib/screenerApprovalQueue.ts",import.meta.url),"utf8"),{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText.replace('"./reviewOutcome"', JSON.stringify(helper));
const { splitApprovedQueue } = await import(url(queueCode));

test("approved final-edit posts belong to Approved while remaining editable",()=>{
 const post={status:"CHANGES_REQUESTED",publish_after_changes:true};
 assert.equal(reviewOutcomeStatus(post),"APPROVED");assert.equal(approvedForFinalEdits(post),true);
 assert.equal(post.status,"CHANGES_REQUESTED");
});
test("approval is shown during the suggestion window too",()=>{
 assert.equal(reviewOutcomeStatus({status:"IN_REVIEW",publish_after_changes:true}),"APPROVED");
});
test("explicit requests for another review stay in Needs changes",()=>{
 assert.equal(reviewOutcomeStatus({status:"CHANGES_REQUESTED",publish_after_changes:false}),"CHANGES_REQUESTED");
 assert.equal(reviewOutcomeStatus({status:"IN_REVIEW",publish_after_changes:false}),"IN_REVIEW");
});
test("legacy approvals remain approved and drafts cannot be approved by a stale flag",()=>{
 assert.equal(reviewOutcomeStatus({status:"APPROVED"}),"APPROVED");
 assert.equal(reviewOutcomeStatus({status:"DRAFT",publish_after_changes:true}),"DRAFT");
});
test("screener approved grouping includes final edits without accidentally scheduling them",()=>{
 const posts=[{id:"edits",status:"CHANGES_REQUESTED",publish_after_changes:true,publish_at:"2026-12-01T12:00:00Z"},
 {id:"held",status:"IN_REVIEW",publish_after_changes:true},{id:"back",status:"CHANGES_REQUESTED",publish_after_changes:false}];
 const split=splitApprovedQueue(posts,{"sub-edits":{scheduled_for:"2026-12-01T12:00:00Z"}});
 assert.deepEqual(split.approved.map(p=>p.id),["edits","held"]);assert.equal(split.scheduled.length,0);
});
test("a creator's confirmed schedule still moves final approved content to Scheduled",()=>{
 const split=splitApprovedQueue([{id:"done",status:"APPROVED"}],{"sub-done":{scheduled_for:"2026-12-01T12:00:00Z"}});
 assert.equal(split.approved.length,0);assert.equal(split.scheduled[0].id,"done");
});
