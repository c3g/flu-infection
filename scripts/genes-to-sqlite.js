/*
 * genes-to-sqlite.js
 */


const fs = require('fs')
const path = require('path')
const Database = require('sqlite-objects').Database


const inputPath = '/home/romgrk/data/flu-infection-genes.txt'
const outputPath = 'genes.sqlite'
const schemaPath = path.join(__dirname, '../models/genes.sql')


;(async () => {
  const lines = fs.readFileSync(inputPath).toString().trim().split('\n')
  const genes = lines.map(parseGene)
  console.log(genes)
  console.log(genes.length, 'records')

  const db = new Database(outputPath, schemaPath)
  await db.ready
  await db.insertMany(
    `INSERT INTO genes (name, chrom, start, end, strand)
          VALUES       (@name, @chrom, @start, @end, @strand)`,
    genes
  )
  console.log('Done')
})()


function parseGene(line) {
  const fields = line.trim().split('\t')
  return {
    name:   fields[0],
    chrom:  fields[1],
    start: +fields[2],
    end:   +fields[3],
    strand: fields[4],
  }
}