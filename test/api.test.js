import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';

process.env.NODE_CONFIG = JSON.stringify({github: {oauth_token: 'test-token'}});
const {setStatus, listLabels, listPullRequestShas} = await import('../src/api.js');
const originalFetch = globalThis.fetch;
const sha = 'a'.repeat(40);

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function response(data, link = null, status = 200) {
	return {status, json: async () => data, headers: {get: () => link}};
}

test('valid requests use the intended endpoint and reject redirects', async () => {
	const calls = [];
	globalThis.fetch = async (url, options) => {
		calls.push({url, options});
		return response([]);
	};
	await setStatus('Owner/repo.name-1', sha, {state: 'success'});
	await listLabels('Owner/repo.name-1', 42);
	await listLabels('Owner/repo.name-1', '43');
	await listPullRequestShas('Owner/repo.name-1');
	assert.deepEqual(calls.map(call => call.url), [
		`https://api.github.com/repos/Owner/repo.name-1/statuses/${sha}`,
		'https://api.github.com/repos/Owner/repo.name-1/issues/42/labels',
		'https://api.github.com/repos/Owner/repo.name-1/issues/43/labels',
		'https://api.github.com/repos/Owner/repo.name-1/pulls?per_page=10&page=1'
	]);
	for (const {options} of calls) {
		assert.equal(options.redirect, 'error');
		assert.equal(options.headers.Authorization, 'token test-token');
	}
	assert.equal(calls[0].options.method, 'post');
	assert.equal(calls[0].options.body, '{"state":"success"}');
});

test('malformed path inputs never reach fetch', async () => {
	globalThis.fetch = () => assert.fail('Invalid input reached fetch');
	for (const repo of [undefined, {}, ['owner/repo'], 'owner', 'owner/repo/../other', 'owner/..', 'owner/.', 'owner/repo?x=1', 'owner/repo#fragment', 'owner/%2e%2e', 'owner\\repo', '//evil.test', 'owner/repo\n']) {
		await assert.rejects(setStatus(repo, sha, {}), TypeError);
		await assert.rejects(listLabels(repo, 1), TypeError);
		await assert.rejects(listPullRequestShas(repo), TypeError);
	}
	for (const invalidSha of ['../issues', `${sha}?x=1`, `${sha}\n`, {}, 'abc']) {
		await assert.rejects(setStatus('owner/repo', invalidSha, {}), TypeError);
	}
	for (const number of [0, -1, 1.5, '1/../../pulls', '1?x=1', '1#fragment', '01', '1\n', null, {}, Number.MAX_SAFE_INTEGER + 1]) {
		await assert.rejects(listLabels('owner/repo', number), TypeError);
	}
});

test('pagination rebuilds the same repository endpoint using only the next page', async () => {
	const urls = [];
	globalThis.fetch = async url => {
		urls.push(url);
		return urls.length === 1
			? response([{head: {sha}}], '<https://api.github.com/repos/owner/repo/pulls?per_page=100&page=2&extra=ignored>; rel="next"')
			: response([{head: {sha: 'b'.repeat(40)}}]);
	};
	assert.deepEqual(await listPullRequestShas('owner/repo'), [sha, 'b'.repeat(40)]);
	assert.deepEqual(urls, [
		'https://api.github.com/repos/owner/repo/pulls?per_page=10&page=1',
		'https://api.github.com/repos/owner/repo/pulls?per_page=10&page=2'
	]);
});

test('unsafe pagination stops before a second authenticated request', async () => {
	for (const next of [
		'https://evil.test/repos/owner/repo/pulls?page=2',
		'http://api.github.com/repos/owner/repo/pulls?page=2',
		'https://api.github.com:444/repos/owner/repo/pulls?page=2',
		'https://user:password@api.github.com/repos/owner/repo/pulls?page=2',
		'https://api.github.com/repos/other/repo/pulls?page=2',
		'https://api.github.com/repos/owner/repo/issues?page=2',
		'https://api.github.com/repos/owner/repo/pulls?page=2#fragment',
		'https://api.github.com/repos/owner/repo/pulls',
		'https://api.github.com/repos/owner/repo/pulls?page=NaN',
		'https://api.github.com/repos/owner/repo/pulls?page=0',
		'https://api.github.com/repos/owner/repo/pulls?page=1',
		'https://api.github.com/repos/owner/repo/pulls?page=9007199254740992'
	]) {
		let calls = 0;
		globalThis.fetch = async () => {
			assert.equal(++calls, 1);
			return response([], `<${next}>; rel="next"`);
		};
		await assert.rejects(listPullRequestShas('owner/repo'), TypeError);
		assert.equal(calls, 1);
	}
});

test('unsuccessful API responses are rejected', async () => {
	const failed = response({message: 'Unauthorized'}, null, 401);
	globalThis.fetch = async () => failed;
	for (const request of [() => setStatus('owner/repo', sha, {}), () => listLabels('owner/repo', 1), () => listPullRequestShas('owner/repo')]) {
		await assert.rejects(request, error => error === failed);
	}
});
