import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as fs from 'fs-extra';
import axios from 'axios';
import { parse, j2xParser } from 'fast-xml-parser';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "maven-studio" is now active!');

	const disposable = vscode.commands.registerCommand('maven-studio.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Maven Studio!');
	});

	const disposableInstall = vscode.commands.registerCommand('maven-studio.install', async () => {
		const artifactId = await vscode.window.showInputBox({ prompt: 'Enter Artifact ID' });
		if (artifactId) {
			try {
				const dependency = await fetchMavenDependency(artifactId);
				if (dependency) {
					modifyPomXml('install', dependency);
				} else {
					vscode.window.showErrorMessage(`Could not find dependency for artifactId: ${artifactId}`);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Error fetching dependency: ${(error as any).message}`);
			}
		}
	});

	const disposableUpdate = vscode.commands.registerCommand('maven-studio.update', async () => {
		const artifactId = await vscode.window.showInputBox({ prompt: 'Enter Artifact ID' });
		if (artifactId) {
			try {
				const dependency = await fetchMavenDependency(artifactId);
				if (dependency) {
					modifyPomXml('update', dependency);
				} else {
					vscode.window.showErrorMessage(`Could not find dependency for artifactId: ${artifactId}`);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Error fetching dependency: ${(error as any).message}`);
			}
		}
	});

	const disposableUninstall = vscode.commands.registerCommand('maven-studio.uninstall', async () => {
		const artifactId = await vscode.window.showInputBox({ prompt: 'Enter Artifact ID' });
		if (artifactId) {
			modifyPomXml('uninstall', { groupId: '', artifactId });
		}
	});

	// context.subscriptions.push(disposableHello, disposableAdd, disposableUpdate, disposableRemove);

	context.subscriptions.push(disposable, disposableInstall, disposableUpdate, disposableUninstall);
}

async function fetchMavenDependency(artifactId: string) {
	const url = `https://search.maven.org/solrsearch/select?q=a:"${artifactId}"&rows=1&wt=json`;
	const response = await axios.get(url);
	if (response.data.response.docs.length > 0) {
		const doc = response.data.response.docs[0];
		return {
			groupId: doc.g,
			artifactId: doc.a,
			version: doc.latestVersion
		};
	}
	return null;
}


function modifyPomXml(action: 'install' | 'update' | 'uninstall', dependency: { groupId: string, artifactId: string, version?: string }) {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const document = editor.document;
		if (document.fileName.endsWith('pom.xml')) {
			fs.readFile(document.fileName, (err, data) => {
				if (err) {
					vscode.window.showErrorMessage('Failed to read pom.xml');
					return;
				}
				xml2js.parseString(data, (err, result) => {
					if (err) {
						vscode.window.showErrorMessage('Failed to parse pom.xml');
						return;
					}

					const dependencies = result.project.dependencies[0].dependency || [];
					if (action === 'install' || action === 'update') {
						const existingDependency = dependencies.find((dep: any) =>
							dep.groupId[0] === dependency.groupId && dep.artifactId[0] === dependency.artifactId);

						if (existingDependency) {
							existingDependency.version[0] = dependency.version;
						} else {
							dependencies.push({
								groupId: [dependency.groupId],
								artifactId: [dependency.artifactId],
								version: [dependency.version]
							});
						}
					} else if (action === 'uninstall') {
						result.project.dependencies[0].dependency = dependencies.filter((dep: any) =>
							!(dep.groupId[0] === dependency.groupId && dep.artifactId[0] === dependency.artifactId));
					}

					const builder = new xml2js.Builder();
					const updatedXml = builder.buildObject(result);
					fs.writeFile(document.fileName, updatedXml, (err) => {
						if (err) {
							vscode.window.showErrorMessage('Failed to write to pom.xml');
							return;
						}
						vscode.window.showInformationMessage(`Dependency ${action}ed successfully`);
						document.save();
					});
				});
			});
		} else {
			vscode.window.showErrorMessage('Open a pom.xml file to modify Maven dependencies.');
		}
	} else {
		vscode.window.showErrorMessage('No active editor found.');
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
