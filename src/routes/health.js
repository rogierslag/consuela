import log from '../log';
// Check whether we are running and if yes return ok
export default function checkHealth(req, res) {
	res.send('Si?');
	log.info('Processed successful healthcheck');
}
