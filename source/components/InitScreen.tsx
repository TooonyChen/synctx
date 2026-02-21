import React, {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import {detectAgents, saveDetectedAgents, type Agent} from '../lib/agents.js';
import {getDb} from '../lib/db.js';

type Props = {
	onDone: (agents: Agent[]) => void;
};

type Step = 'detecting' | 'saving' | 'done';

export default function InitScreen({onDone}: Props) {
	const [step, setStep] = useState<Step>('detecting');
	const [agents, setAgents] = useState<Agent[]>([]);
	const [current, setCurrent] = useState<string>('');

	useEffect(() => {
		async function init() {
			// Init DB
			getDb();

			// Detect agents one by one for live feedback
			setStep('detecting');
			const found: Agent[] = [];

			const detected = detectAgents();

			for (const agent of detected) {
				setCurrent(agent.name);
				found.push(agent);
				setAgents([...found]);
				// Small delay for visual feedback
				await new Promise(r => setTimeout(r, 120));
			}

			setStep('saving');
			saveDetectedAgents(found);

			await new Promise(r => setTimeout(r, 300));
			setStep('done');
			onDone(found);
		}

		void init();
	}, []);

	return (
		<Box flexDirection="column" gap={1}>
			<Box gap={1}>
				<Text color="cyan" bold>
					synctx
				</Text>
				<Text dimColor>— first run setup</Text>
			</Box>

			<Box flexDirection="column">
				<Text dimColor>Detecting installed agents...</Text>
				{agents.map(agent => (
					<Box key={agent.name} gap={1}>
						<Text color="green">✓</Text>
						<Text>{agent.name}</Text>
						<Text dimColor>{agent.version}</Text>
					</Box>
				))}
				{step === 'detecting' && current && (
					<Box gap={1}>
						<Text color="yellow">○</Text>
						<Text dimColor>{current}</Text>
					</Box>
				)}
			</Box>

			{step === 'saving' && <Text dimColor>Saving...</Text>}
		</Box>
	);
}
