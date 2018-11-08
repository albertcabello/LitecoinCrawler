import * as React from 'react';
import styles from './index.module.css';

export class Navbar extends React.Component<{}, {}> {
	
	render() {
		return (
			<div className={styles['title']}>
				<div className={styles['name']}>
					<span>Overseer</span>
				</div>
			</div>
		);
	}

}
