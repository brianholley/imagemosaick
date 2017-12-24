var fs = require('fs')
var os = require('os')
var uuidv4 = require('uuid/v4')
var path = require('path')
var rgbToHsl = require('rgb-to-hsl')

var imp = require('./imagemagick-promise')

function normalize (value, alpha) {
  return Math.floor(value * alpha / 255)
}

function resize (file, outFile, width, height, format) {
  let size = `${width}x${height}!`
  return imp.convert([file, '-resize', size, '-gravity', 'Center', '-format', format, outFile]).then(md => {
    return outFile
  })
}

function reduceImageToColor (imageFile) {
  let rgbaFile = path.join(os.tmpdir(), `1x1_${path.basename(imageFile)}.rgba`)
  return resize(imageFile, rgbaFile, 1, 1, 'RGBA').then(path => {
    let bytes = fs.readFileSync(rgbaFile)
    let rgb = {
      red: normalize(bytes[0], bytes[3]),
      green: normalize(bytes[1], bytes[3]),
      blue: normalize(bytes[2], bytes[3])
    }
    var hsl = rgbToHsl(rgb.red, rgb.green, rgb.blue)
    return {
      red: rgb.red,
      green: rgb.green,
      blue: rgb.blue,
      hue: Math.floor(hsl[0]),
      sat: parseFloat(hsl[1].substring(0, hsl[1].length - 1)) / 100,
      lum: parseFloat(hsl[2].substring(0, hsl[2].length - 1)) / 100
    }
  })
}

class Tileset {
  constructor (folder, tileSize) {
    this.folder = folder
    this.tileSize = tileSize
    this.hslTable = null
    this.cacheBase = path.join(os.tmpdir(), 'tileset-' + path.basename(folder))
  }

  colorTableRecurse (i, files, colors) {
    let source = path.join(this.folder, files[i])
    let resized = path.join(this.cacheBase, files[i])

    // console.log(`File ${source}`)
    return resize(source, resized, this.tileSize, this.tileSize, 'PNG24').then(thumb => {
      // console.log(`Reduce image to color ${resized}`)
      return reduceImageToColor(resized)
    }).then(color => {
      // console.log(`${resized} = (${color.red}, ${color.green}, ${color.blue})`)
      colors[resized] = color
      if (i < files.length - 1) {
        return this.colorTableRecurse(i + 1, files, colors)
      }
    })
  }

  generateColorTableAndCache (colorTableFile) {
    var colors = {}
    let files = fs.readdirSync(this.folder)
    return this.colorTableRecurse(0, files, colors).then(() => {
      fs.writeFileSync(colorTableFile, JSON.stringify(colors))
      return colors
    })
  }

  load () {
    if (this.hslTable != null) {
      return new Promise((resolve, reject) => resolve())
    }
    if (this.loadTask != null) {
      return this.loadTask
    }

    if (!fs.existsSync(this.cacheBase)) {
      fs.mkdirSync(this.cacheBase)
    }

    let colorTableFile = path.join(this.cacheBase, 'colors.json')
    this.loadTask = new Promise((resolve, reject) => {
      if (!fs.existsSync(colorTableFile)) {
        console.log(`Generating new color table file at ${colorTableFile}`)
        this.generateColorTableAndCache(colorTableFile).then(colorTable => {
          resolve(colorTable)
        })
      } else {
        resolve(JSON.parse(fs.readFileSync(colorTableFile)))
      }
    }).then(colorTable => {
      this.hslTable = {}
      for (var file in colorTable) {
        var c = colorTable[file]
        var hsl = rgbToHsl(c.red, c.green, c.blue) // [hue, "sat%", "lum%"]
        var hue = Math.floor(hsl[0])
        if (this.hslTable[hue] === undefined) {
          this.hslTable[hue] = []
        }
        this.hslTable[hue] = [...this.hslTable[hue], {
          hue: hue,
          sat: parseFloat(hsl[1].substring(0, hsl[1].length - 1)) / 100,
          lum: parseFloat(hsl[2].substring(0, hsl[2].length - 1)) / 100,
          file: file
        }]
      }
    })
    return this.loadTask
  }

  setDefaultColor (color) {
    this.defaultTile = this.findTileForPixel(color, 320)
  }

  getTileSimilarity (hue, sat, lum, tileOption) {
    let dHue = hue - tileOption.hue
    let dSat = (sat - tileOption.sat) / 3
    let dLum = (lum - tileOption.lum) / 3
    return Math.sqrt(dHue * dHue + dSat * dSat + dLum * dLum)
  }

  findBestMatchingTileByHslWithHue (hue, sat, lum) {
    if (hue in this.hslTable) {
      var best = this.hslTable[hue][0]
      var delta = this.getTileSimilarity(hue, sat, lum, best)
      for (var opt of this.hslTable[hue].slice(1)) {
        var d = this.getTileSimilarity(hue, sat, lum, opt)
        if (d < delta) {
          best = opt
          delta = d
        }
      }
      return { best, delta }
    }
    return null
  }

  findTileForPixel (rgb, hueMatchThreshold) {
    var hsl = rgbToHsl(rgb.red, rgb.green, rgb.blue)
    var hue = Math.floor(hsl[0])
    var sat = parseFloat(hsl[1].substring(0, hsl[1].length - 1)) / 100
    var lum = parseFloat(hsl[2].substring(0, hsl[2].length - 1)) / 100

    var best = null
    var delta = 1000
    for (var i = 0; i <= hueMatchThreshold; i++) {
      var match = this.findBestMatchingTileByHslWithHue(hue + i, sat, lum)
      if (match !== null && match.delta < delta) {
        best = match.best
        delta = match.delta
      }
      match = this.findBestMatchingTileByHslWithHue(hue - i, sat, lum)
      if (match !== null && match.delta < delta) {
        best = match.best
        delta = match.delta
      }
    }
    if (best != null) {
      return best.file
    }
    console.log(`Could not find color match for RGB ${JSON.stringify(rgb)} ${JSON.stringify(hsl)}`)
    return this.defaultTile
  }
}

exports.Tileset = Tileset

function renderFragment (columns, rows, start, rowOffset, tiles, tileSize, dest, options) {
  var cmd = []
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < columns; c++) {
      var index = start + c + r * rowOffset
      var offset = '+' + (tileSize * c) + '+' + (tileSize * r)
      cmd = [...cmd, '-page', offset, tiles[index]]
    }
  }

  cmd = [...cmd, '-background', 'white', '-layers', 'mosaic', dest]
  if (options.verboseEx) console.log(cmd)
  return imp.convert(cmd)
}

function standardizeOptions (options) {
  if (typeof options === 'undefined') {
    options = { }
  }

  let optionOrDefault = (opt, def) => (typeof opt !== 'undefined' ? opt : def)

  options.verbose = optionOrDefault(options.verbose, false)
  options.verboseEx = optionOrDefault(options.verboseEx, false)
  options.maxMosaicSize = optionOrDefault(options.maxMosaicSize, 200)
  options.threshold = optionOrDefault(options.threshold, 60)

  return options
}

function generate (source, dest, tileset, options) {
  options = standardizeOptions(options)
  let verbose = options.verbose || options.verboseEx
  let verboseEx = options.verboseEx
  let maxMosaicSize = options.maxMosaicSize
  let threshold = options.threshold

  var columns = 0
  var rows = 0
  return tileset.load().then(() => {
    if (verbose) console.log(`Tileset loaded`)
    return reduceImageToColor(source)
  }).then(imageColor => {
    if (verbose) console.log(`Image base color: ${JSON.stringify(imageColor)}`)
    tileset.setDefaultColor(imageColor)
    if (verbose) console.log(`Base tile: ${JSON.stringify(tileset.defaultTile)}`)
    return imp.identify(source)
  }).then(identity => {
    columns = Math.round(identity.width / tileset.tileSize)
    rows = Math.round(identity.height / tileset.tileSize)

    if (verbose) console.log(`Image size: ${identity.width}x${identity.height}`)
    if (verbose) console.log(`Mosaic size: ${columns}x${rows}`)
    if (columns > rows && columns > maxMosaicSize) {
      columns = maxMosaicSize
      rows = Math.floor(identity.height / identity.width * columns)
      if (verbose) console.log(`Snapped to ${columns}x${rows}`)
    } else if (rows > columns && rows > maxMosaicSize) {
      rows = maxMosaicSize
      columns = Math.floor(identity.width / identity.height * rows)
      if (verbose) console.log(`Snapped to ${columns}x${rows}`)
    }

    let sourceRgbaFile = path.join(os.tmpdir(), uuidv4() + '.rgba')
    return resize(source, sourceRgbaFile, columns, rows, 'RGBA')
  }).then(file => {
    let bytes = fs.readFileSync(file)
    if (bytes.length !== rows * columns * 4) {
      throw new Error(`Bad image size, expected: ${rows * columns * 4}, actual: ${bytes.length}`)
    }
    var tiles = []
    for (var p = 0; p < bytes.length / 4; p++) {
      let rgb = {
        red: normalize(bytes[p * 4], bytes[p * 4 + 3]),
        green: normalize(bytes[p * 4 + 1], bytes[p * 4 + 3]),
        blue: normalize(bytes[p * 4 + 2], bytes[p * 4 + 3])
      }
      if (verboseEx) console.log('Target pixel rgb: ' + JSON.stringify(rgb))
      tiles.push(tileset.findTileForPixel(rgb, threshold))
    }
    if (tiles.length !== rows * columns) {
      throw new Error(`Bad tile-map size, expected: ${rows * columns}, actual: ${tiles.length}`)
    }
    return tiles
  }).then(tiles => {
    const fragmentSize = 10

    var cmd = []
    var ctiles = Math.ceil(columns / fragmentSize)
    var rtiles = Math.ceil(rows / fragmentSize)
    if (verbose) console.log(`Tile size: ${ctiles}x${rtiles}`)

    var tempFolder = path.join(os.tmpdir(), '' + uuidv4())
    if (verboseEx) console.log(`Tile render location: ${tempFolder}`)
    fs.mkdirSync(tempFolder)

    var tileRenders = []
    for (var r = 0; r < rtiles; r++) {
      for (var c = 0; c < ctiles; c++) {
        if (verboseEx) console.log(`Tile: ${c},${r}`)

        let tileBase = c * fragmentSize + r * fragmentSize * columns
        let tileName = `${tempFolder}/tile_${c}_${r}.png`
        let tileW = (c < ctiles - 1 ? fragmentSize : columns - c * fragmentSize)
        let tileH = (r < rtiles - 1 ? fragmentSize : rows - r * fragmentSize)
        let render = renderFragment(tileW, tileH, tileBase, columns, tiles, tileset.tileSize, tileName, options)
        tileRenders = [...tileRenders, render]

        let offset = '+' + (fragmentSize * tileset.tileSize * c) + '+' + (fragmentSize * tileset.tileSize * r)
        cmd = [...cmd, '-page', offset, tileName]
      }
    }
    return Promise.all(tileRenders).then(renders => cmd)
  }).then(cmd => {
    if (verbose) console.log('All tiles rendered')
    cmd = [...cmd, '-background', 'white', '-layers', 'mosaic', dest]
    if (verboseEx) console.log(cmd)
    return imp.convert(cmd)
  })
}
exports.generate = generate
