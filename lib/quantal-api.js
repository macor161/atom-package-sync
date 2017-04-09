const store = require('store')
const electron = require('remote')
const BrowserWindow = electron.BrowserWindow
const cache = require('memory-cache')
const fetch = require('fetch-retry')

const API_URL = 'https://api.atom-package-sync.com'
const ATOM_SETTINGS_CACHE_TIMEOUT = 45000 // 45 seconds
const FETCH_RETRIES = 10 // Number of retries before fetch fails
const FETCH_RETRY_DELAY = 3000 // Delay before each fetch retry

let retryCount = 0


/**
 * QuantalApi - Used to communicate with the
 * server, authenticate, fetch and save Atom settings
 */
class QuantalApi {

    constructor() {
        this._apiUrl = API_URL
    }


    /**
     * Fetch Atom Settings from server.
     * Open an authentication window if the user is not
     * authenticated.
     *
     * @return {Promise<AtomSettings>} Atom settings
     */
    fetchAtomSettings() {
        return new Promise((resolve, reject) => {
            if (cache.get('atomSettings'))
                return resolve(cache.get('atomSettings'))

            this._getQuantalToken()
            .then(token => fetch(`${this._apiUrl}/package-sync/settings?token=${token}`), { retries: FETCH_RETRIES, retryDelay: FETCH_RETRY_DELAY })
            .then(response => response.json())
            .then(result => {
                if (!result.error) {
                    cache.put('atomSettings', result, ATOM_SETTINGS_CACHE_TIMEOUT)
                    resolve(result)
                }
                else {
                    if (result.error === 'Invalid token' && retryCount < 3) {
                        store.remove('atom-package-sync:quantalToken')
                        retryCount++
                        return this.fetchAtomSettings().then(resolve)
                    }
                    else
                        reject(result.error)
                }
            })
            .catch(err => {
                console.log(err)
                reject(err)
            })
        });
    }



    /**
     * Send new Atom to the server
     *
     * @param  {AtomSettings} settings Atom settings
     * @return {Promise<AtomSettingsInfo>}
     */
    saveAtomSettings(settings) {
        return new Promise((resolve, reject) => {
            var serializedSettings = JSON.stringify(settings);
            this._getQuantalToken()
            .then(token => {
               return fetch(`${this._apiUrl}/package-sync/settings`, {
                    method: 'POST',
                    headers: {
                        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    body: `token=${token}&settings=${serializedSettings}`,
                    retries: FETCH_RETRIES,
                    retryDelay: FETCH_RETRY_DELAY
                })
            })
            .then(response => response.json())
            .then(response => {
                    if (response.lastUpdate)
                        response.lastUpdate = new Date(response.lastUpdate)
                    resolve(response)
            })
            .catch(err => {
                console.log(err)
                reject(err)
            })
        });
    }



    /**
     * Fetch informations about the
     * Atom settings stored on the server
     *
     * @return {Promise<AtomSettingsInfo>}
     */
    fetchAtomSettingsInfo() {
        return new Promise((resolve, reject) => {
            if (cache.get('atomSettingsInfo'))
                return resolve(cache.get('atomSettingsInfo'))

            this._getQuantalToken()
                .then(token => fetch(`${this._apiUrl}/package-sync/lastUpdate?token=${token}`), { retries: FETCH_RETRIES, retryDelay: FETCH_RETRY_DELAY })
                .then(response => response.json())
                .then(result => {
                    if (!result.error) {
                        if (result.lastUpdate)
                            result.lastUpdate = new Date(result.lastUpdate)

                        cache.put('atomSettingsInfo', result, ATOM_SETTINGS_CACHE_TIMEOUT)
                        return resolve(result)
                    }
                    else {
                        if (result.error === 'Invalid token' && retryCount < 3) {
                            store.remove('atom-package-sync:quantalToken')
                            retryCount++
                            return this.fetchAtomSettingsInfo().then(resolve)
                        }
                        else
                            reject(result.error)
                    }
                })
                .catch(err => {
                    console.log(err)
                    reject(err)
                })
        });
    }


    /**
     * Get Quantal user token from cache or
     * server. Open Auth Window if user is not authenticated
     *
     * @private
     * @return {Promise<string>} Token
     */
    _getQuantalToken() {
        return new Promise((resolve, reject) => {
            var quantalToken = store.get('atom-package-sync:quantalToken');

            if (quantalToken)
                return resolve(quantalToken)

            this._fetchAuthenticationToken()
            .then(googleToken => this._fetchQuantalTokenFromAuthToken(googleToken))
            .then(token => {
                resolve(token)
            })
            .catch(err => reject(err))

        });
    }


    /**
     * Open the Quantal authentication window
     * so the user can authorize the app.
     *
     * @private
     * @return {Promise<string>} Resolve the token
     */
    _openAuthWindow() {
        return new Promise((resolve, reject) => {
            var browserWindowParams = {
                'use-content-size': true,
                center: true,
                show: true,
                resizable: false,
                'always-on-top': true,
                'standard-window': true,
                'auto-hide-menu-bar': true,
                'node-integration': false
            };

            const win = new BrowserWindow(browserWindowParams || {'use-content-size': true});
            win.setMenu(null)

            win.loadURL(`${this._apiUrl}/authentication/app`)

            win.on('closed', () => {
                reject({ name: QuantalError.CONNECT_WINDOW_CLOSED, message: 'User closed the connexion window' })
            })

            win.once('ready-to-show', () => {
                if (win) {
                    let fawe = 'fewa'
                }
            })

            win.on('page-title-updated', () => {
                setImmediate(() => {
                    if (win) {
                        const title = win.getTitle()

                        if (title.startsWith('Denied')) {
                            reject(new Error(title.split(/[ =]/)[2]))
                            win.removeAllListeners('closed')
                            win.close()
                        } else if (title.startsWith('Success')) {
                            resolve(title.split(/[ =]/)[2])
                            win.removeAllListeners('closed')
                            win.close()
                        }
                    }
                })
            })
        })
    }


    /**
     * Use an authentication token
     * to fetch a Quantal token
     *
     * @private
     * @param  {string} authToken Authentication token from an auth provider
     * @return {string} Quantal token
     */
    _fetchQuantalTokenFromAuthToken(authToken) {
        return new Promise((resolve, reject) => {
            fetch(`${this._apiUrl}/authentication`, {
                method: 'POST',
                headers: {
                    "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                body: `token=${authToken}&tokenType=2&returnToken=true`,
                retries: FETCH_RETRIES,
                retryDelay: FETCH_RETRY_DELAY
            })
            .then(response => response.json())
            .then(response => {
                if (response.token) {
                    store.set('atom-package-sync:quantalToken', response.token);
                    return resolve(response.token)
                }
                else
                    reject(response)
            })
            .catch(err => {
                console.log(err)
                reject(err)
            })

        });
    }


    /**
     * Get auth token from
     * cache or from an authentication provider
     * using the authentication window.
     * Currently only supporting Google auth
     *
     * @private
     * @return {Promise<string>} Auth token
     */
    _fetchAuthenticationToken() {

        return new Promise((resolve, reject) => {

            this._openAuthWindow()
            .then(token => {
                store.set('atom-package-sync:googleToken', token)
                resolve(token)
            })
            .catch(err => {
                reject(err)
            });
        });
    }

}



var QuantalError = {
    CONNECT_WINDOW_CLOSED: 'CONNECT_WINDOW_CLOSED',

}



module.exports = { QuantalApi, QuantalError}
