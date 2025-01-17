import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface VSCExpressCommandResponsePayload {
	code: number;
	result?: any;
	message?: string;
}

export class VSCExpress {
	static webviewPanelList: { [uri: string]: vscode.WebviewPanel } = {};
	private _webRootAbsolutePath: string;

	constructor(context: vscode.ExtensionContext, webRootPath: string) {
		this._webRootAbsolutePath = path.join(context.extensionPath, webRootPath);
	}

	/**
	 * Open a specific page in VS Code
	 *
	 * @param path The relative path of the page in web root.
	 * @param title The title of the page. The default is an empty string.
	 * @param viewColumn The view column to open the page in. The default is
	 * vscode.ViewColumn.Two.
	 */
	open(
		filePath: string, title = '',
		viewColumn: vscode.ViewColumn = vscode.ViewColumn.Two,
		options?: vscode.WebviewPanelOptions & vscode.WebviewOptions) {
		options = {
			enableScripts: true, enableCommandUris: true, localResourceRoots: [
				vscode.Uri.file(path.join(this._webRootAbsolutePath, 'dist/nuget-ui'))
			]
		};

		filePath = path.join(this._webRootAbsolutePath, filePath);
		const context =
			new VSCExpressPanelContext(this._webRootAbsolutePath, filePath, title, viewColumn, options);

		return context.panel;
	}

	close(filePath: string) {
		filePath = path.join(this._webRootAbsolutePath, filePath);
		if (VSCExpress.webviewPanelList[filePath]) {
			VSCExpress.webviewPanelList[filePath].dispose();
			delete VSCExpress.webviewPanelList[filePath];
		}
	}
}

export class VSCExpressPanelContext {
	private filePath: string;
	private title: string | undefined;
	private viewColumn: vscode.ViewColumn;
	private options: vscode.WebviewOptions;

	panel: vscode.WebviewPanel;

	constructor(
		_webRootAbsolutePath: string,
		filePath: string, title?: string, viewColumn?: vscode.ViewColumn,
		options?: vscode.WebviewPanelOptions & vscode.WebviewOptions) {

		filePath = filePath.split('#')[0];
		filePath = filePath.split('?')[0];

		this.filePath = filePath;
		this.title = title || filePath;
		this.viewColumn = viewColumn || vscode.ViewColumn.Two;
		this.options = options || {};


		let html = fs.readFileSync(filePath, 'utf8');


		if (!VSCExpress.webviewPanelList[this.filePath]) {
			this.panel = vscode.window.createWebviewPanel(
				'VSCExpress', this.title, this.viewColumn, this.options);


			const onDiskPath = vscode.Uri.file(
				path.join(_webRootAbsolutePath, 'dist/nuget-ui/')
			);
			const basePath = this.panel.webview.asWebviewUri(onDiskPath);

			if (/(<head(\s.*)?>)/.test(html)) {
				html = html.replace(
					/(<head(\s.*)?>)/,
					`$1<base href="${basePath.toString()}">`);
			} else if (/(<html(\s.*)?>)/.test(html)) {
				html = html.replace(
					/(<html(\s.*)?>)/,
					`$1<head><base href="${basePath.toString()}"></head>`);
			} else {
				html = `<head><base href="${basePath.toString()}"></head>${html}`;
			}

			this.panel.webview.html = html;
			this.panel.webview.onDidReceiveMessage(async message => {
				const payload: VSCExpressCommandResponsePayload = { code: 0 };
				try {
					const result = await vscode.commands.executeCommand.apply(
						null, [message.command as string, ...message.parameter]);
					payload.result = result;
				} catch (error: any) {
					payload.message = error.message;
				}
				this.panel.webview.postMessage({ messageId: message.messageId, payload });
			});
			this.panel.onDidDispose(() => {
				delete VSCExpress.webviewPanelList[this.filePath];
			}, this);
			VSCExpress.webviewPanelList[this.filePath] = this.panel;
		} else {
			this.panel = VSCExpress.webviewPanelList[this.filePath];
			this.panel.title = this.title;
			this.panel.webview.html = html;
		}
	}
}