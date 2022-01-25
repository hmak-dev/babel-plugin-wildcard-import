module.exports = (api) => {
    api.cache(true);

    return {
        presets: [['@babel/preset-env', { modules: 'cjs', targets: { node: true } }]],
				plugins: [
						[
								'../index.js',
								{ changeExtensions: { enabled: true, extensions: { ts: 'js' } } },
						],
				],
    };
};
