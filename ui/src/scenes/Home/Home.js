import React from 'react';
import gql from 'graphql-tag';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import {
  Container,
  Row,
  Col,
} from 'reactstrap';
import NeedsList from './components/NeedsList';
import ResponsibilitiesList from './components/ResponsibilitiesList';

class Home extends React.Component {
  constructor() {
    super();

    this.state = { selectedNeed: null, selectedResponsibility: null };
    this.onSelectNeed = this.onSelectNeed.bind(this);
  }

  onSelectNeed(need) {
    this.setState({ selectedNeed: need });
  }

  render() {
    const { data } = this.props;
    const { needs } = data;
    return (
      <Container fluid>
        <Row>
          <Col>
            <h1>Home</h1>
          </Col>
        </Row>
        <Row>
          <Col>
            <NeedsList needs={needs} onSelectNeed={this.onSelectNeed} />
          </Col>
          <Col>
            <ResponsibilitiesList
              responsibilities={this.state.selectedNeed && this.state.selectedNeed.fulfilledBy}
            />
          </Col>
        </Row>
      </Container>
    );
  }
}

Home.defaultProps = {
  data: {
    needs: [],
  },
};

Home.propTypes = {
  data: PropTypes.shape({
    needs: PropTypes.array,
  }),
};

export default graphql(gql`
  query {
    needs {
      title
      description
      fulfilledBy {
        title
        description
      }
    }
  }
`)(Home);