import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp, useStdout} from 'ink';
import {type Agent} from '../lib/agents.js';
import {
	readAllSessions,
	formatRelativeTime,
	type Session,
} from '../lib/sessions.js';
import SessionActions from './SessionActions.js';

type Props = {
	agents: Agent[];
	onExec: (command: string) => void;
};

type View = 'list' | 'actions';

const OVERHEAD = 8;

export default function Dashboard({agents, onExec}: Props) {
	const {exit} = useApp();
	const {stdout} = useStdout();
	const [sessions, setSessions] = useState<Session[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [windowStart, setWindowStart] = useState(0);
	const [view, setView] = useState<View>('list');
	const [activeSession, setActiveSession] = useState<Session | null>(null);

	const visibleCount = Math.max(5, (stdout?.rows ?? 24) - OVERHEAD);

	useEffect(() => {
		setSessions(readAllSessions());
	}, []);

	useEffect(() => {
		if (selectedIndex < windowStart) {
			setWindowStart(selectedIndex);
		} else if (selectedIndex >= windowStart + visibleCount) {
			setWindowStart(selectedIndex - visibleCount + 1);
		}
	}, [selectedIndex, visibleCount, windowStart]);

	useInput((input, key) => {
		if (view !== 'list') return;

		if (input === 'q' || key.escape) {
			exit();
		}

		if (key.upArrow) {
			setSelectedIndex(i => Math.max(0, i - 1));
		}

		if (key.downArrow) {
			setSelectedIndex(i => Math.min(sessions.length - 1, i + 1));
		}

		if (key.return && sessions[selectedIndex]) {
			setActiveSession(sessions[selectedIndex]!);
			setView('actions');
		}
	});

	if (view === 'actions' && activeSession) {
		return (
			<SessionActions
				session={activeSession}
				agents={agents}
				onBack={() => setView('list')}
				onExec={onExec}
			/>
		);
	}

	const visibleSessions = sessions.slice(
		windowStart,
		windowStart + visibleCount,
	);
	const itemsAbove = windowStart;
	const itemsBelow = sessions.length - (windowStart + visibleCount);

	return (
		<Box flexDirection="column" gap={1}>
			{/* Header */}
			<Box gap={2}>
				<Text color="cyan" bold>
					synctx
				</Text>
				<Box gap={1}>
					{agents.map(a => (
						<Box key={a.name} gap={1}>
							<Text color="green">●</Text>
							<Text dimColor>{a.name}</Text>
						</Box>
					))}
				</Box>
			</Box>

			{/* Session list */}
			<Box flexDirection="column">
				<Text dimColor bold>
					Recent sessions
				</Text>

				{itemsAbove > 0 && <Text dimColor> ↑ {itemsAbove} more</Text>}

				{sessions.length === 0 ? (
					<Text dimColor>No sessions found</Text>
				) : (
					visibleSessions.map((session, i) => {
						const absoluteIndex = windowStart + i;
						const isSelected = absoluteIndex === selectedIndex;
						return (
							<Box key={session.sessionId} gap={2}>
								<Text color={isSelected ? 'cyan' : 'gray'}>
									{isSelected ? '❯' : ' '}
								</Text>
								<Box width={28}>
									<Text bold={isSelected} wrap="truncate">
										{session.title}
									</Text>
								</Box>
								<Box width={10}>
									<Text dimColor>{formatRelativeTime(session.lastActive)}</Text>
								</Box>
								<Box width={10}>
									<Text dimColor>{session.messageCount} msgs</Text>
								</Box>
								<Text dimColor>{session.agentName}</Text>
							</Box>
						);
					})
				)}

				{itemsBelow > 0 && <Text dimColor> ↓ {itemsBelow} more</Text>}
			</Box>

			{/* Footer */}
			<Text dimColor>↑↓ navigate · enter select · q quit</Text>
		</Box>
	);
}
