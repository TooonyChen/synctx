import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {type Session} from '../lib/sessions.js';
import {type Agent} from '../lib/agents.js';

type Props = {
	session: Session;
	agents: Agent[];
	onBack: () => void;
};

type Action = {
	label: string;
	description: string;
	handler: () => void;
};

export default function SessionActions({session, agents, onBack}: Props) {
	const [selectedIndex, setSelectedIndex] = useState(0);

	const actions: Action[] = [
		...agents.map(agent => ({
			label: `Resume in ${agent.name}`,
			description: agent.version,
			handler: () => {
				// TODO: implement write/inject logic
			},
		})),
		{
			label: 'Cancel',
			description: '',
			handler: onBack,
		},
	];

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			onBack();
			return;
		}

		if (key.upArrow) {
			setSelectedIndex(i => Math.max(0, i - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(i => Math.min(actions.length - 1, i + 1));
		}

		if (key.return) {
			actions[selectedIndex]?.handler();
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			{/* Session info */}
			<Box flexDirection="column">
				<Box gap={2}>
					<Text color="cyan" bold>synctx</Text>
					<Text dimColor>session selected</Text>
				</Box>
				<Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
					<Box gap={2}>
						<Text bold wrap="truncate">{session.title}</Text>
					</Box>
					<Box gap={2}>
						<Text dimColor>{session.agentName}</Text>
						<Text dimColor>·</Text>
						<Text dimColor>{session.messageCount} messages</Text>
						<Text dimColor>·</Text>
						<Text dimColor>{session.projectName}</Text>
					</Box>
				</Box>
			</Box>

			{/* Actions */}
			<Box flexDirection="column">
				{actions.map((action, i) => {
					const isSelected = i === selectedIndex;
					return (
						<Box key={action.label} gap={2}>
							<Text color={isSelected ? 'cyan' : 'gray'}>
								{isSelected ? '❯' : ' '}
							</Text>
							<Text bold={isSelected} color={action.label === 'Cancel' ? 'gray' : undefined}>
								{action.label}
							</Text>
							{action.description && (
								<Text dimColor>{action.description}</Text>
							)}
						</Box>
					);
				})}
			</Box>

			<Text dimColor>↑↓ navigate · enter select · esc back</Text>
		</Box>
	);
}
