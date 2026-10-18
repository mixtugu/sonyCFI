import test from 'node:test';
import assert from 'node:assert/strict';
import { resultCondition } from './result-condition.js';

test('classifies explorer HP at one-third and two-thirds thresholds', () => {
  assert.equal(resultCondition(6, 20), 'hurt');
  assert.equal(resultCondition(7, 20), 'steady');
  assert.equal(resultCondition(13, 20), 'steady');
  assert.equal(resultCondition(14, 20), 'healthy');
  assert.equal(resultCondition(1, 3), 'hurt');
  assert.equal(resultCondition(2, 3), 'healthy');
});
