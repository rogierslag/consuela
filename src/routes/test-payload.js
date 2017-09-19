import config from 'config';

import log from '../log';

export default function (req, res, next) {
	if (req.body.zen) {
		// This is a github test payload!
		log.info('Received Github test payload');
		const validRepo = config.get('repos').includes(req.body.repository.full_name.toLowerCase());
		if (validRepo) {
			res.status(200).send('Well Github, I love you too!');
		} else {
			res.status(403).send('This repository is not configured for Consuela');
		}
	}
	else {
		next();
	}
}
