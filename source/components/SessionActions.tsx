import React, {useState} from 'react';
import {execSync} from 'node:child_process';
import {Box, Text, useInput} from 'ink';
import {type Session} from '../lib/sessions.js';
import {type Agent} from '../lib/agents.js';
import {readSessionMessages} from '../lib/readers/index.js';
import {getWriter} from '../lib/writers/index.js';
import {getResumeCommand} from '../lib/resume.js';

type Props = {
	session: Session;
	agents: Agent[];
	onBack: () => void;
	onExec: (command: string) => void;
};

type Action = {
	label: string;
	description: string;
	handler: () => void;
};

export default function SessionActions({
	session,
	agents,
	onBack,
	onExec,
}: Props) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [status, setStatus] = useState('');

	const actions: Action[] = [
		...agents.map(agent => ({
			label: `Resume in ${agent.name}`,
			description: agent.version,
			handler: () => {
				// Same-agent shortcut: just resume directly
				if (session.agentName === agent.name) {
					const cmd = getResumeCommand(agent.name, session.sessionId);
					if (cmd) onExec(cmd);
					return;
				}

				// Cross-agent: read → write → exec
				setStatus(`Writing to ${agent.name}...`);

				try {
					const messages = readSessionMessages(session);
					if (messages.length === 0) {
						setStatus('No messages found in session');
						return;
					}

					const writer = getWriter(agent.name);
					if (!writer) {
						setStatus(`No writer available for ${agent.name}`);
						return;
					}

					const normalized = {source: session, messages};

					void writer
						.writeSession(normalized, session.projectPath)
						.then(result => {
							onExec(result.resumeCommand);
						})
						.catch((error: unknown) => {
							const msg =
								error instanceof Error ? error.message : String(error);
							setStatus(`Error: ${msg}`);
						});
				} catch (error: unknown) {
					const msg = error instanceof Error ? error.message : String(error);
					setStatus(`Error: ${msg}`);
				}
			},
		})),
		{
			label: 'Copy Session ID',
			description: session.sessionId,
			handler: () => {
				try {
					execSync(`printf '%s' ${JSON.stringify(session.sessionId)} | pbcopy`);
					setStatus('Copied to clipboard!');
					setTimeout(() => setStatus(''), 1500);
				} catch {
					setStatus(`Session ID: ${session.sessionId}`);
				}
			},
		},
		{
			label: 'Cancel',
			description: '',
			handler: onBack,
		},
	];

	useInput((input, key) => {
		if (status) return;

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
					<Text color="cyan" bold>
						synctx
					</Text>
					<Text dimColor>session selected</Text>
				</Box>
				<Box
					flexDirection="column"
					borderStyle="round"
					borderColor="gray"
					paddingX={1}
					marginTop={1}
				>
					<Box gap={2}>
						<Text bold wrap="truncate">
							{session.title}
						</Text>
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
							<Text
								bold={isSelected}
								color={action.label === 'Cancel' ? 'gray' : undefined}
							>
								{action.label}
							</Text>
							{action.description && <Text dimColor>{action.description}</Text>}
						</Box>
					);
				})}
			</Box>

			{status ? (
				<Text color="yellow">{status}</Text>
			) : (
				<Text dimColor>↑↓ navigate · enter select · esc back</Text>
			)}
		</Box>
	);
}
