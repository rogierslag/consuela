import config from 'config';
import request from 'request';
import parseLinkHeader from 'parse-link-header';

import promisify from './promisify';

export function isValidResponseStatusCode(code) {
	return code >= 200 && code < 300;
}

export async function setStatus(repo, sha, status) {
	const url = `https://api.github.com/repos/${repo}/statuses/${sha}`;

	const response = await promisify(cb => request.post({
		url : url,
		json : true,
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : `token ${config.get('github.oauth_token')}`
		},
		body : status
	}, cb));

	if (!isValidResponseStatusCode(response.statusCode)) {
		throw response;
	}

	return response.body;
}

export async function listLabels(repository, pullRequestNumber) {
	const url = `https://api.github.com/repos/${repository}/issues/${pullRequestNumber}/labels`;
	const response = await promisify(cb => request({
		url : url,
		json : true,
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : 'token ' + config.get('github.oauth_token')
		},
	}, cb));

	if(!isValidResponseStatusCode(response)) {
		throw response;
	}
	return response.body;
}

export async function listPullRequestShas(repo) {
	let shas = [];
	let url = `https://api.github.com/repos/${repo}/pulls?per_page=10`;
	let hasNext = true;
	do {
		const response = await promisify(cb => request({
			url,
			json : true,
			headers : {
				'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
				'Authorization' : `token ${config.get('github.oauth_token')}`
			}
		}, cb));

		shas = shas.concat(response.body.map(pr => pr.head.sha));

		if (response.headers.link) {
			const link = parseLinkHeader(response.headers.link);
			if (link.next) {
				url = link.next.url;
			}
			else {
				hasNext = false;
			}
		}
		else {
			hasNext = false;
		}
	}
	while (hasNext);

	return shas;
}
