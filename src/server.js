'use strict';

import express from 'express';
import bodyParser from 'body-parser';

import setUpRoutes from './routes';

import log from './log';

// Create the server
const app = express();
app.use(bodyParser.json());

setUpRoutes(app);

const port = 8543;

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
