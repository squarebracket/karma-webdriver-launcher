var wd = require('selenium-webdriver');
var firefox = require('selenium-webdriver/firefox');
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
    case 'firefoxPreferences':
      // ignore
      return;
    }
    spec[key] = value;
  });

  if (!spec.browserName) {
    throw new Error('browserName is required!');
  }

  baseBrowserDecorator(this);

  if (spec.applicationName) {
    this.name = spec.applicationName + ' via Selenium Grid';
  } else {
    this.name = spec.browserName + ' (' + (spec.platform || spec.platformName) +
      ') via Selenium Grid';
  }

  const caps = new wd.Capabilities(spec);
  if (args.setAcceptInsecureCerts) {
    log.info('Setting insecure certs for ' + self.name);
    caps.setAcceptInsecureCerts(args.setAcceptInsecureCerts);
  }

  const firefoxOptions = new firefox.Options(args.firefoxPreferences);
  // these prefs are what's set by karma-firefox-launcher, which i've
  // mindlessly copied here
  firefoxOptions.setPreference('browser.shell.checkDefaultBrowser', false);
  firefoxOptions.setPreference('browser.bookmarks.restore_default_bookmarks', false);
  firefoxOptions.setPreference('dom.disable_open_during_load', false);
  firefoxOptions.setPreference('dom.max_script_run_time', 0);
  firefoxOptions.setPreference('extensions.autoDisableScopes', 0);
  firefoxOptions.setPreference('browser.tabs.remote.autostart', false);
  firefoxOptions.setPreference('browser.tabs.remote.autostart.2', false);
  firefoxOptions.setPreference('extensions.enabledScopes', 15);
  if (args.firefoxPreferences) {
    Object.keys(args.firefoxPreferences).forEach((pref) => {
      log.info('setting pref ' + pref + ' to ' + args.firefoxPreferences[pref]);
      firefoxOptions.setPreference(pref, args.firefoxPreferences[pref]);
    });
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
    var urlObj = urlparse(url, true);

    handleXUaCompatible(spec, urlObj);

    delete urlObj.search; //url.format does not want search attribute
    url = urlformat(urlObj);

    log.debug('Grid URL: ' + gridUrl);
    log.debug('Browser capabilities: ' + JSON.stringify(spec));

    self.browser = new wd.Builder()
      .setFirefoxOptions(firefoxOptions)
      .usingServer(gridUrl)
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
          self._done('failure');
          self._onProcessExit(self.error ? -1 : 0, self.error);
        });

    self._process = {
      kill: function() {
        interval && clearInterval(interval);
        self.browser.close()
          .then(() => self.browser.quit())
          .then(() => {
            log.info('Killed ' + self.name + '.');
            self._done();
            self._onProcessExit(self.error ? -1 : 0, self.error);
          })
          .catch(() => {
            log.info('Error stopping browser ' + self.name);
            self._done();
            self._onProcessExit(self.error ? -1 : 0, self.error);
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
