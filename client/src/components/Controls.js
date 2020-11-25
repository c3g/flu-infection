import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import {
  Input,
  InputGroup,
  Button,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledTooltip,
} from 'reactstrap'

import Icon from './Icon.js'
import {
  setChrom,
  setWindowStart,
  setWindowEnd,
  doSearch,
  changePosition,
  fetchSamples,
  fetchPositions,
  mergeTracks,
  handleError,
} from '../actions.js'

const mapStateToProps = state => ({
    isLoading: state.samples.isLoading
  , samples: state.samples.list
  , chroms: state.chroms
  , chrom: state.ui.chrom
  , windowStart: state.ui.windowStart
  , windowEnd: state.ui.windowEnd
  , positions: state.positions
  , position: state.ui.position
  , range: state.ui.range
})
const mapDispatchToProps = (dispatch) =>
  bindActionCreators({
    setChrom,
    setWindowStart,
    setWindowEnd,
    doSearch,
    changePosition,
    fetchSamples,
    fetchPositions,
    mergeTracks,
    handleError
  }, dispatch)

class Controls extends React.Component {

  state = {
    index: 0,
    open: false,
  }

  componentWillReceiveProps(props) {
    if (props.chrom !== this.props.chrom) {
      const { chrom } = props

      this.props.fetchPositions({ chrom, position: '' })
    }
    if (props.positions !== this.props.positions) {
      this.setState({ index: 0 })
    }
  }

  onFocus = (ev) => {
    this.previousValue = ev.target.value

    setTimeout(() => this.setState({ open: true }), 100)
  }

  onBlur = (ev) => {
    const didChange = ev.target.value !== this.previousValue
    const position = didChange ? Number(ev.target.value) : null

    setTimeout(() => {
      this.setState({ open: false })

      if (didChange && !Number.isNaN(position) && position !== 0 && !this.props.isLoading) {
        this.props.setWindowStart(Math.max(0, position - 5000))
        this.props.setWindowEnd(position + 5000)
      }
    }, 200)
  }

  onKeyDown = ev => {
    if (ev.which === 13 /* Enter */) {
      if (this.props.positions.list.length > 0)
        this.selectItem(this.state.index)
      else
        this.props.doSearch()

      if (document.activeElement.tagName === 'INPUT')
        document.activeElement.blur()
    }

    if (ev.which === 9 /* Tab */) {
      ev.preventDefault()
      if (ev.shiftKey)
        this.moveSelection(-1)
      else
        this.moveSelection(+1)
    }
    if (ev.which === 38 /* ArrowUp */) {
      this.moveSelection(-1)
    }
    if (ev.which === 40 /* ArrowDown */) {
      this.moveSelection(+1)
    }
  }

  onClickSearch = () => {
    this.props.doSearch()
  }

  onClickMerge = () => {
    this.props.mergeTracks()
  }

  onChange = (ev) => {
    this.props.changePosition(ev.target.value)
  }

  moveSelection = n => {
    const { length } = this.props.positions.list
    let index = this.state.index + n

    if (index < 0)
      index = index + length
    else if (index > length - 1)
      index = index % length

    this.setState({ index })
  }

  selectItem = index => {
    const { positions: { list } } = this.props

    const position = Number(list[index])
    this.props.setWindowStart(Math.max(0, position - 5000))
    this.props.setWindowEnd(position + 5000)
    this.props.changePosition(position)
    this.props.doSearch()
  }

  renderChroms() {
    const { chrom, chroms: { isLoading, list }, setChrom } = this.props

    return (
      <UncontrolledDropdown className='Controls__chromosome input-group-prepend'>
        <DropdownToggle caret disabled={isLoading}>
          { isLoading &&
            <span><Icon name='spinner' spin/> Loading</span>
          }
          {
            !isLoading &&
              (chrom || 'Chrom.')
          }
        </DropdownToggle>
        <DropdownMenu>
          {
            list.map(chrom =>
              <DropdownItem key={chrom} onClick={() => setChrom(chrom)}>{ chrom }</DropdownItem>
            )
          }
        </DropdownMenu>
      </UncontrolledDropdown>
    )
  }

  renderPosition() {
    const { open, index } = this.state
    const { position, positions: { list } } = this.props

    return (
      <React.Fragment>
        <Input
          className='Controls__input autocomplete'
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          onFocus={this.onFocus}
          onBlur={this.onBlur}
          value={position}
          placeholder='10000'
        />
        {
          open &&
            <div className='autocomplete__dropdown-menu'>
              {
                list.length === 0 &&
                  <div className={ 'autocomplete__item autocomplete__item--empty' }>
                    <span>No results</span>
                  </div>
              }
              {
                list.map((item, i) =>
                  <div key={item} className={ 'autocomplete__item ' + (i === index ? 'autocomplete__item--selected' : '') }
                    onClick={() => this.selectItem(i)}
                  >
                    { highlight(item, position) }
                  </div>
                )
              }
            </div>
        }
      </React.Fragment>
    )
  }

  render() {
    const { isLoading } = this.props

    return (
      <div className='Controls d-flex justify-content-center'>
        <InputGroup>
          { this.renderChroms() }
          { this.renderPosition() }
        </InputGroup>

        <InputGroup>
          <div className='input-group-prepend'>
            <Button className='Controls__search'
              onClick={this.onClickSearch}
              disabled={isLoading}
            >
              <Icon name={ isLoading ? 'spinner' : 'search' } spin={isLoading} /> Search
            </Button>
          </div>
          <Input
            type='number'
            className='Controls__windowStart'
            value={this.props.windowStart}
            onChange={ev => this.props.setWindowStart(+ev.target.value)}
          />
          <Input
            type='number'
            className='Controls__windowEnd'
            value={this.props.windowEnd}
            onChange={ev => this.props.setWindowEnd(+ev.target.value)}
          />
        </InputGroup>
        <Icon id='search-help-tooltip-icon' name='question-circle' className='Controls__help' />
        <UncontrolledTooltip placement='right' target='search-help-tooltip-icon'>
          These inputs allows you to control the window size for which to examine track values.
        </UncontrolledTooltip>
      </div>
    )
  }
}

function highlight(item, prefix) {
  if (!item.startsWith(prefix))
    return <span>{ item }</span>

  const rest = item.replace(prefix, '')
  return (
    <span>
      <span className='highlight'>{ prefix }</span>
      { rest }
    </span>
  )
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Controls);
