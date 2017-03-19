const {QuantalApi, QError, QuantalError} = require('./quantal-api')
const AtomSettingsManager = require('./atom-settings-manager')
const store = require('store')





/**
 * Returns a list of changes between the server and
 * the client Atom settings. Possible changes are:
 * <pre>
 *   - FirstTimeConnect : First time user
 *   - NewAtomInstance : Existing client but new Atom setup
 *   - AddPackagesFromServer : New packages were added on another Atom setup
 *   - RemovePackagesFromServer : Packages were removed on another Atom setup
 *   - PackageSettingsChangedFromServer : Packages settings changed on another Atom setup
 *   - SettingsChangedFromClient : Any change on this Atom setup (Added/Removed package, Settings change)
 * </pre>
 *
 * @return {Array}
 */
function getSyncChanges() {
    return new Promise((resolve, reject) => {
        let settingsManager = new AtomSettingsManager()
        let quantalApi = new QuantalApi()

        quantalApi.fetchAtomSettingsInfo()
        .then(settingsInfo => {
            let lastServerUpdate = settingsInfo.lastUpdate

            let lastClientUpdate = store.get('atom-package-sync:lastUpdate')

            if (lastClientUpdate)
                lastClientUpdate = new Date(lastClientUpdate)

            let changes = []
            let fetchChanges = new Promise(resolve => resolve());

            if (!lastClientUpdate && !lastServerUpdate) {
                changes.push({
                    status: SyncStatus.FirstTimeConnect
                })
            }

            else if (!lastClientUpdate && lastServerUpdate) {
                fetchChanges = fetchChanges
                .then(() => quantalApi.fetchAtomSettings())
                .then(settings => {
                    changes.push({
                        status: SyncStatus.NewAtomInstance,
                        packages: JSON.parse(settings.files['packages.json'].content),
                        packageSettings: JSON.parse(settings.files['settings.json'].content),
                        lastUpdate: lastServerUpdate
                    })
                })
            }

            else if (lastServerUpdate > lastClientUpdate) {
                fetchChanges = fetchChanges
                .then(() => quantalApi.fetchAtomSettings())
                .then(settings => {

                    let localPackages = settingsManager.getPackages()
                    let serverPackages = JSON.parse(settings.files['packages.json'].content)

                    let packageDiffs = getPackagesDiffs(localPackages, serverPackages)

                    if (packageDiffs.added.length > 0) {
                        changes.push({
                            status: SyncStatus.AddPackagesFromServer,
                            packages: packageDiffs.added,
                            lastUpdate: lastServerUpdate
                        })
                    }

                    if (packageDiffs.removed.length > 0) {
                        changes.push({
                            status: SyncStatus.RemovePackagesFromServer,
                            packages: packageDiffs.removed,
                            lastUpdate: lastServerUpdate
                        })
                    }

                    // TODO: Diffs of package settings
                    if (settings.files['settings.json']) {
                        changes.push({
                            status: SyncStatus.PackageSettingsChangedFromServer,
                            packageSettings: JSON.parse(settings.files['settings.json'].content),
                            lastUpdate: lastServerUpdate
                        })
                    }

                })
            }

            // TODO: Change this to ChangesFromClient
            else if (lastClientUpdate > lastServerUpdate) {
                fetchChanges = fetchChanges
                .then(() => quantalApi.fetchAtomSettings())
                .then(settings => {

                    let localPackages = settingsManager.getPackages()
                    let serverPackages = JSON.parse(settings.files['packages.json'].content)

                    /*
                    let packageDiffs = getPackagesDiffs(serverPackages, localPackages)

                    if (packageDiffs.added.length > 0) {
                        changes.push({
                            status: SyncStatus.AddPackagesFromClient,
                            packages: packageDiffs.added
                        })
                    }

                    if (packageDiffs.removed.length > 0) {
                        changes.push({
                            status: SyncStatus.RemovePackagesFromClient,
                            packages: packageDiffs.removed
                        })
                    }*/
                    changes.push({
                        status: SyncStatus.SettingsChangedFromClient
                    })
                })

            }


            else if (lastClientUpdate.getTime() === lastServerUpdate.getTime()) {
                // Nothing to do
            }


            // Handle unknown state
            else {
                console.warn(`atom-package-sync: Unknown state: ${lastServerUpdate, lastClientUpdate}`)
            }


            fetchChanges.then(() => resolve(changes))

        })
        .catch(err => {
            if (err.name !== QuantalError.CONNECT_WINDOW_CLOSED)
                console.log('atom-package-sync error fetching last update', err)

            reject(err)
        })
    })
}



/**
 * Return package diffs between two packages configurations
 * Package versions are not taken into account
 * @private
 */
function getPackagesDiffs(oldPackages, newPackages) {
    let diffs = {
        added: [],
        removed: []
    }

    // Added packages
    for(let newPackage of newPackages) {
        // If oldPackages doesn't contain the new package, add it to diffs.added
        if (!oldPackages.some(oldPackage => oldPackage.name === newPackage.name))
            diffs.added.push(newPackage)
    }

    // Removed packages
    if (oldPackages.length + diffs.added.length !== newPackages.length) {
        for(let oldPackage of oldPackages) {
            // If newPackages doesn't contain the old package, add it to diffs.removed
            if (!newPackages.some(newPackage => newPackage.name === oldPackage.name))
                diffs.removed.push(oldPackage.name)
        }
    }


    return diffs
}



const SyncStatus = {
    Invalid: 'Invalid',
    Synced: 'Synced',
    FirstTimeConnect: 'FirstTimeConnect',
    AddPackagesFromClient: 'AddPackagesFromClient',
    RemovePackagesFromClient: 'RemovePackagesFromClient',
    SettingsChangedFromClient: 'SettingsChangedFromClient',
    AddPackagesFromServer: 'AddPackagesFromServer',
    RemovePackagesFromServer: 'RemovePackagesFromServer',
    PackageSettingsChangedFromServer: 'PackageSettingsChangedFromServer',
    NewAtomInstance: 'NewAtomInstance',
    Unknown: 'Unknown'
}



module.exports = {getSyncChanges, SyncStatus}
