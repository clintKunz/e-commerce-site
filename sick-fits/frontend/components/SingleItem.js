import React, { Component } from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

const SINGLE_ITEM_QUERY = gql`
    query SINGLE_ITEM_QUERY($id: ID!) {
        item(where: { id: $id }) {
            id 
            title 
            description 
            largeImage
        }
    }
`;

class SingleItem extends Component {
    render() {
        return (
            <div>{this.props.id}</div>
        );
    }
}

export default SingleItem;