#!/usr/bin/env bun
import React from 'react';
import {render} from 'ink';
import {execSync} from 'node:child_process';
import meow from 'meow';
import App from './app.js';

meow(
	`
  Usage
    $ synctx

  Commands
    watch   Watch all agent sessions in real time

  Examples
    $ synctx
    $ synctx watch
`,
	{
		importMeta: import.meta,
	},
);

let execCmd = '';

const {waitUntilExit, unmount} = render(
	<App
		onExec={cmd => {
			execCmd = cmd;
			unmount();
		}}
	/>,
);

await waitUntilExit();

if (execCmd) {
	execSync(execCmd, {stdio: 'inherit'});
}
