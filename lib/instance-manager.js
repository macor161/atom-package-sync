/**
 * Since a plugin instance is activated for each open
 * window, an InstanceManager is needed to keep a single
 * instance running.
 *
 * InstanceManager is a Singleton
 */
class InstanceManager {

    constructor() {
        this._instances = []
        this._runningInstance = null
        this._instanceStartedCount = 0
    }


    /**
     * Let a plugin register itself to the InstanceManager
     *
     * @param  {Number} instanceId  Process ID of the plugin
     * @param  {function} startCallback Called when the instance is started by the InstanceManager
     * @return {void}
     */
    addInstance(instanceId, startCallback) {
        this._instances.push({id: instanceId, startCallback })

        this._refreshRunningInstance()
    }


    /**
     * Returns a list of registered plugins
     *
     * @return {Array} List of registered instances
     */
    getInstances() { return this._instances }



    /**
     * Unregister a plugin instance
     *
     * @param  {Number} instanceId Process ID of the plugin
     * @return {void}
     */
    removeInstance(instanceId) {

        // If instance is running, reset its reference
        if (this._runningInstance && this._runningInstance.id === instanceId) {
            this._runningInstance = null
            this._refreshRunningInstance()
        }
    }


    /**
     * Start an instance if no instance is running and
     * an instance is available
     *
     * @private
     */
    _refreshRunningInstance() {
        if (this._runningInstance == null && this._instances.length > 0) {
            this._runningInstance = this._instances.shift()
            this._runningInstance.startCallback(() => {
                this._instanceStartedCount++
            })
        }
    }

}



module.exports = new InstanceManager()
