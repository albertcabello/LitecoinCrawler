import * as React from 'react';

export class ErrorBoundary extends React.Component<{children?: any}, {hasError: boolean}> {
	
	constructor(props) {
		super(props);
		this.state = {hasError: false}
	}

	componentDidCatch(error, info) {
		this.setState({ hasError: true});
		console.log('ErrorBoundary trigger!');
		console.log(error);
		console.log(info);
	}

	render() {
		if (this.state.hasError) {
			return (<span>There is an error!</span>);
		}
		return this.props.children;
	}
}
