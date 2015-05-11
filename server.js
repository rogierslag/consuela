'use strict';

var express = require('express');
var config = require('config');
var bodyParser = require('body-parser');
var request = require("request");

// Create the server
var app = express();
app.use(bodyParser.json());
app.post('/', checkPayload);

// And listen!
var server = app.listen(8543, function () {
    console.log("Server started listening");
});

// Determine whether to do something with the payload
function checkPayload(req, res) {
  if ( config.get('repos').indexOf(req.body.pull_request.head.repo.full_name) > -1 ) {
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
    res.writeHead(403, 'Forbidden');
    res.end();
    return;
  }
}

// Determine what we should send back to github
function checkLabels(req, res) {
  var url = 'https://api.github.com/repos/' + req.body.pull_request.head.repo.full_name + '/issues/' + req.body.pull_request.number + '/labels'
  console.log(url);
  request({
      url: url,
      json: true,
      auth: {
        user: config.get('github.username'),
        pass: config.get('github.password'),
        sendImmediately: true
    },
    headers: {
      'User-Agent': 'Consuela https://github.com/rogierslag/consuela'
    }
  }, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        if ( body.filter(function(item){ console.log(item); return config.get("tags").indexOf(item.name.toLowerCase()) > -1}).length > 0 ) {
          console.log('Did contain tags to prevent merge');
          reportSuccess(req, res, false);
        } else {
          console.log('Merge is allowed');
          reportSuccess(req, res, true);
        }
      } else {
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
  console.log(body);

  request.post({
      url: url,
      json: true,
      auth: {
        user: config.get('github.username'),
        pass: config.get('github.password'),
        sendImmediately: true
    },
    headers: {
      'User-Agent': 'Consuela https://github.com/rogierslag/consuela'
    },
    body: body
  }, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        res.writeHead(200, 'OK');
        res.end();
      } else {
        res.writeHead(500, 'Internal server error');
        res.end();
      }
    });
  }

