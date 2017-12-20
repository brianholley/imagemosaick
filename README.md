# imagemosaick
Image mosaic generation library using imagemagick

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
