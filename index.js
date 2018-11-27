var wd = require('selenium-webdriver');
var urlModule = require('url');
var urlparse = urlModule.parse;
var urlformat = urlModule.format;

var SeleniumGridInstance = function (baseBrowserDecorator, args, logger) {
  var log = logger.create('SeleniumGrid');

  var gridUrl = args.gridUrl || 'http://localhost:4444/wd/hub';
  var self = this;

  // Intialize with default values
  var spec = {
    platform: 'ANY',
    testName: 'Karma test',
    version: 'ANY'
  };

  Object.keys(args).forEach(function (key) {
    var value = args[key];
    switch (key) {
    case 'applicationName':
        break;
    case 'browserName':
      break;
    case 'platform':
      break;
    case 'testName':
      break;
    case 'tags':
      break;
    case 'version':
      break;
    case 'gridUrl':
    case 'setAcceptInsecureCerts':
      // ignore
      return;
    }
    spec[key] = value;
  });

  if (!spec.browserName) {
    throw new Error('browserName is required!');
  }

  const caps = new wd.Capabilities(spec);
  if (args.setAcceptInsecureCerts) {
    caps.setAcceptInsecureCerts(args.setAcceptInsecureCerts);
  }

  baseBrowserDecorator(this);

  if (spec.applicationName) {
    this.name = spec.applicationName + ' via Selenium Grid';
  } else {
    this.name = spec.browserName + ' (' + (spec.platform || spec.platformName) +
      ') via Selenium Grid';
  }

  // Handle x-ua-compatible option same as karma-ie-launcher(copy&paste):
  //
  // Usage :
  //   customLaunchers: {
  //     IE9: {
  //       base: 'SeleniumGrid',
  //       gridUrl: 'http://your-grid.example.com:4444/wd/hub',
  //       browserName: 'internet explorer',
  //       'x-ua-compatible': 'IE=EmulateIE9'
  //     }
  //   }
  //
  // This is done by passing the option on the url, in response the Karma server will
  // set the following meta in the page.
  //   <meta http-equiv="X-UA-Compatible" content="[VALUE]"/>
  function handleXUaCompatible(args, urlObj) {
    if (args['x-ua-compatible']) {
      urlObj.query['x-ua-compatible'] = args['x-ua-compatible'];
    }
  }

  this._start = function (url) {
    log.info(url);
    var urlObj = urlparse(url, true);

    handleXUaCompatible(spec, urlObj);

    delete urlObj.search; //url.format does not want search attribute
    url = urlformat(urlObj);

    log.debug('Grid URL: ' + gridUrl);
    log.debug('Browser capabilities: ' + JSON.stringify(spec));

    self.browser = new wd.Builder().usingServer(gridUrl)
      .withCapabilities(caps).build();

    var interval = spec.browserName !== 'internet explorer' && 
        args.pseudoActivityInterval && setInterval(function() {
      log.debug('Imitate activity');
      self.browser.getTitle()
        .catch((err) => {
          log.error('Caught error for browser ' + 
            self.name + ': ' + err);
        });
    }, args.pseudoActivityInterval);

    self.browser
        .get(url)
        .then(() => {
          log.debug(self.name + ' started');
        })
        .catch((err) => {
          log.error(self.name + ' was unable to start: ' + err);
        });

    self._process = {
      kill: function() {
        interval && clearInterval(interval);
        self.browser.close()
          .then(() => self.browser.quit())
          .then(() => {
            log.info('Killed ' + self.name + '.');
            self._onProcessExit(self.error ? -1 : 0, self.error);
          })
          .catch(() => {
            log.info('Error stopping browser ' + self.name);
          });
      }
    };
  };

  // We can't really force browser to quit so just avoid warning about SIGKILL
  this._onKillTimeout = function(){};
};

SeleniumGridInstance.prototype = {
  name: 'SeleniumGrid',

  DEFAULT_CMD: {
    linux: undefined,
    darwin: undefined,
    win32: undefined
  },
  ENV_CMD: 'SeleniumGrid_BIN'
};

SeleniumGridInstance.$inject = ['baseBrowserDecorator', 'args', 'logger'];

// PUBLISH DI MODULE
module.exports = {
  'launcher:SeleniumGrid': ['type', SeleniumGridInstance]
};
