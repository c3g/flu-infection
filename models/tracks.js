/*
 * tracks.js
 */

const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const exists = promisify(fs.exists)
const md5 = require('md5')
const { map, path: prop, groupBy } = require('rambda')

const parseFeature = require('../helpers/parse-feature')
const bigWigMerge = require('../helpers/bigwig-merge.js')
const valueAt = require('../helpers/value-at.js')
const config = require('../config.js')
const Samples = require('./samples.js')

const source = require('./source')

module.exports = {
  get,
  values,
  group,
  merge,
  calculate,
}

const groupByEthnicity = groupBy(prop('track.ethnicity'))
const mapToData = map(prop('data'))

function get(peak, feature) {
  const chrom    = peak.chrom
  const position = peak.position - 1 // FIXME remove position - 1 hack (needs clean data)

  return Samples.queryMap(chrom, position).then(info => {
    return source.getTracks(info.samples, peak, feature)
  })
}

function values(peak) {
  const feature = parseFeature(peak.feature)
  return get(peak, feature)
  .then(tracks =>
    Promise.all(tracks.map(track =>
      valueAt(track.path, {
        chrom: feature.chrom,
        start: feature.start,
        end:   feature.end,
        ...config.merge
      })
      .then(value => (value === undefined ? undefined : {
        id: track.id,
        donor: track.donor,
        assay: track.assay,
        variant: track.variant,
        type: track.type,
        value: track.value,
        data: value,
        track: track,
      }))
    ))
    .then(values => values.filter(v => v !== undefined))
  )
}

function group(tracks) {
  const tracksByCondition = {}
  Object.entries(groupBy(x => x.track.condition, tracks)).forEach(([condition, tracks]) => {
    tracksByCondition[condition] = groupBy(prop('type'), tracks)
  })
  return tracksByCondition
}

function calculate(tracksByCondition) {
  Object.keys(tracksByCondition).forEach(condition => {
    const tracksByType = tracksByCondition[condition]
    tracksByType.HET = derive(tracksByType.HET || [])
    tracksByType.HOM = derive(tracksByType.HOM || [])
    tracksByType.REF = derive(tracksByType.REF || [])
  })

  return tracksByCondition
}

function merge(tracks, { chrom, start, end }) {
  // FIXME need to reimplement this whole method with new structure
  throw new Error('unimplemented')

  const tracksByAssay = group(tracks)

  const mergeTracksByType = tracksByType =>
    Promise.all(
      [
        tracksByType.REF || [],
        tracksByType.HET || [],
        tracksByType.HOM || []
      ].map(tracks =>
        tracks.length > 0 ?
          mergeFiles(tracks.map(prop('path')), { chrom, start, end }) :
          undefined
      )
    )

  let promisedTracks

  promisedTracks = 
    Object.entries(tracksByAssay).map(([assay, tracksByEthnicity]) => {
      return Object.entries(tracksByEthnicity).map(([condition, tracksByType]) => {
        return mergeTracksByType(tracksByType)
        .then(output => {
          return {
            assay,
            condition,
            tracks,
            output: {
              REF: output[0],
              HET: output[1],
              HOM: output[2],
            }
          }
        })
      })
      .flat()
    })

  return Promise.all(promisedTracks)
  .then(results => results.filter(Boolean))
}


// Helpers

function mergeFiles(paths, { chrom, start, end }) {
  paths.sort(Intl.Collator().compare)
  const mergeHash = md5(JSON.stringify({ paths, chrom, start, end }))
  const mergeName = mergeHash + '.bw'
  const url = `/merged/${mergeName}`
  const mergePath = path.join(config.paths.mergedTracks, mergeName)
  const deviationPath = mergePath.replace(/\.bw$/, '-dev.bw')

  return exists(mergePath)
    .then(yes => yes ?
      true :
      bigWigMerge(paths, {
        output: mergePath,
        deviation: paths.length > 1 ? deviationPath : undefined,
        chrom,
        start,
        end,
        ...config.merge
      })
    )
    .then(() => ({ path: mergePath, url, hasDeviation: paths.length > 1 }))
}

function derive(list) {
  const n = list.length
  const points = list.map(d => d.data).sort((a, b) => a - b)
  const pointsByEthnicity = map(mapToData, groupByEthnicity(list))

  const data = {
    n: n,
    min: Math.min(...points),
    max: Math.max(...points),
    stats: getStats(points),
    points: pointsByEthnicity,
  }

  return data
}

function getStats(points) {
  return {
    start:  points[~~(points.length * 1/4)],
    median: points[~~(points.length * 2/4)],
    end:    points[~~(points.length * 3/4)],
  }
}
