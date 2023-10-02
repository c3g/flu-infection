import React, {useCallback, useEffect, useState} from 'react';
import {Navigate, Outlet, Route, Routes, useLocation, useNavigate} from "react-router-dom";
import {useDispatch, useSelector} from "react-redux";

import Header from './Header'
import Footer from './Footer'
import PeakResults from './PeakResults'
import HelpModal from "./HelpModal";
import TermsModal from "./TermsModal";

import ContactModal from "./ContactModal";
import AboutPage from "./pages/AboutPage";
import ProtectedPageContainer from "./pages/ProtectedPageContainer";
import OverviewPage from "./pages/OverviewPage";
import ExplorePage from "./pages/ExplorePage";
import DatasetsPage from "./pages/DatasetsPage";
import FAQPage from "./pages/FAQPage";

import {saveUser} from "../actions";
import {SITE_SUBTITLE, SITE_TITLE} from "../constants/app";


const RoutedApp = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const userData = useSelector(state => state.user);

  const [helpModal, setHelpModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);

  const chrom = useSelector(state => state.ui.chrom);
  const position = useSelector(state => state.ui.position);

  const toggleHelp = useCallback(() => setHelpModal(!helpModal), [helpModal]);
  const toggleContact = useCallback(() => setContactModal(!contactModal), [contactModal]);
  const toggleTerms = useCallback(() => setTermsModal(!termsModal), [termsModal]);

  const navigateAbout = useCallback(() => navigate("/about"), [navigate]);
  const navigateDatasets = useCallback(() => navigate("/datasets"), [navigate]);
  // TODO: remember chrom and assay:
  const navigateOverview = useCallback(() => navigate("/overview"), [navigate]);
  const navigateExplore = useCallback(() => {
    if (location.pathname.startsWith("/explore")) return;
    if (chrom && position) {
      navigate(`/explore/locus/${chrom}/${position}`);
    } else {
      navigate("/explore");
    }
  }, [location.pathname, chrom, position, navigate]);
  const navigateFAQ = () => navigate("/faq");

  useEffect(() => {
    document.title = `${SITE_TITLE} | ${SITE_SUBTITLE}`;
  }, []);

  useEffect(() => {
    if (userData.isLoaded && userData.data && !userData.data.consentedToTerms) {
      // If the user has signed in and has not yet consented to the current terms version,
      // show the terms modal.
      setTermsModal(true);
    } else if (userData.data?.consentedToTerms) {
      // Just consented, close the modal
      setTermsModal(false);
    }
  }, [userData]);

  const termsOnAgree = useCallback(() => {
    if (userData.isLoaded) {
      dispatch(saveUser({consentedToTerms: true}));
    }
  }, [userData, dispatch]);

  return (
    <div className="RoutedApp">
      <TermsModal
        isOpen={termsModal}
        toggle={toggleTerms}
        showAgree={userData.data && !userData.data.consentedToTerms}
        onAgree={termsOnAgree}
      />

      <ContactModal isOpen={contactModal} toggle={toggleContact} />

      <Header onAbout={navigateAbout}
              onDatasets={navigateDatasets}
              onOverview={navigateOverview}
              onExplore={navigateExplore}
              onFAQ={navigateFAQ}
              onContact={toggleContact}>
        <HelpModal isOpen={helpModal} toggle={toggleHelp} />
      </Header>

      <Outlet context={{termsModal, setTermsModal, toggleHelp}} />

      <Footer onContact={toggleContact} onTerms={toggleTerms} />
    </div>
  )
};


const App = () => (
  <div className='App'>
    <Routes>
      <Route path="/" element={<RoutedApp />}>
        <Route index={true} element={<Navigate to="/about" replace={true} />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="overview" element={<ProtectedPageContainer>
          <OverviewPage />
        </ProtectedPageContainer>} />
        <Route path="explore" element={<ProtectedPageContainer>
          <ExplorePage />
        </ProtectedPageContainer>}>
          <Route index={true} element={<PeakResults />} />
          <Route path="locus/:chrom/:position/:assay" element={<PeakResults />} />
          <Route path="locus/:chrom/:position" element={<PeakResults />} />
        </Route>
        <Route path="faq" element={<FAQPage />} />
        <Route path="auth-failure" element={<div />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />}/>
    </Routes>
  </div>
);


export default App;
