import React, {useCallback, useEffect} from "react";
import {useSelector} from "react-redux";
import {useOutletContext} from "react-router-dom";
import {Container, Spinner} from "reactstrap";

import {LOGIN_PATH} from "../../constants/app";
import {getHasLoggedIn, setHasLoggedIn} from "../../helpers/localStorage";

import Intro from "../Intro";

const LoadingContainer = React.memo(() => (
  <Container>
    <div style={{textAlign: "center", marginTop: 48}}>
      <Spinner />
    </div>
  </Container>
));

const triggerLogIn = () => {
  window.location.href = `${LOGIN_PATH}?redirect=${window.location.pathname}`;
};

const ProtectedPageContainer = React.memo(({children}) => {
  const {setTermsModal} = useOutletContext();
  const {data: userData, isLoaded} = useSelector(state => state.user);

  useEffect(() => {
    if (isLoaded && userData) {
      setHasLoggedIn();
    } else if (isLoaded && !userData) {
      if (getHasLoggedIn()) {
        triggerLogIn();
      }
    }
  }, [userData, isLoaded]);

  const onAccess = useCallback(() => {
    if (!userData) {
      // Redirect to sign in, so we can capture some information about their identity (IP address).
      triggerLogIn();
    } else {
      // Signed in but terms not accepted yet; show the modal.
      setTermsModal(true);
    }
  }, [userData]);

  if (!isLoaded) return <LoadingContainer />;

  return (!userData?.consentedToTerms) ? (
    <Intro onAccess={onAccess} />
  ) : <>
    {children}
  </>;
});

export default ProtectedPageContainer;
