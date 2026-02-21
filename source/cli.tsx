#!/usr/bin/env bun
import React from 'react';
import {render} from 'ink';
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

render(<App />);
