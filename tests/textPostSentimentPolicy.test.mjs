import assert from 'node:assert/strict';
import test from 'node:test';
import { loadService } from './loadTypeScriptService.mjs';

const { usesSentiment } = loadService('sentimentPolicy', {}, 'lib');
const steps = loadService('postSteps', {}, 'lib');
const revisions = loadService('revisionSteps', {'@/lib/postSteps': steps}, 'lib');
const editor = loadService('submissionRevisionSteps', {}, 'lib');
const freshness = loadService('preparationFreshness', {'./mediaFreshness': {analysisIsCurrent:()=>true}}, 'lib');

test('text posts have details, compliance and send, with no sentiment step', () => {
  const skip = !usesSentiment('TEXT_POST');
  assert.equal(skip, true);
  assert.deepEqual(Array.from(steps.postPreparationSteps(skip), s=>s.key), ['details','compliance','send']);
  assert.ok(!revisions.creatorPreparationSteps(skip,true).some(s=>s.key==='sentiment'));
  assert.ok(!editor.submissionRevisionSteps(skip,true).some(s=>s.key==='sentiment'));
});

test('an old sentiment resume step advances to send when compliance is current', () => {
  const result = steps.ranOnce({locked:false,details:'done',compliance:'done',sentiment:'todo',next:'sentiment'},true);
  assert.equal(result.next,'send');
  assert.equal(result.ready_to_send,true);
});

test('text-post publishing skips sentiment while keeping compliance freshness', () => {
  const result=freshness.preparationCheckState({skipSentiment:true,hasCheck:true,inputCheckStale:false,mediaChanged:false,hasMood:false});
  assert.equal(result.sentiment,true); assert.equal(result.compliance,true);
  assert.equal(freshness.preparationCheckState({skipSentiment:true,hasCheck:true,inputCheckStale:true,mediaChanged:false,hasMood:false}).compliance,false);
});

test('images, carousels and finished videos keep sentiment; script-only drafts skip it', () => {
  for (const kind of ['IMAGE','SOCIAL_POST','CAROUSEL','VIDEO']) assert.equal(usesSentiment(kind),true);
  assert.equal(usesSentiment('VIDEO',true),false);
  assert.ok(steps.postPreparationSteps(false).some(s=>s.key==='sentiment'));
});
