import React from "react";
import {Col, Container, Row} from "reactstrap";
import {Link} from "react-router-dom";

const DatasetsPage = () => {
  return <Container className="Page">
    <Row>
      <Col md="12" lg={{size: 10, offset: 1}}>
        <h2>Datasets</h2>
        <p>
          All the datasets that have been generated as part of this project are made available freely. Access to some
          of the raw datasets will require a formal data access request. Please cite{" "}
          <Link to="/about#papers">the appropriate paper(s)</Link> if you use data from this project.
        </p>
        <h3>Data Download</h3>
        <h4>RNA-seq, ATAC-seq and ChIPmentation</h4>
        <p>
          Sequence data for RNA-seq, ATAC-seq and ChIPmentation have been deposited at the
          European Genome-phenome Archive (EGA), under accession numbers{" "}
          <a href="https://ega-archive.org/datasets/EGAD00001008422"
             target="_blank"
             rel="noreferrer">EGAD00001008422</a>.
        </p>
        <h4>WGS and WGBS</h4>
        <p>
          Sequence data for WGS and WGBS have been deposited at the European Genome-phenome Archive (EGA), under
          accession numbers{" "}
          <a href="https://ega-archive.org/datasets/EGAD00001008422"
             target="_blank"
             rel="noreferrer">EGAD00001008422</a>{" "}
          (RNA-seq, ATAC-seq and ChIPmentation) and{" "}
          <a href="https://ega-archive.org/datasets/EGAD00001008359"
             target="_blank"
             rel="noreferrer">EGAD00001008359</a>.
        </p>
        <h4>10X linked reads</h4>
        <p>N/A for now</p>
        <h4>ChIP-seq on NA12878</h4>
        <p>N/A for now</p>
      </Col>
    </Row>
  </Container>;
};

export default DatasetsPage;
