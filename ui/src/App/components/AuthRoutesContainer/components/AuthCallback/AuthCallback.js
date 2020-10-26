import React, { useEffect } from 'react';
import { gql } from '@apollo/client';
import Loader from 'react-loader';
import useAuth from '@/services/useAuth';
import apolloClient from '@/services/apolloClient';
import history from '@/services/history';

const GET_VIEWER = gql`
  query AuthCallback_person($email: String!) {
    person(email: $email) {
      nodeId
      email
      name
    }
  }
`;

const CREATE_VIEWER = gql`
  mutation AuthCallback_createViewer {
    createViewer {
      nodeId
      email
    }
  }
`;

const AuthCallback = () => {
  const {
    initialized, isLoggedIn, email, accessToken,
  } = useAuth();

  useEffect(() => {
    if (initialized) {
      if (isLoggedIn && email) {
        const client = apolloClient(accessToken);

        client
          .query({ query: GET_VIEWER, variables: { email } })
          .then(({ data }) => {
            if (data.person) {
              history.replace('/');
            } else {
              client
                .mutate({ mutation: CREATE_VIEWER })
                .then(() => history.replace('/profile'))
                .catch(err => console.log(err));
            }
          })
          .catch(err => console.log(err));
      } else {
        // just logged out
        history.replace('/');
      }
    }
  });

  return (
    <div>
      <Loader
        options={{
          color: '#aaa',
          length: 20,
          radius: 20,
          width: 8,
        }}
      />
    </div>
  );
};

export default AuthCallback;
