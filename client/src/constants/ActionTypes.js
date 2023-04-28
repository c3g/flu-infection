export const SET_CHROM        = 'SET_CHROM';
export const SET_POSITION     = 'SET_POSITION';
export const HANDLE_ERROR     = 'HANDLE_ERROR';

export const ASSAYS           = createFetchConstants('ASSAYS');
export const SAMPLES          = createFetchConstants('SAMPLES');
export const CHROMS           = createFetchConstants('CHROMS');
export const POSITIONS        = createFetchConstants('POSITIONS');
export const VALUES           = createFetchConstants('VALUES');
export const PEAKS            = createFetchConstants('PEAKS');
export const OVERVIEW_CONFIG  = createFetchConstants('OVERVIEW_CONFIG');
export const MANHATTAN_DATA   = createFetchConstants('MANHATTAN_DATA');
export const USER             = createFetchConstants('USER');
export const MESSAGES         = createFetchConstants('MESSAGES');


function createFetchConstants(namespace) {
  return {
    'REQUEST': `${namespace}.REQUEST`,
    'RECEIVE': `${namespace}.RECEIVE`,
    'ERROR':   `${namespace}.ERROR`,
    'ABORT':   `${namespace}.ABORT`,
  }
}
