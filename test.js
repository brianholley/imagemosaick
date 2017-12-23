var fs = require('fs')
var os = require('os')
var path = require('path')
require('use-strict')

var mosaick = require('./imagemosaick')

var tileset = new mosaick.Tileset(path.join('.', 'test', 'tileset'), 8)

// Test usage: node test <input> <output>
if (process.argv.length >= 4) {
  let input = process.argv[2]
  let output = process.argv[3]
  console.log(`MANUAL TEST MODE: ${input} => ${output}`)

  mosaick.generate(input, output, tileset, { verboseEx: true })
    .then(() => { console.log('Finished!') })
    .catch(reason => { console.log(reason) })
} else {
  console.log(`UNIT TEST MODE`)

  tileset.load().then(() => {
    let srcFolder = path.join('.', 'test', 'color')
    let outFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'imagemosaicktest-'))
    let files = fs.readdirSync(srcFolder)
    let generators = files.map((f) => {
      console.log(`Generating mosaic for ${f}`)
      let inFile = path.join(srcFolder, f)
      let outFile = path.join(outFolder, f)
      return mosaick.generate(inFile, outFile, tileset)
    })
    Promise.all(generators).then(() => {
      console.log(`PASS`)
    }).catch(err => {
      console.log(`FAIL: ${err}`)
    })
  })
}
