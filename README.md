# Consuela

![consuela](http://i.imgur.com/ysTG8Qr.jpg)

## What is it?

Consuela is a tool we use at [inventid](https://www.inventid.nl) to prevent accidental merges.
It works by checking tags of your Pull request.
In case a PR has one of the mentioned tags, Consuela will drop a status to your PR to prevent merges.


## Merge locking

Additionally, Consuela offers support for locking repositories entirely through the `/merge-lock` endpoint.
This puts an error status on all the open pull request, indicating an ongoing merge lock
The endpoints can be accessed using `POST` for setting the lock, and `DELETE` for releasing it.
Both endpoints require a `repo` query parameter to be set, and the lock creation optionally supports a `message` query param for indicating why the lock is in place.

One caveat of the current locking system is that it uses a global variable to store the current lock state.
That means that if a lock is in place and Consuela is restarted, any changes to pull requests will not be updated with the lock status.

# What does it look like?

![screenshot 2015-05-08 21 11 18](https://cloud.githubusercontent.com/assets/2778689/7543879/740e1df2-f5c8-11e4-95a5-9dd3032efda2.png)

![screenshot 2015-05-08 21 11 27](https://cloud.githubusercontent.com/assets/2778689/7543881/75dc53b0-f5c8-11e4-8ce1-a0a26a8b4437.png)

# How to use it?
It works really simple:

1. Copy the `default.json.example` to `default.json`
1. Edit the username and password (that user should have write access to the repo)
1. Add the repository
1. Add the named tags you wish to use to prevent merges
1. Add the webhook (add a webhook to the URL the system is running, use `application/json`, and leave the secret empty. As the hook, only select `Pull Request`.
1. Run system

## Plain node

```bash
node server.js
```

## Puppet

```puppet
class consuela {

  file { '/opt/consuela.json':
    ensure => present,
    source => 'puppet:///modules/consuela/config.json',
    mode   => '0600',
    notify => Docker::Run['consuela']
  }

  docker::image { 'rogierslag/consuela:latest': }

  docker::run { 'consuela':
    image => 'rogierslag/consuela',
    volumes => ['/opt/consuela.json:/opt/consuela/config/default.json'],
    ports => ["${ipaddress_eth0}:8543:8543"]
  }

  firewall { '200 allow gonzuela':
    dport => ['8543'],
    proto => 'tcp',
    action => 'accept'
  }
}
```

## Docker

```bash
sudo docker run -d -v /opt/consuela.json:/opt/consuela/config/default.json -p <IP>:8543:8543 rogierslag/consuela
```
