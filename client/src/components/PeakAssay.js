import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  Alert,
  Container,
  Col,
  Row,
  Table,
} from 'reactstrap'

import Icon from './Icon'
import PeakBoxplot from './PeakBoxplot'
import { fetchValues } from '../actions'

const mapStateToProps = state => ({
  valuesByID: state.values.itemsByID
})
const mapDispatchToProps =
  { fetchValues }


class PeakAssay extends Component {
  static getDerivedStateFromProps(props, state) {
    if (state.selectedPeak !== undefined)
      return null
    const p = props.peaks[0]
    return { selectedPeak: p ? p.id : undefined }
  }

  state = {
    selectedPeak: undefined,
  }

  onChangeFeature = (p) => {
    const peakID = p.id
    this.setState({ selectedPeak: peakID })
  }

  render() {
    const { assay, peaks, valuesByID } = this.props
    const { selectedPeak } = this.state
    const p = peaks.find(p => p.id === selectedPeak)
    const values = valuesByID[selectedPeak]

    if (!values && p) {
      const params = p
      const meta = { id: p.id }
      this.props.fetchValues(params, meta)
    }

    return (
      <Container className='PeakAssay'>
        <Row>
          <Col xs='12'>
            <h6 className='PeakAssay__name'>
              <Icon name='flask' className='PeakAssay__icon' /><strong>{assay}</strong> - {peaks.length} peaks
            </h6>
          </Col>
        </Row>
        <Row>
          <Col xs='12'>
            <PeaksTable
              peaks={peaks}
              selectedPeak={selectedPeak}
              onChangeFeature={this.onChangeFeature}
            />
            {values && values.message &&
              <Alert color='danger'>
                <strong>Error while fetching data:</strong> {values.message}
              </Alert>
            }
          </Col>
          <Col xs='12' className={values && values.isLoading ? 'loading' : ''}>
            <PeakBoxplot
              title={formatFeature(p.feature)}
              values={values}
            />
          </Col>
        </Row>
      </Container>
    )
  }
}

function PeaksTable({ peaks, selectedPeak, onChangeFeature}) {
  return (
    <Table
      className='PeaksTable'
      size='sm'
      bordered
      hover
    >
      <thead>
        <tr>
          <th>Feature</th>
          <th>Condition</th>
          <th>P-value</th>
          <th>Output</th>
        </tr>
      </thead>
      <tbody>
        {
          peaks.map(p =>
            <tr
              key={p.id}
              className={'PeaksTable__row ' + (selectedPeak === p.id ? 'PeaksTable__row--selected' : '')}
              role='button'
              onClick={() => onChangeFeature(p)}
            >
              <td className='PeaksTable__feature'>{p.gene || formatFeature(p.feature)}</td>
              <td>{p.condition.split(',').map(conditionName).join(' | ')}</td>
              <td>{p.pvalue.toPrecision(5)}</td>
              <td><a href='#'>Tracks</a></td>
            </tr>
          )
        }
      </tbody>
    </Table>
  )
}

function conditionName(c) {
  switch (c) {
    case 'NI':  return 'Non-infected'
    case 'Flu': return 'Flu'
    default:
      return 'Unknown'
  }
}

function formatFeature(feature) {
  const {chrom, start, end, strand} = feature
  return `${chrom}:${start}-${end}` + (strand ? ` (${strand})` : '')
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PeakAssay);
