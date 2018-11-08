import React, { Component } from 'react';
//import logo from './assets/logo.svg';
import { ErrorBoundary } from './app/components/error-boundary';
import { Overview } from './app/views/overview';
import './App.css';

class App extends Component {
	render() {
		return (
			<ErrorBoundary>
				<Overview />
				{/*
				<div className="App">
					<header className="App-header">
						<img src={logo} className="App-logo" alt="logo" />
						<p>
							Edit <code>src/App.tsx</code> and save to reload.
						</p>
						<a
							className="App-link"
							href="https://reactjs.org"
							target="_blank"
							rel="noopener noreferrer"
						>
							Learn React
						</a>
					</header>
				</div>
				*/}
			</ErrorBoundary>
		);
	}
}

export default App;
