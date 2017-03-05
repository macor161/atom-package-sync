module.exports = {
  syncPackages:
    description: "Synchronize Packages"
    type: 'boolean'
    default: true
    order: 1
  syncSettings:
    description: "Synchronize Settings"
    type: 'boolean'
    default: true
    order: 2
  blacklistedKeys:
    description: "Comma-seperated list of blacklisted keys (e.g. 'package-name,other-package-name.config-name')"
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 3
  extraFiles:
    description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 4
}
