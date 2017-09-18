'use strict';

import express from 'express';
import config from 'config';
import bodyParser from 'body-parser';
import request from 'request';
import parseLinkHeader from 'parse-link-header';

import log from './log';
import promisify from './promisify';

// Create the server
const app = express();
app.use(bodyParser.json());
app.get('/health', checkHealth);
app.post('/', checkPayload);
app.post('/merge-lock', validateRepo, putMergeLock);
app.delete('/merge-lock', validateRepo, releaseMergeLock);

const supportedActions = ['opened', 'labeled', 'unlabeled', 'synchronize'];
const port = 8543;

//global merge lock (so we update the check if people push new commits)
let mergeLock = null;

// And listen!
const server = app.listen(port, () => {
	log.info('Consuela picked up the phone and started listening');
});

server.on('error', (e) => {
	if (e.code === 'EADDRINUSE') {
		log.error(`Address http://localhost:${port} in use!`);
	}
	else {
		log.error(`Something broke! Failed to start listening. Error was ${e}`);
	}
});

// Check whether we are running and if yes return ok
function checkHealth(req, res) {
	res.send('Si?');
	log.info('Processed successful healthcheck');
}

function validateRepo(req, res, next) {
	if (config.get('repos').includes(req.query.repo.toLowerCase())) {
		next();
	}
	else {
		log.warn(`Repo ${req.query.repo} is not allowed`);
		res.sendStatus(403);
	}
}

// Determine whether to do something with the payload
async function checkPayload(req, res) {
	if (req.body.zen) {
		// This is a github test payload!
		log.info('Received Github test payload');
		const validRepo = config.get('repos').includes(req.body.repository.full_name.toLowerCase());
		if (validRepo) {
			res.status(200).send('Well Github, I love you too!');
		} else {
			res.status(403).send('This repository is not configured for Consuela');
		}
		return;
	}

	if (config.get('repos').includes(req.body.pull_request.head.repo.full_name.toLowerCase())) {
		log.info(`Received a request for matching repo: ${req.body.pull_request.head.repo.full_name}`);
		log.info(`Action is: ${req.body.action}`);
		if (supportedActions.includes(req.body.action)) {
			const pullRequest = req.body.pull_request;
			try {
				await checkLabels(pullRequest);
				res.sendStatus(200);
			}
			catch (e) {
				log.info(`Error while checking labels: ${e}`);
				res.sendStatus(500);
			}

			if(mergeLock) {
				try {
					await setStatus(pullRequest.head.repo.full_name, pullRequest.head.sha, mergeLock);
					res.sendStatus(200);
				}
				catch (e) {
					log.info(`Error while checking labels: ${e}`);
					res.sendStatus(500);
				}
			}
		} else {
			res.sendStatus(200);
		}
	} else {
		log.info(`Incoming request did not match any repository [${req.body.pull_request.head.repo.full_name}]`);
		res.sendStatus(403);
	}
}

// Determine what we should send back to github
async function checkLabels(pullRequest) {
	const url = `https://api.github.com/repos/${pullRequest.head.repo.full_name}/issues/${pullRequest.number}/labels`;
	const response = await promisify(cb => request({
		url : url,
		json : true,
		headers : {
			'User-Agent' : 'Consuela https://github.com/rogierslag/consuela',
			'Authorization' : 'token ' + config.get('github.oauth_token')
		},
	}, cb));

	if (isValidResponseStatusCode(response.statusCode)) {
		if (response.body.filter((item) => config.get('tags').includes(item.name.toLowerCase())).length > 0) {
			log.info('Did contain tags to prevent merge');
			await reportSuccess(pullRequest, false);
		} else {
			log.info('Merge is allowed');
			await reportSuccess(pullRequest, true);
		}
	} else {
		throw response;
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

async function putMergeLock(req, res) {
	const repo = req.query.repo;
	const message = req.query.message ? `: ${req.query.message}` : '';
	mergeLock = {
		state : 'error',
		context : 'Consuela merge-lock',
		description : `Merge lock in place${message}`
	};
	const prShas = await listPullRequestsShas(repo);
	await Promise.all(prShas.map(sha => setStatus(repo, sha, mergeLock)));

	res.sendStatus(200);
}

async function releaseMergeLock(req, res) {
	mergeLock = null;
	const repo = req.query.repo;
	const status = {
		state : 'success',
		context : 'Consuela merge-lock',
		description : 'No merge lock!'
	};
	const prShas = await listPullRequestsShas(repo);
	await Promise.all(prShas.map(sha => setStatus(repo, sha, status)));
	res.sendStatus(200);
}

async function setStatus(repo, sha, status) {
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
}

async function listPullRequestsShas(repo) {
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

function isValidResponseStatusCode(code) {
	return code >= 200 && code < 300;
}
