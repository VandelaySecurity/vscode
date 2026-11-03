/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { exec, spawn, type ExecOptionsWithStringEncoding, type SpawnOptionsWithoutStdio } from 'node:child_process';
import type { ICompletionResource } from '../types';

/**
 * SECURITY: The command parameter is restricted to known shells. If args contains
 * user-controlled input, callers MUST sanitize or validate it to prevent injection.
 */
export async function spawnHelper(command: string, args: string[], options: SpawnOptionsWithoutStdio): Promise<string> {
	const ALLOWED_SHELLS = ['bash', 'zsh', 'sh', 'fish', 'pwsh', 'powershell', 'cmd.exe', 'cmd'];
	if (!ALLOWED_SHELLS.includes(command)) {
		throw new Error(`Command not allowed: ${command}. Only known shells are permitted.`);
	}
	if (options.shell === true) {
		throw new Error('Shell option must not be enabled to prevent command injection.');
	}
	// This must be run with interactive, otherwise there's a good chance aliases won't
	// be set up. Note that this could differ from the actual aliases as it's a new bash
	// session, for the same reason this would not include aliases that are created
	// by simply running `alias ...` in the terminal.
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, options);
		let stdout = '';
		child.stdout.on('data', (data) => {
			stdout += data;
		});
		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`process exited with code ${code}`));
			} else {
				resolve(stdout);
			}
		});
	});
}

export interface ISpawnHelperResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}
/**
 * SECURITY: The command parameter is restricted to known shells. If args contains
 * user-controlled input, callers MUST sanitize or validate it to prevent injection.
 */
export async function spawnHelper2(command: string, args: string[], options: SpawnOptionsWithoutStdio): Promise<ISpawnHelperResult> {
	const ALLOWED_SHELLS = ['bash', 'zsh', 'sh', 'fish', 'pwsh', 'powershell', 'cmd.exe', 'cmd'];
	if (!ALLOWED_SHELLS.includes(command)) {
		throw new Error(`Command not allowed: ${command}. Only known shells are permitted.`);
	}
	if (options.shell === true) {
		throw new Error('Shell option must not be enabled to prevent command injection.');
	}
	// This must be run with interactive, otherwise there's a good chance aliases won't
	// be set up. Note that this could differ from the actual aliases as it's a new bash
	// session, for the same reason this would not include aliases that are created
	// by simply running `alias ...` in the terminal.
	return new Promise<ISpawnHelperResult>((resolve, reject) => {
		const stdout: string[] = [];
		const stderr: string[] = [];
		const child = spawn(command, args, options);
		child.stdout.on('data', (data) => stdout.push(data));
		child.stderr.on('data', (data) => stderr.push(data));
		child.on('error', (error) => reject(error));
		child.on('close', (code) => {
			resolve({
				stdout: stdout.join(''),
				stderr: stderr.join(''),
				exitCode: code ?? -1
			});
		});
	});
}

export async function execHelper(commandLine: string, options: ExecOptionsWithStringEncoding): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		exec(commandLine, options, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});
}

export async function getAliasesHelper(command: string, args: string[], regex: RegExp, options: ExecOptionsWithStringEncoding): Promise<ICompletionResource[]> {
	// This must be run with interactive, otherwise there's a good chance aliases won't
	// be set up. Note that this could differ from the actual aliases as it's a new bash
	// session, for the same reason this would not include aliases that are created
	// by simply running `alias ...` in the terminal.
	const aliasOutput = await spawnHelper(command, args, options);
	const result: ICompletionResource[] = [];
	for (const line of aliasOutput.split('\n')) {
		const match = line.match(regex);
		if (!match?.groups) {
			continue;
		}
		let definitionCommand = '';
		let definitionIndex = match.groups.resolved.indexOf(' ');
		if (definitionIndex === -1) {
			definitionIndex = match.groups.resolved.length;
		}
		definitionCommand = match.groups.resolved.substring(0, definitionIndex);
		result.push({
			label: { label: match.groups.alias, description: match.groups.resolved },
			detail: match.groups.resolved,
			kind: vscode.TerminalCompletionItemKind.Alias,
			definitionCommand,
		});
	}
	return result;
}

