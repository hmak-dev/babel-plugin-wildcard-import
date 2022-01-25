const fs = require('fs');
const path = require('path');

function readDir(root, route, dirInfo = true, changeExtension = null) {
	const outputFiles = [];

	const files = fs.readdirSync(root);

	for (let file of files) {
		const filename = `${root}/${file}`;
		const parsedFile = path.parse(file);

		if (fs.statSync(filename).isDirectory()) {
			outputFiles.push({
				type: 'dir',
				base: parsedFile.base,
				ext: parsedFile.ext,
				name: parsedFile.name,
				dir: route,
				path: `${route}/${file}`,
				filename,
				files: readDir(filename, `${route}/${file}`, false, changeExtension),
			});
		} else {
			let ext = parsedFile.ext;
			let base = parsedFile.base;

			if (changeExtension) {
				if (changeExtension[ext.substring(1)]) {
					ext = `.${changeExtension[ext.substring(1)]}`;
					base = `${parsedFile.name}${ext}`;
				}
			}

			outputFiles.push({
				type: 'file',
				originalBase: parsedFile.base,
				originalExt: parsedFile.ext,
				base,
				ext,
				name: parsedFile.name,
				dir: route,
				path: `${route}/${base}`,
				filename,
			});
		}
	}

	if (dirInfo) {
		const parsedDir = path.parse(route);

		return {
			type: 'dir',
			base: parsedDir.base,
			ext: parsedDir.ext,
			name: parsedDir.name,
			dir: parsedDir.dir,
			path: route,
			filename: root,
			files: outputFiles,
		}
	}

	return outputFiles;
}

module.exports = (babel) => {
	const { types: t } = babel;

	function createObject(code, name) {
		const variable = t.identifier(name);

		code.insertBefore(
			t.variableDeclaration(
				'const',
				[t.variableDeclarator(variable, t.objectExpression([]))]
			)
		);

		return variable;
	}

	function createMemberObject(code, object, name) {
		const memberExpression = t.memberExpression(object, t.stringLiteral(name), true);

		code.insertBefore(
			t.expressionStatement(
				t.assignmentExpression(
					'=',
					memberExpression,
					t.objectExpression([])
				)
			)
		);

		return memberExpression;
	}

	function importFile(code, name, file) {
		code.insertBefore(
			t.importDeclaration(
				[t.importDefaultSpecifier(t.identifier(name))],
				t.stringLiteral(file)
			)
		);
	}

	function importMemberFile(code, object, file, name) {
		const id = code.scope.generateUidIdentifier('drimp');

		code.insertBefore(
			t.importDeclaration(
				[t.importDefaultSpecifier(id)],
				t.stringLiteral(file.path)
			)
		);

		code.insertBefore(
			t.expressionStatement(
				t.assignmentExpression(
					'=',
					t.memberExpression(object, t.stringLiteral(name), true),
					id
				)
			)
		);
	}

	function importDirectory(code, directory, object, depth = 0) {
		if (!object) { // No Object Name
			directory.files.forEach((file) => {
				if (file.type === 'file') {
					code.insertAfter(
						t.importDeclaration([], t.stringLiteral(file.path))
					);
				} else {
					importDirectory(code, file, null, depth + 1);
				}
			});
		} else {
			const memberExpression = t.memberExpression(object, t.stringLiteral('__import_depth'), true);

			code.insertBefore(
				t.expressionStatement(
					t.assignmentExpression(
						'=',
						memberExpression,
						t.numericLiteral(depth)
					)
				)
			);

			directory.files.forEach((file) => {
				if (file.type === 'file') {
					importMemberFile(code, object, file, file.name);
				} else {
					const indexFile = file.files.find((file) => file.type === 'file' && /^index\.(ts|js)x?/.test(file.base));

					if (indexFile) { // Import Index File
						importMemberFile(code, object, indexFile, file.name)
					} else { // Import Whole Directory
						importDirectory(code, file, createMemberObject(code, object, file.name), depth + 1);
					}
				}
			});
		}
	}

	return {
		visitor: {
			ImportDeclaration(code, state) {
				const { node } = code;

				const importPath = node.source.value;
				const absoluteImportPath = path.resolve(path.dirname(state.file.opts.filename), importPath);

				// Check if it exists and it is a directory
				if (fs.existsSync(absoluteImportPath) && fs.lstatSync(absoluteImportPath).isDirectory()) {
					const hasIndexFile = fs.readdirSync(absoluteImportPath).filter((file) => /^index\.(ts|js)x?/.test(file)).length > 0;

					if (!hasIndexFile) {
						const changeExtensions = state.opts?.changeExtensions?.enabled ? state.opts.changeExtensions.extensions : undefined;

						// TODO: Integrate Glob Patterns
						const dir = readDir(absoluteImportPath, importPath, true, changeExtensions);

						if (node.specifiers.length === 0) { // Simple Import
							importDirectory(code, dir);
						} else {
							node.specifiers.forEach((spec) => {
								if (t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)) { // Directory Import
									importDirectory(code, dir, createObject(code, spec.local.name));
								} else if (t.isImportSpecifier(spec)) { // Named Module Import
									// Check For File Or Directory
									let target = dir.files.find((file) => file.name === spec.imported.name);

									if (target) {
										if (target.type === 'file') { // Import File
											importFile(code, spec.local.name, target.path);
										} else { // Import Directory
											const indexFile = target.files.find((file) => file.type === 'file' && /^index\.(ts|js)x?/.test(file.base));

											if (indexFile) { // Import Index File
												importFile(code, spec.local.name, indexFile.path);
											} else { // Import Whole Directory
												importDirectory(code, target, createObject(code, spec.local.name));
											}
										}
									} else {
										throw new Error(`Module not Found: '${spec.imported.name}'`);
									}
								}
							});
						}

						code.remove();
					}
				}
			},
		},
	};
};
