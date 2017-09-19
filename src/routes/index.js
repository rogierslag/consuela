import checkHealth from './health';
import testPayload from './test-payload';
import labelCheck, {checkPullRequestBody} from './label-check';
import {validateRepo, putMergeLock, releaseMergeLock} from './merge-lock';

export default function setupRoutes(app) {
	app.get('/health', checkHealth);
	app.post('/', testPayload, checkPullRequestBody, labelCheck);
	app.post('/merge-lock', validateRepo, putMergeLock);
	app.delete('/merge-lock', validateRepo, releaseMergeLock);
}
