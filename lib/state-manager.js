const PACKAGE_NAME = 'atom-package-sync'
const store = require('store')


/**
 * Contains the current state of
 * atom-package-sync
 */
class StateManager {

    constructor(state) {
        if (state)
            this.syncState(state)
    }


    /**
     * Returns the last saved checksum of the atom settings
     *
     * @return {String}
     */
    getAtomSettingsChecksum() { return store.get('atom-package-sync:checksum') }


    /**
     * Returns last update on the client side
     *
     * @return {Date} Last client-side update
     */
    getLastUpdate() {
        let lastUpdate = store.get('atom-package-sync:lastUpdate')

        if (lastUpdate)
            lastUpdate = new Date(lastUpdate)

        return lastUpdate
    }


    /**
     * Returns the Quantal token
     *
     * @return {String}
     */
    getQuantalToken() { return store.get('atom-package-sync:quantalToken') }


    /**
     * Simple lock used to prevent multiple simultaneous syncs
     *
     * @return {boolean} true if currently syncing
     */
    get syncLock() { return StateManager._syncLock }
    set syncLock(value) { StateManager._syncLock = value }


    /**
     * Returns atom-package-sync current settings. Contains:
     * <pre>
     *   - syncPackages
     *   - syncSettings
     *   - blacklistedKeys
     *   - extraFiles
     * </pre>
     */
    getPackageSettings() {
        return {
            get syncPackages() {
                let value = atom.config.get(`${PACKAGE_NAME}.syncPackages`)
                return typeof(value) === 'boolean' ? value : true
            },
            get syncSettings() {
                let value = atom.config.get(`${PACKAGE_NAME}.syncSettings`)
                return typeof(value) === 'boolean' ? value : true
            },
            get blacklistedKeys() { return atom.config.get(`${PACKAGE_NAME}.blacklistedKeys`) || [] },
            get extraFiles() { return atom.config.get(`${PACKAGE_NAME}.extraFiles`) || [] }
        }
    }

    /**
     * Returns the current state of the plugin
     *
     * @return {Object}
     */
    getState() {
        return {
            quantalToken: store.get('atom-package-sync:quantalToken'),
            lastUpdate: this.getLastUpdate(),
            checksum: store.get('atom-package-sync:checksum')
        }
    }

    /**
     * Used to retrieve config information if localStorage
     * has been erased
     */
    syncState(state) {
        if (state && !store.get('atom-package-sync:quantalToken')) {

            if (state && false) {

                if (state.quantalToken)
                    store.set('atom-package-sync:quantalToken', state.quantalToken)
                if (state.lastUpdate)
                    store.set('atom-package-sync:lastUpdate', state.lastUpdate)
                if (state.checksum)
                    store.set('atom-package-sync:checksum', state.checksum)

            }

        }

    }

}

StateManager._syncLock = false

module.exports = StateManager
