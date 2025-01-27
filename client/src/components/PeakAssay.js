import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {
  Button,
  ButtonGroup,
  Container,
  Col,
  Input,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  Row,
  Table,
  Tooltip,
} from 'reactstrap'
import {useTable, usePagination, useSortBy} from "react-table";
import igv from "igv/dist/igv.esm";

import Icon from "./Icon";
import PeakBoxplot from "./PeakBoxplot";

import {mergeTracks, setUsePrecomputed} from "../actions";
import {constructUCSCUrl} from "../helpers/ucsc";
import {useCurrentDataset, useNode} from "../hooks";


const PAGE_SIZES = [10, 20, 30, 40, 50];


const PeakAssay = ({peaks}) => {
  const dispatch = useDispatch();

  const usePrecomputed = useSelector(state => state.ui.usePrecomputed);
  const setPrecomputed = useCallback(
    event => dispatch(setUsePrecomputed(event.currentTarget.checked)),
    [dispatch]);

  const [selectedPeak, setSelectedPeak] = useState(undefined);

  useEffect(() => {
    if (selectedPeak !== undefined && peaks.map(p => p.id).includes(selectedPeak)) return;
    // If we do not have a selected peak which is in the current list of peaks for all assays, select one.
    const p = peaks[0];
    setSelectedPeak(p ? p.id : undefined);
  }, [peaks])

  const onChangeFeature = useCallback(p => setSelectedPeak(p.id), []);
  const onOpenTracks = useCallback((p) => {
    return dispatch(mergeTracks(p));  // res shape: { assemblyID, sessionID, session }
  }, [dispatch]);

  const selectedPeakData = peaks.find(p => p.id === selectedPeak);

  return (
    <Container className='PeakAssay' fluid={true}>
      <Row>
        <Col xs={12}>
          <PeaksTable
            peaks={peaks}
            selectedPeak={selectedPeak}
            onChangeFeature={onChangeFeature}
            onOpenTracks={onOpenTracks}
          />
        </Col>
        <Col xs={12}>
          <Label check={true}>
            <Input type="checkbox" checked={usePrecomputed} onChange={setPrecomputed} />{" "}
            Use precomputed, batch-corrected points?
          </Label>
        </Col>
        <Col xs={12}>
          <PeakBoxplot
            title={selectedPeakData ? `${selectedPeakData.snp.id} — ${formatFeature(selectedPeakData)}` : ""}
            peak={selectedPeakData}
          />
        </Col>
      </Row>
    </Container>
  );
};

const PeaksTable = ({peaks, selectedPeak, onChangeFeature, onOpenTracks}) => {
  const node = useSelector((state) => state.ui.node);

  const dataset = useCurrentDataset();
  const {assembly, conditions} = dataset ?? {};  // dataset metadata

  const [tooltipsShown, setTooltipsShown] = useState({});
  const [tracksLoading, setTracksLoading] = useState({});

  const [igvData, setIgvData] = useState(null);  // shape: { assemblyID, sessionID, session }
  const [igvModalOpen, setIgvModalOpen] = useState(false);

  const setTrackLoading = useCallback((id, val) => {
    setTracksLoading({...tracksLoading, [id]: val});
  }, [tracksLoading]);
  const setTrackNotLoading = useCallback((id) => {
    setTracksLoading(Object.fromEntries(Object.entries(tracksLoading).filter(e => e[0] !== id)));
  }, [tracksLoading]);

  const toggleTooltip = tooltipID => () => setTooltipsShown({
    ...tooltipsShown,
    [tooltipID]: tooltipsShown[tooltipID] ? undefined : true,
  });

  const columns = useMemo(() => [
    {
      id: "snp",
      Header: "SNP",
      accessor: ({id, snp}) => {
        const k = `row${id}-snp`;
        return <div>
          <a id={k} style={{textDecoration: "underline"}}>{snp.id}</a>
          <Tooltip target={k} placement="top" isOpen={tooltipsShown[k]} toggle={toggleTooltip(k)} autohide={false}>
            [{assembly}] chr{snp.chrom}:{snp.position}
          </Tooltip>
        </div>;
      },
      disableSortBy: true,
    },
    {
      id: "feature",
      Header: "Feature",
      className: "PeaksTable__feature",
      accessor: row => {
        const {id, feature} = row;
        const k = `row${id}-feature`;
        const featureText = formatFeature(row);
        const showTooltip = !featureText.startsWith("chr");
        return <div>
          <a id={k} style={{textDecoration: showTooltip ? "underline" : "none"}}>{featureText}</a>
          {showTooltip ? (
            <Tooltip target={k} placement="top" isOpen={tooltipsShown[k]} toggle={toggleTooltip(k)} autohide={false}>
              [{assembly}] chr{feature.chrom}:{feature.start}-{feature.end}
              {" "}
              {feature.strand ? `(strand: ${feature.strand})` : null}
            </Tooltip>
          ) : null}
        </div>;
      },
      disableSortBy: true,
    },
    {
      id: "distance",
      Header: "SNP-Feature Distance",
      className: "PeaksTable__distance",
      accessor: ({snp: {position: snpPos}, feature: {start, end}}) => {
        if (start <= snpPos && snpPos <= end) {
          return "contained";
        }

        // Otherwise, SNP is outside the feature, either L/R of it.

        // Distance in base pairs
        const distance = Math.min(Math.abs(snpPos - start), Math.abs(snpPos - end));

        return distance > 1000
          ? `${(distance / 1000).toFixed(1)} kb`
          : `${distance.toFixed(0)} bp`;
      },
      disableSortBy: true,
    },
    ...(conditions ?? []).map(({id, name}, idx) => {
      // noinspection JSUnusedGlobalSymbols
      return {
        id: `value${id}`,
        Header: <span><span style={{fontFamily: "serif"}}>p</span> Value ({name})</span>,
        accessor: row => {
          const fixed = row.values[idx].toPrecision(5);
          const floatStr = row.values[idx].toString();
          return floatStr.length < fixed.length ? floatStr : fixed;
        },
        sortType: (r1, r2) => r1.original.values[idx] < r2.original.values[idx] ? -1 : 1,
      };
    }),
    {
      id: "tracks",
      Header: "View Tracks",
      className: "PeaksTable__tracks",
      accessor: row => {
        const loading = tracksLoading[row.id];
        return <div style={{ whiteSpace: "nowrap" }}>
          <Button size="sm" color="link" disabled={!!loading} onClick={() => {
            setTrackLoading(row.id, "igv");
            onOpenTracks(row).then((res) => {
              if (res.error) {
                console.error("could not open igv.js browser:", res);
              } else {
                console.debug("opening igv.js with", res);
                setIgvData(res);
                setIgvModalOpen(true);
              }
              setTrackNotLoading(row.id);
            });
          }}>
            <span style={{ fontFamily: "monospace" }}>{loading === "igv" ? "Loading" : "igv.js"}</span>
          </Button>
          <span style={{ margin: "0 0.4em" }}>·</span>
          <Button size='sm' color='link' disabled={!!loading} onClick={() => {
            setTrackLoading(row.id, "ucsc");
            onOpenTracks(row).then((res) => {
              launchInUCSC(node, res);
              setTrackNotLoading(row.id);
            });
          }}>
            {loading === "ucsc" ? "Loading" : (<>UCSC <Icon name='external-link' /></>)}
          </Button>
        </div>;
      },
      disableSortBy: true,
    },
  ], [node, assembly, conditions, setTrackLoading, setTrackNotLoading, onOpenTracks, tooltipsShown]);

  // noinspection JSCheckFunctionSignatures
  const tableInstance = useTable(
    {columns, data: peaks},
    // Order matters for below hooks
    useSortBy,
    usePagination);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,

    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = tableInstance;

  const onGotoPage = useCallback(e => {
    const page = e.target.value ? Number(e.target.value) - 1 : 0
    gotoPage(page)
  }, [gotoPage]);

  const onSelectPage = useCallback(e => setPageSize(Number(e.target.value)), []);

  return <>
    <div className="PeaksTableContainer">
      <PeakIGVModal data={igvData} isOpen={igvModalOpen} toggle={() => setIgvModalOpen(!igvModalOpen)} />

      <Table
        className="PeaksTable"
        size="sm"
        bordered
        hover
        {...getTableProps()}
      >
        <thead>
        {
          headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render("Header")}
                  <span>{column.isSorted ? (column.isSortedDesc ? " ▼" : " ▲") : ''}</span>
                </th>
              ))}
            </tr>
          ))
        }
        </thead>
        <tbody {...getTableBodyProps()}>
        {
          page.map(row => {
            prepareRow(row);
            const p = row.original;
            // noinspection JSCheckFunctionSignatures,JSUnresolvedVariable,JSUnusedGlobalSymbols
            return (
              <tr {...row.getRowProps([{
                className: "PeaksTable__row " + (selectedPeak === p.id ? "PeaksTable__row--selected" : ""),
                onClick: () => onChangeFeature(p),
              }])}>
                {row.cells.map(cell => <td {...cell.getCellProps([{
                  className: cell.column.className,
                }])}>{cell.render("Cell")}</td>)}
              </tr>
            )
          })
        }
        </tbody>
      </Table>
    </div>

    {/*
        Pagination can be built however you'd like.
        This is just a very basic UI implementation:
      */}
    <div className="pagination">
      <ButtonGroup>
        <Button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>&laquo;</Button>
        <Button onClick={() => previousPage()} disabled={!canPreviousPage}>&lsaquo;</Button>
        <Button onClick={() => nextPage()} disabled={!canNextPage}>&rsaquo;</Button>
        <Button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>&raquo;</Button>
      </ButtonGroup>
      <div className="pagination__page">
        Page <strong>{pageIndex + 1} of {pageOptions.length}</strong>
      </div>
      <div className="pagination__goto">
        Go to page:{' '}
        <Input
          type="number"
          disabled={pageOptions.length === 1}
          defaultValue={pageIndex + 1}
          onChange={onGotoPage}
          style={{ width: "100px", display: "inline-block" }}
        />
      </div>
      <Input
        type="select"
        value={pageSize}
        onChange={onSelectPage}
        style={{width: "120px", marginLeft: "1em"}}
      >
        {PAGE_SIZES.map(pageSize => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </Input>
    </div>
  </>;
}

const PeakIGVModal = ({ data, isOpen, toggle }) => {
  const browserDiv = useRef();
  const browserRef = useRef(null);

  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingBrowser, setLoadingBrowser] = useState(false);
  const [sessionTracks, setSessionTracks] = useState(null);

  const node = useNode();

  const { assemblyID, sessionID, session } = data ?? {};  // session <=> peak here
  const { assay, feature, snp } = session ?? {};
  const { chrom: fChrom, start: fStart, end: fEnd } = feature ?? {};

  useEffect(() => {
    // Fetch tracks when data is set
    if (data) {
      setLoadingTracks(true);
      fetch(`${node}/api/igvjs/track-db/${sessionID}`)
        .then((res) => res.json())
        .then(({data: tracks}) => {
          setSessionTracks(tracks);
          setLoadingTracks(false);
        })
        .catch((err) => console.error(err));
    } else if (browserRef.current) {
      igv.removeBrowser(browserRef.current);
    }
  }, [data]);

  useEffect(() => {
    console.debug("browserDiv.current:", browserDiv.current);
    console.debug("tracks:", sessionTracks);
    
    if (!browserDiv.current || !sessionTracks) return;

    setLoadingBrowser(true);
    
    igv.createBrowser(browserDiv.current, {
      genome: assemblyID,
      locus: buildBrowserPosition(feature, snp),
      tracks: sessionTracks,
      roi: [
        // rgb(255, 235, 0) at 0.2 opacity is equivalent to #FFFBCC to match UCSC
        buildIGVjsROI(`chr${fChrom}`, fStart, fEnd, "rgba(255, 235, 0, 0.2)", "Feature"),
        // rgb(255, 0, 0) at 0.38 opacity is equivalent to #FF9F9F to match UCSC
        buildIGVjsROI(`chr${snp.chrom}`, snp.position, snp.position + 1, "rgba(255, 0, 0, 0.38)", "SNP"),
      ],
    }).then((browser) => {
      console.debug("set up igv.js browser:", browser);
      browserRef.current = browser;
      setLoadingBrowser(false);
    }).catch((err) => console.error(err));
  }, [sessionTracks]);

  /** @type React.ReactNode */
  const title = data ? <><strong>{assay}</strong> – SNP: {snp.id}, feature: {formatFeature(session)}</> : "";

  return (
    <Modal isOpen={isOpen} toggle={toggle} style={{ maxWidth: "80vw" }}>
      <ModalHeader toggle={toggle}>{title}</ModalHeader>
      <ModalBody>
        {loadingTracks && <div style={{ paddingBottom: 12, textAlign: "center" }}>Loading...</div>}
        <div ref={browserDiv} style={{ minHeight: 550 }} className={loadingBrowser ? "loading" : ""} />
      </ModalBody>
    </Modal>
  );
};

const launchInUCSC = (node, { assemblyID, sessionID, session: { feature, snp } }) => {
  const position = buildBrowserPosition(feature, snp);
  const hubURL = `${node}/api/ucsc/hub/${sessionID}`;
  const ucscURL = constructUCSCUrl([
    ["db", assemblyID],
    ["hubClear", hubURL],
    // ["hubClear", permaHubURL],
    ["position", position],

    // Highlight the SNP in red, and the feature in light yellow
    ["highlight", [
      buildUCSCHighlight(assemblyID, `chr${feature.chrom}`, feature.start, feature.end, "#FFFBCC"),
      buildUCSCHighlight(assemblyID, `chr${snp.chrom}`, snp.position, snp.position + 1, "#FF9F9F"),
    ].join("|")],
  ]);

  console.debug('Hub:',  hubURL);
  console.debug('UCSC:', ucscURL);

  window.open(ucscURL);
};

const buildBrowserPosition = (feature, snp, padding=500) => {
  const featureChrom = `chr${feature.chrom}`;
  const snpChrom = `chr${snp.chrom}`;

  const snpPosition = snp.position;
  const displayWindow = featureChrom === snpChrom
    ? [Math.min(feature.start, snpPosition), Math.max(feature.end, snpPosition)]
    : [feature.start, feature.end];

  return `${featureChrom}:${displayWindow[0]-padding}-${displayWindow[1]+padding}`;
};

const buildIGVjsROI = (chr, start, end, color, name) => ({
  name,
  color,
  features: [{ chr, start, end }],
});

const buildUCSCHighlight = (asm, chr, start, end, color) => `${asm}.${chr}:${start}-${end}${color}`;

const formatFeature = ({assay, gene, feature}) => {
  const {chrom, start, end, strand} = feature;
  const featureText = `chr${chrom}:${start}-${end}` + (strand ? ` (${strand})` : '')
  return assay === "RNA-seq" ? (gene || featureText) : featureText
};

export default PeakAssay;
