let electron = require('remote')
let fetchMock = require('fetch-mock')
let BrowserWindow = electron.BrowserWindow
let SpecHelper = require('./spec-helpers')
let {QuantalApi} = require('../lib/quantal-api')




describe('QuantalApi', () => {
    let qlApi

    beforeEach(() => {
        qlApi = new QuantalApi()
        setTimeout.andCallThrough()
    })

    afterEach(() => {
        closeUnusedBrowserWindows()
        fetchMock.restore()
    })


    describe('fetchAtomSettingsInfo', () => {

        it('opens the authentication window when no token is availabe', () => {

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettingsInfo().then(settings => {
                    fail()
                })

                return new Promise((res,rej) => {
                    setTimeout(() => {
                        expect(BrowserWindow.getAllWindows().length).toEqual(2)
                        res()
                    }, 100)
                })

            })

        })


        it('get token from cache when it\'s availabe', () => {
            localStorage.setItem('atom-package-sync:quantalToken', '00000000')

            spyOn(localStorage, 'getItem').andCallThrough()
            spyOn(window, 'fetch')

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettingsInfo()

                return new Promise((res,rej) => {
                    process.nextTick(() => {
                        expect(BrowserWindow.getAllWindows().length).toEqual(1)
                        expect(localStorage.getItem).toHaveBeenCalledWith('atom-package-sync:quantalToken')
                        res()
                    })
                })

            })

        })


        it('removes token from cache when invalid and retry', () => {
            localStorage.setItem('atom-package-sync:quantalToken', '000000000')

            spyOn(qlApi, 'fetchAtomSettingsInfo').andCallThrough()
            fetchMock.get('*', { error: 'Invalid token' })

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettingsInfo()

                return new Promise((res,rej) => {
                    setTimeout(() => {
                        expect(qlApi.fetchAtomSettingsInfo.callCount).toEqual(2)
                        expect(localStorage.getItem('atom-package-sync:quantalToken')).toBeNull()
                        res()
                    }, 100)
                })

            })

        })


        it('returns the correct settingsInfo', () => {
            localStorage.setItem('atom-package-sync:quantalToken', '000000000')

            let originalSettingsInfo = {
                lastUpdate: new Date(),
                checksum: '123'
            }

            fetchMock.get('*', { checksum: originalSettingsInfo.checksum, lastUpdate: JSON.stringify(originalSettingsInfo.lastUpdate) })

            waitsForPromise({ timeout: 60000 }, () => {

                return qlApi.fetchAtomSettingsInfo().then(settingsInfo => {
                    return new Promise((res, rej) => {
                        expect(settingsInfo.checksum).toEqual(originalSettingsInfo.checksum)
                        expect(settingsInfo.lastUpdate).toEqual(originalSettingsInfo.lastUpdate)
                        res()
                    })
                })


            })

        })

    })



    describe('fetchAtomSettings', () => {

        it('opens the authentication window when no token is availabe', () => {

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettings().then(settings => {
                    fail()
                })

                return new Promise((res,rej) => {
                    setTimeout(() => {
                        expect(BrowserWindow.getAllWindows().length).toEqual(2)
                        res()
                    }, 500)
                })

            })

        })


        it('get token from cache when it\'s availabe', () => {
            localStorage.setItem('atom-package-sync:quantalToken', '00000000')

            spyOn(localStorage, 'getItem').andCallThrough()
            spyOn(window, 'fetch')

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettings()

                return new Promise((res,rej) => {
                    process.nextTick(() => {
                        expect(BrowserWindow.getAllWindows().length).toEqual(1)
                        expect(localStorage.getItem).toHaveBeenCalledWith('atom-package-sync:quantalToken')
                        res()
                    })
                })

            })

        })


        it('removes token from cache when invalid and retry', () => {
            localStorage.setItem('atom-package-sync:quantalToken', '000000000')

            spyOn(qlApi, 'fetchAtomSettings').andCallThrough()
            fetchMock.get('*', { error: 'Invalid token' })

            waitsForPromise({ timeout: 60000 }, () => {

                qlApi.fetchAtomSettings()

                return new Promise((res,rej) => {
                    setTimeout(() => {
                        expect(qlApi.fetchAtomSettings.callCount).toEqual(2)
                        expect(localStorage.getItem('atom-package-sync:quantalToken')).toBeNull()
                        res()
                    }, 100)
                })

            })

        })

    })
})




function closeUnusedBrowserWindows() {
    let browserWindows = BrowserWindow.getAllWindows()

    if (browserWindows.length > 1) {
        browserWindows.forEach((browserWindow, i) => {
            if (i === 0)
                return
            else
                browserWindow.close()
        })
    }
}
