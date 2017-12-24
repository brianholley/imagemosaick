# imagemosaick
Image mosaic generation library using imagemagick

[![Build Status](https://travis-ci.org/brianholley/imagemosaick.svg?branch=master)](https://travis-ci.org/brianholley/imagemosaick)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Installation

```
npm install imagemosaick
```

## Usage

```javascript
var mosaick = require('imagemosaick')

let tilesFolder = './tileset'
let tileSize = 16
var tileset = new mosaick.Tileset(
    tilesFolder,
    tileSize)

let input = 'inputFile.png'
let output = 'outputFile.png'
let options = { }
mosaick.generate(input, output, tileset, options)
    .then(() => { console.log('Finished!') })
```

## Options

Mosaic generation curently supports the following options:

| Option        | Description | Default |
| ------------- | ----------- | ------- |
| verbose       | Enable verbose stdout logging | false |
| verboseEx     | Enable extra verbose stdout logging (VERY verbose) | false |
| maxMosaicSize | Maximum mosaic size in # of tiles (scale source image down to fit if necessary) | 200 |
| threshold     | Hue match threshold (0-320) - how far should the color match go? | 60 |
