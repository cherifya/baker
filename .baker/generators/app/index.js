/* eslint max-len: "off" */
/* globals which: false */

import 'shelljs/global';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import BaseGenerator from '../base';

module.exports = BaseGenerator.extend({
  constructor(args, options) {
    BaseGenerator.call(this, args, options);

    this.applicationName = this.options.name;

    if (!this.applicationName) {
      // Use current directory name as the app name
      this.applicationName = path.basename(this.destinationPath('./'));
    }

    this.applicationName = this.namingConventions.applicationName.clean(this.applicationName);
  },

  initializing() {
    // XX: check if current directory has smth resembling a bootstrapped RN application
    if (this._currentDirectoryHasRNApp()) {
      this._abortSetup();
    }

    if (!this._checkIfRNIsInstalled()) {
      this.env.error('No React Native found: start by installing it https://facebook.github.io/react-native/docs/getting-started.html#quick-start');
    }

    this.originalDestination = this.destinationPath('.');
  },

  writing: {
    serverFiles() {
      this.bulkDirectory('server', this.serverDirectory);
    },
  },

  install: {
    // react-native init needs to run before app folder is created
    // otherwise it bails
    installAppDepsAndRunRNSetup() {
      this._initRN();

      if (this.originalDestination !== this.destinationPath('.')) {
        this.destinationRoot(this.originalDestination);
      }

      this._runYarnInstall(this.destinationPath(this.serverDirectory));
    },

    appPackageJSON() {
      this.template('package.json.hbs', `${this.appDirectory}/package.json`, {
        applicationName: this.applicationName,
      });
    },

    assetsDirectory() {
      this.bulkDirectory('assets', `${this.appDirectory}/assets`);
    },
  },

  end() {
    if (this.originalDestination !== this.destinationPath('.')) {
      this.destinationRoot(this.originalDestination);
    }

    this.conflicter.force = true;

    ['ios', 'android'].forEach(platform => {
      this.template('index.js.hbs', `${this.appDirectory}/index.${platform}.js`,
        {
          applicationName: this.applicationName,
        }
      );
    });

    this.bulkDirectory('src', `${this.appDirectory}/src`);
    this.bulkDirectory('settings', this.appSettingsDirectory);
    // XX: make sure production server settings never get checked into the repository
    this.write(`${this.appDirectory}/settings/production/.gitignore`, 'server.json');
    // link to app settings from the project root
    execSync(`ln -s ${this.appDirectory}/settings ./settings`, {
      cwd: this.destinationPath('.'),
    });

    this.composeWith('component', {
      options: {
        componentName: 'App',
        boilerplateName: 'Vanila',
        platformSpecific: false,
      },
    }, {
      local: require.resolve('../component'),
    });

    this.composeWith('model', {
      options: {
        modelName: 'Example',
      },
    }, {
      local: require.resolve('../model'),
    });

    // Setup Fastlane jazz
    this.template('fastlane/Gemfile', `${this.appDirectory}/fastlane/Gemfile`);
    this.template('fastlane/Fastfile', `${this.appDirectory}/fastlane/Fastfile`, {
      applicationName: this.applicationName,
    });
    this.template('fastlane/Matchfile', `${this.appDirectory}/fastlane/Matchfile`);

    // Generate App Icons
    execSync('npm run icons', {
      cwd: this.destinationRoot(),
    });

    // Remove generated __tests__ directory from the root of RN project
    rm('-rf', this.destinationPath(`${this.appDirectory}/__tests__`));

    // Run a final yarn install to catch the overwritten package.json
    this._runYarnInstall(this.destinationPath(this.appDirectory));
  },

  _checkIfRNIsInstalled() {
    return which('react-native');
  },

  _initRN() {
    this.log('Initializing React Native app to ' + this.destinationPath('app'));
    this.spawnCommandSync('/usr/local/bin/npx', [
      'react-native',
      'init',
      this.applicationName,
      '--directory',
      this.destinationPath('app'),
      '--template',
      'react-native-template-moule'
    ]);
  },

  _runYarnInstall(workingdirectory) {
    const command = which('yarn') ? 'yarn install' : 'npm install';

    execSync(command, {
      cwd: workingdirectory,
    });
  },

  _currentDirectoryHasRNApp() {
    try {
      ['android', 'ios', 'index.ios.js', 'index.android.js'].forEach(f => fs.statSync(this.destinationPath(f)));
      return true;
    } catch (e) {
      return false;
    }
  },

  _abortSetup() {
    this.env.error('Yo! Looks like you are trying to run the app generator in a directory that already has a RN app.');
  },
});
