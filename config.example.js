/*
 * config.js
 */

const path = require('path');

require('dotenv').config();


/* This is the application data directory */
const dataDirname = path.join(__dirname, './data');

/* This is the input data directory */
const inputFilesDirname = path.join(__dirname, './input-files');

/* This is the storage volume path for Gemini genotypes and tracks (i.e., very large files / raw data) */
const tracksDirname = process.env.VARWIG_TRACKS_DIR ?? '/flu-infection-data';

/* For development: the `tracks` data is huge, so it makes
 * more sense to mount the files via `sshfs` instead of
 * copying them all.
 * You'd mount them with something like:
 *  sshfs beluga.calculcanada.ca:~/projects/rrg-bourqueg-ad/C3G/projects/DavidB_varwig \
 *      ~/mnt/beluga-varwig-data
 * Then you base directory would be something like:
 * VARWIG_TRACKS_DIR='/home/romgrk/mnt/beluga-varwig-data'
 * VARWIG_GEMINI_DB='/home/romgrk/mnt/beluga-varwig-data/WGS_VCFs/allSamples_WGS.gemini.db'
 */

module.exports = {
  inputFilesDirname,

  paths: {
    data:          dataDirname,

    // Static (unchanging) part of UCSC track hub to show alongside dynamic merged tracks
    staticTracks:  `${dataDirname}/ucsc.other-tracks.txt`,

    // Template for loading QTL files
    qtlsTemplate:  process.env.VARWIG_QTLS_TEMPLATE ?? `${inputFilesDirname}/qtls/QTLs_complete_$ASSAY.csv`,

    // Template for loading pre-computed points for box plots
    //   Format: TSV with:
    //    - column headers of sample IDs ([DONOR]_[CONDITION])
    //    - row headers of features
    pointTemplate: process.env.VARWIG_POINTS_TEMPLATE
      ?? `${inputFilesDirname}/matrices/$ASSAY_batch.age.corrected_PCsreg.txt`,

    // Merged tracks file location
    mergedTracks:  process.env.VARWIG_MERGED_TRACKS_DIR ?? path.join(dataDirname, 'mergedTracks'),

    // Locations of huge sensitive files
    tracks:        tracksDirname,
    gemini:        process.env.VARWIG_GEMINI_DB ?? path.join(tracksDirname, 'allSamples_WGS.gemini.db'),
  },

  source: {
    type: 'metadata',
    metadata: {
      path: path.join(__dirname, 'data/metadata.json'),
    },

    /*
     * The current gemini database for Aracena et al. contains names as "Epi_realName_flu_xxx".
     * We need to extract "realName" to make it easier for the rest (where "realName" corresponds to
     * the metadata.json "donor" property).
     */
    geminiSampleNameConverter: name => name.split('_')[1],  // name => name

    // minimum p-value for a peak must be at or below this p-value for the peak to get included.
    pValueMinThreshold: 0.05,

    conditions: [
      {id: "NI", name: "Non-infected"},
      {id: "Flu", name: "Flu"},
    ],
    ethnicities: [
      {id: "AF", name: "African-American", plotColor: "#5100FF", plotBoxColor: "rgba(81, 0, 255, 0.6)"},
      {id: "EU", name: "European-American", plotColor: "#FF8A00", plotBoxColor: "rgba(255, 138, 0, 0.6)"},
    ],
  },

  // The application was conceived to accept multiple data sources,
  // but for now only `metadata` (above) is tested.
  /* source: {
   *   type: 'ihec',
   *   ihec: {
   *     mysql: {
   *       host:     'localhost',
   *       user:     'root',
   *       password: 'secret',
   *       database: 'edcc',
   *     },
   *   },
   * }, */

  samples: {
    /* Additional filter for samples. The gemini database might contain
     * variants that we don't want to see, this removes them without
     * having to clean the database. */
    filter: 'type = "snp"',
  },

  merge: {
    bin: '',
    /* Maximum number of concurrent bigWigMergePlus processes, to
     * avoid CPU/memory shortage. */
    semaphoreLimit: 2,
  },

  assembly: {
    id: 'hg19',
    chromosomeSizes: {  // This is for HG19; if you want HG38, you will have to change these values
      "1": 249250621,
      "2": 243199373,
      "3": 198022430,
      "4": 191154276,
      "5": 180915260,
      "6": 171115067,
      "7": 159138663,
      "8": 146364022,
      "9": 141213431,
      "10": 135534747,
      "11": 135006516,
      "12": 133851895,
      "13": 115169878,
      "14": 107349540,
      "15": 102531392,
      "16": 90354753,
      "17": 81195210,
      "18": 78077248,
      "19": 59128983,
      "20": 63025520,
      "21": 48129895,
      "22": 51304566,
      // "X": 155270560,
      // "Y": 59373566,
    },
  },

  plots: {
    manhattan: {
      minPValue: 0.10,
      binSize: 100000,  // 100 kb bins
    },
  },

  /* Configuration for development related options */
  development: {
    /** @type Array<String> */
    chroms: undefined,
    // Eg
    //chroms: ['chr1', 'chr2', 'chr3' /* etc */],
  },
}
