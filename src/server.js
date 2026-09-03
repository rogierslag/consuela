'use strict';

import express from 'express';
import bodyParser from 'body-parser';

import setUpRoutes from './routes/index.js';

import log from './log.js';

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
		log.error('Something broke! Failed to start listening. Error was:', e);
	}
});

function close() {
	server.close();
}

process.on('exit', (code) => {
	if (code) {
		log.error(`Exiting with code ${code}`);
	}
	else {
		log.info('Exited normally');
	}
});

process.on('SIGINT', close);
process.on('SIGTERM', close);

process.on('uncaughtException', (err) => {
	log.error('Got an uncaught exception, closing down', err);
	close();
});
process.on('unhandledRejection', (err) => {
	log.error('Got an unhandled promise rejection, closing down', err);
	close();
});
