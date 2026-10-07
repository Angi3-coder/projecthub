import test from 'node:test';
import assert from 'node:assert/strict';
import { progress } from '../src/progress.js';

test('no tasks is 0', () => assert.equal(progress([]), 0));
test('rounds to nearest percent', () => assert.equal(progress([{ status: 'done' }, { status: 'todo' }, { status: 'doing' }]), 33));
test('all done is 100', () => assert.equal(progress([{ status: 'done' }]), 100));
