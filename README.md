# imagemosaick
Image mosaic generation library using imagemagick

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Installation

```
npm install imagemosaick
```

## Usage

```javascript
var mosaick = require('imagemosaick')

let tilesFolder = 'tileset'
let tileSize = 16
var tileset = new mosaick.Tileset(
    tilesFolder,
    tileSize)

let input = 'inputFile.png'
let output = 'outputFile.png'
mosaick.generate(input, output, tileset)
    .then(() => { console.log('Finished!') })
```

## Options

Coming soon...
