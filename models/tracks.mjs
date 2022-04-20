/*
 * tracks.js
 */

import path from "path";
import fs from "fs";
import {promisify} from "util";

import md5 from "md5";
import {groupBy, map, path as prop} from "rambda";

import bigWigMerge from "../helpers/bigwig-merge.js";
import bigWigChromosomeLength from "../helpers/bigwig-chromosome-length.js";
import {boxPlot, getDomain, PLOT_SIZE} from "../helpers/boxplot.js";
import cache from "../helpers/cache.mjs";
import valueAt from "../helpers/value-at.js";
import config from "../config.js";
import Samples from "./samples.mjs";
import source from "./source/index.js";

const exists = promisify(fs.exists);


export default {
  get,
  values,
  group,
  merge,
  calculate,
  plot,
};

const strandToView = {
  "+": "signal_forward",
  "-": "signal_reverse",
};

const groupByEthnicity = groupBy(prop("ethnicity"));
const mapToData = map(prop("data"));

// Methods

function get(peak) {
  const {chrom, position} = peak;
  // FIXME remove position - 1 hack (needs clean data)
  return Samples.queryMap(chrom, position - 1)
    .then(info => source.getTracks(info.samples, peak));
}

async function values(peak) {
  const k = `varwig:values:${peak.id}`;

  await cache.open();

  // noinspection JSCheckFunctionSignatures
  const cv = await cache.getJSON(k);
  if (cv) return cv;

  const tracks = await get(peak);

  const result = (await Promise.all(tracks.filter(track =>
    // RNA-seq results are either forward or reverse strand; we only want tracks from the direction
    // of the selected peak (otherwise results will appear incorrectly, and we'll have 2x the # of
    // values we should in some cases.)
    track.assay !== "RNA-Seq" || track.view === strandToView[peak.strand]
  ).map(track =>
    valueAt(track.path, {
      chrom: `chr${peak.chrom}`,
      start: peak.start,  // peak.start pulled from join with feature
      end: peak.end,  // peak.end pulled from join with feature
      ...config.merge
    }).then(value => (value === undefined ? undefined : {
      id: track.id,
      donor: track.donor,
      assay: track.assay,
      condition: track.condition,
      ethnicity: track.ethnicity,
      variant: track.variant,
      type: track.type,
      value: track.value,
      data: value,
    }))
  ))).filter(v => v !== undefined);

  await cache.setJSON(k, result, 60 * 60 * 24 * 180);

  return result;
}

function group(tracks) {
  const tracksByCondition = {}
  Object.entries(groupBy(x => x.condition, tracks)).forEach(([condition, tracks]) => {
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

function merge(tracks, session) {

  const tracksByCondition = group(tracks)

  const mergeTracksByType = tracksByType =>
    Promise.all(
      [
        tracksByType.REF || [],
        tracksByType.HET || [],
        tracksByType.HOM || []
      ].map(async tracks => {
        if (tracks.length === 0) {
          return undefined;
        }

        const filePaths = tracks.map(prop('path'))

        const maxSize = await bigWigChromosomeLength(filePaths[0], session.peak.feature.chrom)

        return mergeFiles(filePaths, {
          chrom: session.peak.feature.chrom,
          start: Math.max(session.peak.feature.start - 100000, 0),
          end:   Math.min(session.peak.feature.end + 100000, maxSize),
        })
      })
    )

  const promisedTracks =
    Object.entries(tracksByCondition).map(([condition, tracksByType]) =>
      mergeTracksByType(tracksByType)
      .then(output => ({
          assay: session.peak.assay,
          condition,
          tracks,
          output: {
            REF: output[0],
            HET: output[1],
            HOM: output[2],
          }
        })
      )
    )

  return Promise.all(promisedTracks)
    .then(results => results.filter(Boolean))
}

function plot(tracksByCondition) {
  const CONDITION_NI = "NI";
  const CONDITION_FLU = "Flu";

  const niData  = tracksByCondition[CONDITION_NI]  ? getDataFromValues(tracksByCondition[CONDITION_NI])  : [];
  const fluData = tracksByCondition[CONDITION_FLU] ? getDataFromValues(tracksByCondition[CONDITION_FLU]) : [];

  const niDomain  = getDomain(niData)
  const fluDomain = getDomain(fluData)

  return Promise.all([
    boxPlot({title: "Non-infected", data: niData, domain: niDomain}),
    boxPlot({title: "Flu", data: fluData, domain: fluDomain, transform: "translate(350 0)"}),
  ]).then(plots =>
    `<svg width="${PLOT_SIZE * 2}" height="${PLOT_SIZE}">
       ${plots.join("")}
     </svg>`
  );
}


// Helpers

function getDataFromValues(values) {
  return [
    { name: 'Hom Ref', data: values.REF || [] },
    { name: 'Het',     data: values.HET || [] },
    { name: 'Hom Alt', data: values.HOM || [] }
  ]
}

function mergeFiles(paths, { chrom, start, end }) {
  paths.sort(Intl.Collator().compare)
  const mergeHash = md5(JSON.stringify({ paths, chrom, start, end }))
  const mergeName = mergeHash + '.bw'
  const url = `/merged/${mergeName}`
  const mergePath = path.join(config.paths.mergedTracks, mergeName)

  return exists(mergePath)
    .then(yes => yes ?
      true :
      bigWigMerge(paths, {
        output: mergePath,
        chrom,
        start,
        end,
        ...config.merge
      })
    )
    .then(() => ({ path: mergePath, url }))
}

function derive(list) {
  const points = list.map(d => d.data).sort((a, b) => a - b)
  const pointsByEthnicity = map(mapToData, groupByEthnicity(list))


  // noinspection JSCheckFunctionSignatures
  return {
    n: list.length,
    stats: getStats(points),
    statsByEthnicity: Object.fromEntries(
      Object.entries(pointsByEthnicity)
        .map(([eth, ethPoints]) => [
          eth,
          getStats(ethPoints.sort((a, b) => a - b))
        ])
    ),

    // Note: Do not send points to the front end – it is too easy to re-identify genotypes
    // from a public bigWig file here.
    points: pointsByEthnicity,
  }
}

function getStats(points) {
  return {
    min:        Math.min(...points),
    quartile_1: points[~~(points.length * 1/4)],
    median:     points[~~(points.length * 2/4)],
    quartile_3: points[~~(points.length * 3/4)],
    max:        Math.max(...points),
  };
}
