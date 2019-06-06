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

export function validateSecretKey(req, res, next) {
	const secretKey = config.get('lockKey');
	if(!secretKey) {
		log.warn(`No secret key defined. For a public service this is not very safe!`);
		next();
		return;
	}

	const suppliedKey = req.query.secret;
	if(secretKey === suppliedKey) {
		next();
		return;
	}

	log.warn(`Incorrect secret key supplied`);
	res.sendStatus(401);
}

export async function putMergeLock(req, res) {
	const repo = req.query.repo;
	const message = req.query.message ? `: ${decodeURIComponent(req.query.message)}` : '';
	const status = {
		state : 'error',
		context : 'Consuela merge-lock',
		description : `Merge lock in place${message}`
	};
	sharedLock.lock = status;
	const prShas = await listPullRequestShas(repo);
	await Promise.all(prShas.map(sha => setStatus(repo, sha, status)));
	log.info(`Setting a merge lock for repo ${repo} with message: '${message}'`);

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
	log.info(`Removing merge lock for repo ${repo}`);
	res.sendStatus(200);
}

export default sharedLock;
