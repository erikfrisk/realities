import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useHistory, useParams } from 'react-router-dom';
import { GET_NEEDS, GET_RESP_FULFILLS, CACHE_QUERY } from 'services/queries';
import {
  REALITIES_CREATE_SUBSCRIPTION,
  REALITIES_DELETE_SUBSCRIPTION,
  REALITIES_UPDATE_SUBSCRIPTION,
} from 'services/subscriptions';
import useAuth from 'services/useAuth';
import ListHeader from 'components/ListHeader';
import WrappedLoader from 'components/WrappedLoader';
import CreateNeed from './components/CreateNeed';
import NeedsList from './components/NeedsList';

const NeedsContainer = () => {
  const auth = useAuth();
  const history = useHistory();
  const { orgSlug, responsibilityId, needId } = useParams();
  const { data: localData = {} } = useQuery(CACHE_QUERY);
  const {
    subscribeToMore,
    loading,
    error,
    data,
  } = useQuery(GET_NEEDS);
  const {
    loading: loadingFulfills,
    error: errorFulfills,
    data: dataFulfills,
  } = useQuery(GET_RESP_FULFILLS, {
    variables: { responsibilityId },
    skip: !responsibilityId,
  });

  const [expandedNeedId, setExpandedNeedId] = useState(undefined);
  const [highlightedNeedId, setHighlightedNeedId] = useState(undefined);
  const [lastRespId, setLastRespId] = useState(undefined);

  return (
    <div
      data-cy="needs-container"
    >
      {auth.isLoggedIn && <ListHeader needIsExpanded={!!expandedNeedId} />}
      {localData.showCreateNeed
        && <CreateNeed />}
      {(() => {
        if (loading) return <WrappedLoader />;
        if (error) return `Error! ${error.message}`;
        if (errorFulfills) return `Error! ${errorFulfills.message}`;

        if (!responsibilityId && needId !== highlightedNeedId) {
          setHighlightedNeedId(needId);
          setExpandedNeedId(needId);
        } else if (!loadingFulfills && dataFulfills) {
          if (dataFulfills.responsibility === null) {
            // if the respId is invalid for some reason
            history.push(`/${orgSlug}`);
            return null;
          }
          const fulfillsNeedId = dataFulfills.responsibility.fulfills.nodeId;
          if (!expandedNeedId || lastRespId !== responsibilityId) {
            // if we're new on the page or if something makes us nav to another
            // resp
            setExpandedNeedId(fulfillsNeedId);
            setLastRespId(responsibilityId);
          }
          if (fulfillsNeedId !== highlightedNeedId) {
            setHighlightedNeedId(fulfillsNeedId);
          }
        }

        return (
          <NeedsList
            needs={data.needs}
            highlightedNeedId={highlightedNeedId}
            expandedNeedId={expandedNeedId}
            setExpandedNeedId={setExpandedNeedId}
            subscribeToNeedsEvents={() => {
              const unsubscribes = [
                subscribeToMore({
                  document: REALITIES_CREATE_SUBSCRIPTION,
                  updateQuery: (prev, { subscriptionData }) => {
                    if (!subscriptionData.data) return prev;
                    const { realityCreated } = subscriptionData.data;

                    if (realityCreated.__typename !== 'Need') return prev;

                    const alreadyExists = prev.needs
                      .filter((need) => need.nodeId === realityCreated.nodeId)
                      .length > 0;

                    if (alreadyExists) return prev;
                    return { needs: [realityCreated, ...prev.needs] };
                  },
                }),
                subscribeToMore({
                  document: REALITIES_DELETE_SUBSCRIPTION,
                  updateQuery: (prev, { subscriptionData }) => {
                    if (!subscriptionData.data) return prev;
                    const { realityDeleted } = subscriptionData.data;
                    return {
                      needs: prev.needs.filter(((item) => item.nodeId !== realityDeleted.nodeId)),
                    };
                  },
                }),
                subscribeToMore({
                  document: REALITIES_UPDATE_SUBSCRIPTION,
                  updateQuery: (prev, { subscriptionData }) => {
                    if (!subscriptionData.data) return prev;

                    const { realityUpdated } = subscriptionData.data;

                    return {
                      needs: prev.needs.map((item) => {
                        if (item.nodeId === realityUpdated.nodeId) return realityUpdated;
                        return item;
                      }),
                    };
                  },
                }),
              ];
              return () => unsubscribes.forEach((fn) => fn());
            }}
          />
        );
      })()}
    </div>
  );
};

export default NeedsContainer;
