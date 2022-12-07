import config from 'config';
import fetch from 'node-fetch';
import parseLinkHeader from 'parse-link-header';

export function isValidResponseStatusCode(code) {
	return code >= 200 && code < 300;
}

export async function setStatus(repo, sha, status) {
	const url = `https://api.github.com/repos/${repo}/statuses/${sha}`;

	const response = await fetch(url, {
		method: 'post',
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : `token ${config.get('github.oauth_token')}`
		},
		body : status
	});

	if (!isValidResponseStatusCode(response.status)) {
		throw response;
	}

	return await response.json();
}

export async function listLabels(repository, pullRequestNumber) {
	const url = `https://api.github.com/repos/${repository}/issues/${pullRequestNumber}/labels`;
	const response = await fetch(url, {
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : 'token ' + config.get('github.oauth_token')
		},
	});

	if (!isValidResponseStatusCode(response.status)) {
		throw response;
	}

	return await response.json();
}

export async function listPullRequestShas(repo) {
	let shas = [];
	let url = `https://api.github.com/repos/${repo}/pulls?per_page=10`;
	let hasNext = true;
	do {
		const response = await fetch(url, {
			headers : {
				'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
				'Authorization' : `token ${config.get('github.oauth_token')}`
			}
		});
		const data = await response.json();

		shas = shas.concat(data.map(pr => pr.head.sha));

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
