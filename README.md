# Litecoin Network Grokker
==========================
Welcome to the Litecoin Network Grokker.  The goal of this project is to traverse the entire Litecoin network to gather all kinds of information about it.  Currently, this project traverses the entire Litecoin network using an algorithm very similar to Breadth First Search.  

## The Project
==============
This project is split into two parts:
 1. The Crawler
 2. The Listener

The Crawler is, as described above, does an algorithm very similar to Breadth First Search.  It starts with a seeding peer, connects to it, get's all the peers it knows, and connects to those ad infinitum.  The Crawler also sends [addr](https://en.bitcoin.it/wiki/Protocol_documentation#addr) messages every 10 minutes in order to aid The Listener.

The Listener exists because for some reason, some nodes exist that don't accept incoming connections, but do perform outbound connections.  In order to still account for these nodes, the listener simply sets up a listening server that accepts peers.  Other peers in the world can find out about this server because of the addr messages The Crawler sends every ten minutes.  Like The Crawler, this piece also sends addr messages every 10 minutes in the hopes that other outbound connection only peers will get it.

These two pieces, when combined, give us an accurate way to measure the size of the Litecoin network.  

## Startup
==========
Because this project is split into two parts, The Crawler and The Listener can be run independently.  If you'd like to run only The Crawler, navigate to the crawler directory and run `npm run start`, this will start up the crawler as well as a reloader in case the crawler crashes.  If you'd like to run only The Listener, navigate to the listener directory and run `node listener.js`. A side effect of the project being split, is that before either part is run, you have to run `npm install` in each directory so Node can install the proper dependencies.

The Crawler can run with no configuration if you don't care to log your findings, just rename `config.sample.js` to `config.js` and it'll report a warning about MySQL, but if you don't want logging it's fine.

The Listener does need some configuration for it to work right.  Rename `config.sample.js` to `config.js` and enter in the MySQL information (if you'd like) as well as a listening port for the server. 
