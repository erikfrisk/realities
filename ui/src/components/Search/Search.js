import React from 'react';
import styled from 'styled-components';
import { useHistory } from 'react-router-dom';
import Downshift from 'downshift';
import { useOrgSlug } from 'services/location';
import SearchBar from './components/SearchBar';
import SearchResultsContainer from './components/SearchResultsContainer';

const Wrapper = styled.div`
  position: relative;
`;

const Search = () => {
  const history = useHistory();
  const orgSlug = useOrgSlug();

  return (
    <Downshift
      onChange={(node, { reset, clearSelection }) => {
        clearSelection();
        reset();
        if (node) {
          switch (node.__typename) {
            case 'Need':
              history.push(`/${orgSlug}/need/${node.nodeId}`);
              break;
            case 'Responsibility':
              history.push(`/${orgSlug}/${node.nodeId}`);
              break;
            case 'Person':
              history.push(`/${orgSlug}/profile/${node.nodeId}`);
              break;
            default:
              history.push(`/${orgSlug}`);
          }
        }
      }}
      itemToString={(i) => (i && i.title) || ''}
    >
      {({
        getRootProps,
        getInputProps,
        getMenuProps,
        getItemProps,
        inputValue,
        highlightedIndex,
        isOpen,
        reset,
      }) => (
        <Wrapper {...getRootProps({ refKey: 'innerRef' })}>
          <SearchBar
            onClear={() => reset()}
            {...getInputProps({ onBlur: (e) => e.preventDefault() })}
          />
          {isOpen && (
          <SearchResultsContainer
            searchTerm={inputValue}
            getMenuProps={getMenuProps}
            getItemProps={getItemProps}
            highlightedIndex={highlightedIndex}
          />
          )}
        </Wrapper>
      )}
    </Downshift>
  );
};

export default Search;
