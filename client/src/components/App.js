import React, { Component } from 'react';
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux';

import Controls from './Controls'
import Header from './Header'
import PeakResults from './PeakResults'


const mapStateToProps = state => ({})
const mapDispatchToProps = dispatch =>
  bindActionCreators({}, dispatch)

class App extends Component {

  render() {
    return (
      <div className='App'>
        <Header>
          <Controls />
        </Header>

        <PeakResults />
      </div>
    )
  }
}


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
