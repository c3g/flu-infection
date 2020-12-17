/*
 * config.js
 */

const path = require('path')

module.exports = {
  paths: {
    data: '/home/rgregoir/data',
    gemini: '/home/rgregoir/data/gemini.db',
    tracks: '/home/rgregoir/data/tracks',
    mergedTracks: '/home/rgregoir/data/mergedTracks',
    sessions: '/home/rgregoir/data/sessions.sqlite',
    peaks: '/home/rgregoir/data/peaks.sqlite',
    genes: '/home/rgregoir/data/genes.sqlite',
  },
  // source: either 'ihec' or 'metadata'
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
  /* source: {
   *   type: 'metadata',
   *   metadata: {
   *     path: path.join(__dirname, 'data/metadata.json'),
   *   },
   * }, */
  samples: {
    filter: '1 = 1',
  },
  merge: {
    bin: '',
    semaphoreLimit: 2,
  },

  /* Configuration for development related options */
  development: {
    /** @type Array<String> cached list of chroms */
    chroms: undefined,
  },
}
