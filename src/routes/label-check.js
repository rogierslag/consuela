import config from 'config';

import {listLabels, setStatus} from '../api';
import sharedLock from './merge-lock';
import log from '../log';

const supportedActions = ['opened', 'labeled', 'unlabeled', 'synchronize'];

async function sleep(timeout) {
	await new Promise(resolve => {
		setTimeout(resolve, timeout);
	});
}

async function checkLabels(pullRequest) {
	const labels = await listLabels(pullRequest.head.repo.full_name, pullRequest.number);

	if (labels.filter((item) => config.get('tags').includes(item.name.toLowerCase())).length > 0) {
		log.info('Did contain tags to prevent merge');
		await reportSuccess(pullRequest, false);
	} else {
		log.info('Merge is allowed');
		await reportSuccess(pullRequest, true);
	}
}

async function reportSuccess(pullRequest, result) {
	let status;

	if (result) {
		status = {
			state : 'success',
			context : 'Consuela',
			description : 'Consuela says: This PR may be merged.'
		};
	} else {
		status = {
			state : 'error',
			context : 'Consuela',
			description : 'Consuela shouts: This PR should not be merged yet!'
		};
	}

	await setStatus(pullRequest.head.repo.full_name, pullRequest.head.sha, status);
}

export function checkPullRequestBody(req, res, next) {
	if (config.get('repos').includes(req.body.pull_request.head.repo.full_name.toLowerCase())) {
		next();
	} else {
		log.warn(`Incoming request did not match any repository [${req.body.pull_request.head.repo.full_name}]`);
		res.sendStatus(403);
	}
}

export default async function checkLabel(req, res) {
	log.info(`Received a request for matching repo: ${req.body.pull_request.head.repo.full_name}`);
	log.info(`Action is: ${req.body.action}`);
	if (supportedActions.includes(req.body.action)) {
		const pullRequest = req.body.pull_request;

		if (sharedLock.lock) {
			try {
				await setStatus(pullRequest.head.repo.full_name, pullRequest.head.sha, sharedLock.lock);
			}
			catch (e) {
				log.error('Error while checking labels for shared lock:', e);
				res.sendStatus(500);
				return;
			}
		}

		// Github hasn't always persisted the labels at this point, so we'll just wait a few seconds
		await sleep(5000);
		try {
			await checkLabels(pullRequest);
		}
		catch (e) {
			log.error('Error while checking labels for individual lock:', e);
			res.sendStatus(500);
			return;
		}
		res.sendStatus(200);
	} else {
		res.sendStatus(200);
	}
}
