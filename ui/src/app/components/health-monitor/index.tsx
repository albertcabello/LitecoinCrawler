import * as React from 'react';
import styles from './index.module.css';

export class HealthMonitor extends React.Component<{}, {crawler: {crawlerHealth: boolean, crawlerEfficiency: number, crawlerCount: number},
							listener: {listenerHealth: boolean, listenerCount: number} }> {
	
	constructor(props) {
		super(props);
		this.state = {crawler: {crawlerHealth: false, crawlerEfficiency: -1, crawlerCount: -1}, 
			      listener: {listenerHealth: false, listenerCount: -1}
			     };
	}

	componentDidMount() {
		let me = this;
		fetch('http://camp-us-02.cis.fiu.edu:7332/efficiency').then(function(response) {
			if (response.status == 200) {
				return response.json();
			}
			else {
				return {error: 'DivByZero'}
			}
		}).then(function(json) {
			if (json.hasOwnProperty('error')) {
				me.setState({crawler: {crawlerHealth: false, crawlerEfficiency: -1, crawlerCount: -1}, listener: me.state.listener});
			}
			else {
				me.setState({crawler: {crawlerHealth: true, crawlerEfficiency: json.efficiency, crawlerCount: json.count}, listener: me.state.listener});
			}
		}).catch(function() {
			me.setState({crawler: {crawlerHealth: false, crawlerEfficiency: -1, crawlerCount: -1}, listener: me.state.listener});
		});

		fetch('http://camp-us-02.cis.fiu.edu:7331/count').then(function(response) {
			return response.json();
		}).then(function(json) {	
			me.setState({crawler: me.state.crawler, listener: {listenerHealth: true, listenerCount: json.count}});
		}).catch(function(err) {
			console.log("ERR", err);
			me.setState({crawler: me.state.crawler, listener: {listenerHealth: false, listenerCount: -1}});
		});	
		
	}

	render() {
		return (
			<div>
				<div className={styles['item']} style={{float: 'left'}}>
					<div className={styles['title']}>Crawler Overview</div>
					<div className={ this.state.crawler.crawlerHealth ? styles['success'] : styles['error']}>
						<div>Crawler Health: <b>{ this.state.crawler.crawlerHealth ? "Up!" : "Down :(" }</b></div>
						<div>Crawler Efficiency: <b>{this.state.crawler.crawlerEfficiency == -1 ? "NA" : this.state.crawler.crawlerEfficiency}</b></div>
					</div>
					<div> 
						<div>Crawler Connection Count: <b>{this.state.crawler.crawlerCount == -1 ? "NA" : this.state.crawler.crawlerCount}</b></div>
					</div>
				</div>
				<div className={styles['item']} style={{float: 'right'}}>
					<div className={styles['title']}>Listener Overview</div>
					<div className={ this.state.listener.listenerHealth ? styles['success'] : styles['error']}>
						<div>Listener Health: <b>{ this.state.listener.listenerHealth ? "Up!" : "Down :("}</b></div>
						<div>Listener Connections: <b>{this.state.listener.listenerCount == -1 ? "NA" : this.state.listener.listenerCount}</b></div>
					</div>
				</div>
			</div>
		);
	}
}
