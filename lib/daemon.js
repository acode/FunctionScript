const cluster = require('cluster');
const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');

const Gateway = require('./gateway.js');

/**
* Multi-process HTTP Daemon that resets when files changed (in development)
* @class
*/
class Daemon {

  constructor (name, cpus) {

    this.name = name || 'HTTP';

    this._watchers = null;

    this._error = null;
    this._server = null;
    this._port = null;

    this._paused = false;

    this.cpus = parseInt(cpus) || os.cpus().length;
    this.children = [];

    process.on('exit', (code) => {

      console.log(`[${this.name}.Daemon] Shutdown: Exited with code ${code}`);

    });

  }

  /**
  * Starts the Daemon. If all application services fail, will launch a
  *   dummy error app on the port provided.
  * @param {Number} port
  */
  start(port) {

    this._port = port || 3000;

    console.log(`[${this.name}.Daemon] Startup: Initializing`);

    if ((process.env.NODE_ENV || 'development') === 'development') {

      this.watch('', (changes) => {
        changes.forEach(change => {
          console.log(`[${this.name}.Daemon] ${change.event[0].toUpperCase()}${change.event.substr(1)}: ${change.path}`);
        });
        this.children.forEach(child => child.send({invalidate: true}));
        this.children = [];
        !this.children.length && this.unwatch() && this.start();
      });

    }

    this._server && this._server.close();
    this._server = null;

    for (var i = 0; i < this.cpus; i++) {

      let child = cluster.fork();
      this.children.push(child);

      child.on('message', this.message.bind(this));
      child.on('exit', this.exit.bind(this, child));

    }

    console.log(`[${this.name}.Daemon] Startup: Spawning HTTP Workers`);

  }

  /**
  * Daemon failed to load, set it in idle state (accept connections, give dummy response)
  */
  idle() {

    let port = this._port || 3000;

    this._server = http
      .createServer((req, res) => {
        this.error(req, res, this._error);
        req.connection.destroy();
      })
      .listen(port);

    console.log(`[${this.name}.Daemon] Idle: Unable to spawn HTTP Workers, listening on port ${port}`);

  }

  error(req, res, error) {

    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end(`Application Error:\n${error.stack}`);

  }

  message(data) {

    if (data.error) {
      this.logError(data.error);
    }

  }

  /**
  * Shut down a child process given a specific exit code. (Reboot if clean shutdown.)
  * @param {child_process} child
  * @param {Number} code Exit status codes
  */
  exit(child, code) {

    let index = this.children.indexOf(child);

    if (index === -1) {
      return;
    }

    this.children.splice(index, 1);

    if (code === 0) {
      child = cluster.fork();
      this.children.push(child);
      child.on('message', this.message.bind(this));
      child.on('exit', this.exit.bind(this, child));
    }

    if (this.children.length === 0) {
      this.idle();
    }

  }

  /**
  * Log an error on the Daemon
  * @param {Error} error
  */
  logError(error) {

    this._error = error;
    this._server = null;
    console.log(`[${this.name}.Daemon] ${error.name}: ${error.message}`);
    console.log(error.stack);

  }

  /**
  * Stops watching a directory tree for changes
  */
  unwatch() {

    clearInterval(this._watchers.interval);
    this._watchers = null;
    return true;

  }

  /**
  * Watches a directory tree for changes
  * @param {string} root Directory tree to watch
  * @param {function} onChange Method to be executed when a change is detected
  */
  watch (root, onChange) {

    let cwd = process.cwd();

    function watchDir (dirname, watchers) {

      if (!watchers) {

        watchers = Object.create(null);
        watchers.directories = Object.create(null);
        watchers.interval = null;

      }

      let pathname = path.join(cwd, dirname);
      let files = fs.readdirSync(pathname);

      watchers.directories[dirname] = Object.create(null);

      files.forEach(function (name) {

        if (name === 'node_modules' || name.indexOf('.') === 0) {
          return;
        }

        let filename = path.join(dirname, name);
        let fullPath = path.join(cwd, filename);

        let stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          watchDir(filename, watchers);
          return;
        }

        watchers.directories[dirname][name] = stat;

      });

      return watchers;

    }

    let watchers = watchDir(root || '');
    let self = this;

    watchers.iterate = function (changes) {
      if (!fs.existsSync(path.join(process.cwd(), '.daemon.pause'))) {
        // Skip a cycle if just unpaused...
        if (!this._paused) {
          if (changes.length) {
            onChange.call(self, changes);
          }
        } else {
          this._paused = false;
        }
      } else {
        this._paused = true;
      }
    };

    watchers.interval = setInterval(function() {

      let changes = [];

      Object.keys(watchers.directories).forEach(function (dirname) {

        let dir = watchers.directories[dirname];
        let dirPath = path.join(cwd, dirname);

        if (!fs.existsSync(dirPath)) {

          delete watchers.directories[dirname];
          changes.push({event: 'removed', path: dirPath});

        } else {

          let files = fs.readdirSync(dirPath);
          let added = [];

          let contents = Object.create(null);

          files.forEach(function (filename) {

            if (filename === 'node_modules' || filename.indexOf('.') === 0) {
              return;
            }

            let fullPath = path.join(dirPath, filename);
            let stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              let checkPath = path.join(dirname, filename);
              if (!watchers.directories[checkPath]) {
                watchDir(checkPath, watchers);
              }
            } else {
              if (!dir[filename]) {
                added.push([filename, stat]);
                changes.push({event: 'added', path: fullPath});
                return;
              }

              if (stat.mtime.toString() !== dir[filename].mtime.toString()) {
                dir[filename] = stat;
                changes.push({event: 'modified', path: fullPath});
              }

              contents[filename] = true;
            }

          });

          Object.keys(dir).forEach(function (filename) {

            let fullPath = path.join(cwd, dirname, filename);

            if (!contents[filename]) {
              delete dir[filename];
              changes.push({event: 'removed', path: fullPath});
            }

          });

          added.forEach(function (change) {
            let [filename, stat] = change;
            dir[filename] = stat;
          });

        }

      });

      watchers.iterate(changes);

    }, 1000);

    return this._watchers = watchers;

  }

}

class FunctionScriptDaemon extends Daemon {
  constructor (cpus) {
    super('FunctionScript', cpus);
  }
}

FunctionScriptDaemon.Gateway = class FunctionScriptDaemonGateway extends Gateway {

  constructor (cfg) {
    super(cfg);
    process.on('uncaughtException', e => {
      if (typeof process.send === 'function') {
        process.send({
          error: {
            name: e.name,
            message: e.message,
            stack: e.stack
          }
        });
      }
      process.exit(1);
    });
    process.on('message', data => data.invalidate && process.exit(0));
    process.on('exit', code => this.log(null, `Shutdown: Exited with code ${code}`));
  }

  listen (port, callback, opts) {
    super.listen(port, callback, opts);
    if (typeof process.send === 'function') {
      process.send({message: 'ready'});
    }
    return this.server;
  }

}

module.exports = FunctionScriptDaemon;
