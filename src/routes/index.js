import checkHealth from './health.js';
import testPayload from './test-payload.js';
import labelCheck, {checkPullRequestBody} from './label-check.js';
import {validateSecretKey, validateRepo, putMergeLock, releaseMergeLock} from './merge-lock.js';

export default function setupRoutes(app) {
	app.get('/health', checkHealth);
	app.post('/', testPayload, checkPullRequestBody, labelCheck);
	app.post('/merge-lock', validateSecretKey, validateRepo, putMergeLock);
	app.delete('/merge-lock', validateSecretKey, validateRepo, releaseMergeLock);
}
