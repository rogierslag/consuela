FROM ubuntu:14.04.2
MAINTAINER Rogier Slag

# In order to reduce the image size, we need to do all of this in one command
RUN apt-get update && \
  apt-get install -y software-properties-common && \
  add-apt-repository ppa:chris-lea/node.js && \
  apt-get remove -y software-properties-common && \
  apt-get autoremove -y && \
  apt-get clean
# get node.js
RUN apt-get update && apt-get install -y nodejs && apt-get clean

# Set the application
ADD package.json /opt/consuela/package.json
ADD server.js /opt/consuela/server.js

# Set the exposed stuff
VOLUME /opt/consuela/config
EXPOSE 8543

# Run NPM love
RUN cd /opt/consuela && npm install

# Start it!
WORKDIR /opt/consuela
CMD ["/usr/bin/node", "server.js"]

