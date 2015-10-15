'use strict';

var express = require('express');
var config = require('config');
var bodyParser = require('body-parser');
var request = require("request");

// Create the server
var app = express();
app.use(bodyParser.json());
app.get('/health', checkHealth);
app.post('/', checkPayload);

// And listen!
var server = app.listen(8543, function () {
    console.log("Consuela picked up the phone and started listening");
});

// Check whether we are running and if yes return ok
function checkHealth(req, res) {
  res.writeHead(200, 'OK');
  res.write('Si?');
  res.end();
  console.log('Processed successful healthcheck');
  return;
}

// Determine whether to do something with the payload
function checkPayload(req, res) {
  if ( req.body.zen ) {
    // This is a github test payload!
    console.log("Github test payload");
    var validRepo = config.get('repos').indexOf(req.body.repository.full_name.toLowerCase()) > -1;
    if ( validRepo ) {
      res.status(200).write('Well Github, I love you too!').end();
    } else {
      res.status(403).write('This repository is not configured for Consuela').end();
    }
    return;
  }

  if ( config.get('repos').indexOf(req.body.pull_request.head.repo.full_name.toLowerCase()) > -1 ) {
    console.log("Received a request for matching repo: " + req.body.pull_request.head.repo.full_name);
    console.log("Action is: " + req.body.action);
    if ( req.body.action === 'opened' || req.body.action === 'labeled' || req.body.action === 'unlabeled' || req.body.action === 'synchronize' ) {
      return checkLabels(req, res);
    } else {
      res.writeHead(200, 'OK');
      res.end();
      return;
    }
  } else {
    console.log('Incoming request did not match any repository [' + req.body.pull_request.head.repo.full_name + ']');
    res.writeHead(403, 'Forbidden');
    res.end();
    return;
  }
}

// Determine what we should send back to github
function checkLabels(req, res) {
  var url = 'https://api.github.com/repos/' + req.body.pull_request.head.repo.full_name + '/issues/' + req.body.pull_request.number + '/labels'
  request({
    url: url,
    json: true,
    headers: {
      'User-Agent': 'Consuela https://github.com/rogierslag/consuela',
      'Authorization': 'token ' + config.get('github.oauth_token')
    },
  }, function (error, response, body) {
      if (!error && isValidResponseStatusCode(response.statusCode)) {
        if ( body.filter(function(item){ return config.get("tags").indexOf(item.name.toLowerCase()) > -1}).length > 0 ) {
          console.log('Did contain tags to prevent merge');
          reportSuccess(req, res, false);
        } else {
          console.log('Merge is allowed');
          reportSuccess(req, res, true);
        }
      } else {
        console.log('Received an eror from github on url ' + url + ' with body ' + body + ': ' + error + ' (' + response.statusCode + ') with response ' + JSON.stringify(response));
        res.writeHead(500, 'Internal server error');
        res.end();
      }
  });
}

function reportSuccess(req, res, result) {
  var url = 'https://api.github.com/repos/' + req.body.pull_request.head.repo.full_name + '/statuses/' + req.body.pull_request.head.sha;
  var body;

  if ( result ) {
    body = {state: "success", context: "Consuela", description: "Consuela says: This PR may be merged."};
  } else {
    body = {state: "error", context: "Consuela", description: "Consuela shouts: This PR should not be merged yet!"};
  }

  request.post({
    url: url,
    json: true,
    headers: {
      'User-Agent': 'Consuela https://github.com/rogierslag/consuela',
      'Authorization': 'token ' + config.get('github.oauth_token')
    },
    body: body
  }, function (error, response, body) {
      if (!error && isValidResponseStatusCode(response.statusCode)) {
        res.writeHead(200, 'OK');
        res.end();
      } else {
        console.log('Received an eror from github on url ' + url + ' with body ' + body + ': ' + error + ' (' + response.statusCode + ') with response ' + JSON.stringify(response));
        res.writeHead(500, 'Internal server error');
        res.end();
      }
    });
  }

function isValidResponseStatusCode(code) {
  return code >= 200 && code < 300;
}
