const {BufferedProcess} = require('atom')
const _ = require('underscore-plus')
const crypto = require('crypto')
const store = require('store')
const fs = require('fs')
const async = require('async')
const PackageManager = require('./package-manager')
const StateManager = require('./state-manager')


/**
 * Manages Atom packages and settings
 */
class AtomSettingsManager extends PackageManager {

    constructor() {

        super()

        this._stateManager = new StateManager()
        this._packageSettings = this._stateManager.getPackageSettings()

        this.startSettingsChangeCheck()
    }


    /**
     * Apply package settings
     *
     * @return {void}
     */
    applyPackageSettings(pref, settings) {
        for (var key in settings) {
            var value = settings[key];
            var keyPath = `${pref}.${key}`;
            var isColor = false;
            if (_.isObject(value)) {
                var valueKeys = Object.keys(value);
                var colorKeys = ['alpha', 'blue', 'green', 'red'];
                isColor = _.isEqual(_.sortBy(valueKeys), colorKeys);
            }

            if (_.isObject(value) && !_.isArray(value) && !isColor)
                this.applyPackageSettings(keyPath, value);
            else {
                atom.config.set(keyPath.slice(1), value);
            }
        }
    }


    applySettingsFiles(files) {

        for(let fileName in files) {
            let file = files[fileName]

            switch(fileName) {
                case 'settings.json':
                    this.applyPackageSettings('', JSON.parse(file.content))
                    break

                case 'keymap.cson':
                    fs.writeFileSync(atom.keymaps.getUserKeymapPath(), file.content)
                    break

                case 'styles.less':
                    fs.writeFileSync(atom.styles.getUserStyleSheetPath(), file.content)
                    break

                case 'init.coffee':
                    fs.writeFileSync(atom.config.configDirPath + "/init.coffee", file.content)
                    break

                case 'snippets.cson':
                    fs.writeFileSync(atom.config.configDirPath + "/snippets.cson", file.content)
                    break

                default: break
            }

        }
    }


    /**
     * Returns Atom settings files:
     * <pre>
     *   - packages.json
     *   - settings.json
     *   - keymap.cson
     *   - styles.less
     *   - init.cofee
     *   - snippets.cson
     * </pre>
     *
     * @return {Object} Atom settings files
     */
    getFiles() {
      var files = {};
      var ref;

      // TODO: Don't add nonexistent files

      if (this._packageSettings.syncSettings) {
        files["settings.json"] = { content: this.getFilteredSettings() };
        files["keymap.cson"] = { content: (ref = this.fileContent(atom.keymaps.getUserKeymapPath())) != null ? ref : "# keymap file (not found)" };
        files["styles.less"] = { content: (ref = this.fileContent(atom.styles.getUserStyleSheetPath())) != null ? ref : "// styles file (not found)" };
        files["init.coffee"] = { content: (ref = this.fileContent(atom.config.configDirPath + "/init.coffee")) != null ? ref : "# initialization file (not found)" };
        files["snippets.cson"] = { content: (ref = this.fileContent(atom.config.configDirPath + "/snippets.cson")) != null ? ref : "# snippets file (not found)" };
      }

      if (this._packageSettings.syncPackages)
        files["packages.json"] = { content: JSON.stringify(this.getPackages(), null, '\t') };

      for (var file of this._packageSettings.extraFiles) {
        var ext = file.slice(file.lastIndexOf(".")).toLowerCase();
        var cmtstart = "#";
        if (ext === ".less" || ext === ".scss" || ext === ".js") cmtstart = "//";
        if (ext === ".css") cmtstart = "/*";
        var cmtend = "";
        if (ext === ".css") cmtend = "*/";
        files[file] = { content: (ref = this.fileContent(atom.config.configDirPath + ("/" + file))) != null ? ref : cmtstart + " " + file + " (not found) " + cmtend };
      }

      return files
    }


    /**
     * Returns installed packages
     *
     * @return {Array} Installed packages
     */
    getPackages() {
      var packages = [];
      var hasProp = {}.hasOwnProperty;
      var ref = atom.packages.getLoadedPackages();
      for (var name in ref) {
        if (!hasProp.call(ref, name)) continue;
        var info = ref[name];
        var ref1 = info.metadata;
        var name = ref1.name
        var version = ref1.version
        var theme = ref1.theme;
        packages.push({
          name: name,
          version: version,
          theme: theme
        });
      }
      return _.sortBy(packages, 'name');
    }


    /**
     * Returns Atom settings files without the blacklisted ones
     *
     * @return {Object} Filtered Atom settings
     */
    getFilteredSettings() {
        var settings = JSON.parse(JSON.stringify(atom.config.settings));

        for (var blacklistedKey of this._packageSettings.blacklistedKeys) {
            var blacklistedKey = blacklistedKey.split(".");
            this._removeProperty(settings, blacklistedKey);
        }

        return JSON.stringify(settings, null, '\t');
    }


    /**
     * Autocheck packages/settings changes
     * Will start only once even if called
     * multiple times across instances
     *
     * @return {void}
     */
    startSettingsChangeCheck() {
        if (AtomSettingsManager._settingsChangeCheckTimer)
            return

        AtomSettingsManager._settingsChangeCheckTimer = setInterval(() => this.refreshLastClientUpdate(), 60000)
    }

    /**
     * Stop autocheck packages/settings changes
     *
     * @return {void}
     */
    stopSettingsChangeCheck() {
        clearInterval(AtomSettingsManager._settingsChangeCheckTimer)
        AtomSettingsManager._settingsChangeCheckTimer = false
    }


    /**
     * lastClientUpdate is updated only if
     * atom-package-sync is currently
     * syncing (lastUpdate != null)
     *
     * @return {void}
     */
    refreshLastClientUpdate() {
        if (this._stateManager.syncLock)
            return

        if (this._stateManager.getLastUpdate() && this.settingsChanged()) {
            this.setLastUpdate(new Date())
        }
    }



    /**
     * Set last client-side update.
     * Mostly used to sync last server and client update
     *
     * @param  {Date} last update
     * @return {void}
     */
    setLastUpdate(date) {
        store.set('atom-package-sync:checksum', this.getAtomSettingsChecksum())
        store.set('atom-package-sync:lastUpdate', date)
    }



    /**
     * Returns true if settings files changed by comparing
     * the last checksum calculated with the current one
     * Returns false if no lastChecksum is available
     */
    settingsChanged() {
      var lastChecksum = this._stateManager.getAtomSettingsChecksum()
      var checksum = this.getAtomSettingsChecksum()
      return lastChecksum && checksum != lastChecksum
    }

    /**
     * Returns the Atom settings checksum
     *
     * @return {String} Atom settings checksum
     */
    getAtomSettingsChecksum() {
      var files = this.getFiles();
      var serializedFiles = JSON.stringify(files);

      return crypto.createHash('sha256').update(serializedFiles).digest("hex");
    }


    /**
     * Returns the content of a given file
     *
     * @param  {String} filePath
     * @return {String} Content of the file
     */
    fileContent(filePath) {
      try {
        return fs.readFileSync(filePath, {encoding: 'utf8'}) || null;
      }
      catch(e) {
        console.error(`Error reading file ${filePath}. Probably doesn't exist.`, e)
        return null;
      }
    }


    /**
     * Install packages that are not already installed
     *
     * @param  {Array} packages
     * @return {Promise}
     */
    installMissingPackages(packages) {
        return new Promise((res, rej) => {
            packages = packages.map(pack => {
                if (typeof pack === 'string')
                    return { name: pack }
                else
                    return pack
            })

            async.eachLimit(packages, 5, (pkg, nextPackage) => {
                if (atom.packages.isPackageLoaded(pkg.name))
                    return nextPackage()

                this.installPackage(pkg, () => nextPackage())
            }, err => {
                if (err)
                    rej(err)
                else
                    res()
            })
        })
    }


    /**
     * Install a package
     *
     * @param  {Object} pack Package
     * @param  {function} cb Callback
     * @return {void}
     */
    installPackage(pack, cb) {
        try {
            var type = pack.theme ? 'theme' : 'package'

            console.info("Installing " + type + " " + pack.name + "...");

            this.install(pack, (error) => {
                if (error != null)
                    console.log("atom-package-sync installing " + type + " " + pack.name + " failed " + JSON.stringify(error), error);

                return typeof cb === "function" ? cb(error) : void 0;
            });
        } catch(e) {
            console.log('Error installPackage ', e)
        }
    }


    /**
     * Uninstall packages from Atom
     *
     */
    uninstallPackages(packages) {
        return new Promise((res, rej) => {
            if (!packages || !(packages instanceof Array))
                rej('Wrong param: packages must be an Array');

            packages = packages.map(pack => {
                if (typeof pack === 'string')
                    return { name: pack }
                else
                    return pack
            })

            async.eachSeries(packages, (pack, nextPackage) => {
                this.uninstall(pack, err => {
                    if (err)
                        console.error(`atom-package-sync error uninstalling package ${pack} : ${err}`)

                    nextPackage()
                })
            }, err => {
                if (err)
                    rej(`atom-package-sync error uninstalling packages ${JSON.stringify(packages)} : ${err}`)
                else
                    res()
            })

        })
    }

    _removeProperty(obj, key){
        var lastKey = key.length === 1;
        var currentKey = key.shift();

        if (!lastKey && _.isObject(obj[currentKey]) && !_.isArray(obj[currentKey]))
            this._removeProperty(obj[currentKey], key);
        else
            delete obj[currentKey];
    }

}



module.exports = AtomSettingsManager;
