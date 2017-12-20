var fs = require('fs')
var os = require('os')
var path = require('path')
require('use-strict')

var mosaick = require('./imagemosaick')

let tileSize = 16
var tileset = new mosaick.Tileset(
    path.join('.', 'test', 'tileset'), 
    tileSize)

// Test usage: test <input> <output>
if (process.argv.length >= 5 && process.argv[2] == "test") {
    let input = process.argv[3] 
    let output = process.argv[4]
    console.log(`MANUAL TEST MODE: ${input} => ${output}`)

    mosaick.generate(input, output, tileset)
        .then(() => { console.log("Finished!") })
        .catch(reason => { console.log(reason) })
    return
}

console.log(`UNIT TEST MODE`)

let outdir = path.join(os.tmpdir(), 'imagemosaicktest', new Date().toTimeString())

// TODO: Add automatic tests