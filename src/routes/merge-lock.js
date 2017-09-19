import config from 'config';

import {listPullRequestShas, setStatus} from '../api';
import log from '../log';

const sharedLock = {
	lock : null
};

export function validateRepo(req, res, next) {
	if (config.get('repos').includes(req.query.repo.toLowerCase())) {
		next();
	}
	else {
		log.warn(`Repo ${req.query.repo} is not allowed`);
		res.sendStatus(403);
	}
}

export async function putMergeLock(req, res) {
	const repo = req.query.repo;
	const message = req.query.message ? `: ${req.query.message}` : '';
	const status = {
		state : 'error',
		context : 'Consuela merge-lock',
		description : `Merge lock in place${message}`
	};
	sharedLock.lock = status;
	const prShas = await listPullRequestShas(repo);
	await Promise.all(prShas.map(sha => setStatus(repo, sha, status)));

	res.sendStatus(200);
}

export async function releaseMergeLock(req, res) {
	sharedLock.lock = null;
	const repo = req.query.repo;
	const status = {
		state : 'success',
		context : 'Consuela merge-lock',
		description : 'No merge lock!'
	};
	const prShas = await listPullRequestShas(repo);
	await Promise.all(prShas.map(sha => setStatus(repo, sha, status)));
	res.sendStatus(200);
}

export default sharedLock;
