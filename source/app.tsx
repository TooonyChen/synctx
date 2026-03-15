import React, {useState} from 'react';
import {type Agent, getStoredAgents} from './lib/agents.js';
import {isFirstRun} from './lib/db.js';
import InitScreen from './components/InitScreen.js';
import Dashboard from './components/Dashboard.js';

type Screen = 'init' | 'dashboard';

type Props = {
	onExec: (command: string) => void;
};

export default function App({onExec}: Props) {
	const firstRun = isFirstRun();
	const [screen, setScreen] = useState<Screen>(firstRun ? 'init' : 'dashboard');
	const [agents, setAgents] = useState<Agent[]>(() =>
		firstRun ? [] : getStoredAgents(),
	);

	if (screen === 'init') {
		return (
			<InitScreen
				onDone={detected => {
					setAgents(detected);
					setScreen('dashboard');
				}}
			/>
		);
	}

	return <Dashboard agents={agents} onExec={onExec} />;
}
