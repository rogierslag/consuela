import checkHealth from './health';
import testPayload from './test-payload';
import labelCheck, {checkPullRequestBody} from './label-check';
import {validateSecretKey, validateRepo, putMergeLock, releaseMergeLock} from './merge-lock';

export default function setupRoutes(app) {
	app.get('/health', checkHealth);
	app.post('/', testPayload, checkPullRequestBody, labelCheck);
	app.post('/merge-lock', validateSecretKey, validateRepo, putMergeLock);
	app.delete('/merge-lock', validateSecretKey, validateRepo, releaseMergeLock);
}
