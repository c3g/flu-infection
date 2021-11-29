import React from 'react';

import { ETHNICITY_COLOR } from '../constants/app'
import { getDomain } from '../helpers/boxplot'
import {CONDITION_FLU, CONDITION_NI, conditionName} from "../helpers/conditions";
import AutoSizer from './AutoSizer'
import BoxPlot from './BoxPlot'

const defaultValues = { isLoading: true, data: {} }

function PeakBoxplot({ title, values = defaultValues }) {
  const niData  = values.data[CONDITION_NI]  ? getDataFromValues(values.data[CONDITION_NI])  : []
  const fluData = values.data[CONDITION_FLU] ? getDataFromValues(values.data[CONDITION_FLU]) : []

  const niDomain  = getDomain(niData)
  const fluDomain = getDomain(fluData)

  // Use this for the box plots to get y-axes on the same scale
  // Also import: import { combineDomains } from '../helpers/boxplot'
  // Disabled upon request by David L, 2021-10-08
  // const domain = combineDomains([niDomain, fluDomain])

  return (
    <div className='PeakBoxplot'>
      <h6 className='text-center'>{title}</h6>
      <AutoSizer disableHeight>
        {
          ({ width }) => {
            const boxWidth = Math.min(width / 2, 350)

            return (
              <div className='PeakBoxplot__graphs'>
                <BoxPlot
                  title={conditionName(CONDITION_NI)}
                  domain={values.isLoading ? undefined : niDomain}
                  data={values.isLoading ? [] : niData}
                  width={boxWidth}
                  height={boxWidth}
                />
                <BoxPlot
                  title={conditionName(CONDITION_FLU)}
                  domain={values.isLoading ? undefined : fluDomain}
                  data={values.isLoading ? [] : fluData}
                  width={boxWidth}
                  height={boxWidth}
                />
              </div>
            )
          }
        }
      </AutoSizer>
      <div className='PeakBoxplot__legend'>
        <div className='PeakBoxplot__legend__item'>
          <span style={{ background: ETHNICITY_COLOR.AF }} /> African-American
        </div>
        <div className='PeakBoxplot__legend__item'>
          <span style={{ background: ETHNICITY_COLOR.EU }} /> European-American
        </div>
      </div>
    </div>
  )
}

function getDataFromValues(values) {
  return [
    { name: 'Hom Ref', data: values.REF || [] },
    { name: 'Het',     data: values.HET || [] },
    { name: 'Hom Alt', data: values.HOM || [] }
  ]
}

export default PeakBoxplot
