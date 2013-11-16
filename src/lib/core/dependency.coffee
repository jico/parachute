{ EventEmitter } = require('events')
assetVars        = require('./asset_vars')
copycat          = require('../util/copycat')
git              = require('../util/git-wrapper')
template         = require('../util/template')
_                = require('../util/lodash-ext')
fs               = require('fs')
gift             = require('gift')
path             = require('path')
spawn            = require('child_process').spawn

class Dependency extends EventEmitter
  constructor: (@src, options) ->
    # Recognize git source URL parameters:
    # [original str, http(s), git@, host, trailing path, treeish]
    gitRegex     = /(\w+:\/\/)?(.+@)*([\w\d\.]+):?\/*([^#]*)#?(.*)/
    pathSegments = @src.match(gitRegex)

    @name       = pathSegments[4].replace('/','-').replace('.git','')
    @cacheDir   = path.join(process.env['HOME'], '.parachute', @name)
    @root       = options?.root || process.cwd()
    @remote     = pathSegments[1]? || pathSegments[2]?
    @src        = path.resolve(pathSegments[3], pathSegments[4]) unless @remote
    @repo       = gift @cacheDir
    @treeish    = pathSegments[5] || 'master'
    @treeish    = "origin/#{@treeish}" if @remote and @treeish isnt 'master'
    @components = options?.components && @parseComponents(options.components)

    @ncpOptions =
      clobber: true
      filter: (filename) ->
        ignore = [/\.git/, /parachute.json/, /post_scripts/]
        !_.detect ignore, (regexp) -> filename.match(regexp)?.length

  cache: (cb) ->
    template('action', { doing: 'caching', what: @src })
      .on 'data', @emit.bind(@, 'data')
    # TODO: Test clone remote vs local
    cp = git(['clone', @src.split('#')[0], @cacheDir])
    cp.on 'exit', (status) =>
      @emit 'cached', status
      cb?(status)

  copy: (cb) ->
    if @isCached()
      @repo.status (err, status) =>
        if status.clean
          template('action', { doing: 'checking out', what: @treeish })
            .on 'data', @emit.bind(@, 'data')
          git(['checkout', @treeish], cwd: @cacheDir, verbose: false).on 'exit', (gitStatus) =>
            unless gitStatus is 128
              @copyComponents(cb)
              template('action', { doing: 'copying', what: @src })
                .on 'data', @emit.bind(@, 'data')
              git(['checkout', 'master'], cwd: @cacheDir, verbose: false)
        else
          @emit 'error', message: 'dependency cache is dirty'
    else
      @emit 'error', message: 'dependency is not cached'

  isCached: ->
    fs.existsSync(@cacheDir)

  update: (cb) ->
    @repo.status (err, status) =>
      if status.clean
        template('action', { doing: 'Updating', what: @name })
          .on 'data', @emit.bind(@, 'data')
        cp = git(['pull'], cwd: @cacheDir)
        cp.on 'exit', (status) =>
          @emit 'updated', status
          cb?()
      else
        @emit 'error', message: "'#{@name}' repo is dirty, please resolve changes"

  # Private

  parseComponents: (components) ->
    _.map components, (item) ->
      if typeof item == 'string' then { src: item, dest: null } else item

  sourceComponents: ->
    if fs.existsSync "#{@cacheDir}/parachute.json"
      JSON.parse(fs.readFileSync("#{@cacheDir}/parachute.json")).components

  copyComponents: (cb) ->
    components = @components || @sourceComponents() || [ src: null, dest: null ]
    components = _.map components, (component) =>
      componentWithAbsPaths =
        src:  path.join(@cacheDir, component.src  || '')
        dest: path.join(@root,     component.dest || '')
    if components?.length
      next = (err) =>
        throw err if err
        if components.length
          copyNextComponent()
        else
          @emit 'copied', 0
          cb?(0)

      do copyNextComponent = =>
        component = components.shift()
        copycat.copy(component.src, @subVariables(component.dest), @ncpOptions, next)

  subVariables: (string) ->
    for variable in string.match(/{{(\w+)}}/g) || []
      key    = variable.slice(2, -2)
      string = string.replace(variable, assetVars[key])
    string

module.exports = Dependency
