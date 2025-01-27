import React from "react";

import {Button, Col, Container, Row} from "reactstrap";

const Intro = ({onAccess}) => (
  <Container className="Page">
    <Row>
      <Col md="12" lg={{size: 10, offset: 1}}>
        <p>
          To explore the data, you must first{" "}
          <a href="#" onClick={onAccess}>agree to our terms of use</a>{" "}
          to ensure data privacy conditions are respected.
        </p>
        <Button onClick={onAccess}>Access the Data</Button>
      </Col>
    </Row>
  </Container>
);

export default Intro;
