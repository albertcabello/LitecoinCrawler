import * as React from 'react';
import { Navbar } from '../../components/navbar';
import { HealthMonitor } from '../../components/health-monitor';
import styles from './index.module.css';

export class Overview extends React.Component<{}, {}> {
	
	render() {
		return (
			<div className={styles['overview']}>
				<Navbar />
				<div className={styles['content']}>
					<HealthMonitor />
				</div>
			</div>
		);
	}

}

