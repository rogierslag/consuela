import config from 'config';
import parseLinkHeader from 'parse-link-header';

function repositoryPath(repository) {
	if (typeof repository !== 'string' || repository !== repository.trim() || !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
		throw new TypeError('Invalid GitHub repository');
	}
	const [owner, name] = repository.split('/');
	if (name === '.' || name === '..') {
		throw new TypeError('Invalid GitHub repository');
	}
	return `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function positiveInteger(value) {
	if (!['string', 'number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || String(Number(value)) !== String(value)) {
		throw new TypeError('Invalid GitHub page or pull request number');
	}
	return Number(value);
}

export function isValidResponseStatusCode(code) {
	return code >= 200 && code < 300;
}

export async function setStatus(repo, sha, status) {
	const repository = repositoryPath(repo);
	if (typeof sha !== 'string' || sha.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(sha)) {
		throw new TypeError('Invalid GitHub commit SHA');
	}
	const url = `https://api.github.com/repos/${repository}/statuses/${encodeURIComponent(sha)}`;

	const response = await fetch(url, {
		method: 'post',
		redirect: 'error',
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : `token ${config.get('github.oauth_token')}`,
			'Content-Type': 'application/json',
		},
		body : JSON.stringify(status)
	});

	if (!isValidResponseStatusCode(response.status)) {
		throw response;
	}

	return await response.json();
}

export async function listLabels(repository, pullRequestNumber) {
	const url = `https://api.github.com/repos/${repositoryPath(repository)}/issues/${positiveInteger(pullRequestNumber)}/labels`;
	const response = await fetch(url, {
		redirect: 'error',
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
	const path = `/repos/${repositoryPath(repo)}/pulls`;
	let page = 1;
	let hasNext = true;
	do {
		const url = `https://api.github.com${path}?per_page=10&page=${page}`;
		const response = await fetch(url, {
			redirect: 'error',
			headers : {
				'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
				'Authorization' : `token ${config.get('github.oauth_token')}`
			}
		});
		if (!isValidResponseStatusCode(response.status)) {
			throw response;
		}
		const data = await response.json();

		shas = shas.concat(data.map(pr => pr.head.sha));

		const linkHeader= response.headers.get('link');
		if (linkHeader) {
			const link = parseLinkHeader(linkHeader);
			if (link?.next) {
				const next = new URL(link.next.url);
				if (next.origin !== 'https://api.github.com' || next.pathname !== path || next.username || next.password || next.hash) {
					throw new TypeError('Invalid GitHub pagination URL');
				}
				const nextPage = positiveInteger(next.searchParams.get('page'));
				if (nextPage <= page) {
					throw new TypeError('GitHub pagination must advance');
				}
				// Only use the page number; rebuild the URL for the original repository.
				page = nextPage;
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
