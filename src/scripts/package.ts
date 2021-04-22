#! /usr/bin/env ts-node

import { traceFile } from 'trace-deps';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs-extra';

(async () => {
	const traceResult = await traceFile({
		srcPath: 'dist/lambda.js',
		allowMissing: {
			'node-fetch': ['encoding'],
		},
	});

	const zip = new AdmZip();
	traceResult.dependencies.forEach((dep) => {
		zip.addLocalFile(dep, path.relative(process.cwd(), path.dirname(dep)));
	});

	zip.addLocalFile('dist/lambda.js');
	zip.addLocalFile('dist/lambda.js.map');

	zip.writeZip('dist/lambda.zip');

	fs.unlinkSync('dist/lambda.js');
	fs.unlinkSync('dist/lambda.js.map');
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
