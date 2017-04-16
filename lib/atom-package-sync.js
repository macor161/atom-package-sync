let electron
let packagePath
let AtomSettingsManager
let asyncjs
let StateManager
let QuantalApi
let { SyncStatus, getSyncChanges } = { SyncStatus: null, getSyncChanges: null }

const SYNC_SUCCESS_MESSAGE = 'Packages synced successfully'


var instanceManager



/**
 * Main package class
 */
class AtomPackageSync {

    constructor() {
        this.config = require('./config')
    }

    /**
     * Activate package. On multiple windows, we use an InstanceManager singleton
     * to keep a single instance of the package running
     *
     * @param  {Object} Package state
     */
    activate(state) {

        setTimeout(() => {
            this._loadDependencies()

            this._stateManager = new StateManager(state)
            this._qlApi = new QuantalApi()

            instanceManager.addInstance(process.pid, cb => this.start(cb))

            atom.commands.add('atom-workspace', "atom-package-sync:check-backup", () => {
                this.sync()
            })

        }, 10)

    }


    /**
     * Remove package instance from InstanceManager and stop auto-sync
     *
     */
    deactivate() {
        instanceManager.removeInstance(process.pid)

        this.stop()

    }

    goToPackageSettings() {
        atom.workspace.open("atom://config/packages/atom-package-sync")
    }


    /**
     * Returns package state
     */
    serialize() {
        if (this._stateManager)
            return this._stateManager.getState()
    }


    /**
     * Start auto-sync
     *
     * @param  {function} cb Callback
     */
    start(cb) {
        this._atomSettingsManager = new AtomSettingsManager()

        this.sync()

        if (cb) cb()
    }


    /**
     * Stop auto-sync
     *
     */
    stop() {
        this.stopAutoUpdateCheck()
    }


    /**
     * Sync packages/settings changes between client and server
     *
     */
    sync() {
        new Promise((resolve, reject) => {
            if (this._stateManager.syncLock)
                return resolve()

            this._stateManager.syncLock = true

            getSyncChanges()
                .then(changes => {
                    return new Promise((resolve, reject) => {

                        if (changes.length)
                            console.log('Changes: ', changes)

                        asyncjs.eachSeries(changes, (change, next) => {
                                let func;

                                switch (change.status) {
                                    case SyncStatus.FirstTimeConnect:
                                        func = () => this.backup();
                                        break

                                    case SyncStatus.AddPackagesFromClient:
                                    case SyncStatus.RemovePackagesFromClient:
                                    case SyncStatus.SettingsChangedFromClient:
                                        func = () => this.backup();
                                        break

                                    case SyncStatus.AddPackagesFromServer:
                                        func = () => this.handlePackageAdd(change.packages)
                                        break

                                    case SyncStatus.RemovePackagesFromServer:
                                        func = () => this.handlePackageRemove(change.packages)
                                        break

                                    case SyncStatus.PackageSettingsChangedFromServer:
                                        func = () => this.applySettingsFiles(change.settingsFiles)
                                        break

                                    case SyncStatus.NewAtomInstance:
                                        func = () => {
                                            return this.handlePackageAdd(change.packages)
                                                .then(() => this.applySettingsFiles(change.settingsFiles))
                                                .then(() => this.backup())
                                        }
                                        break


                                }



                                if (func) {
                                    func()
                                        .then(() => {
                                            next()
                                        })
                                        .catch(err => {
                                            throw err
                                        })
                                }

                            },
                            err => {
                                if (err)
                                    return reject(err)
                                else
                                    resolve(changes.length)
                            })
                    })
                })
                .then(nbOfChanges => {
                    if (nbOfChanges > 0)
                        atom.notifications.addSuccess(SYNC_SUCCESS_MESSAGE)

                    this.setupAutoUpdateCheck()
                })
                .then(() => {
                    this._stateManager.syncLock = false
                    resolve()
                })
                .catch(err => {
                    // TODO handle error
                    console.log('Error Unlock sync')
                    this._stateManager.syncLock = false
                })
        })
    }


    applySettingsFiles(files) {

        this._atomSettingsManager.applySettingsFiles(files)

        return this._qlApi.fetchAtomSettingsInfo()
            .then(atomSettingsInfo => this._atomSettingsManager.setLastUpdate(atomSettingsInfo.lastUpdate))
    }

    /**
     * Apply new package settings to current configuration
     * and manually set atom settings lastUpdate to prevent a resync
     *
     * @param  {Object} packageSettings
     * @return {Promise}
     */
    applyPackageSettings(packageSettings) {
        this._atomSettingsManager.applyPackageSettings('', packageSettings)

        return this._qlApi.fetchAtomSettingsInfo()
            .then(atomSettingsInfo => this._atomSettingsManager.setLastUpdate(atomSettingsInfo.lastUpdate))
    }


    /**
     * Add new packages
     *
     * @param  {Array} packages
     * @return {Promise}
     */
    handlePackageAdd(packages) {
        return this._atomSettingsManager.installMissingPackages(packages)
            .then(() => this._qlApi.fetchAtomSettingsInfo())
            .then(atomSettingsInfo => this._atomSettingsManager.setLastUpdate(atomSettingsInfo.lastUpdate))
    }


    /**
     * Remove packages
     *
     * @param  {Array} packages
     * @return {Promise}
     */
    handlePackageRemove(packages) {
        return this._atomSettingsManager.uninstallPackages(packages)
            .then(() => this._qlApi.fetchAtomSettingsInfo())
            .then(atomSettingsInfo => this._atomSettingsManager.setLastUpdate(atomSettingsInfo.lastUpdate))
    }


    /**
     * Start auto-sync if it's not already started
     */
    setupAutoUpdateCheck() {
        if (this.autocheckTimer)
            return

        this.autocheckTimer = setInterval(() => this.sync(), 60000)
    }


    /**
     * Stop auto-sync
     */
    stopAutoUpdateCheck() {
        clearInterval(this.autocheckTimer)
        this.autocheckTimer = false
    }




    /**
     * Save packages/settings to server
     *
     * @return {Promise}
     */
    backup() {
        return new Promise((resolve, reject) => {
            let files = this._atomSettingsManager.getFiles()
            let settings = {
                files: files
            }


            this._qlApi.saveAtomSettings(settings)
                .then(result => {
                    if (result.success === true)
                        this._atomSettingsManager.setLastUpdate(result.lastUpdate)


                    resolve()
                })
                .catch(err => {
                    console.error("atom-package-sync error backing up data: ", err)
                    reject(err)
                })

        })

    }


    _loadDependencies() {
        electron = require('electron')
        packagePath = atom.packages.resolvePackagePath('atom-package-sync')
        AtomSettingsManager = require('./atom-settings-manager')
        asyncjs = require('async')
        StateManager = require('./state-manager')

        let QuantalApiLib = require('./quantal-api')
        QuantalApi = QuantalApiLib.QuantalApi

        let GetSyncChangesLig = require('./get-sync-changes')
        SyncStatus = GetSyncChangesLig.SyncStatus
        getSyncChanges = GetSyncChangesLig.getSyncChanges

        instanceManager = electron.remote.require(packagePath + '/lib/instance-manager')
    }


}



module.exports = new AtomPackageSync()
